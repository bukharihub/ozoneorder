'use client'

import React from 'react'
import { AppProvider, useApp } from '@/components/AppProvider'
import { AppShell } from '@/components/AppShell'
import { DeveloperFooter } from '@/components/DeveloperBranding'
import { LoginPage } from '@/components/LoginPage'

function Root() {
  const { ready, session } = useApp()
  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 pb-20 text-xs text-slate-300">Loading OZONE ERP…<DeveloperFooter /></div>
  }
  return session ? <AppShell /> : <LoginPage />
}

export default function Home() {
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  )
}
