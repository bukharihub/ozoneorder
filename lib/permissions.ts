export type Role = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'CUSTOMER' | 'STORE_FG' | 'ACCOUNTS'
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'print'
export type PermissionModule = 'sales_order' | 'gdn_gate_pass' | 'sales_tax_invoice' | 'bank_receipt' | 'ledger_reports' | 'products_customers'
export type PermissionMap = Partial<Record<PermissionModule, Partial<Record<PermissionAction, boolean>>>>

export const PERMISSION_MODULES: Array<{ key: PermissionModule; label: string; actions: PermissionAction[] }> = [
  { key: 'sales_order', label: 'Sales Order', actions: ['view', 'create', 'edit', 'delete', 'print'] },
  { key: 'gdn_gate_pass', label: 'GDN / Gate Pass', actions: ['view', 'create', 'edit', 'delete', 'print'] },
  { key: 'sales_tax_invoice', label: 'Sales Tax Invoice', actions: ['view', 'create', 'edit', 'delete', 'print'] },
  { key: 'bank_receipt', label: 'Bank Receipt', actions: ['view', 'create', 'edit', 'delete', 'print'] },
  { key: 'ledger_reports', label: 'Ledger / Reports', actions: ['view', 'print'] },
  { key: 'products_customers', label: 'Products / Customers', actions: ['view', 'create', 'edit', 'delete'] },
]

const all = (actions: PermissionAction[], value = true) => Object.fromEntries(actions.map((a) => [a, value]))

export const defaultPermissions = (role: Role): PermissionMap => {
  if (role === 'SUPER_ADMIN' || role === 'COMPANY_ADMIN') {
    return Object.fromEntries(PERMISSION_MODULES.map((m) => [m.key, all(m.actions, true)])) as PermissionMap
  }
  if (role === 'STORE_FG') return {
    sales_order: { view: true, create: false, edit: false, delete: false, print: true },
    gdn_gate_pass: { view: true, create: true, edit: true, delete: true, print: true },
    sales_tax_invoice: all(['view', 'create', 'edit', 'delete', 'print'], false),
    bank_receipt: all(['view', 'create', 'edit', 'delete', 'print'], false),
    ledger_reports: { view: false, print: false },
    products_customers: all(['view', 'create', 'edit', 'delete'], false),
  }
  if (role === 'ACCOUNTS') return {
    sales_order: all(['view', 'create', 'edit', 'delete', 'print'], false),
    gdn_gate_pass: all(['view', 'create', 'edit', 'delete', 'print'], false),
    sales_tax_invoice: { view: true, create: true, edit: true, delete: true, print: true },
    bank_receipt: { view: true, create: true, edit: true, delete: true, print: true },
    ledger_reports: { view: true, print: true },
    products_customers: all(['view', 'create', 'edit', 'delete'], false),
  }
  return {
    sales_order: { view: true, create: true, edit: false, delete: false, print: true },
    gdn_gate_pass: all(['view', 'create', 'edit', 'delete', 'print'], false),
    sales_tax_invoice: all(['view', 'create', 'edit', 'delete', 'print'], false),
    bank_receipt: all(['view', 'create', 'edit', 'delete', 'print'], false),
    ledger_reports: { view: false, print: false },
    products_customers: all(['view', 'create', 'edit', 'delete'], false),
  }
}

export const hasPermission = (role: Role | undefined, permissions: PermissionMap | undefined, module: PermissionModule, action: PermissionAction) => {
  if (!role) return false
  if (role === 'SUPER_ADMIN') return true
  if (role === 'CUSTOMER' && module === 'sales_order' && (action === 'view' || action === 'create')) return true
  const map = permissions && Object.keys(permissions).length ? permissions : defaultPermissions(role)
  return Boolean(map[module]?.[action])
}
