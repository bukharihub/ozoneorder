'use client'

import React from 'react'
import { Code2, ShieldCheck } from 'lucide-react'

export const DEVELOPER_NAME = 'Syed Shoaib Ali Shah Bukhari (Bukharihub)'
export const DEVELOPER_COPYRIGHT = '© 2026 Syed Shoaib Ali Shah Bukhari (Bukharihub). All Rights Reserved.'
export const DEVELOPER_FOOTER_TEXT = `Engineered & Developed by ${DEVELOPER_NAME} • © 2026 All Rights Reserved`

export function DeveloperBadge({ compact = false }: { compact?: boolean }) {
  return (
    <div className="print-hidden glass-static mt-5 flex items-center gap-3 rounded-xl border-cyan-400/25 bg-slate-950/70 p-3 text-left shadow-[0_0_18px_rgba(6,182,212,.12)]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,.25)]">
        <Code2 className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-cyan-300">Developer Attribution</p>
        <p className="mt-0.5 text-[11px] font-semibold text-cyan-50">Developed by {DEVELOPER_NAME}</p>
        {!compact && <p className="mt-0.5 text-[9px] leading-snug text-slate-400">{DEVELOPER_COPYRIGHT}</p>}
      </div>
    </div>
  )
}

export function DeveloperSidebarBadge() {
  return (
    <div className="print-hidden mt-4 rounded-xl border border-cyan-400/25 bg-slate-950/70 p-2.5 shadow-[0_0_16px_rgba(6,182,212,.1)]">
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-400">
        <ShieldCheck className="h-3 w-3" />
        Developer
      </div>
      <p className="mt-1 text-[9px] leading-relaxed text-cyan-100/80">{DEVELOPER_FOOTER_TEXT}</p>
    </div>
  )
}

export function DeveloperFooter() {
  return (
    <footer className="print-hidden fixed inset-x-0 bottom-0 z-30 border-t border-cyan-400/25 bg-slate-950/90 px-4 py-2 shadow-[0_-8px_26px_rgba(2,6,23,.5)] backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
        <Code2 className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
        <span className="text-[10px] font-semibold tracking-wide text-cyan-100 sm:text-[11px]">{DEVELOPER_FOOTER_TEXT}</span>
      </div>
    </footer>
  )
}
