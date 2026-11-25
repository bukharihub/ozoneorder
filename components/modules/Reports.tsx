'use client'

import React, { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, Printer } from 'lucide-react'
import * as XLSX from 'xlsx'
import { computeAging } from '@/lib/aging'
import { callRpcRows, listRows } from '@/lib/api'
import { downloadCsv } from '@/lib/csv'
import { money, quantity } from '@/lib/format'
import { useRows } from '@/lib/useRows'
import type { Customer, LedgerRow, Product } from '@/lib/types'
import { useApp } from '../AppProvider'
import { Button, Card, Notice, Stat } from '../Ui'

interface AgentReportRow { booker: string; customer: string; bankAccount: string; orders: number; orderedCartons: number; cartons: number; invoiced: number; received: number; receivables: number }

function AgentReportPrint({ rows }: { rows: AgentReportRow[] }) {
  return (
    <div className="voucher">
      <div className="voucher-title">BOOKER / AGENT-WISE SALES &amp; CUSTOMER REPORT</div>
      <table className="mt-3 w-full text-left text-xs">
        <thead className="table-head"><tr><th className="px-2 py-2">Booker / Agent</th><th className="px-2 py-2">Customer</th><th className="px-2 py-2">Bank Account</th><th className="px-2 py-2 text-right">Orders</th><th className="px-2 py-2 text-right">Ordered Cartons</th><th className="px-2 py-2 text-right">Delivered Cartons</th><th className="px-2 py-2 text-right">Invoiced</th><th className="px-2 py-2 text-right">Received</th><th className="px-2 py-2 text-right">Receivables</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => <tr key={`${row.booker}-${row.customer}-${index}`} className="table-row"><td className="px-2 py-2">{row.booker}</td><td className="px-2 py-2">{row.customer}</td><td className="px-2 py-2">{row.bankAccount || '—'}</td><td className="px-2 py-2 text-right">{row.orders}</td><td className="px-2 py-2 text-right">{quantity(row.orderedCartons)}</td><td className="px-2 py-2 text-right">{quantity(row.cartons)}</td><td className="px-2 py-2 text-right">{money(row.invoiced)}</td><td className="px-2 py-2 text-right">{money(row.received)}</td><td className="px-2 py-2 text-right font-bold">{money(row.receivables)}</td></tr>)}
        </tbody>
      </table>
    </div>
  )
}

export function Reports() {
  const { tables, version, showPrint } = useApp()
  const products = useRows<Product>(() => listRows(tables!.products, { order: 'product_name' }), [tables?.products, version])
  const customers = useRows<Customer>(() => listRows(tables!.customers, { order: 'business_name' }), [tables?.customers, version])
  const ledger = useRows<LedgerRow>(() => listRows(tables!.ledger, { order: 'voucher_date' }), [tables?.ledger, version])
  const [bookerNames, setBookerNames] = useState<string[]>([])
  const [bookerFilter, setBookerFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [bankFilter, setBankFilter] = useState('')

  useEffect(() => {
    let active = true
    void callRpcRows<any>('list_company_bookers')
      .then((rows) => { if (active) setBookerNames(rows.map((row) => String(row.full_name || '')).filter(Boolean)) })
      .catch(() => { if (active) setBookerNames([]) })
    return () => { active = false }
  }, [version])

  if (!tables) return null

  const aging = computeAging(customers.rows, ledger.rows)
  const totals = aging.reduce((sum, row) => ({
    current: sum.current + row.current,
    days31to60: sum.days31to60 + row.days31to60,
    days61to90: sum.days61to90 + row.days61to90,
    days90plus: sum.days90plus + row.days90plus,
    total: sum.total + row.total,
  }), { current: 0, days31to60: 0, days61to90: 0, days90plus: 0, total: 0 })

  const bookerOptions = Array.from(new Set([...bookerNames, ...ledger.rows.map((row) => String(row.booked_by_name || '')).filter(Boolean)])).sort()
  const bankOptions = Array.from(new Set(customers.rows.map((row) => String(row.bank_account_no || '')).filter(Boolean))).sort()
  const customerById = new Map(customers.rows.map((row) => [row.id, row]))
  const salesOrders = new Map(ledger.rows.filter((row) => row.voucher_type === 'SALES_ORDER').map((row) => [row.voucher_no, row]))
  const agentMap = new Map<string, AgentReportRow>()
  ledger.rows
    .filter((row) => ['SALES_ORDER', 'GDN_GATE_PASS', 'SALES_TAX_INVOICE', 'BANK_RECEIPT'].includes(String(row.voucher_type)))
    .filter((row) => !dateFrom || String(row.voucher_date || '') >= dateFrom)
    .filter((row) => !dateTo || String(row.voucher_date || '') <= dateTo)
    .filter((row) => {
      const account = String(row.bank_account_no || customerById.get(String(row.customer_id || ''))?.bank_account_no || '')
      return !bankFilter || account.toLowerCase() === bankFilter.toLowerCase()
    })
    .forEach((row) => {
      const sourceOrder = row.voucher_type === 'GDN_GATE_PASS' ? salesOrders.get(String(row.linked_so_no || '')) : undefined
      const booker = String(sourceOrder?.booked_by_name || row.booked_by_name || 'Unassigned')
      const customer = String(sourceOrder?.customer_name || row.customer_name || '—')
      if (bookerFilter && booker !== bookerFilter) return
      const key = `${booker}|${customer}`
      const bankAccount = String(row.bank_account_no || customerById.get(String(row.customer_id || ''))?.bank_account_no || '')
      const current = agentMap.get(key) || { booker, customer, bankAccount, orders: 0, orderedCartons: 0, cartons: 0, invoiced: 0, received: 0, receivables: 0 }
      if (row.voucher_type === 'SALES_ORDER') {
        current.orders += 1
        current.orderedCartons += Number(row.total_cartons || 0)
      } else if (row.voucher_type === 'GDN_GATE_PASS') {
        current.cartons += Number(row.total_cartons || 0)
      } else if (row.voucher_type === 'SALES_TAX_INVOICE') {
        current.invoiced += Number(row.net_invoice_total || 0)
      } else {
        current.received += Number(row.bank_receipt_amount || 0)
      }
      current.receivables = current.invoiced - current.received
      agentMap.set(key, current)
    })
  const agentRows = Array.from(agentMap.values()).sort((a, b) => a.booker.localeCompare(b.booker) || a.customer.localeCompare(b.customer))

  const exportAgentCsv = () => downloadCsv('booker_agent_wise_sales_report.csv', [
    ['booker_agent', 'customer', 'bank_account_no', 'orders', 'ordered_cartons', 'delivered_cartons', 'invoiced', 'received', 'receivables'],
    ...agentRows.map((row) => [row.booker, row.customer, row.bankAccount, row.orders, row.orderedCartons, row.cartons, row.invoiced, row.received, row.receivables]),
  ])

  const exportCsv = () => downloadCsv('company_master_ledger.csv', [
    ['voucher_type', 'voucher_no', 'linked_so_no', 'linked_gdn_no', 'voucher_date', 'customer_name', 'total_cartons', 'total_pcs', 'total_exclusive_value', 'sales_tax_18', 'further_tax_4', 'amount_before_236g', 'advance_tax_236g', 'net_invoice_total', 'bank_receipt_amount', 'bank_reference', 'status'],
    ...ledger.rows.map((row) => [
      row.voucher_type, row.voucher_no, row.linked_so_no, row.linked_gdn_no, row.voucher_date,
      row.customer_name, row.total_cartons, row.total_pcs, row.total_exclusive_value, row.sales_tax_18,
      row.further_tax_4, row.amount_before_236g, row.advance_tax_236g, row.net_invoice_total,
      row.bank_receipt_amount, row.bank_reference, row.status,
    ]),
  ])

  const exportExcel = () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(ledger.rows), 'Master Ledger')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(products.rows), 'Products')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(customers.rows), 'Customers')
    XLSX.writeFile(workbook, 'company_full_export.xlsx')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports &amp; Exports</h1>
          <p className="text-xs text-slate-500">Receivables aging, FG stock sheet and single-click company export.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Ledger CSV</Button>
          <Button variant="dark" onClick={exportExcel}><FileSpreadsheet className="h-3.5 w-3.5" /> Full Excel export</Button>
        </div>
      </div>
      {(products.error || customers.error || ledger.error) && <Notice type="error">{products.error || customers.error || ledger.error}</Notice>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Current (0-30)" value={money(totals.current, 0)} tone="green" />
        <Stat label="31-60 days" value={money(totals.days31to60, 0)} tone="blue" />
        <Stat label="61-90 days" value={money(totals.days61to90, 0)} tone="amber" />
        <Stat label="90+ days" value={money(totals.days90plus, 0)} tone="amber" />
        <Stat label="Total receivables" value={money(totals.total, 0)} tone="slate" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Receivables aging">
          <div className="app-scroll overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="table-head"><tr><th className="px-2 py-2">Customer</th><th className="px-2 py-2 text-right">0-30</th><th className="px-2 py-2 text-right">31-60</th><th className="px-2 py-2 text-right">61-90</th><th className="px-2 py-2 text-right">90+</th><th className="px-2 py-2 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {aging.map((row) => (
                  <tr key={row.customer.id} className="table-row">
                    <td className="px-2 py-2 font-medium">{row.customer.business_name}</td>
                    <td className="px-2 py-2 text-right">{money(row.current, 0)}</td>
                    <td className="px-2 py-2 text-right">{money(row.days31to60, 0)}</td>
                    <td className="px-2 py-2 text-right">{money(row.days61to90, 0)}</td>
                    <td className="px-2 py-2 text-right">{money(row.days90plus, 0)}</td>
                    <td className="px-2 py-2 text-right font-bold">{money(row.total, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {aging.length === 0 && <p className="p-6 text-center text-xs text-slate-500">No outstanding receivables.</p>}
          </div>
        </Card>
        <Card title="FG stock sheet">
          <div className="app-scroll max-h-[420px] overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="table-head"><tr><th className="px-2 py-2">Product</th><th className="px-2 py-2 text-right">Type</th><th className="px-2 py-2 text-right">Cartons</th><th className="px-2 py-2 text-right">Pcs</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {products.rows.map((product) => (
                  <tr key={product.id} className="table-row">
                    <td className="px-2 py-2">{product.product_name}</td>
                    <td className="px-2 py-2 text-right">{product.product_type}</td>
                    <td className="px-2 py-2 text-right font-bold">{quantity(product.current_stock_ctns)}</td>
                    <td className="px-2 py-2 text-right">{quantity(product.current_stock_pcs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="Booker / Agent-Wise Sales & Customer Report" subtitle="Delivered cartons, invoiced value, receipts and receivables grouped by booker and customer" actions={<div className="flex flex-wrap gap-2">
        <input className="field-input" type="date" aria-label="From date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <input className="field-input" type="date" aria-label="To date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        <select className="field-input" aria-label="Booker filter" value={bookerFilter} onChange={(event) => setBookerFilter(event.target.value)}><option value="">All bookers</option>{bookerOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select>
        <select className="field-input" aria-label="Bank account filter" value={bankFilter} onChange={(event) => setBankFilter(event.target.value)}><option value="">All bank accounts</option>{bankOptions.map((account) => <option key={account} value={account}>{account}</option>)}</select>
        <Button variant="secondary" onClick={exportAgentCsv}><Download className="h-3.5 w-3.5" /> CSV</Button>
        <Button variant="secondary" onClick={() => showPrint(<AgentReportPrint rows={agentRows} />)}><Printer className="h-3.5 w-3.5" /> Print</Button>
      </div>}>
        <div className="app-scroll overflow-x-auto">
            <table className="w-full min-w-[1020px] text-left text-xs">
            <thead className="table-head"><tr><th className="px-2 py-2">Booker / Agent</th><th className="px-2 py-2">Customer</th><th className="px-2 py-2">Bank Account</th><th className="px-2 py-2 text-right">Orders</th><th className="px-2 py-2 text-right">Ordered Cartons</th><th className="px-2 py-2 text-right">Delivered Cartons</th><th className="px-2 py-2 text-right">Invoiced</th><th className="px-2 py-2 text-right">Received</th><th className="px-2 py-2 text-right">Receivables</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {agentRows.map((row, index) => (
                <tr key={`${row.booker}-${row.customer}-${index}`} className="table-row">
                  <td className="px-2 py-2 font-semibold">{row.booker}</td>
                  <td className="px-2 py-2">{row.customer}</td>
                  <td className="px-2 py-2">{row.bankAccount || '—'}</td>
                  <td className="px-2 py-2 text-right">{row.orders}</td>
                  <td className="px-2 py-2 text-right">{quantity(row.orderedCartons)}</td>
                  <td className="px-2 py-2 text-right">{quantity(row.cartons)}</td>
                  <td className="px-2 py-2 text-right">{money(row.invoiced)}</td>
                  <td className="px-2 py-2 text-right">{money(row.received)}</td>
                  <td className="px-2 py-2 text-right font-bold">{money(row.receivables)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!agentRows.length && <p className="p-6 text-center text-xs text-slate-500">No sales found for this booker.</p>}
        </div>
      </Card>
    </div>
  )
}
