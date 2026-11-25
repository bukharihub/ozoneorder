'use client'

import React from 'react'

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'dark'
}) {
  const variants: Record<string, string> = {
    primary: 'neon-button border border-cyan-300/50',
    secondary: 'border border-cyan-400/30 bg-slate-900/85 text-cyan-100 hover:bg-slate-800 hover:text-white',
    danger: 'border border-rose-400/40 bg-rose-600/85 text-white hover:bg-rose-500',
    ghost: 'border border-transparent bg-transparent text-cyan-100 hover:bg-cyan-400/10 hover:text-white',
    dark: 'border border-indigo-400/35 bg-slate-950/85 text-white hover:bg-slate-900',
  }
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Card({ title, subtitle, actions, children }: {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="glass-panel rounded-2xl">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-400/20 px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-bold text-cyan-50">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function Field({ label, children, className = '' }: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={className}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

export function Notice({ type = 'info', children }: {
  type?: 'info' | 'error' | 'success' | 'warn'
  children: React.ReactNode
}) {
  const styles: Record<string, string> = {
    info: 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100',
    error: 'border-rose-400/35 bg-rose-500/10 text-rose-100',
    success: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100',
    warn: 'border-amber-400/35 bg-amber-500/10 text-amber-100',
  }
  return <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${styles[type]}`}>{children}</div>
}

export function Toast({ type = 'success', message, onClose }: {
  type?: 'success' | 'error'
  message: string
  onClose: () => void
}) {
  const styles: Record<string, string> = {
    success: 'border-emerald-400/50 bg-emerald-950/95 text-emerald-100',
    error: 'border-rose-400/50 bg-rose-950/95 text-rose-100',
  }
  return (
    <div className={`fixed bottom-5 right-5 z-[60] flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 text-xs font-semibold shadow-2xl backdrop-blur ${styles[type]}`} role="status">
      <span className="flex-1 leading-relaxed">{message}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss notification" className="opacity-70 hover:opacity-100">✕</button>
    </div>
  )
}

export function Modal({ title, onClose, children, wide = false }: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/80 p-4 backdrop-blur-sm">
      <div className={`glass-panel max-h-[92vh] w-full overflow-auto rounded-2xl ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-cyan-400/20 bg-slate-950/90 px-4 py-3">
          <h3 className="text-sm font-bold text-cyan-50">{title}</h3>
          <Button variant="ghost" onClick={onClose} aria-label="Close">✕</Button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-cyan-400/25 px-4 py-8 text-center text-xs text-slate-400">{children}</div>
}

export function Stat({ label, value, tone = 'blue' }: { label: string; value: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    blue: 'text-cyan-300',
    green: 'text-emerald-300',
    amber: 'text-amber-300',
    slate: 'text-cyan-50',
  }
  return (
    <div className="glass-static rounded-xl p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-2 text-xl font-bold ${tones[tone] || tones.blue}`}>{value}</p>
    </div>
  )
}
