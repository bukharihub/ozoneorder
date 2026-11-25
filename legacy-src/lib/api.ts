import { supabase } from './supabase'
import { clearSession, getSession, saveSession } from './session'
import { embeddedLicense, isCompanyLockedBuild, sessionLockout, SUPPORT_CONTACT } from './license'
import type { AppSession, Row } from './types'

const unwrap = async <T>(query: PromiseLike<any>): Promise<T> => {
  const response = await query
  if (response?.error) throw new Error(response.error.message || 'Database request failed')
  return response?.data as T
}

export interface ListOptions {
  select?: string
  order?: string
  ascending?: boolean
  filters?: Record<string, any>
  limit?: number
}

export const listRows = <T extends Row = Row>(table: string, options: ListOptions = {}): Promise<T[]> => {
  let query: any = supabase.from(table).select(options.select || '*')
  Object.entries(options.filters || {}).forEach(([column, value]) => {
    if (value !== undefined && value !== null && value !== '') query = query.eq(column, value)
  })
  if (options.order) query = query.order(options.order, { ascending: options.ascending !== false })
  if (options.limit) query = query.limit(options.limit)
  return unwrap<T[]>(query)
}

export const getRow = <T extends Row = Row>(table: string, id: string): Promise<T> =>
  unwrap<T>(supabase.from(table).select('*').eq('id', id).single())

export const insertRow = <T extends Row = Row>(table: string, row: Row): Promise<T> =>
  unwrap<T>(supabase.from(table).insert([row]).select().single())

export const insertRows = <T extends Row = Row>(table: string, rows: Row[]): Promise<T[]> =>
  rows.length ? unwrap<T[]>(supabase.from(table).insert(rows).select()) : Promise.resolve([])

export const updateRow = <T extends Row = Row>(table: string, id: string, patch: Row): Promise<T> =>
  unwrap<T>(supabase.from(table).update(patch).eq('id', id).select().single())

export const upsertRow = <T extends Row = Row>(table: string, row: Row, onConflict: string): Promise<T> =>
  unwrap<T>(supabase.from(table).upsert([row], { onConflict }).select().single())

export const deleteRow = (table: string, id: string): Promise<void> =>
  unwrap<void>(supabase.from(table).delete().eq('id', id))

export const callRpc = async <T = any>(name: string, args: Row = {}): Promise<T> => {
  const data = await unwrap<any>(supabase.rpc(name, args))
  return (Array.isArray(data) ? data[0] : data) as T
}

const parseJson = (value: any): any => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return {}
    }
  }
  return value || {}
}

const normalizeSession = (payload: any): AppSession => {
  const result = parseJson(payload)
  return {
    user: parseJson(result.user),
    company: parseJson(result.company),
    settings: parseJson(result.settings),
    policies: parseJson(result.policies),
  }
}

export const authenticate = async (
  companyCode: string,
  loginId: string,
  password: string,
): Promise<AppSession> => {
  const code = companyCode.trim().toUpperCase()
  if (isCompanyLockedBuild() && embeddedLicense.companyCode && code !== embeddedLicense.companyCode) {
    throw new Error(`This desktop build is licensed only for ${embeddedLicense.companyName || embeddedLicense.companyCode}`)
  }
  const payload = await callRpc('app_authenticate', {
    p_company_code: code,
    p_login_id: loginId.trim(),
    p_password: password,
  })
  const session = normalizeSession(payload)
  if (!session.user?.id || !session.company?.company_id) {
    throw new Error('Login response was incomplete')
  }
  const lockout = sessionLockout(session)
  if (lockout) {
    clearSession()
    throw new Error(
      `System Access Locked — Company License Expired. Your 40-day software license has expired and system access has been disabled. Please contact the software administrator to renew your license. Support: ${lockout.supportContact || SUPPORT_CONTACT}`,
    )
  }
  saveSession(session)
  return session
}

export const signOut = async (): Promise<void> => {
  try {
    await supabase.rpc('app_logout')
  } catch {
    clearSession()
    return
  }
  clearSession()
}

export const currentSession = (): AppSession | null => getSession()

export const nextNumber = async (
  docType: 'quotation' | 'sale_order' | 'gdn' | 'gate_pass' | 'invoice' | 'receipt',
  customerType = '',
): Promise<string> => {
  const session = getSession()
  if (!session) throw new Error('Session expired')
  const year = new Date().getFullYear()
  return callRpc<string>('next_document_number', {
    p_company_id: session.company.company_id,
    p_doc_type: docType,
    p_customer_type: customerType,
    p_doc_year: year,
  })
}

export const lineTotals = async (
  regNo: string,
  filerStatus: string,
  qtyCartons: number,
  ratePerCarton: number,
): Promise<Row> =>
  callRpc<Row>('calculate_line_totals', {
    p_reg_no: regNo,
    p_filer_status: filerStatus,
    p_qty_cartons: qtyCartons,
    p_rate_per_carton: ratePerCarton,
  })

export const availableCartons = async (productId: string): Promise<number> => {
  const session = getSession()
  if (!session) return 0
  const value = await callRpc<any>('fg_available_cartons', {
    p_company_id: session.company.company_id,
    p_product_id: productId,
  })
  return Number(value || 0)
}

export const createQuotation = async (header: Row, items: Row[]): Promise<Row> => {
  const session = getSession()
  if (!session) throw new Error('Session expired')
  const created = await insertRow<Row>('quotations', {
    company_id: session.company.company_id,
    quotation_number: '',
    customer_id: header.customer_id || null,
    customer_user_id: getSession()?.user.customer_id ? session.user.id : null,
    customer_name: header.customer_name,
    customer_type: header.customer_type,
    reg_no: header.reg_no,
    cnic_ntn: header.cnic_ntn || '',
    strn: header.strn || '',
    filer_status: header.filer_status || 'Non-Filer',
    delivery_destination_address: header.delivery_destination_address || '',
    quotation_date: header.quotation_date,
    valid_until: header.valid_until,
    status: 'pending',
    remark: header.remark || '',
    created_by: session.user.id,
  })
  await insertRows('quotation_items', items.map((item) => ({
    company_id: session.company.company_id,
    quotation_id: created.id,
    product_id: item.product_id,
    qty_cartons: item.qty_cartons,
    cnts_size: item.cnts_size,
    bags_size: item.bags_size,
    rate_per_carton: item.rate_per_carton,
    rate_per_diaper: item.rate_per_diaper || 0,
  })))
  return getRow('quotations', created.id)
}

export const createSaleOrder = async (quotationId: string): Promise<Row> => {
  const session = getSession()
  if (!session) throw new Error('Session expired')
  const quotation = await getRow<Row>('quotations', quotationId)
  const items = await listRows<Row>('quotation_items', {
    filters: { quotation_id: quotationId },
    order: 'created_at',
  })
  if (!items.length) throw new Error('Quotation has no items')
  const created = await insertRow<Row>('sale_orders', {
    company_id: session.company.company_id,
    order_number: '',
    quotation_id: quotation.id,
    customer_id: quotation.customer_id,
    customer_user_id: quotation.customer_user_id,
    customer_name: quotation.customer_name,
    customer_type: quotation.customer_type,
    reg_no: quotation.reg_no,
    cnic_ntn: quotation.cnic_ntn,
    strn: quotation.strn,
    filer_status: quotation.filer_status,
    delivery_destination_address: quotation.delivery_destination_address,
    order_date: new Date().toISOString().slice(0, 10),
    status: 'approved',
    approved_by: session.user.id,
    approved_at: new Date().toISOString(),
    created_by: session.user.id,
  })
  await insertRows('sale_order_items', items.map((item) => ({
    company_id: session.company.company_id,
    sale_order_id: created.id,
    product_id: item.product_id,
    qty_cartons: item.qty_cartons,
    cnts_size: item.cnts_size,
    bags_size: item.bags_size,
    rate_per_carton: item.rate_per_carton,
    rate_per_diaper: item.rate_per_diaper,
  })))
  return getRow('sale_orders', created.id)
}

export const createGdn = async (orderId: string, header: Row, lines: Row[]): Promise<Row> => {
  const session = getSession()
  if (!session) throw new Error('Session expired')
  const order = await getRow<Row>('sale_orders', orderId)
  const created = await insertRow<Row>('gdns', {
    company_id: session.company.company_id,
    gdn_number: '',
    sale_order_id: order.id,
    customer_id: order.customer_id,
    gdn_date: header.gdn_date,
    status: 'draft',
    vehicle_no: header.vehicle_no || '',
    driver_name: header.driver_name || '',
    driver_cnic: header.driver_cnic || '',
    prepared_by: session.user.id,
    created_by: session.user.id,
  })
  await insertRows('gdn_items', lines.map((line) => ({
    company_id: session.company.company_id,
    gdn_id: created.id,
    product_id: line.product_id,
    qty_cartons: line.qty_cartons,
  })))
  return getRow('gdns', created.id)
}

export const issueGatePass = async (gdnId: string, header: Row): Promise<Row> => {
  const session = getSession()
  if (!session) throw new Error('Session expired')
  const gdn = await getRow<Row>('gdns', gdnId)
  return insertRow<Row>('gate_passes', {
    company_id: session.company.company_id,
    gate_pass_number: '',
    gdn_id: gdn.id,
    customer_id: gdn.customer_id,
    passage_date: header.passage_date,
    vehicle_number: header.vehicle_number,
    driver_name: header.driver_name,
    driver_cnic: header.driver_cnic,
    guard_badge_no: header.guard_badge_no || '',
    remarks: header.remarks || '',
    status: 'issued',
    issued_by: session.user.id,
  })
}

export const postInvoice = async (gatePassId: string, header: Row): Promise<Row> => {
  const session = getSession()
  if (!session) throw new Error('Session expired')
  const gatePass = await getRow<Row>('gate_passes', gatePassId)
  const gdn = await getRow<Row>('gdns', gatePass.gdn_id)
  const order = gdn.sale_order_id ? await getRow<Row>('sale_orders', gdn.sale_order_id) : null
  let customer: Row | null = null
  if (gatePass.customer_id) {
    const customers = await listRows<Row>('customers', {
      filters: { id: gatePass.customer_id },
      limit: 1,
    })
    customer = customers[0] || null
  }
  const settings = session.settings
  return insertRow<Row>('invoices', {
    company_id: session.company.company_id,
    invoice_number: '',
    sale_order_id: order?.id || null,
    gate_pass_id: gatePass.id,
    customer_id: gatePass.customer_id,
    customer_user_id: order?.customer_user_id || null,
    customer_name: customer?.business_name || customer?.customer_name || order?.customer_name || header.customer_name || '',
    customer_type: customer?.customer_type || order?.customer_type || 'unregistered',
    reg_no: customer?.reg_no || order?.reg_no || 'Unregistered',
    cnic_ntn: customer?.cnic_ntn || order?.cnic_ntn || '',
    strn: customer?.strn || order?.strn || '',
    filer_status: customer?.filer_status || order?.filer_status || 'Non-Filer',
    delivery_destination_address: customer?.delivery_destination_address || order?.delivery_destination_address || '',
    invoice_date: header.invoice_date,
    due_date: header.due_date,
    sales_tax_rate: Number(settings.sales_tax_rate ?? 18),
    further_tax_rate: Number(settings.further_tax_rate ?? 0),
    sec236g_rate: String(header.filer_status).toLowerCase() === 'filer'
      ? Number(settings.sec236g_filer_rate ?? 0.001)
      : Number(settings.sec236g_non_filer_rate ?? 0.02),
    status: 'unpaid',
    created_by: session.user.id,
  })
}

export const postReceipt = async (invoiceId: string, header: Row): Promise<Row> => {
  const session = getSession()
  if (!session) throw new Error('Session expired')
  const invoice = await getRow<Row>('invoices', invoiceId)
  return insertRow<Row>('bank_cash_receipts', {
    company_id: session.company.company_id,
    receipt_number: '',
    invoice_id: invoice.id,
    customer_id: invoice.customer_id,
    receipt_date: header.receipt_date,
    amount: header.amount,
    payment_method: header.payment_method,
    bank_name: header.bank_name || '',
    instrument_no: header.instrument_no || '',
    reference_no: header.reference_no || '',
    status: 'cleared',
    remarks: header.remarks || '',
    created_by: session.user.id,
  })
}
