import { useMemo, useState } from 'react'
import { Button, Card, Field, Input, Modal, PageHeader, Select, Table, Badge } from '../components/ui'
import { useApp } from '../components/AppContext'
import { useRows } from '../lib/useRows'
import { exportRows } from '../lib/excel'
import { dateLabel, money, titleCase } from '../lib/format'
import type { Row } from '../lib/types'

export const LedgerPage = () => {
  const { session, permissions } = useApp()
  const balances = useRows('v_customer_balances', { order: 'business_name' })
  const aging = useRows('v_aging_report', { order: 'due_date' })
  const ledger = useRows('customer_ledger', { order: 'entry_date', ascending: false })
  const [customerId, setCustomerId] = useState('')
  const [search, setSearch] = useState('')
  const [printOpen, setPrintOpen] = useState(false)

  const customerMap = useMemo(
    () => new Map(balances.rows.map((customer) => [customer.customer_id, customer])),
    [balances.rows],
  )

  const filteredLedger = useMemo(() => {
    const term = search.toLowerCase()
    return ledger.rows.filter((row) => {
      const matchesCustomer = !customerId || row.customer_id === customerId
      const text = [row.description, row.entry_type, row.source, row.reference_no].join(' ').toLowerCase()
      return matchesCustomer && text.includes(term)
    })
  }, [ledger.rows, customerId, search])

  const filteredAging = customerId ? aging.rows.filter((row) => row.customer_id === customerId) : aging.rows
  const customer = customerMap.get(customerId)

  const exportStatement = () =>
    exportRows(filteredLedger, `${session.company.company_code}_CustomerLedger`, 'Ledger')

  return (
    <div>
      <PageHeader
        title="Customer Ledger"
        subtitle="Invoices, receipts, running balance and receivables aging."
        actions={
          <>
            <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="w-72">
              <option value="">All Customers</option>
              {balances.rows.map((row) => (
                <option key={row.customer_id} value={row.customer_id}>
                  {row.customer_code} — {row.business_name}
                </option>
              ))}
            </Select>
            <Input placeholder="Search entries…" value={search} onChange={(event) => setSearch(event.target.value)} className="w-56" />
            <Button variant="secondary" onClick={exportStatement}>Export</Button>
            <Button variant="secondary" onClick={() => setPrintOpen(true)} disabled={!customerId}>Print Statement</Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">Customers</div>
          <div className="mt-2 text-2xl font-bold text-white">{balances.rows.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">Total Outstanding</div>
          <div className="mt-2 text-2xl font-bold text-cyan-300">
            {money(balances.rows.reduce((sum, row) => sum + Number(row.outstanding_balance || 0), 0), permissions.viewValues)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wider text-slate-500">Overdue Invoices</div>
          <div className="mt-2 text-2xl font-bold text-amber-300">
            {aging.rows.filter((row) => String(row.aging_bucket).startsWith('31') || String(row.aging_bucket).startsWith('60')).length}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="border-b border-slate-800 px-5 py-4 font-bold text-white">Ledger Entries</div>
          <Table
            rowKey={(row) => row.id}
            rows={filteredLedger.slice(0, 100)}
            columns={[
              { key: 'entry_date', label: 'Date', render: (row) => dateLabel(row.entry_date) },
              { key: 'entry_type', label: 'Type', render: (row) => <Badge tone={row.entry_type === 'debit' ? 'amber' : 'green'}>{row.entry_type}</Badge> },
              { key: 'description', label: 'Description' },
              { key: 'debit', label: 'Debit', render: (row) => money(row.debit, permissions.viewValues) },
              { key: 'credit', label: 'Credit', render: (row) => money(row.credit, permissions.viewValues) },
              { key: 'balance', label: 'Balance', render: (row) => money(row.balance, permissions.viewValues) },
            ]}
          />
        </Card>

        <Card>
          <div className="border-b border-slate-800 px-5 py-4 font-bold text-white">Receivables Aging</div>
          <Table
            rowKey={(row) => row.invoice_id}
            rows={filteredAging.slice(0, 100)}
            columns={[
              { key: 'invoice_number', label: 'Invoice' },
              { key: 'business_name', label: 'Customer' },
              { key: 'due_date', label: 'Due', render: (row) => dateLabel(row.due_date) },
              { key: 'aging_bucket', label: 'Bucket', render: (row) => <Badge tone="amber">{row.aging_bucket}</Badge> },
              { key: 'balance_amount', label: 'Balance', render: (row) => money(row.balance_amount, permissions.viewValues) },
            ]}
          />
        </Card>
      </div>

      <Modal open={printOpen} title={`Statement — ${customer?.business_name || ''}`} onClose={() => setPrintOpen(false)} width="max-w-5xl">
        <div className="print-area bg-white p-6 text-black">
          <div className="text-xl font-black">{session.company.company_name}</div>
          <div className="text-xs">{session.company.address} · NTN/STRN {session.company.ntn_strn}</div>
          <div className="mt-4 text-lg font-bold">Customer Ledger Statement</div>
          <div className="mt-2 text-xs">
            {customer?.business_name} · {titleCase(customer?.reg_no)} · {titleCase(customer?.filer_status)}
          </div>
          <table className="mt-5 w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 px-2 py-2 text-left">Date</th>
                <th className="border border-slate-400 px-2 py-2 text-left">Description</th>
                <th className="border border-slate-400 px-2 py-2 text-right">Debit</th>
                <th className="border border-slate-400 px-2 py-2 text-right">Credit</th>
                <th className="border border-slate-400 px-2 py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.map((row) => (
                <tr key={row.id}>
                  <td className="border border-slate-300 px-2 py-1">{dateLabel(row.entry_date)}</td>
                  <td className="border border-slate-300 px-2 py-1">{row.description}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right">{money(row.debit, permissions.viewValues)}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right">{money(row.credit, permissions.viewValues)}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right">{money(row.balance, permissions.viewValues)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 text-right text-sm font-black">Closing: {money(customer?.outstanding_balance || 0, permissions.viewValues)}</div>
        </div>
        <div className="mt-4 flex justify-end gap-2 no-print">
          <Button variant="secondary" onClick={() => setPrintOpen(false)}>Close</Button>
          <Button onClick={() => window.print()}>Print Statement</Button>
        </div>
      </Modal>
    </div>
  )
}
