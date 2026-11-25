'use client'

import React, { useMemo, useState } from 'react'
import {
  Activity,
  Banknote,
  Boxes,
  Cloud,
  Database,
  Globe2,
  PackageCheck,
  ShoppingCart,
  Smartphone,
  TrendingUp,
  Users,
  Warehouse,
} from 'lucide-react'
import { listAllRows } from '@/lib/api'
import { money, quantity } from '@/lib/format'
import { isConfigured } from '@/lib/supabase'
import type { Customer, LedgerRow, LineItem, Product } from '@/lib/types'
import { useRows } from '@/lib/useRows'
import { useApp } from '../AppProvider'
import { Notice } from '../Ui'

type Segment = { label: string; value: number; percent: number; color: string }

const number = (value: any) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const lineItems = (row: LedgerRow): LineItem[] => (Array.isArray(row.line_items) ? row.line_items : [])

const cartonCount = (row: LedgerRow, field: 'ordered_ctns' | 'delivered_ctns') => {
  const lines = lineItems(row)
  if (lines.length) return lines.reduce((sum, item) => sum + number(item[field]), 0)
  return number(row.total_cartons)
}

const documentValue = (row: LedgerRow) => number(row.net_invoice_total || row.total_exclusive_value)

const rowDate = (row: LedgerRow) => row.voucher_date || row.created_at

const isoDay = (value: any) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const monthKey = (value: any) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

const weekKey = (value: any) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const mondayOffset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - mondayOffset)
  return date.toISOString().slice(0, 10)
}

const lastMonths = (count: number) => {
  const now = new Date()
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - index), 1))
    return date.toISOString().slice(0, 7)
  })
}

const lastDays = (count: number) => {
  const now = new Date()
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now)
    date.setUTCDate(date.getUTCDate() - (count - 1 - index))
    return date.toISOString().slice(0, 10)
  })
}

const lastWeeks = (count: number) => {
  const current = weekKey(new Date())
  const base = new Date(`${current}T00:00:00Z`)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(base)
    date.setUTCDate(date.getUTCDate() - (count - 1 - index) * 7)
    return date.toISOString().slice(0, 10)
  })
}

const aggregateByMonth = (rows: LedgerRow[], keys: string[], value: (row: LedgerRow) => number) => {
  const totals = new Map(keys.map((key) => [key, 0]))
  rows.forEach((row) => {
    const key = monthKey(rowDate(row))
    if (totals.has(key)) totals.set(key, (totals.get(key) || 0) + value(row))
  })
  return keys.map((key) => totals.get(key) || 0)
}

const compactPkr = (value: number) => {
  const absolute = Math.abs(value)
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return `${Math.round(value)}`
}

function Panel({ title, subtitle, badge, className = '', children }: {
  title: string
  subtitle?: string
  badge?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={`dash-panel ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-400/15 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-cyan-50">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p>}
        </div>
        {badge}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function KpiCard({ label, value, note, icon, accent, iconClass, visual }: {
  label: string
  value: string
  note: string
  icon: React.ReactNode
  accent: string
  iconClass: string
  visual: React.ReactNode
}) {
  return (
    <div className="kpi-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <p className={`mt-2 truncate text-2xl font-extrabold tracking-tight ${accent}`}>{value}</p>
          <p className="mt-1 truncate text-[10px] text-slate-500">{note}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 ${iconClass}`}>{icon}</div>
      </div>
      <div className="mt-3 h-10">{visual}</div>
    </div>
  )
}

function Sparkline({ id, values, color }: { id: string; values: number[]; color: string }) {
  const width = 160
  const height = 42
  const pad = 3
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : width - pad * 2
  const points = values.map((value, index) => ({
    x: pad + index * step,
    y: height - pad - (value / max) * (height - pad * 2),
  }))
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const area = points.length
    ? `${line} L ${points[points.length - 1].x} ${height - pad} L ${points[0].x} ${height - pad} Z`
    : ''

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.42" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
        <filter id={`spark-glow-${id}`} x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="1.6" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {area && <path d={area} fill={`url(#spark-${id})`} />}
      {line && <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" filter={`url(#spark-glow-${id})`} />}
    </svg>
  )
}

function MiniBars({ values, color }: { values: number[]; color: string }) {
  return (
    <div className="flex h-10 items-end gap-1.5">
      {values.map((value, index) => (
        <div key={index} className="flex-1 rounded-t-sm bg-slate-800/80" style={{ height: '100%' }}>
          <div
            className="h-full w-full rounded-t-sm"
            style={{ height: `${Math.max(4, Math.min(100, value))}%`, background: `linear-gradient(180deg, ${color}, ${color}44)`, boxShadow: `0 0 10px ${color}55` }}
          />
        </div>
      ))}
    </div>
  )
}

function TrendChart({ labels, orders, revenue }: { labels: string[]; orders: number[]; revenue: number[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const width = 760
  const height = 250
  const left = 58
  const right = 18
  const top = 18
  const bottom = 32
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const max = Math.max(1, ...orders, ...revenue)
  const x = (index: number) => left + (labels.length > 1 ? (index * plotWidth) / (labels.length - 1) : plotWidth / 2)
  const y = (value: number) => top + plotHeight - (value / max) * plotHeight
  const linePath = (values: number[]) => values.map((value, index) => `${index === 0 ? 'M' : 'L'} ${x(index)} ${y(value)}`).join(' ')
  const areaPath = (values: number[]) => values.length
    ? `${linePath(values)} L ${x(values.length - 1)} ${top + plotHeight} L ${x(0)} ${top + plotHeight} Z`
    : ''
  const ticks = [0, max / 2, max]
  const hoverWidth = labels.length > 1 ? plotWidth / (labels.length - 1) : plotWidth

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[250px] w-full" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="trend-order-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="trend-revenue-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
          </linearGradient>
          <filter id="trend-glow" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {ticks.map((tick, index) => (
          <g key={index}>
            <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="rgba(148,163,184,.14)" strokeDasharray="4 5" />
            <text x={left - 10} y={y(tick) + 4} textAnchor="end" fill="#64748b" fontSize="10">{compactPkr(tick)}</text>
          </g>
        ))}

        <path d={areaPath(orders)} fill="url(#trend-order-area)" />
        <path d={areaPath(revenue)} fill="url(#trend-revenue-area)" />
        <path d={linePath(orders)} fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinejoin="round" filter="url(#trend-glow)" />
        <path d={linePath(revenue)} fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinejoin="round" filter="url(#trend-glow)" />

        {labels.map((label, index) => (
          <g key={`${label}-${index}`}>
            <text x={x(index)} y={height - 8} textAnchor="middle" fill="#64748b" fontSize="10">{label}</text>
            <rect
              x={x(index) - hoverWidth / 2}
              y={top}
              width={hoverWidth}
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
            />
          </g>
        ))}

        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={top} y2={top + plotHeight} stroke="rgba(34,211,238,.5)" strokeDasharray="3 4" />
            <circle cx={x(hover)} cy={y(orders[hover] || 0)} r="4" fill="#22d3ee" stroke="#fff" strokeWidth="1.5" />
            <circle cx={x(hover)} cy={y(revenue[hover] || 0)} r="4" fill="#818cf8" stroke="#fff" strokeWidth="1.5" />
          </g>
        )}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 rounded-lg border border-cyan-400/35 bg-slate-950/95 px-3 py-2 text-[10px] shadow-xl"
          style={{ left: `${Math.min(84, Math.max(12, (x(hover) / width) * 100))}%`, top: 8 }}
        >
          <p className="font-bold text-cyan-200">{labels[hover]}</p>
          <p className="mt-1 text-cyan-300">Sales Orders: PKR {money(orders[hover] || 0, 0)}</p>
          <p className="text-indigo-300">Invoiced: PKR {money(revenue[hover] || 0, 0)}</p>
        </div>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-4 text-[10px] text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />Sales Order Value (PKR)</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />Invoiced Revenue (PKR)</span>
      </div>
    </div>
  )
}

function DonutChart({ segments, total }: { segments: Segment[]; total: number }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  let offset = 0
  const arcs = segments.filter((segment) => segment.value > 0).map((segment) => {
    const dash = (segment.value / Math.max(total, 1)) * circumference
    const arc = (
      <circle
        key={segment.label}
        cx="70"
        cy="70"
        r={radius}
        fill="none"
        stroke={segment.color}
        strokeWidth="16"
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={-offset}
        strokeLinecap="butt"
        transform="rotate(-90 70 70)"
        style={{ filter: `drop-shadow(0 0 5px ${segment.color}aa)` }}
      />
    )
    offset += dash
    return arc
  })

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative h-[140px] w-[140px] shrink-0">
        <svg viewBox="0 0 140 140" className="h-full w-full">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(51,65,85,.7)" strokeWidth="16" />
          {arcs}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-extrabold text-white">{total}</span>
          <span className="text-[9px] uppercase tracking-wider text-slate-500">Orders</span>
        </div>
      </div>
      <div className="grid min-w-[190px] flex-1 grid-cols-2 gap-2">
        {segments.map((segment) => (
          <div key={segment.label} className="rounded-lg border border-cyan-400/15 bg-slate-950/55 px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span className="h-2 w-2 rounded-full" style={{ background: segment.color, boxShadow: `0 0 7px ${segment.color}` }} />
              <span className="truncate">{segment.label}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-sm font-extrabold text-cyan-50">{segment.percent.toFixed(1)}%</span>
              <span className="text-[10px] text-slate-500">{segment.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RevenueBars({ labels, sales, dispatch }: { labels: string[]; sales: number[]; dispatch: number[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const width = 760
  const height = 220
  const left = 52
  const right = 14
  const top = 18
  const bottom = 30
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const max = Math.max(1, ...sales, ...dispatch)
  const groupWidth = plotWidth / Math.max(labels.length, 1)
  const barWidth = Math.max(5, Math.min(17, groupWidth * 0.26))
  const y = (value: number) => top + plotHeight - (value / max) * plotHeight
  const ticks = [0, max / 2, max]

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] w-full" onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="bar-sales" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#0891b2" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
          <linearGradient id="bar-dispatch" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#4338ca" />
            <stop offset="100%" stopColor="#a5b4fc" />
          </linearGradient>
          <filter id="bar-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {ticks.map((tick, index) => (
          <g key={index}>
            <line x1={left} x2={width - right} y1={y(tick)} y2={y(tick)} stroke="rgba(148,163,184,.14)" strokeDasharray="4 5" />
            <text x={left - 8} y={y(tick) + 4} textAnchor="end" fill="#64748b" fontSize="10">{compactPkr(tick)}</text>
          </g>
        ))}

        {labels.map((label, index) => {
          const center = left + groupWidth * index + groupWidth / 2
          return (
            <g key={`${label}-${index}`}>
              <rect x={center - barWidth - 2} y={y(sales[index] || 0)} width={barWidth} height={Math.max(0, top + plotHeight - y(sales[index] || 0))} rx="3" fill="url(#bar-sales)" filter="url(#bar-glow)" />
              <rect x={center + 2} y={y(dispatch[index] || 0)} width={barWidth} height={Math.max(0, top + plotHeight - y(dispatch[index] || 0))} rx="3" fill="url(#bar-dispatch)" filter="url(#bar-glow)" />
              <text x={center} y={height - 8} textAnchor="middle" fill="#64748b" fontSize="10">{label}</text>
              <rect x={center - groupWidth / 2} y={top} width={groupWidth} height={plotHeight} fill="transparent" onMouseEnter={() => setHover(index)} />
            </g>
          )
        })}

        {hover !== null && (
          <line x1={left + groupWidth * hover + groupWidth / 2} x2={left + groupWidth * hover + groupWidth / 2} y1={top} y2={top + plotHeight} stroke="rgba(34,211,238,.4)" strokeDasharray="3 4" />
        )}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 rounded-lg border border-cyan-400/35 bg-slate-950/95 px-3 py-2 text-[10px] shadow-xl"
          style={{ left: `${Math.min(86, Math.max(12, ((left + groupWidth * hover + groupWidth / 2) / width) * 100))}%`, top: 8 }}
        >
          <p className="font-bold text-cyan-200">{labels[hover]}</p>
          <p className="mt-1 text-cyan-300">Sales: PKR {money(sales[hover] || 0, 0)}</p>
          <p className="text-indigo-300">Dispatched: PKR {money(dispatch[hover] || 0, 0)}</p>
        </div>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-4 text-[10px] text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-400" />Sales</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-400" />Dispatched</span>
      </div>
    </div>
  )
}

function SystemBar({ systems }: { systems: Array<{ label: string; detail: string; ok: boolean; icon: React.ReactNode }> }) {
  const allOnline = systems.every((system) => system.ok)
  return (
    <section className="dash-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-cyan-50">Frontend ➔ Core ERP Engine ➔ Backend</p>
            <p className="text-[10px] text-slate-500">Live connected system architecture</p>
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-bold ${allOnline ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-300' : 'border-amber-400/35 bg-amber-500/10 text-amber-300'}`}>
          {allOnline ? 'All systems online' : 'Syncing systems'}
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {systems.map((system) => (
          <div key={system.label} className="flex items-center gap-2.5 rounded-xl border border-cyan-400/15 bg-slate-950/55 px-3 py-2.5">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${system.ok ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300' : 'border-amber-400/25 bg-amber-500/10 text-amber-300'}`}>
              {system.icon}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold text-cyan-50">{system.label}</p>
              <p className="truncate text-[10px] text-slate-500">{system.detail}</p>
            </div>
            <span className={`ml-auto h-2 w-2 shrink-0 rounded-full ${system.ok ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'}`} />
          </div>
        ))}
      </div>
    </section>
  )
}

export function Dashboard() {
  const { session, tables, version } = useApp()
  const [rangeMode, setRangeMode] = useState<'daily' | 'weekly'>('daily')

  const ledger = useRows<LedgerRow>(
    () => (tables ? listAllRows<LedgerRow>(tables.ledger, { order: 'voucher_date' }) : Promise.resolve([])),
    [tables?.ledger, version],
  )
  const products = useRows<Product>(
    () => (tables ? listAllRows<Product>(tables.products, { order: 'product_name' }) : Promise.resolve([])),
    [tables?.products, version],
  )
  const customers = useRows<Customer>(
    () => (tables ? listAllRows<Customer>(tables.customers, { order: 'business_name' }) : Promise.resolve([])),
    [tables?.customers, version],
  )

  const analytics = useMemo(() => {
    const orders = ledger.rows.filter((row) => row.voucher_type === 'SALES_ORDER')
    const gdns = ledger.rows.filter((row) => row.voucher_type === 'GDN_GATE_PASS')
    const invoices = ledger.rows.filter((row) => row.voucher_type === 'SALES_TAX_INVOICE')
    const receipts = ledger.rows.filter((row) => row.voucher_type === 'BANK_RECEIPT')

    const orderedCartons = orders.reduce((sum, row) => sum + cartonCount(row, 'ordered_ctns'), 0)
    const dispatchedCartons = gdns.reduce((sum, row) => sum + cartonCount(row, 'delivered_ctns'), 0)
    const invoiceTotal = invoices.reduce((sum, row) => sum + documentValue(row), 0)
    const collected = receipts.reduce((sum, row) => sum + number(row.bank_receipt_amount), 0)
    const orderValue = orders.reduce((sum, row) => sum + documentValue(row), 0)
    const fulfillment = orderedCartons > 0 ? Math.min(100, (dispatchedCartons / orderedCartons) * 100) : 0
    const recovery = invoiceTotal > 0 ? Math.min(100, (collected / invoiceTotal) * 100) : 0

    const monthlyKeys = lastMonths(6)
    const orderCountValues = aggregateByMonth(orders, monthlyKeys, () => 1)
    const orderValueValues = aggregateByMonth(orders, monthlyKeys, documentValue)
    const revenueValues = aggregateByMonth(invoices, monthlyKeys, documentValue)
    const orderedMonthly = aggregateByMonth(orders, monthlyKeys, (row) => cartonCount(row, 'ordered_ctns'))
    const dispatchedMonthly = aggregateByMonth(gdns, monthlyKeys, (row) => cartonCount(row, 'delivered_ctns'))
    const invoicedMonthly = aggregateByMonth(invoices, monthlyKeys, documentValue)
    const collectedMonthly = aggregateByMonth(receipts, monthlyKeys, (row) => number(row.bank_receipt_amount))
    const fulfillmentBars = orderedMonthly.map((value, index) => (value > 0 ? Math.min(100, (dispatchedMonthly[index] / value) * 100) : 0))
    const recoveryBars = invoicedMonthly.map((value, index) => (value > 0 ? Math.min(100, (collectedMonthly[index] / value) * 100) : 0))

    const productNames = new Map(products.rows.map((product) => [product.id, product.product_name]))
    const stats = new Map<string, { name: string; cartons: number }>()
    orders.forEach((row) => lineItems(row).forEach((item) => {
      const key = item.product_id || item.product_name
      if (!key) return
      const entry = stats.get(key) || { name: item.product_name || productNames.get(item.product_id) || 'Unknown product', cartons: 0 }
      entry.cartons += number(item.ordered_ctns)
      stats.set(key, entry)
    }))
    const topProducts = [...stats.values()].sort((a, b) => b.cartons - a.cartons).slice(0, 5)

    const orderCounts = new Map<string, number>()
    orders.forEach((row) => {
      const key = row.customer_id || (row.customer_name || '').trim().toLowerCase()
      if (!key) return
      orderCounts.set(key, (orderCounts.get(key) || 0) + 1)
    })
    const repeatCustomers = [...orderCounts.values()].filter((count) => count > 1).length
    const activeCustomers = customers.rows.length || orderCounts.size
    const repeatRate = orderCounts.size ? (repeatCustomers / orderCounts.size) * 100 : 0
    const avgOrderValue = orders.length ? orderValue / orders.length : 0

    const sources = { registered: 0, unregistered: 0, booker: 0, direct: 0 }
    orders.forEach((row) => {
      if (row.booked_by_user_id || row.booked_by_name) sources.booker += 1
      else if (row.registration_status === 'Register') sources.registered += 1
      else if (row.registration_status === 'Unregister') sources.unregistered += 1
      else sources.direct += 1
    })
    const sourceSegments: Segment[] = [
      { label: 'Registered Customers', value: sources.registered, percent: orders.length ? (sources.registered / orders.length) * 100 : 0, color: '#22d3ee' },
      { label: 'Unregistered Customers', value: sources.unregistered, percent: orders.length ? (sources.unregistered / orders.length) * 100 : 0, color: '#38bdf8' },
      { label: 'Distributor / Booker Group', value: sources.booker, percent: orders.length ? (sources.booker / orders.length) * 100 : 0, color: '#818cf8' },
      { label: 'Direct Orders', value: sources.direct, percent: orders.length ? (sources.direct / orders.length) * 100 : 0, color: '#f472b6' },
    ]

    return {
      orders, gdns, invoices, receipts,
      orderedCartons, dispatchedCartons, invoiceTotal, collected, orderValue,
      fulfillment, recovery,
      monthlyKeys, orderCountValues, orderValueValues, revenueValues, fulfillmentBars, recoveryBars,
      topProducts, activeCustomers, repeatRate, avgOrderValue, sourceSegments,
    }
  }, [ledger.rows, products.rows, customers.rows])

  const rangeBars = useMemo(() => {
    const keys = rangeMode === 'daily' ? lastDays(7) : lastWeeks(6)
    const bucket = (value: any) => (rangeMode === 'daily' ? isoDay(value) : weekKey(value))
    const salesMap = new Map(keys.map((key) => [key, 0]))
    const dispatchMap = new Map(keys.map((key) => [key, 0]))
    const collectMap = new Map(keys.map((key) => [key, 0]))
    analytics.orders.forEach((row) => {
      const key = bucket(rowDate(row))
      if (salesMap.has(key)) salesMap.set(key, (salesMap.get(key) || 0) + documentValue(row))
    })
    analytics.gdns.forEach((row) => {
      const key = bucket(rowDate(row))
      if (dispatchMap.has(key)) dispatchMap.set(key, (dispatchMap.get(key) || 0) + documentValue(row))
    })
    analytics.receipts.forEach((row) => {
      const key = bucket(rowDate(row))
      if (collectMap.has(key)) collectMap.set(key, (collectMap.get(key) || 0) + number(row.bank_receipt_amount))
    })
    return {
      labels: keys.map((key) => key.slice(5)),
      sales: keys.map((key) => salesMap.get(key) || 0),
      dispatch: keys.map((key) => dispatchMap.get(key) || 0),
      collectedInRange: keys.reduce((sum, key) => sum + (collectMap.get(key) || 0), 0),
    }
  }, [analytics.orders, analytics.gdns, analytics.receipts, rangeMode])

  if (!session || !tables) return null

  const systems = [
    { label: 'Web Portal', detail: 'Frontend online', ok: true, icon: <Globe2 className="h-4 w-4" /> },
    { label: 'Customer App', detail: customers.loading ? 'Syncing profiles' : customers.error ? 'Offline' : `${customers.rows.length} profiles`, ok: isConfigured && !customers.error && !customers.loading, icon: <Smartphone className="h-4 w-4" /> },
    { label: 'FG Inventory', detail: products.loading ? 'Syncing stock' : products.error ? 'Offline' : `${products.rows.length} products`, ok: isConfigured && !products.error && !products.loading, icon: <Warehouse className="h-4 w-4" /> },
    { label: 'Bank Ledger', detail: ledger.loading ? 'Syncing ledger' : ledger.error ? 'Offline' : `${analytics.receipts.length} receipts`, ok: isConfigured && !ledger.error && !ledger.loading, icon: <Database className="h-4 w-4" /> },
    { label: 'Supabase Sync', detail: isConfigured ? 'Realtime backend ready' : 'Backend not configured', ok: isConfigured && !ledger.error && !products.error && !customers.error, icon: <Cloud className="h-4 w-4" /> },
  ]

  const maxProductCartons = Math.max(1, ...analytics.topProducts.map((product) => product.cartons))
  const loading = ledger.loading || products.loading || customers.loading
  const error = ledger.error || products.error || customers.error

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-400/80">Executive Command Center</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Sales Order Dashboard</h1>
          <p className="mt-1 text-xs text-slate-400">
            {session.company.company_name} · License until {session.company.license_expiry_date} · Role {session.user.role}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold text-emerald-200">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          LIVE COMPANY DATA · PKR / CARTONS
        </div>
      </header>

      {(error || loading) && (
        <Notice type={error ? 'error' : 'info'}>
          {error || 'Loading live company data from master ledger, products and customers…'}
        </Notice>
      )}

      <div className="dash-grid">
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-5">
          <KpiCard
            label="Total Sales Orders"
            value={String(analytics.orders.length)}
            note="Live SALES_ORDER records"
            icon={<ShoppingCart className="h-4 w-4" />}
            accent="text-cyan-300"
            iconClass="bg-cyan-400/10 text-cyan-300"
            visual={<Sparkline id="orders" values={analytics.orderCountValues} color="#22d3ee" />}
          />
          <KpiCard
            label="Total Revenue"
            value={`PKR ${money(analytics.invoiceTotal, 0)}`}
            note="Invoiced value · SALES_TAX_INVOICE"
            icon={<Banknote className="h-4 w-4" />}
            accent="text-indigo-300"
            iconClass="bg-indigo-400/10 text-indigo-300"
            visual={<Sparkline id="revenue" values={analytics.revenueValues} color="#818cf8" />}
          />
          <KpiCard
            label="Fulfillment Rate"
            value={`${analytics.fulfillment.toFixed(1)}%`}
            note={`${quantity(analytics.dispatchedCartons)} / ${quantity(analytics.orderedCartons)} cartons dispatched`}
            icon={<PackageCheck className="h-4 w-4" />}
            accent="text-emerald-300"
            iconClass="bg-emerald-400/10 text-emerald-300"
            visual={<MiniBars values={analytics.fulfillmentBars} color="#34d399" />}
          />
          <KpiCard
            label="Recovery Rate"
            value={`${analytics.recovery.toFixed(1)}%`}
            note={`PKR ${money(analytics.collected, 0)} collected of ${money(analytics.invoiceTotal, 0)}`}
            icon={<TrendingUp className="h-4 w-4" />}
            accent="text-amber-300"
            iconClass="bg-amber-400/10 text-amber-300"
            visual={<MiniBars values={analytics.recoveryBars} color="#fbbf24" />}
          />
        </div>

        <Panel
          className="lg:col-span-7"
          title="Revenue & Order Growth"
          subtitle="Monthly sales order value vs invoiced revenue"
          badge={<span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-bold text-cyan-300">LAST 6 MONTHS</span>}
        >
          <TrendChart labels={analytics.monthlyKeys.map((key) => key.slice(5))} orders={analytics.orderValueValues} revenue={analytics.revenueValues} />
        </Panel>

        <Panel className="lg:col-span-4" title="Customer Insights" subtitle="Live customer master & order behavior">
          <div className="space-y-3">
            {[
              { label: 'Active Customers', value: String(analytics.activeCustomers), note: `${customers.rows.length} in customer master`, icon: <Users className="h-4 w-4" />, color: 'text-cyan-300' },
              { label: 'Repeat Order Rate', value: `${analytics.repeatRate.toFixed(1)}%`, note: 'Customers with more than one order', icon: <Activity className="h-4 w-4" />, color: 'text-indigo-300' },
              { label: 'Avg. Order Value', value: `PKR ${money(analytics.avgOrderValue, 0)}`, note: 'Sales order value / order count', icon: <Banknote className="h-4 w-4" />, color: 'text-emerald-300' },
            ].map((tile) => (
              <div key={tile.label} className="flex items-center justify-between gap-3 rounded-xl border border-cyan-400/15 bg-slate-950/55 px-3 py-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{tile.label}</p>
                  <p className={`mt-1 truncate text-lg font-extrabold ${tile.color}`}>{tile.value}</p>
                  <p className="truncate text-[10px] text-slate-500">{tile.note}</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">{tile.icon}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="lg:col-span-8" title="Order Performance" subtitle="Top products ranked by ordered cartons" badge={<span className="rounded-full border border-indigo-400/25 bg-indigo-400/10 px-2.5 py-1 text-[10px] font-bold text-indigo-300">TOP SELLING PRODUCTS</span>}>
          {analytics.topProducts.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">No ordered cartons found in the master ledger yet.</p>
          ) : (
            <div className="space-y-3.5">
              {analytics.topProducts.map((product, index) => (
                <div key={`${product.name}-${index}`}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex min-w-0 items-center gap-2 text-cyan-50">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-cyan-400/25 bg-cyan-400/10 text-[10px] font-bold text-cyan-300">#{index + 1}</span>
                      <span className="truncate">{product.name}</span>
                    </span>
                    <span className="shrink-0 font-bold text-cyan-200">{quantity(product.cartons)} cartons sold</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 shadow-[0_0_12px_rgba(34,211,238,.55)]"
                      style={{ width: `${Math.max(2, (product.cartons / maxProductCartons) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="lg:col-span-5" title="Order Sources & Mix" subtitle="Breakdown of live SALES_ORDER records">
          <DonutChart segments={analytics.sourceSegments} total={analytics.orders.length} />
        </Panel>

        <Panel
          className="lg:col-span-7"
          title="Daily / Weekly Revenue Breakdown"
          subtitle="Sales and dispatched value with collected receipts"
          badge={
            <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold text-emerald-300">
              TOTAL COLLECTED · PKR {money(analytics.collected, 0)}
            </span>
          }
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setRangeMode('daily')}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition ${rangeMode === 'daily' ? 'neon-button' : 'border border-cyan-400/20 text-slate-400 hover:text-cyan-200'}`}
            >
              Daily · 7 days
            </button>
            <button
              onClick={() => setRangeMode('weekly')}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition ${rangeMode === 'weekly' ? 'neon-button' : 'border border-cyan-400/20 text-slate-400 hover:text-cyan-200'}`}
            >
              Weekly · 6 weeks
            </button>
            <span className="ml-auto text-[10px] text-slate-500">Collected in range: PKR {money(rangeBars.collectedInRange, 0)}</span>
          </div>
          <RevenueBars labels={rangeBars.labels} sales={rangeBars.sales} dispatch={rangeBars.dispatch} />
        </Panel>
      </div>

      <SystemBar systems={systems} />
      <div className="flex items-center justify-center gap-2 pb-2 text-[10px] text-slate-600">
        <Boxes className="h-3 w-3" />
        All dashboard figures are calculated from {session.company.company_code.toLowerCase()}_master_ledger, _products and _customers.
      </div>
    </div>
  )
}
