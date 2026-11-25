'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Building2, KeyRound, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react'
import { checkCompany } from '@/lib/api'
import { errorMessage } from '@/lib/format'
import { useApp } from './AppProvider'
import { CompanyLogo } from './CompanyLogo'
import { DeveloperBadge, DeveloperFooter } from './DeveloperBranding'
import { Button, Field, Notice } from './Ui'

const LOCKED_CODE = (process.env.NEXT_PUBLIC_LOCKED_COMPANY_CODE || '').trim().toUpperCase()
const LOCKED_NAME = process.env.NEXT_PUBLIC_LOCKED_COMPANY_NAME || ''
const LOCKED_EXPIRY = process.env.NEXT_PUBLIC_LOCKED_EXPIRY_DATE || ''

export function LoginPage() {
  const { login } = useApp()
  const [companyCode, setCompanyCode] = useState(LOCKED_CODE || 'OZONE')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState(LOCKED_NAME)
  const [logoUrl, setLogoUrl] = useState('')
  const [companyNote, setCompanyNote] = useState('')
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)
  const [lockInfo, setLockInfo] = useState<{ isDemoExpired?: boolean; ownerContact?: string }>({})
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)

  const verifyCompany = useCallback(async (code: string, strict = false) => {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length < 3) return
    setChecking(true)
    try {
      const result = await checkCompany(trimmed)
      if (result.locked) {
        setLocked(true)
        setError(result.message)
        setLockInfo({ isDemoExpired: result.demo_expired, ownerContact: result.owner_contact_info || '' })
        return
      }
      if (result.exists) {
        setCompanyName(result.company_name)
        setLogoUrl(result.logo_url || '')
        setCompanyNote('Company verified · secure channel ready')
        if (strict) setError('')
        return
      }
      setCompanyName('')
      setLogoUrl('')
      setCompanyNote('')
      if (strict) setError('Company code not found')
    } catch (caught) {
      if (strict) setError(errorMessage(caught))
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    if (!LOCKED_EXPIRY) return
    const expiry = new Date(`${LOCKED_EXPIRY}T23:59:59`).getTime()
    if (Number.isFinite(expiry) && expiry < Date.now()) {
      setLocked(true)
      setError('License Expired – Contact Administrator')
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = (params.get('company') || params.get('companyCode') || params.get('code') || '').trim().toUpperCase()
    if (!code) return
    setCompanyCode(code)
    void verifyCompany(code, true)
  }, [verifyCompany])

  useEffect(() => {
    const code = companyCode.trim().toUpperCase()
    if (code.length < 3 || code === LOCKED_CODE) return
    const timer = window.setTimeout(() => void verifyCompany(code), 550)
    return () => window.clearTimeout(timer)
  }, [companyCode, verifyCompany])

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLocked(false)
    if (!companyCode.trim() || !username.trim() || !password) {
      setError('Enter company code, username and password')
      return
    }
    setBusy(true)
    try {
      await login(companyCode, username, password)
    } catch (caught) {
      const message = errorMessage(caught)
      if (message.toLowerCase().includes('license') || message.toLowerCase().includes('demo period') || message.toLowerCase().includes('locked')) {
        setLocked(true)
        setError(message)
      } else {
        setError(message)
      }
    } finally {
      setBusy(false)
    }
  }

  if (locked) {
    const wa = lockInfo.ownerContact?.replace(/[^0-9]/g, '')
    return (
      <main className="login-shell relative flex min-h-screen items-center justify-center overflow-hidden p-4 pb-20">
        <div className="pointer-events-none absolute inset-0 opacity-[0.1]" style={{ backgroundImage: 'linear-gradient(rgba(34,211,238,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.25) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
        <div className="glass-panel relative w-full max-w-md rounded-3xl p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/40 bg-rose-500/10 text-rose-300">
            <LockKeyhole className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-extrabold text-rose-200">{lockInfo.isDemoExpired ? 'Demo Period (7 Days) Has Expired — System Auto-Locked' : 'System Access Locked'}</h1>
          <p className="mt-3 text-xs text-slate-400">{lockInfo.isDemoExpired ? 'Please contact the Owner to activate your full license.' : error}</p>
          <p className="mt-2 text-xs text-slate-400">ڈیمو کی مدت (7 دن) ختم ہو گئی ہے — سسٹم خودکار طور پر لاک ہو گیا ہے۔ براہ کرم مکمل لائسنس کے لیے مالک سے رابطہ کریں۔</p>
          {lockInfo.ownerContact && <p className="mt-3 text-xs font-semibold text-cyan-200">Owner Contact: {lockInfo.ownerContact}</p>}
          {wa && <a className="mt-4 inline-block rounded-lg neon-button px-4 py-2 text-xs font-bold" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">Contact on WhatsApp</a>}
          <div className="mt-5">
            <Button variant="secondary" className="w-full" onClick={() => { setLocked(false); setError(''); setLockInfo({}); setCompanyNote('') }}>Back to company code</Button>
          </div>
          <DeveloperBadge compact />
        </div>
        <DeveloperFooter />
      </main>
    )
  }

  return (
    <main className="login-shell relative flex min-h-screen items-center justify-center overflow-hidden p-4 pb-20">
      <div className="pointer-events-none absolute inset-0 opacity-[0.1]" style={{ backgroundImage: 'linear-gradient(rgba(34,211,238,.25) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.25) 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
      <div className="glass-panel relative w-full max-w-md rounded-3xl p-6 sm:p-8">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-cyan-300/45 bg-slate-950/80 shadow-[0_0_34px_rgba(6,182,212,.25)]">
            <ShieldCheck className="absolute h-9 w-9 text-cyan-300" />
            <CompanyLogo url={logoUrl} companyCode={companyCode} companyName={companyName || LOCKED_NAME} className="relative z-10 max-h-14 max-w-[76px]" />
          </div>
          <div className="mt-4 inline-flex max-w-full items-center gap-2 truncate rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200">
            <Building2 className="h-3 w-3 shrink-0" />
            {companyName || LOCKED_NAME || 'OZONE ENTERPRISE ERP'}
          </div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white">Secure Enterprise Access</h1>
          <p className="mt-1 text-xs text-slate-400">{companyCode ? `${companyCode.toUpperCase()} · Sign in to continue` : 'Multi-company voucher & inventory management'}</p>
          <p className={`mt-1 text-[10px] font-semibold ${checking ? 'text-cyan-400' : 'text-emerald-300'}`}>{checking ? 'Verifying company…' : companyNote}</p>
        </div>

        <form onSubmit={submitLogin} className="space-y-4">
          {error && <Notice type="error">{error}</Notice>}
          <Field label="Company Code">
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-400/70" />
              <input
                className="field-input h-11 pl-10 uppercase tracking-wider"
                value={companyCode}
                onChange={(event) => setCompanyCode(event.target.value.toUpperCase())}
                placeholder="OZONE"
                autoComplete="organization"
                readOnly={Boolean(LOCKED_CODE)}
              />
            </div>
          </Field>
          <p className="-mt-2 text-[10px] text-slate-500">Company code auto-fills from ?company=CODE</p>
          <Field label="Username">
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-400/70" />
              <input
                className="field-input h-11 pl-10"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter username"
                autoComplete="username"
                autoFocus
              />
            </div>
          </Field>
          <Field label="Password">
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-400/70" />
              <input
                className="field-input h-11 pl-10"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
              />
            </div>
          </Field>
          <Button className="neon-button mt-2 w-full py-2.5 text-sm" type="submit" disabled={busy}>
            {busy ? 'Authenticating…' : <>Sign In <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </form>
        <DeveloperBadge />
      </div>
      <DeveloperFooter />
    </main>
  )
}
