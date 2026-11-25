import type { ReactNode } from 'react'
import {
  BarChart3,
  BookOpen,
  Boxes,
  CreditCard,
  FileText,
  LayoutDashboard,
  MapPin,
  Menu,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Tags,
  Truck,
  Users,
  X,
} from 'lucide-react'
import { licenseDaysLabel } from '../lib/license'
import { isPlatformMaster } from '../lib/rbac'
import { useApp } from './AppContext'
import { Badge, Button } from './ui'

export type PageKey =
  | 'dashboard'
  | 'customers'
  | 'products'
  | 'prices'
  | 'stock'
  | 'quotations'
  | 'orders'
  | 'gdn'
  | 'gatepass'
  | 'invoices'
  | 'receipts'
  | 'ledger'
  | 'tracking'
  | 'reports'
  | 'admin'

const NAV: Array<{ key: PageKey; label: string; icon: any; group: string }> = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Overview' },
  { key: 'customers', label: 'Customers', icon: Users, group: 'Masters' },
  { key: 'products', label: 'Products', icon: Package, group: 'Masters' },
  { key: 'prices', label: 'Price Lists', icon: Tags, group: 'Masters' },
  { key: 'stock', label: 'FG Stock', icon: Boxes, group: 'Masters' },
  { key: 'quotations', label: 'Quotations', icon: FileText, group: 'Operations' },
  { key: 'orders', label: 'Sale Orders', icon: ShoppingCart, group: 'Operations' },
  { key: 'gdn', label: 'Delivery Notes', icon: Truck, group: 'Operations' },
  { key: 'gatepass', label: 'Gate Passes', icon: MapPin, group: 'Operations' },
  { key: 'invoices', label: 'Invoices', icon: Receipt, group: 'Finance' },
  { key: 'receipts', label: 'Receipts', icon: CreditCard, group: 'Finance' },
  { key: 'ledger', label: 'Customer Ledger', icon: BookOpen, group: 'Finance' },
  { key: 'tracking', label: 'Order Tracking', icon: MapPin, group: 'Reports' },
  { key: 'reports', label: 'Reports', icon: BarChart3, group: 'Reports' },
  { key: 'admin', label: 'Security & Admin', icon: Settings, group: 'Reports' },
]

export const AppLayout = ({
  activePage,
  onNavigate,
  children,
  mobileOpen,
  onToggleMobile,
}: {
  activePage: PageKey
  onNavigate: (page: PageKey) => void
  children: ReactNode
  mobileOpen: boolean
  onToggleMobile: () => void
}) => {
  const { session, permissions, logout } = useApp()
  const groups = [...new Set(NAV.map((item) => item.group))]
  const showAdmin = isPlatformMaster(session) || permissions.manageUsers
  const license = licenseDaysLabel(session.company.license_expiry_date)

  const nav = (
    <nav className="space-y-5 p-4">
      {groups.map((group) => (
        <div key={group}>
          <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">{group}</div>
          <div className="space-y-1">
            {NAV.filter((item) => item.group === group && (item.key !== 'admin' || showAdmin)).map((item) => {
              const Icon = item.icon
              const active = activePage === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    onNavigate(item.key)
                    onToggleMobile()
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                    active ? 'bg-cyan-500/15 text-cyan-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen bg-slate-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 overflow-y-auto border-r border-slate-800 bg-slate-900/95 lg:block no-print">
        <div className="border-b border-slate-800 px-5 py-5">
          <div className="text-lg font-black tracking-wider text-cyan-400">OZONE ERP</div>
          <div className="mt-1 text-xs text-slate-500">{session.company.company_name}</div>
        </div>
        {nav}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/70 lg:hidden no-print" onClick={onToggleMobile}>
          <aside className="h-full w-64 overflow-y-auto border-r border-slate-800 bg-slate-900" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-5">
              <div className="text-lg font-black tracking-wider text-cyan-400">OZONE ERP</div>
              <Button variant="ghost" size="sm" onClick={onToggleMobile}>
                <X size={18} />
              </Button>
            </div>
            {nav}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur no-print sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className="lg:hidden" onClick={onToggleMobile}>
                <Menu size={18} />
              </Button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-bold text-white">{session.company.company_name}</div>
                  <Badge tone={license.tone}>{license.label}</Badge>
                </div>
                <div className="text-[11px] text-slate-500">
                  {session.company.ntn_strn || 'NTN/STRN not set'} · {session.company.city}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <div className="text-xs font-semibold text-slate-200">{session.user.full_name}</div>
                <div className="text-[11px] text-cyan-400">{session.user.role.replaceAll('_', ' ')}</div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => void logout()}>
                Logout
              </Button>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">{children}</main>

        <footer className="border-t border-slate-900 px-6 py-4 text-center text-[11px] text-slate-600 no-print">
          {session.company.bank_name} · {session.company.bank_account} · Permissions:{' '}
          {Object.entries(permissions)
            .filter(([, enabled]) => enabled)
            .length}{' '}
          enabled
        </footer>
      </div>
    </div>
  )
}
