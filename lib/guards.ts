import type { LedgerRow, PermissionAction, PermissionMap, PermissionModule, Role, SessionCompany, SessionUser } from './types'
import { hasPermission } from './permissions'

export const canBypassLock = (user: Pick<SessionUser, 'role' | 'bypass_entry_lock'> | null | undefined) =>
  Boolean(user && (user.role === 'SUPER_ADMIN' || user.role === 'COMPANY_ADMIN' || user.bypass_entry_lock))

export const recordAgeLocked = (row: Pick<LedgerRow, 'voucher_date' | 'created_at'>) => {
  const created = new Date(row.created_at).getTime()
  const byCreated = Number.isFinite(created) && (Date.now() - created) > 3 * 24 * 60 * 60 * 1000
  const vDate = new Date(`${row.voucher_date}T00:00:00`).getTime()
  const byDate = Number.isFinite(vDate) && ((Date.now() - vDate) > 3 * 24 * 60 * 60 * 1000)
  return byCreated || byDate
}

export const recordCutoffLocked = (row: Pick<LedgerRow, 'voucher_date'>, company?: Pick<SessionCompany, 'entry_lock_date'> | null) => {
  const cutoff = company?.entry_lock_date
  if (!cutoff) return false
  return row.voucher_date <= cutoff
}

export const recordLocked = (row: Pick<LedgerRow, 'voucher_date' | 'created_at'>, user?: Pick<SessionUser, 'role' | 'bypass_entry_lock'> | null, company?: Pick<SessionCompany, 'entry_lock_date'> | null) =>
  (recordAgeLocked(row) || recordCutoffLocked(row, company)) && !canBypassLock(user)

export const lockReason = (row: Pick<LedgerRow, 'voucher_date' | 'created_at'>, user?: Pick<SessionUser, 'role' | 'bypass_entry_lock'> | null, company?: Pick<SessionCompany, 'entry_lock_date'> | null) => {
  if (canBypassLock(user)) return ''
  if (recordCutoffLocked(row, company)) return 'Locked: Entry cutoff date has passed'
  if (recordAgeLocked(row)) return 'Auto-Locked (>3 Days)'
  return ''
}

export const canDo = (role: Role | undefined, permissions: PermissionMap | undefined, module: PermissionModule, action: PermissionAction) =>
  hasPermission(role, permissions, module, action)
