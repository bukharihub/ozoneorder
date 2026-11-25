import { isPlatformMaster } from './rbac'
import type { AppSession, LockoutInfo, Row } from './types'

export const LICENSE_DAYS = 40
export const SUPPORT_CONTACT = 'OZONE ENTERPRISE Support — Karachi | Contact Vendor for License Renewal'

export const embeddedLicense = {
  companyCode: String(import.meta.env.VITE_LOCKED_COMPANY_CODE || '').trim().toUpperCase(),
  companyName: String(import.meta.env.VITE_LOCKED_COMPANY_NAME || '').trim(),
  expiryDate: String(import.meta.env.VITE_LOCKED_EXPIRY_DATE || '').trim(),
}

export const isCompanyLockedBuild = (): boolean => Boolean(embeddedLicense.companyCode || embeddedLicense.expiryDate)

const dayNumber = (value: any): number | null => {
  if (!value) return null
  const match = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return Date.UTC(year, month - 1, day)
}

const todayNumber = (): number => {
  const now = new Date()
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
}

export const daysUntil = (value: any): number | null => {
  const target = dayNumber(value)
  if (target === null) return null
  return Math.round((target - todayNumber()) / 86400000)
}

export const addDays = (value: any, days: number): string => {
  const base = dayNumber(value) ?? todayNumber()
  return new Date(base + days * 86400000).toISOString().slice(0, 10)
}

export const formatDateInput = (value: any): string => {
  const number = dayNumber(value)
  return number === null ? '' : new Date(number).toISOString().slice(0, 10)
}

export const isExpired = (value: any): boolean => {
  const remaining = daysUntil(value)
  return remaining !== null && remaining < 0
}

const supportOf = (company: Row): string => String(company?.support_contact || SUPPORT_CONTACT)

export const licenseLockout = (company: Row): LockoutInfo | null => {
  const details = {
    companyName: String(company?.company_name || ''),
    companyCode: String(company?.company_code || ''),
    supportContact: supportOf(company),
  }

  if (isExpired(embeddedLicense.expiryDate)) {
    return { ...details, expiryDate: formatDateInput(embeddedLicense.expiryDate), reason: 'desktop' }
  }

  if (String(company?.license_status || 'active').toLowerCase() === 'suspended') {
    return { ...details, expiryDate: formatDateInput(company?.license_expiry_date), reason: 'suspended' }
  }

  if (isExpired(company?.license_expiry_date)) {
    return { ...details, expiryDate: formatDateInput(company?.license_expiry_date), reason: 'expired' }
  }

  return null
}

export const sessionLockout = (session: AppSession | null): LockoutInfo | null => {
  if (!session) return null
  if (isPlatformMaster(session)) {
    if (!isExpired(embeddedLicense.expiryDate)) return null
    return licenseLockout(session.company)
  }
  return licenseLockout(session.company)
}

export const licenseDaysLabel = (value: any): { label: string; tone: 'green' | 'amber' | 'red' } => {
  const remaining = daysUntil(value)
  if (remaining === null) return { label: 'Not set', tone: 'amber' }
  if (remaining < 0) return { label: 'Expired', tone: 'red' }
  if (remaining === 0) return { label: 'Expires today', tone: 'red' }
  if (remaining <= 7) return { label: `${remaining} Days Left`, tone: 'amber' }
  return { label: `${remaining} Days Left`, tone: 'green' }
}
