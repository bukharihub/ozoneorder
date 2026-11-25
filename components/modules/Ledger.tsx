'use client'

import React, { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { callRpcRows, listRows } from '@/lib/api'
import { downloadCsv } from '@/lib/csv'
import { money } from '@/lib/format'
import { useRows } from '@/lib/useRows'
import type { Customer, LedgerRow } from '@/lib/types'
import { useApp } from '../AppProvider'
import { Button, Card, Field, Notice } from '../Ui'

interface AgentCustomerRow { customer: string; invoices: number; receipts: number; balance: number }

function AgentLedgerPrint({ rows, booker }: { rows: AgentCustomerRow[]; booker: string }) {
  return (
    <div className="voucher">
      <div className="voucher-title">BOOKER / AGENT-WISE CUSTOMER LEDGER{booker ? ` — ${booker}` : ''}</div>
      <table className="mt-3 w-full text-left text-xs">
        <thead className="table-head"><tr><th className="px-2 py-2">Customer</th><th className="px-2 py-2 text-right">Invoiced</th><th className="px-2 py-2 text-right">Received</th><th className="px-2 py-2 text-right">Balance</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, index) => <tr key={`${row.customer}-${index}`} className="table-row"><td className="px-2 py-2">{row.customer}</td><td className="px-2 py-2 text-right">{money(row.invoices)}</td><td className="px-2 py-2 text-right">{money(row.receipts)}</td><td className="px-2 py-2 text-right font-bold">{money(row.balance)}</td></tr>)}
        </tbody>
      </table>
    </div>
  )
}

export function Ledger() {
  const { tables, version, showPrint } = useApp()
  const customers = useRows<Customer>(() => listRows(tables!.customers, { order: 'business_name' }), [tables?.customers, version])
  const ledger = useRows<LedgerRow>(() => listRows(tables!.ledger, { order: 'voucher_date' }), [tables?.ledger, version])
  const [mode, setMode] = useState<'customer' | 'agent'>('customer')
  const [customerId, setCustomerId] = useState('')
  const [booker, setBooker] = useState('')
  const [bookers, setBookers] = useState<string[]>([])

  useEffect(() => {
    let active = true
    void callRpcRows<any>('list_company_bookers')
      .then((rows) => { if (active) setBookers(rows.map((row) => String(row.full_name || '')).filter(Boolean)) })
      .catch(() => { if (active) setBookers([]) })
    return () => { active = false }
  }, [version])

  if (!tables) return null

  const customer = customers.rows.find((item) => item.id === customerId) || null
  const rows = ledger.rows.filter((row) => row.customer_id === customerId)
  let balance = Number(customer?.opening_balance || 0)
  const entries = rows.map((row) => {
    const debit = row.voucher_type === 'SALES_TAX_INVOICE' ? Number(row.net_invoice_total) : 0
    const credit = row.voucher_type === 'BANK_RECEIPT' ? Number(row.bank_receipt_amount) : 0
    balance += debit - credit
    return { row, debit, credit, balance }
  })

  const bookerOptions = Array.from(new Set([...bookers, ...ledger.rows.map((row) => String(row.booked_by_name || '')).filter(Boolean)])).sort()
  const agentMap = new Map<string, AgentCustomerRow>()
  ledger.rows
    .filter((row) => row.voucher_type === 'SALES_TAX_INVOICE' || row.voucher_type === 'BANK_RECEIPT')
    .filter((row) => !booker || String(row.booked_by_name || '') === booker)
    .forEach((row) => {
      const customerName = String(row.customer_name || '—')
      const current = agentMap.get(customerName) || { customer: customerName, invoices: 0, receipts: 0, balance: 0 }
      if (row.voucher_type === 'SALES_TAX_INVOICE') current.invoices += Number(row.net_invoice_total || 0)
      else current.receipts += Number(row.bank_receipt_amount || 0)
      current.balance = current.invoices - current.receipts
      agentMap.set(customerName, current)
    })
  const agentRows = Array.from(agentMap.values()).sort((a, b) => a.customer.localeCompare(b.customer))
  const exportAgentCsv = () => downloadCsv('booker_agent_customer_ledger.csv', [
    ['booker_agent', 'customer', 'invoiced', 'received', 'balance'],
    ...agentRows.map((row) => [booker || 'All bookers', row.customer, row.invoices, row.receipts, row.balance]),
  ])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Customer Ledger</h1>
        <p className="text-xs text-slate-500">Opening balance plus invoice debits and bank receipt credits.</p>
      </div>
      <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-2">
        <button onClick={() => setMode('customer')} className={`flex-1 rounded-lg px-4 py-2 text-xs font-bold ${mode === 'customer' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Customer ledger</button>
        <button onClick={() => setMode('agent')} className={`flex-1 rounded-lg px-4 py-2 text-xs font-bold ${mode === 'agent' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Booker / Agent-wise</button>
      </div>
      {(customers.error || ledger.error) && <Notice type="error">{customers.error || ledger.error}</Notice>}
      {mode === 'customer' ? (
        <>
          <Card>
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Customer" className="w-full max-w-md">
                <select className="field-input" value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                  <option value="">Select customer</option>
                  {customers.rows.map((item) => <option key={item.id} value={item.id}>{item.business_name}</option>)}
                </select>
              </Field>
              {customer && <div className="mb-1 text-xs text-slate-600">CNIC / NTN: <strong>{customer.cnic_ntn}</strong> · STRN: <strong>{customer.strn}</strong> · {customer.income_tax_status}</div>}
            </div>
          </Card>
          {customer && (
            <Card title={`Ledger — ${customer.business_name}`} actions={<Button variant="secondary" onClick={() => ledger.reload()}>Refresh</Button>}>
              <div className="app-scroll overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="table-head"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Voucher</th><th className="px-3 py-2">Booker</th><th className="px-3 py-2">Description</th><th className="px-3 py-2 text-right">Debit</th><th className="px-3 py-2 text-right">Credit</th><th className="px-3 py-2 text-right">Balance</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr><td className="px-3 py-2">Opening</td><td className="px-3 py-2">—</td><td className="px-3 py-2">—</td><td className="px-3 py-2">Opening balance</td><td className="px-3 py-2 text-right">—</td><td className="px-3 py-2 text-right">—</td><td className="px-3 py-2 text-right">{money(customer.opening_balance)}</td></tr>
                    {entries.map((entry) => (
                      <tr key={entry.row.id} className="table-row">
                        <td className="px-3 py-2">{entry.row.voucher_date}</td>
                        <td className="px-3 py-2 font-semibold text-blue-800">{entry.row.voucher_no}</td>
                        <td className="px-3 py-2">{entry.row.booked_by_name || '—'}</td>
                        <td className="px-3 py-2">{entry.row.voucher_type.replaceAll('_', ' ')}</td>
                        <td className="px-3 py-2 text-right">{entry.debit ? money(entry.debit) : '—'}</td>
                        <td className="px-3 py-2 text-right">{entry.credit ? money(entry.credit) : '—'}</td>
                        <td className="px-3 py-2 text-right font-bold">{money(entry.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {entries.length === 0 && <p className="p-6 text-center text-xs text-slate-500">No ledger entries for this customer.</p>}
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card title="Booker / Agent-wise customer summary" subtitle="Invoices, receipts and balance by customer for the selected booker" actions={<div className="flex gap-2">
          <select className="field-input" value={booker} onChange={(event) => setBooker(event.target.value)}><option value="">All bookers</option>{bookerOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select>
          <Button variant="secondary" onClick={exportAgentCsv}>CSV</Button>
          <Button variant="secondary" onClick={() => showPrint(<AgentLedgerPrint rows={agentRows} booker={booker} />)}><Printer className="h-3.5 w-3.5" /> Print</Button>
        </div>}>
          <div className="app-scroll overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-xs">
              <thead className="table-head"><tr><th className="px-3 py-2">Customer</th><th className="px-3 py-2 text-right">Invoiced</th><th className="px-3 py-2 text-right">Received</th><th className="px-3 py-2 text-right">Balance</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {agentRows.map((row, index) => <tr key={`${row.customer}-${index}`} className="table-row"><td className="px-3 py-2 font-semibold">{row.customer}</td><td className="px-3 py-2 text-right">{money(row.invoices)}</td><td className="px-3 py-2 text-right">{money(row.receipts)}</td><td className="px-3 py-2 text-right font-bold">{money(row.balance)}</td></tr>)}
              </tbody>
            </table>
            {!agentRows.length && <p className="p-6 text-center text-xs text-slate-500">No invoices or receipts found.</p>}
          </div>
        </Card>
      )}
    </div>
  )
}
