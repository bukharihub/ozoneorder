import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppContext } from './components/AppContext'
import { AppLayout, type PageKey } from './components/AppLayout'
import { CustomerPortalPage } from './pages/CustomerPortalPage'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LoginPage } from './components/LoginPage'
import { LicenseLockout } from './components/LicenseLockout'
import { AdminPage } from './pages/AdminPage'
import { DashboardPage } from './pages/DashboardPage'
import { CustomersPage } from './pages/CustomersPage'
import { ProductsPage } from './pages/ProductsPage'
import { PriceListPage } from './pages/PriceListPage'
import { StockPage } from './pages/StockPage'
import { QuotationsPage } from './pages/QuotationsPage'
import { OrdersPage } from './pages/OrdersPage'
import { GdnPage } from './pages/GdnPage'
import { GatePassPage } from './pages/GatePassPage'
import { InvoicesPage } from './pages/InvoicesPage'
import { ReceiptsPage } from './pages/ReceiptsPage'
import { LedgerPage } from './pages/LedgerPage'
import { TrackingPage } from './pages/TrackingPage'
import { ReportsPage } from './pages/ReportsPage'
import { getRow, signOut } from './lib/api'
import { sessionLockout } from './lib/license'
import { getPermissions, isCustomerUser } from './lib/rbac'
import { clearSession, getSession } from './lib/session'
import { supabase, isConfigured } from './lib/supabase'
import type { AppSession, LockoutInfo, Row, ToastMessage } from './lib/types'

const toastTone = {
  success: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200',
  error: 'border-rose-500/50 bg-rose-500/15 text-rose-200',
  info: 'border-cyan-500/50 bg-cyan-500/15 text-cyan-100',
}

export default function App() {
  const [session, setSession] = useState<AppSession | null>(() => getSession())
  const [activePage, setActivePage] = useState<PageKey>('dashboard')
  const [refreshKey, setRefreshKey] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const [lockout, setLockout] = useState<LockoutInfo | null>(null)

  const permissions = useMemo(() => getPermissions(session), [session])

  const lockWorkspace = useCallback((info: LockoutInfo) => {
    void signOut().catch(() => undefined)
    clearSession()
    setSession(null)
    setLockout(info)
  }, [])

  const notify = useCallback((text: string, tone: ToastMessage['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((previous) => [...previous, { id, tone, text }])
    window.setTimeout(() => setToasts((previous) => previous.filter((toast) => toast.id !== id)), 4000)
  }, [])

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), [])

  const logout = useCallback(async () => {
    await signOut()
    setSession(null)
    setActivePage('dashboard')
  }, [])

  useEffect(() => {
    if (!session || !isConfigured) return
    const channel = supabase
      .channel(`ozone-erp-${session.company.company_id}`)
      .on('postgres_changes', { event: '*', schema: 'public' }, () => setRefreshKey((key) => key + 1))
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [session])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    const checkLicense = async () => {
      const localLock = sessionLockout(session)
      if (localLock) {
        lockWorkspace(localLock)
        return
      }
      if (!isConfigured) return
      try {
        const company = await getRow<Row>('companies', session.company.company_id)
        if (cancelled) return
        const remoteLock = sessionLockout({ ...session, company: { ...session.company, ...company } })
        if (remoteLock) lockWorkspace(remoteLock)
      } catch {}
    }
    void checkLicense()
    const timer = window.setInterval(() => void checkLicense(), 20000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [session, lockWorkspace])

  const contextValue = useMemo(
    () => ({
      session: session as AppSession,
      permissions,
      refreshKey,
      refresh,
      notify,
      logout,
    }),
    [session, permissions, refreshKey, refresh, notify, logout],
  )

  const toastView = (
    <div className="fixed bottom-5 right-5 z-[100] flex w-full max-w-sm flex-col gap-2 no-print">
      {toasts.map((toast) => (
        <div key={toast.id} className={`rounded-lg border px-4 py-3 text-sm shadow-xl ${toastTone[toast.tone]}`}>
          {toast.text}
        </div>
      ))}
    </div>
  )

  if (lockout) {
    return (
      <ErrorBoundary>
        <LicenseLockout info={lockout} onBack={() => setLockout(null)} />
        {toastView}
      </ErrorBoundary>
    )
  }

  if (!session) {
    return (
      <ErrorBoundary>
        <LoginPage onSuccess={setSession} />
        {!isConfigured && (
          <div className="fixed bottom-5 left-5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Supabase environment variables are not configured.
          </div>
        )}
        {toastView}
      </ErrorBoundary>
    )
  }

  const renderPage = (): React.ReactNode => {
    switch (activePage) {
      case 'customers': return <CustomersPage />
      case 'products': return <ProductsPage />
      case 'prices': return <PriceListPage />
      case 'stock': return <StockPage />
      case 'quotations': return <QuotationsPage />
      case 'orders': return <OrdersPage />
      case 'gdn': return <GdnPage />
      case 'gatepass': return <GatePassPage />
      case 'invoices': return <InvoicesPage />
      case 'receipts': return <ReceiptsPage />
      case 'ledger': return <LedgerPage />
      case 'tracking': return <TrackingPage />
      case 'reports': return <ReportsPage />
      case 'admin': return <AdminPage />
      default: return <DashboardPage onNavigate={setActivePage} />
    }
  }

  return (
    <ErrorBoundary>
      <AppContext.Provider value={contextValue}>
        {isCustomerUser(session) ? (
          <CustomerPortalPage />
        ) : (
          <AppLayout
            activePage={activePage}
            onNavigate={setActivePage}
            mobileOpen={mobileOpen}
            onToggleMobile={() => setMobileOpen((open) => !open)}
          >
            {renderPage()}
          </AppLayout>
        )}
        {toastView}
      </AppContext.Provider>
    </ErrorBoundary>
  )
}
