'use client'

import React, { useState } from 'react'
import {
  BarChart3,
  BookOpen,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react'
import { callRpc } from '@/lib/api'
import { errorMessage } from '@/lib/format'
import { hasPermission } from '@/lib/permissions'
import { useApp } from './AppProvider'
import { CompanyLogo } from './CompanyLogo'
import { DeveloperFooter, DeveloperSidebarBadge } from './DeveloperBranding'
import { CustomerPortal } from './customer/CustomerPortal'
import { FounderPlaybook } from './FounderPlaybook'
import { UserGuide } from './UserGuide'
import { Button, Field, Modal, Notice } from './Ui'
import { Admin } from './modules/Admin'
import { Customers } from './modules/Customers'
import { Dashboard } from './modules/Dashboard'
import { Gdn } from './modules/Gdn'
import { Invoices } from './modules/Invoices'
import { Ledger } from './modules/Ledger'
import { Orders } from './modules/Orders'
import { Products } from './modules/Products'
import { Receipts } from './modules/Receipts'
import { Reports } from './modules/Reports'

type PageKey = 'dashboard' | 'orders' | 'gdn' | 'invoices' | 'receipts' | 'ledger' | 'reports' | 'products' | 'customers' | 'admin'

const pages: Array<{ key: PageKey; label: string; icon: React.ComponentType<{ className?: string }>; roles: string[]; module?: any; action?: 'view' }> = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'STORE_FG', 'ACCOUNTS'] },
  { key: 'orders', label: 'Sales Orders', icon: ShoppingCart, roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'STORE_FG', 'CUSTOMER'], module: 'sales_order', action: 'view' },
  { key: 'gdn', label: 'GDN & Gate Pass', icon: Truck, roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'STORE_FG'], module: 'gdn_gate_pass', action: 'view' },
  { key: 'invoices', label: 'Sales Tax Invoices', icon: FileText, roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'ACCOUNTS'], module: 'sales_tax_invoice', action: 'view' },
  { key: 'receipts', label: 'Bank Receipts', icon: ReceiptText, roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'ACCOUNTS'], module: 'bank_receipt', action: 'view' },
  { key: 'ledger', label: 'Customer Ledger', icon: BookOpen, roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'ACCOUNTS'], module: 'ledger_reports', action: 'view' },
  { key: 'reports', label: 'Reports & Exports', icon: BarChart3, roles: ['SUPER_ADMIN', 'COMPANY_ADMIN', 'ACCOUNTS'], module: 'ledger_reports', action: 'view' },
  { key: 'products', label: 'Products / FG Stock', icon: Package, roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'], module: 'products_customers', action: 'view' },
  { key: 'customers', label: 'Customers', icon: Users, roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'], module: 'products_customers', action: 'view' },
  { key: 'admin', label: 'Administration', icon: Settings, roles: ['SUPER_ADMIN', 'COMPANY_ADMIN'] },
]

const components: Record<PageKey, React.ComponentType> = {
  dashboard: Dashboard,
  orders: Orders,
  gdn: Gdn,
  invoices: Invoices,
  receipts: Receipts,
  ledger: Ledger,
  reports: Reports,
  products: Products,
  customers: Customers,
  admin: Admin,
}

export function AppShell() {
  const { session, logout, page, navigate } = useApp()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNext, setPwNext] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwNotice, setPwNotice] = useState('')
  const [pwBusy, setPwBusy] = useState(false)

  if (!session) return null
  if (session.user.role === 'CUSTOMER') return <CustomerPortal />

  const allowed = pages.filter((item) => item.roles.includes(session.user.role) && (!item.module || hasPermission(session.user.role, session.user.permissions, item.module, item.action || 'view')))
  const current = allowed.some((item) => item.key === page) ? page : (allowed[0]?.key || 'dashboard')
  const ActivePage = components[current as PageKey] || Dashboard
  const hideAmounts = session.user.hide_rates_and_amounts

  const changePassword = async () => {
    setPwError(''); setPwNotice('')
    if (!pwCurrent || !pwNext) { setPwError('Enter current and new password'); return }
    if (pwNext !== pwConfirm) { setPwError('New password confirmation does not match'); return }
    setPwBusy(true)
    try {
      await callRpc('change_own_password', { p_current_password: pwCurrent, p_new_password: pwNext })
      setPwNotice('Password updated')
      setPwCurrent(''); setPwNext(''); setPwConfirm('')
    } catch (caught) { setPwError(errorMessage(caught)) } finally { setPwBusy(false) }
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside className={`${mobileOpen ? 'block' : 'hidden'} w-64 shrink-0 border-r border-cyan-400/20 bg-slate-950/85 p-3 pb-20 text-slate-200 backdrop-blur-sm lg:block`}>
        <div className="mb-5 flex items-center gap-2 px-2 pt-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-300/40 bg-gradient-to-br from-cyan-500 to-indigo-600 font-bold text-white shadow-[0_0_18px_rgba(6,182,212,.3)]">
            {session.company.logo_url ? <CompanyLogo url={session.company.logo_url} companyCode={session.company.company_code} companyName={session.company.company_name} className="max-h-9" /> : 'O'}
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-cyan-50">OZONE ERP</p>
            <p className="text-[10px] uppercase tracking-wide text-cyan-400/80">{session.company.company_code}</p>
          </div>
        </div>
        <nav className="space-y-1">
          {allowed.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                onClick={() => { navigate(item.key); setMobileOpen(false) }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold transition ${current === item.key ? 'neon-button text-white' : 'text-slate-300 hover:bg-cyan-400/10 hover:text-cyan-100'}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="mt-6 border-t border-cyan-400/15 pt-4 text-[11px] text-slate-400">
          <p className="font-semibold text-slate-200">{session.user.full_name}</p>
          <p>{session.user.role}</p>
          <p className="mt-1">License: {session.company.license_expiry_date}</p>
          {hideAmounts && <p className="mt-1 text-amber-300">Rates &amp; amounts hidden</p>}
        </div>
        <DeveloperSidebarBadge />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-cyan-400/20 bg-slate-950/85 px-4 py-3 shadow-[0_8px_30px_rgba(2,6,23,.45)] backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="lg:hidden" onClick={() => setMobileOpen((value) => !value)}>☰</Button>
            <CompanyLogo url={session.company.logo_url} companyCode={session.company.company_code} companyName={session.company.company_name} className="max-h-10" />
            <div>
              <p className="text-sm font-bold text-cyan-50">{session.company.company_name}</p>
              <p className="text-[11px] text-slate-400">{session.company.city_country} · NTN/STRN {session.company.ntn_strn}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right md:block">
              <p className="text-xs font-semibold text-cyan-50">{session.user.username}</p>
              <p className="text-[10px] text-cyan-400/80">{session.user.role}</p>
            </div>
            <UserGuide />
            <FounderPlaybook />
            <Button variant="secondary" onClick={() => { setPwOpen(true); setPwError(''); setPwNotice('') }}><KeyRound className="h-3.5 w-3.5" /> Change Password</Button>
            <Button variant="secondary" onClick={() => void logout()}><LogOut className="h-3.5 w-3.5" /> Sign out</Button>
          </div>
        </header>
        {hideAmounts && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-[11px] font-semibold text-amber-900">
            Rate and amount columns are hidden for this account.
          </div>
        )}
        <main className="app-scroll p-4 pb-20">
          <ActivePage />
        </main>
      </div>

      <DeveloperFooter />

      {pwOpen && (
        <Modal title="Change My Password" onClose={() => setPwOpen(false)}>
          <div className="space-y-3">
            {pwError && <Notice type="error">{pwError}</Notice>}
            {pwNotice && <Notice type="success">{pwNotice}</Notice>}
            <Field label="Current password"><input className="field-input" type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} /></Field>
            <Field label="New password"><input className="field-input" type="password" value={pwNext} onChange={(e) => setPwNext(e.target.value)} /></Field>
            <Field label="Confirm new password"><input className="field-input" type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} /></Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPwOpen(false)}>Close</Button>
              <Button onClick={() => void changePassword()} disabled={pwBusy}>{pwBusy ? 'Saving…' : 'Update Password'}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
