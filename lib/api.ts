import { normalizeLinkedCustomerIds } from './linkedCustomers'
import { hasPermission } from './permissions'
import { supabase } from './supabase'
import { clearSession, getSession, saveSession } from './session'
import type { Session } from './types'

type Row = Record<string, any>

const unwrap = async <T>(query: PromiseLike<any>): Promise<T> => {
  const response = await query
  if (response?.error) {
    const detail = [response.error.message, response.error.details, response.error.hint].filter(Boolean).join(' — ')
    throw new Error(detail || 'Database request failed')
  }
  return response?.data as T
}

export const callRpc = async <T = any>(name: string, args: Row = {}): Promise<T> => {
  const data = await unwrap<any>(supabase.rpc(name, args))
  return (Array.isArray(data) ? data[0] : data) as T
}

export const callRpcRows = async <T = any>(name: string, args: Row = {}): Promise<T[]> => {
  const data = await unwrap<any>(supabase.rpc(name, args))
  return (Array.isArray(data) ? data : []) as T[]
}

export interface ListOptions {
  select?: string
  order?: string
  ascending?: boolean
  filters?: Row
  limit?: number
}

export const listRows = <T = Row>(table: string, options: ListOptions = {}): Promise<T[]> => {
  let query: any = supabase.from(table).select(options.select || '*')
  Object.entries(options.filters || {}).forEach(([column, value]) => {
    if (value !== undefined && value !== null && value !== '') query = query.eq(column, value)
  })
  if (options.order) query = query.order(options.order, { ascending: options.ascending !== false })
  if (options.limit) query = query.limit(options.limit)
  return unwrap<T[]>(query)
}

export const listAllRows = async <T = Row>(table: string, options: ListOptions = {}, pageSize = 1000): Promise<T[]> => {
  const rows: T[] = []
  let start = 0
  while (true) {
    let query: any = supabase.from(table).select(options.select || '*')
    Object.entries(options.filters || {}).forEach(([column, value]) => {
      if (value !== undefined && value !== null && value !== '') query = query.eq(column, value)
    })
    if (options.order) query = query.order(options.order, { ascending: options.ascending !== false })
    const chunk = await unwrap<T[]>(query.range(start, start + pageSize - 1))
    rows.push(...chunk)
    if (chunk.length < pageSize) break
    start += pageSize
  }
  return rows
}

const assertCompanyProfileWrite = (table: string, operation: string) => {
  if (table !== 'sys_companies') return
  if (getSession()?.user.role !== 'SUPER_ADMIN') {
    throw new Error(`Only SUPER_ADMIN can ${operation} company profile data`)
  }
}

const assertCustomerWrite = (table: string, operation: string, row?: Row) => {
  const session = getSession()
  if (session?.user.role !== 'CUSTOMER') return
  if (operation !== 'insert') {
    throw new Error(`CUSTOMER accounts cannot ${operation} ${table}`)
  }
  if (!table.endsWith('_master_ledger')) {
    throw new Error('CUSTOMER accounts can only submit sales orders')
  }
  if (String(row?.voucher_type || '') !== 'SALES_ORDER') {
    throw new Error('CUSTOMER accounts can only submit sales orders')
  }
  if (!hasPermission(session.user.role, session.user.permissions, 'sales_order', 'create')) {
    throw new Error('Permission denied: create sales_order')
  }
  const allowed = normalizeLinkedCustomerIds(session.user)
  if (!allowed.includes(String(row?.customer_id || ''))) {
    throw new Error('Your login is not linked to this customer')
  }
}

export const insertRow = async <T = Row>(table: string, row: Row): Promise<T> => {
  assertCompanyProfileWrite(table, 'insert')
  assertCustomerWrite(table, 'insert', row)
  if (table.endsWith('_master_ledger')) {
    const session = getSession()
    if (!session) throw new Error('Session expired')
    return callRpc<T>('insert_master_ledger', {
      p_company_code: session.company.company_code,
      p_voucher: row,
    })
  }
  return unwrap<T>(supabase.from(table).insert([row]).select().single())
}

export const updateRow = <T = Row>(table: string, id: string, patch: Row): Promise<T> => {
  assertCompanyProfileWrite(table, 'update')
  assertCustomerWrite(table, 'update', patch)
  return unwrap<T>(supabase.from(table).update(patch).eq('id', id).select().single())
}

export const deleteRow = (table: string, id: string): Promise<void> => {
  assertCompanyProfileWrite(table, 'delete')
  assertCustomerWrite(table, 'delete')
  return unwrap<void>(supabase.from(table).delete().eq('id', id))
}

export const companyTables = (companyCode: string) => {
  const prefix = companyCode.toLowerCase().replace(/[^a-z0-9_]/g, '_')
  return {
    products: `${prefix}_products`,
    customers: `${prefix}_customers`,
    ledger: `${prefix}_master_ledger`,
  }
}

export const checkCompany = (companyCode: string) =>
  callRpc<{ exists: boolean; locked: boolean; company_name: string; message: string; logo_url?: string; is_demo_mode?: boolean; demo_started_at?: string | null; owner_contact_info?: string; demo_expired?: boolean }>('check_company', {
    p_company_code: companyCode,
  })

export const authenticate = async (
  companyCode: string,
  username: string,
  password: string,
): Promise<Session> => {
  const session = await callRpc<Session>('app_authenticate', {
    p_company_code: companyCode.trim().toUpperCase(),
    p_username: username.trim(),
    p_password: password,
  })
  if (!session?.token || !session?.user?.id) throw new Error('Login response was incomplete')
  saveSession(session)
  return session
}

export const signOut = async () => {
  try {
    await callRpc('app_logout')
  } catch {
    clearSession()
    return
  }
  clearSession()
}

export const nextVoucher = (prefix: string, digits = 4) => {
  const session = getSession()
  if (!session) throw new Error('Session expired')
  return callRpc<string>('next_voucher_no', {
    p_company_code: session.company.company_code,
    p_prefix: prefix,
    p_digits: digits,
  })
}
