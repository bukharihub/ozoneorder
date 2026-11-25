import type { AppSession, Permissions } from './types'

const PLATFORM_ROLES = ['super_admin', 'platform_master']
const COMPANY_SUPER_ROLES = ['master', 'super_user', 'sales_approver']

const roleOf = (session: AppSession | null): string => String(session?.user?.role || '').toLowerCase()

export const isPlatformMaster = (session: AppSession | null): boolean => PLATFORM_ROLES.includes(roleOf(session))

export const isPlatformMasterUser = (user: { role?: string } | null | undefined): boolean =>
  PLATFORM_ROLES.includes(String(user?.role || '').toLowerCase())

export const isCompanySuperUser = (session: AppSession | null): boolean => COMPANY_SUPER_ROLES.includes(roleOf(session))

const denyAll: Permissions = {
  editVouchers: false,
  deleteVouchers: false,
  printVouchers: false,
  manageLicenses: false,
  managePolicies: false,
  buildDesktopInstaller: false,
  viewRates: false,
  viewValues: false,
  viewFullInvoices: false,
  uploadFgExcel: false,
  viewStock: false,
  approveOrders: false,
  postGdn: false,
  issueGatePass: false,
  createInvoice: false,
  postReceipt: false,
  manageUsers: false,
  manageProducts: false,
  manageCompany: false,
}

export const getPermissions = (session: AppSession | null): Permissions => {
  if (!session) return denyAll
  if (isPlatformMaster(session)) {
    return {
      editVouchers: true,
      deleteVouchers: true,
      printVouchers: true,
      manageLicenses: true,
      managePolicies: true,
      buildDesktopInstaller: true,
      viewRates: true,
      viewValues: true,
      viewFullInvoices: true,
      uploadFgExcel: true,
      viewStock: true,
      approveOrders: true,
      postGdn: true,
      issueGatePass: true,
      createInvoice: true,
      postReceipt: true,
      manageUsers: true,
      manageProducts: true,
      manageCompany: true,
    }
  }
  const p = session.policies || {}
  const superUser = isCompanySuperUser(session)
  return {
    editVouchers: superUser ? p.can_edit_vouchers !== false : !!p.can_edit_vouchers,
    deleteVouchers: superUser ? p.can_delete_vouchers !== false : !!p.can_delete_vouchers,
    printVouchers: superUser ? p.can_print_vouchers !== false : !!p.can_print_vouchers,
    manageLicenses: false,
    managePolicies: false,
    buildDesktopInstaller: false,
    viewRates: !!p.can_view_rates,
    viewValues: !!p.can_view_values,
    viewFullInvoices: !!p.can_view_full_invoices,
    uploadFgExcel: !!p.can_upload_fg_excel,
    viewStock: p.can_view_stock !== false,
    approveOrders: roleOf(session) === 'sales_approver' || !!p.can_approve_orders,
    postGdn: roleOf(session) === 'delivery' || !!p.can_post_gdn,
    issueGatePass: roleOf(session) === 'gate' || !!p.can_issue_gate_pass,
    createInvoice: roleOf(session) === 'billing' || !!p.can_create_invoice,
    postReceipt: roleOf(session) === 'bank' || !!p.can_post_receipt,
    manageUsers: !!p.can_manage_users,
    manageProducts: !!p.can_manage_products,
    manageCompany: !!p.can_manage_company,
  }
}

export const isCustomerUser = (session: AppSession | null): boolean => {
  if (!session) return false
  const role = roleOf(session)
  return role === 'registered_user' || role === 'unregistered_user' || !!session.user.customer_id
}
