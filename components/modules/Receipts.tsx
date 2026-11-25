'use client'

import React, { useEffect, useState } from 'react'
import { Eye, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { callRpcRows, deleteRow, insertRow, listRows, nextVoucher, updateRow } from '@/lib/api'
import { errorMessage, money, todayIso } from '@/lib/format'
import { parseLinkedCustomerIds } from '@/lib/linkedCustomers'
import { balanceDue, invoiceStatus, unpaidInvoiceRows } from '@/lib/pipeline'
import { useRows } from '@/lib/useRows'
import type { Customer, LedgerRow } from '@/lib/types'
import { lockReason, recordLocked } from '@/lib/guards'
import { hasPermission } from '@/lib/permissions'
import { useApp } from '../AppProvider'
import { NextStepButton, PipelineBreadcrumb } from '../Pipeline'
import { PrintReceipt } from '../print/Vouchers'
import { Button, Card, Field, Modal, Notice } from '../Ui'

interface BookerRow { id: string; full_name: string; linked_customer_ids: string[] }

export function Receipts() {
  const { session, tables, version, bump, showPrint, pipelineSeed, clearPipelineSeed } = useApp()
  const customers = useRows<Customer>(() => listRows(tables!.customers, { order: 'business_name' }), [tables?.customers, version])
  const invoices = useRows<LedgerRow>(() => listRows(tables!.ledger, { filters: { voucher_type: 'SALES_TAX_INVOICE' }, order: 'created_at', ascending: false }), [tables?.ledger, version])
  const receipts = useRows<LedgerRow>(() => listRows(tables!.ledger, { filters: { voucher_type: 'BANK_RECEIPT' }, order: 'created_at', ascending: false }), [tables?.ledger, version])
  const ledger = useRows<LedgerRow>(() => listRows(tables!.ledger, { order: 'created_at', ascending: false }), [tables?.ledger, version])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<LedgerRow | null>(null)
  const [invoiceNo, setInvoiceNo] = useState('')
  const [date, setDate] = useState(todayIso())
  const [amount, setAmount] = useState(0)
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [viewing, setViewing] = useState<LedgerRow | null>(null)
  const [completed, setCompleted] = useState<LedgerRow | null>(null)
  const [bankSearch, setBankSearch] = useState('')
  const [bookers, setBookers] = useState<BookerRow[]>([])

  useEffect(() => {
    let active = true
    void callRpcRows<any>('list_company_bookers')
      .then((rows) => {
        if (!active) return
        setBookers(rows.map((row) => ({ id: String(row.id), full_name: String(row.full_name || ''), linked_customer_ids: parseLinkedCustomerIds(row.linked_customer_ids) })))
      })
      .catch(() => { if (active) setBookers([]) })
    return () => { active = false }
  }, [version])

  useEffect(() => {
    const seedInvoice = pipelineSeed?.invoiceNo
    if (!seedInvoice) return
    setEditing(null)
    setInvoiceNo(seedInvoice)
    setDate(todayIso())
    setAmount(0)
    setReference('')
    setError('')
    setShowForm(true)
    clearPipelineSeed()
  }, [pipelineSeed, clearPipelineSeed])

  if (!session || !tables) return null
  const canCreate = hasPermission(session.user.role, session.user.permissions, 'bank_receipt', 'create')
  const canEdit = hasPermission(session.user.role, session.user.permissions, 'bank_receipt', 'edit')
  const canDelete = hasPermission(session.user.role, session.user.permissions, 'bank_receipt', 'delete')
  const canPrint = hasPermission(session.user.role, session.user.permissions, 'bank_receipt', 'print')

  const customerById = (id?: string | null) => customers.rows.find((row) => row.id === id) || null
  const selectedInvoice = ledger.rows.find((row) => row.voucher_type === 'SALES_TAX_INVOICE' && row.voucher_no === invoiceNo) || null
  const selectableInvoices = unpaidInvoiceRows(ledger.rows)
  const outstanding = selectedInvoice
    ? balanceDue(ledger.rows, selectedInvoice) + Number(editing?.bank_receipt_amount || 0)
    : 0

  const searchTerm = bankSearch.trim().toLowerCase()
  const filteredInvoices = selectableInvoices.filter((row) => {
    if (!searchTerm) return true
    const customer = customerById(row.customer_id)
    return [row.voucher_no, row.customer_name, customer?.bank_account_no || '', customer?.bank_branch_name || '']
      .some((value) => String(value || '').toLowerCase().includes(searchTerm))
  })
  const matchedAccount = searchTerm
    ? customers.rows.find((row) => String(row.bank_account_no || '').trim().toLowerCase() === searchTerm)?.bank_account_no || ''
    : ''
  const activeAccount = selectedInvoice
    ? customerById(selectedInvoice.customer_id)?.bank_account_no || ''
    : matchedAccount
  const groupCustomers = activeAccount
    ? customers.rows.filter((row) => String(row.bank_account_no || '').toLowerCase() === activeAccount.toLowerCase())
    : []
  const groupBooker = groupCustomers.length
    ? bookers.find((booker) => booker.linked_customer_ids.some((id) => groupCustomers.some((customer) => customer.id === id)))
    : undefined
  const groupInvoices = groupCustomers.length
    ? unpaidInvoiceRows(ledger.rows).filter((row) => groupCustomers.some((customer) => customer.id === row.customer_id))
    : []

  const openNew = () => { if (!canCreate) { setError('Permission denied: create receipt'); return } setEditing(null); setInvoiceNo(''); setDate(todayIso()); setAmount(0); setReference(''); setError(''); setShowForm(true) }

  const openEdit = (row: LedgerRow) => {
    if (!canEdit) { setError('Permission denied: edit receipt'); return }
    const reason = lockReason(row, session.user, session.company)
    if (reason) { setError(reason); return }
    setEditing(row)
    setInvoiceNo(row.linked_gdn_no)
    setDate(row.voucher_date)
    setAmount(Number(row.bank_receipt_amount))
    setReference(row.bank_reference)
    setError('')
    setShowForm(true)
  }

  const save = async () => {
    setError('')
    try {
      if (!selectedInvoice) throw new Error('Select an invoice')
      if (amount <= 0) throw new Error('Receipt amount must be positive')
      if (amount > outstanding) throw new Error(`Amount exceeds outstanding balance of ${money(outstanding)}`)
      const payload: any = {
        voucher_no: editing?.voucher_no || await nextVoucher('BR-{YYYY}-{SEQ}', 4),
        linked_so_no: selectedInvoice.linked_so_no,
        linked_gdn_no: selectedInvoice.voucher_no,
        voucher_date: date,
        customer_id: selectedInvoice.customer_id,
        customer_name: selectedInvoice.customer_name,
        bank_account_no: customerById(selectedInvoice.customer_id)?.bank_account_no || '',
        bank_branch_name: customerById(selectedInvoice.customer_id)?.bank_branch_name || '',
        ship_to_name: selectedInvoice.ship_to_name,
        ship_to_address: selectedInvoice.ship_to_address,
        bank_receipt_amount: amount,
        bank_reference: reference,
        net_invoice_total: amount,
        amount_in_words: `${amount}`,
        status: 'PAID' as const,
        created_by: session.user.username,
      }
      let saved: LedgerRow
      if (editing) saved = await updateRow<LedgerRow>(tables.ledger, editing.id, payload)
      else saved = await insertRow<LedgerRow>(tables.ledger, { voucher_type: 'BANK_RECEIPT', ...payload })

      const rowsAfterSave = [
        ...ledger.rows.filter((row) => row.id !== editing?.id),
        saved,
      ]
      const invoice = rowsAfterSave.find((row) => row.voucher_type === 'SALES_TAX_INVOICE' && row.voucher_no === selectedInvoice.voucher_no)
      if (invoice) {
        const nextStatus = invoiceStatus(rowsAfterSave, invoice)
        await updateRow(tables.ledger, invoice.id, { status: nextStatus })
        const order = rowsAfterSave.find((row) => row.voucher_type === 'SALES_ORDER' && row.voucher_no === invoice.linked_so_no)
        if (order) await updateRow(tables.ledger, order.id, { status: nextStatus })
      }
      setCompleted(saved)
      setNotice(editing ? 'Bank receipt updated' : 'Bank receipt posted')
      setShowForm(false)
      bump()
      receipts.reload()
      invoices.reload()
      void ledger.reload()
    } catch (caught) { setError(errorMessage(caught)) }
  }

  const remove = async (row: LedgerRow) => {
    if (!canDelete) { setError('Permission denied: delete receipt'); return }
    const reason = lockReason(row, session.user, session.company)
    if (reason) { setError(reason); return }
    if (!window.confirm(`Delete bank receipt ${row.voucher_no}?`)) return
    try {
      await deleteRow(tables.ledger, row.id)
      const rowsAfterDelete = ledger.rows.filter((item) => item.id !== row.id)
      const invoice = rowsAfterDelete.find((item) => item.voucher_type === 'SALES_TAX_INVOICE' && item.voucher_no === row.linked_gdn_no)
      if (invoice) {
        const nextStatus = invoiceStatus(rowsAfterDelete, invoice)
        await updateRow(tables.ledger, invoice.id, { status: nextStatus })
        const order = rowsAfterDelete.find((item) => item.voucher_type === 'SALES_ORDER' && item.voucher_no === invoice.linked_so_no)
        if (order) await updateRow(tables.ledger, order.id, { status: nextStatus })
      }
      if (completed?.id === row.id) setCompleted(null)
      if (viewing?.id === row.id) setViewing(null)
      bump()
      receipts.reload()
      invoices.reload()
      void ledger.reload()
    } catch (caught) { setError(errorMessage(caught)) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Bank Receipts</h1>
          <p className="text-xs text-slate-500">Payments posted against sales tax invoices.</p>
        </div>
        {canCreate && <Button onClick={openNew}><Plus className="h-3.5 w-3.5" /> New receipt</Button>}
      </div>
      <PipelineBreadcrumb row={completed || viewing} ledger={ledger.rows} />
      {completed && !showForm && (
        <Card title={`Receipt ${completed.voucher_no} posted`} actions={<NextStepButton row={completed} ledger={ledger.rows} />}>
          <p className="text-xs text-slate-600">Payment is reflected in the customer ledger and aging report immediately.</p>
        </Card>
      )}
      {(error || receipts.error) && <Notice type="error">{error || receipts.error}</Notice>}
      {notice && !showForm && <Notice type="success">{notice}</Notice>}
      <Card>
        <div className="app-scroll overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-xs">
            <thead className="table-head"><tr><th className="px-3 py-2">Receipt No</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Bank account / branch</th><th className="px-3 py-2">Invoice</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">Invoice balance</th><th className="px-3 py-2">Status</th><th className="px-3 py-2" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {receipts.rows.map((row) => (
                <tr key={row.id} className="table-row">
                  <td className="px-3 py-2 font-bold text-blue-800">{row.voucher_no}{recordLocked(row, session.user, session.company) && <div><span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Auto-Locked (&gt;3 Days)</span></div>}</td>
                  <td className="px-3 py-2">{row.voucher_date}</td>
                  <td className="px-3 py-2">{row.customer_name}</td>
                  <td className="px-3 py-2">
                    {row.bank_account_no || row.bank_branch_name || customerById(row.customer_id)?.bank_account_no ? (
                      <span className="inline-flex flex-col rounded bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700">
                        <span>{row.bank_account_no || customerById(row.customer_id)?.bank_account_no || '—'}</span>
                        <span className="font-medium text-indigo-500">{row.bank_branch_name || customerById(row.customer_id)?.bank_branch_name || '—'}</span>
                      </span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2">{row.linked_gdn_no}</td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-700">{money(row.bank_receipt_amount)}</td>
                  <td className="px-3 py-2 text-right">{money(balanceDue(ledger.rows, ledger.rows.find((item) => item.voucher_type === 'SALES_TAX_INVOICE' && item.voucher_no === row.linked_gdn_no) || null))}</td>
                  <td className="px-3 py-2">{invoiceStatus(ledger.rows, ledger.rows.find((item) => item.voucher_type === 'SALES_TAX_INVOICE' && item.voucher_no === row.linked_gdn_no) || null)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" onClick={() => setViewing(row)}><Eye className="h-3.5 w-3.5" /></Button>
                      {canPrint && <Button variant="ghost" onClick={() => showPrint(<PrintReceipt company={session.company} row={row} />)}><Printer className="h-3.5 w-3.5" /></Button>}
                      {canEdit && <Button variant="ghost" onClick={() => openEdit(row)}><Pencil className="h-3.5 w-3.5" /></Button>}
                      {canDelete && <Button variant="ghost" onClick={() => void remove(row)}><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {showForm && (
        <Modal title={editing ? `Edit ${editing.voucher_no}` : 'New bank receipt'} onClose={() => setShowForm(false)}>
          <div className="space-y-4">
            {error && <Notice type="error">{error}</Notice>}
            <Field label="Search by customer name / bank account no / invoice no">
              <input className="field-input" value={bankSearch} onChange={(event) => setBankSearch(event.target.value)} placeholder="e.g. PK00BANK0000000000" />
            </Field>
            <Notice type="info">
              <span className="block">Customer: {selectedInvoice?.customer_name || '—'}</span>
              <span className="block">BANK ACCOUNT NO / IBAN: {selectedInvoice ? (customerById(selectedInvoice.customer_id)?.bank_account_no || '—') : (matchedAccount || '—')}</span>
              <span className="block">BANK &amp; BRANCH NAME: {selectedInvoice ? (customerById(selectedInvoice.customer_id)?.bank_branch_name || '—') : '—'}</span>
              <span className="block">Booker / Group: {groupBooker?.full_name || selectedInvoice?.booked_by_name || 'Unassigned'}</span>
            </Notice>
            {groupCustomers.length > 1 && (
              <Notice type="info">
                <span className="font-bold">
                  {groupBooker
                    ? `Shared Group Account — Linked Booker: ${groupBooker.full_name} (${groupCustomers.length} Customers)`
                    : `Shared Group Account — ${groupCustomers.length} Customers (no booker linked)`}
                </span>
                <span className="mt-2 block">Account {activeAccount} · {groupBooker?.full_name || 'Unassigned'} · Customer names: {groupCustomers.map((row) => row.business_name).join(', ')}</span>
              </Notice>
            )}
            {groupInvoices.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="mb-2 text-xs font-bold text-blue-900">Unpaid invoices across this shared account</p>
                <div className="flex flex-wrap gap-2">
                  {groupInvoices.map((row) => (
                    <button key={row.id} type="button" onClick={() => { setInvoiceNo(row.voucher_no); setAmount(balanceDue(ledger.rows, row)) }} className="rounded border border-blue-300 bg-white px-2 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100">
                      {row.voucher_no} · {row.customer_name} · due {money(balanceDue(ledger.rows, row))}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <Field label="Select unpaid invoice">
              <select className="field-input" value={invoiceNo} onChange={(event) => {
                const number = event.target.value
                setInvoiceNo(number)
                const invoice = ledger.rows.find((row) => row.voucher_type === 'SALES_TAX_INVOICE' && row.voucher_no === number) || null
                setAmount(invoice ? balanceDue(ledger.rows, invoice) + Number(editing?.bank_receipt_amount || 0) : 0)
              }} disabled={Boolean(editing)}>
                <option value="">Select invoice</option>
                {filteredInvoices.map((row) => <option key={row.id} value={row.voucher_no}>{row.voucher_no} — {row.customer_name} — due {money(balanceDue(ledger.rows, row))}</option>)}
                {editing && !filteredInvoices.some((row) => row.voucher_no === editing.linked_gdn_no) && <option value={editing.linked_gdn_no}>{editing.linked_gdn_no} (editing)</option>}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Receipt date"><input className="field-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
              <Field label="Amount"><input className="field-input" type="number" step="0.01" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></Field>
              <Field label="Bank reference" className="col-span-2"><input className="field-input" value={reference} onChange={(event) => setReference(event.target.value)} /></Field>
            </div>
            {selectedInvoice && <Notice type="info">Invoice total: {money(selectedInvoice.net_invoice_total)} · Outstanding: {money(outstanding)}</Notice>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={() => void save()}>{editing ? 'Update receipt' : 'Post receipt'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {viewing && (
        <Modal title={`Receipt ${viewing.voucher_no}`} onClose={() => setViewing(null)}>
          <div className="space-y-3">
            <div className="flex justify-end"><NextStepButton row={viewing} ledger={ledger.rows} /></div>
            <PrintReceipt company={session.company} row={viewing} />
          </div>
        </Modal>
      )}
    </div>
  )
}
