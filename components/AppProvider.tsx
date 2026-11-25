'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authenticate, companyTables, signOut } from '@/lib/api'
import { clearSession, getSession, saveSession } from '@/lib/session'
import type { AppPage, PipelineSeed, Session, SessionCompany } from '@/lib/types'

interface AppContextValue {
  session: Session | null
  ready: boolean
  tables: ReturnType<typeof companyTables> | null
  page: AppPage
  pipelineSeed: PipelineSeed | null
  login: (companyCode: string, username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  navigate: (page: AppPage, seed?: PipelineSeed) => void
  clearPipelineSeed: () => void
  updateCompany: (patch: Partial<SessionCompany>) => void
  showPrint: (content: React.ReactNode) => void
  bump: () => void
  version: number
}

const AppContext = createContext<AppContextValue | null>(null)

export const useApp = () => {
  const value = useContext(AppContext)
  if (!value) throw new Error('AppProvider is missing')
  return value
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [printContent, setPrintContent] = useState<React.ReactNode>(null)
  const [version, setVersion] = useState(0)
  const [page, setPage] = useState<AppPage>('dashboard')
  const [pipelineSeed, setPipelineSeed] = useState<PipelineSeed | null>(null)

  useEffect(() => {
    const stored = getSession()
    const lockedCode = (process.env.NEXT_PUBLIC_LOCKED_COMPANY_CODE || '').trim().toUpperCase()
    if (stored && lockedCode && stored.company.company_code.toUpperCase() !== lockedCode) clearSession()
    else setSession(stored)
    setReady(true)
    const handler = () => setPrintContent(null)
    window.addEventListener('afterprint', handler)
    return () => window.removeEventListener('afterprint', handler)
  }, [])

  const login = useCallback(async (companyCode: string, username: string, password: string) => {
    const next = await authenticate(companyCode, username, password)
    setSession(next)
    setPage('dashboard')
    setPipelineSeed(null)
    setVersion((value) => value + 1)
  }, [])

  const logout = useCallback(async () => {
    try {
      await signOut()
    } finally {
      clearSession()
      setSession(null)
      setPage('dashboard')
      setPipelineSeed(null)
    }
  }, [])

  const showPrint = useCallback((content: React.ReactNode) => {
    setPrintContent(content)
    window.setTimeout(() => window.print(), 80)
  }, [])

  const navigate = useCallback((next: AppPage, seed?: PipelineSeed) => {
    setPage(next)
    setPipelineSeed(seed || null)
  }, [])

  const clearPipelineSeed = useCallback(() => setPipelineSeed(null), [])

  const updateCompany = useCallback((patch: Partial<SessionCompany>) => {
    setSession((current) => {
      if (!current) return current
      const next = { ...current, company: { ...current.company, ...patch } }
      saveSession(next)
      return next
    })
  }, [])

  const bump = useCallback(() => setVersion((value) => value + 1), [])

  const value = useMemo<AppContextValue>(
    () => ({
      session,
      ready,
      tables: session ? companyTables(session.company.company_code) : null,
      page,
      pipelineSeed,
      login,
      logout,
      navigate,
      clearPipelineSeed,
      updateCompany,
      showPrint,
      bump,
      version,
    }),
    [session, ready, page, pipelineSeed, login, logout, navigate, clearPipelineSeed, updateCompany, showPrint, bump, version],
  )

  return (
    <AppContext.Provider value={value}>
      {children}
      <div className="print-root">{printContent}</div>
    </AppContext.Provider>
  )
}
