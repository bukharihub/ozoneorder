export type Row = Record<string, any>

export interface SessionUser extends Row {
  id: string
  company_id: string
  company_code: string
  cnic: string
  login_id: string
  full_name: string
  email: string
  phone: string
  role: string
  customer_id: string | null
}

export interface SessionCompany extends Row {
  company_id: string
  company_code: string
  company_name: string
  short_name: string
  address: string
  city: string
  country: string
  ntn_strn: string
  bank_name: string
  bank_account: string
  license_expiry_date?: string | null
  license_status?: string | null
  support_contact?: string | null
}

export interface SessionSettings extends Row {
  company_id: string
  quotation_prefix: string
  sale_order_prefix: string
  gdn_prefix: string
  gate_pass_prefix: string
  invoice_prefix: string
  receipt_prefix: string
  registered_invoice_prefix: string
  unregistered_invoice_prefix: string
  default_hs_code: string
  sales_tax_rate: number
  further_tax_rate: number
  sec236g_filer_rate: number
  sec236g_non_filer_rate: number
}

export interface SessionPolicies extends Row {
  can_edit_vouchers?: boolean
  can_delete_vouchers?: boolean
  can_print_vouchers?: boolean
  can_view_rates?: boolean
  can_view_values?: boolean
  can_view_full_invoices?: boolean
  can_upload_fg_excel?: boolean
  can_view_stock?: boolean
  can_approve_orders?: boolean
  can_post_gdn?: boolean
  can_issue_gate_pass?: boolean
  can_create_invoice?: boolean
  can_post_receipt?: boolean
  can_manage_users?: boolean
  can_manage_products?: boolean
  can_manage_company?: boolean
}

export interface AppSession {
  user: SessionUser
  company: SessionCompany
  settings: SessionSettings
  policies: SessionPolicies
}

export interface Permissions {
  editVouchers: boolean
  deleteVouchers: boolean
  printVouchers: boolean
  manageLicenses: boolean
  managePolicies: boolean
  buildDesktopInstaller: boolean
  viewRates: boolean
  viewValues: boolean
  viewFullInvoices: boolean
  uploadFgExcel: boolean
  viewStock: boolean
  approveOrders: boolean
  postGdn: boolean
  issueGatePass: boolean
  createInvoice: boolean
  postReceipt: boolean
  manageUsers: boolean
  manageProducts: boolean
  manageCompany: boolean
}

export interface ToastMessage {
  id: number
  tone: 'success' | 'error' | 'info'
  text: string
}

export interface LockoutInfo {
  companyName: string
  companyCode: string
  expiryDate: string
  supportContact: string
  reason: 'expired' | 'suspended' | 'desktop'
}
