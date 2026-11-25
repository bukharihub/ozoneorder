export type Role = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'CUSTOMER' | 'STORE_FG' | 'ACCOUNTS'
export type VoucherType = 'SALES_ORDER' | 'GDN_GATE_PASS' | 'SALES_TAX_INVOICE' | 'BANK_RECEIPT'
export type VoucherStatus = 'PENDING' | 'PARTIAL_DELIVERED' | 'DELIVERED' | 'INVOICED' | 'PARTIAL_PAID' | 'PAID'

export type AppPage = 'dashboard' | 'orders' | 'gdn' | 'invoices' | 'receipts' | 'ledger' | 'reports' | 'products' | 'customers' | 'admin'

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'print'
export type PermissionModule = 'sales_order' | 'gdn_gate_pass' | 'sales_tax_invoice' | 'bank_receipt' | 'ledger_reports' | 'products_customers'
export type PermissionMap = Partial<Record<PermissionModule, Partial<Record<PermissionAction, boolean>>>>

export interface PipelineSeed {
  soNo?: string
  gdnNo?: string
  invoiceNo?: string
}

export interface SessionUser {
  id: string
  company_code: string
  username: string
  full_name: string
  role: Role
  linked_customer_id: string | null
  linked_customer_ids?: string[]
  hide_rates_and_amounts: boolean
  permissions?: PermissionMap
  bypass_entry_lock?: boolean
}

export interface SessionCompany {
  id: string
  company_code: string
  company_name: string
  city_country: string
  ntn_strn: string
  bank_details: string
  address: string
  logo_url: string
  license_expiry_date: string
  is_active: boolean
  is_demo_mode?: boolean
  demo_started_at?: string | null
  owner_contact_info?: string
  max_users?: number | null
  entry_lock_date?: string | null
}

export interface Session {
  token: string
  user: SessionUser
  company: SessionCompany
}

export interface LineItem {
  product_id: string
  product_name: string
  hs_code: string
  size_category?: string
  pcs_per_carton?: number
  ordered_ctns: number
  delivered_ctns: number
  pending_ctns: number
  pcs: number
  rate: number
  exclusive_value: number
}

export interface Product {
  id: string
  size_category: string
  product_type: 'REGISTERED' | 'UNREGISTERED'
  product_name: string
  hs_code: string
  diapers_per_bag: number
  bags_per_carton: number
  pcs_per_carton: number
  opening_stock_ctns: number
  current_stock_ctns: number
  current_stock_pcs: number
  per_diaper_rate: number
  per_carton_rate: number
  created_at: string
}

export interface Customer {
  id: string
  cnic_ntn: string
  strn: string
  business_name: string
  delivery_destination: string
  registration_status: 'Register' | 'Unregister'
  income_tax_status: 'Filer' | 'Non Filer'
  tax_rate_236g: number
  opening_balance: number
  bank_account_no?: string | null
  bank_branch_name?: string | null
  created_at: string
}

export interface LedgerRow {
  id: string
  voucher_type: VoucherType
  voucher_no: string
  linked_so_no: string
  linked_gdn_no: string
  voucher_date: string
  customer_id: string | null
  customer_name: string
  ship_to_name: string
  ship_to_address: string
  cnic_ntn: string
  strn: string
  filer_status: string
  registration_status: 'Register' | 'Unregister'
  vehicle_1: string
  driver_1: string
  remarks_1: string
  vehicle_2: string
  driver_2: string
  remarks_2: string
  outward_time: string
  line_items: LineItem[]
  total_cartons: number
  total_pcs: number
  total_exclusive_value: number
  sales_tax_18: number
  further_tax_4: number
  amount_before_236g: number
  advance_tax_236g: number
  net_invoice_total: number
  bank_receipt_amount: number
  bank_reference: string
  amount_in_words: string
  status: VoucherStatus
  created_by: string
  booked_by_user_id?: string | null
  booked_by_name?: string | null
  bank_account_no?: string | null
  bank_branch_name?: string | null
  created_at: string
}

export interface VoucherTotals {
  exclusive: number
  salesTax: number
  furtherTax: number
  amountBefore236g: number
  advanceTax: number
  netTotal: number
}
