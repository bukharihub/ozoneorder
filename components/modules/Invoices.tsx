'use client'

import React, { useEffect, useState } from 'react'
import { Eye, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { callRpc, deleteRow, insertRow, listRows, nextVoucher, updateRow } from '@/lib/api'
import { calculateTotals } from '@/lib/calc'
import { errorMessage, money, quantity, todayIso } from '@/lib/format'
import { balanceDue, deliverableGdnRows, invoiceStatus, paidAmount, receiptsForInvoice } from '@/lib/pipeline'
import { useRows } from '@/lib/useRows'
import type { Customer, LedgerRow, LineItem } from '@/lib/types'
import { lockReason, recordLocked } from '@/lib/guards'
import { hasPermission } from '@/lib/permissions'
import { useApp } from '../AppProvider'
import { NextStepButton, PipelineBreadcrumb } from '../Pipeline'
import { PrintInvoiceRegistered, PrintInvoiceUnregistered } from '../print/Vouchers'
import { Button, Card, Field, Modal, Notice } from '../Ui'

export function Invoices() {
  const { session, tables, version, bump, showPrint, pipelineSeed, clearPipelineSeed } = useApp()
  const gdns = useRows<LedgerRow>(() => listRows(tables!.ledger, { filters: { voucher_type: 'GDN_GATE_PASS' }, order: 'created_at', ascending: false }), [tables?.ledger, version])
  const invoices = useRows<LedgerRow>(() => listRows(tables!.ledger, { filters: { voucher_type: 'SALES_TAX_INVOICE' }, order: 'created_at', ascending: false }), [tables?.ledger, version])
  const ledger = useRows<LedgerRow>(() => listRows(tables!.ledger, { order: 'created_at', ascending: false }), [tables?.ledger, version])
  const customers = useRows<Customer>(() => listRows(tables!.customers), [tables?.customers, version])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<LedgerRow | null>(null)
  const [gdnNo, setGdnNo] = useState('')
  const [date, setDate] = useState(todayIso())
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [viewing, setViewing] = useState<LedgerRow | null>(null)
  const [completed, setCompleted] = useState<LedgerRow | null>(null)

  useEffect(() => {
    const seedGdn = pipelineSeed?.gdnNo
    if (!seedGdn) return
    setEditing(null)
    setGdnNo(seedGdn)
    setDate(todayIso())
    setError('')
    setShowForm(true)
    clearPipelineSeed()
  }, [pipelineSeed, clearPipelineSeed])

  if (!session || !tables) return null
  const canCreate = hasPermission(session.user.role, session.user.permissions, 'sales_tax_invoice', 'create')
  const canEdit = hasPermission(session.user.role, session.user.permissions, 'sales_tax_invoice', 'edit')
  const canDelete = hasPermission(session.user.role, session.user.permissions, 'sales_tax_invoice', 'delete')
  const canPrint = hasPermission(session.user.role, session.user.permissions, 'sales_tax_invoice', 'print')

  const selectedGdn = ledger.rows.find((row) => row.voucher_type === 'GDN_GATE_PASS' && row.voucher_no === gdnNo) || null
  const customer = customers.rows.find((item) => item.id === selectedGdn?.customer_id) || null
  const registration = customer?.registration_status || selectedGdn?.registration_status || 'Unregister'
  const taxRate = customer?.tax_rate_236g
    ? Number(customer.tax_rate_236g)
    : selectedGdn?.filer_status === 'Filer' ? 0.001 : 0.02
  const selectableGdns = deliverableGdnRows(ledger.rows)

  const lines: LineItem[] = (selectedGdn?.line_items || []).map((item) => {
    const rate = registration === 'Unregister' ? Number(item.rate) : Number(item.rate)
    return {
      ...item,
      ordered_ctns: Number(item.delivered_ctns),
      pcs: Number(item.pcs),
      rate,
      exclusive_value: registration === 'Unregister'
        ? Number(item.pcs) * rate
        : Number(item.delivered_ctns) * rate,
    }
  })

  const totals = calculateTotals(registration, taxRate, lines.map((line) => ({
    cartons: Number(line.delivered_ctns),
    pcs: Number(line.pcs),
    diaperRate: Number(line.rate),
    cartonRate: Number(line.rate),
  })))

  const printInvoice = (row: LedgerRow) => {
    showPrint(row.registration_status === 'Register'
      ? <PrintInvoiceRegistered company={session.company} row={row} />
      : <PrintInvoiceUnregistered company={session.company} row={row} />)
  }

  const openNew = () => { if (!canCreate) { setError('Permission denied: create invoice'); return } setEditing(null); setGdnNo(''); setDate(todayIso()); setError(''); setShowForm(true) }

  const openEdit = (row: LedgerRow) => {
    if (!canEdit) { setError('Permission denied: edit invoice'); return }
    const reason = lockReason(row, session.user, session.company)
    if (reason) { setError(reason); return }
    if (receiptsForInvoice(ledger.rows, row.voucher_no).length) { setError('Locked: Bank Receipt already posted'); return }
    setEditing(row)
    setGdnNo(row.linked_gdn_no)
    setDate(row.voucher_date)
    setError('')
    setShowForm(true)
  }

  const save = async () => {
    setError('')
    try {
      if (!selectedGdn) throw new Error('Select a GDN')
      if (!lines.length) throw new Error('Selected GDN has no line items')
      const prefix = registration === 'Register' ? 'GST MLT-{SEQ}' : 'ST-{YYYY}-{SEQ}'
      const digits = registration === 'Register' ? 2 : 4
      const voucherNo = editing?.voucher_no || await nextVoucher(prefix, digits)
      const payload: any = {
        voucher_no: voucherNo,
        linked_so_no: selectedGdn.linked_so_no,
        linked_gdn_no: selectedGdn.voucher_no,
        voucher_date: date,
        customer_id: selectedGdn.customer_id,
        customer_name: selectedGdn.customer_name,
        ship_to_name: selectedGdn.ship_to_name,
        ship_to_address: selectedGdn.ship_to_address,
        cnic_ntn: selectedGdn.cnic_ntn,
        strn: selectedGdn.strn,
        filer_status: selectedGdn.filer_status,
        registration_status: registration,
        line_items: lines,
        total_cartons: lines.reduce((sum, item) => sum + Number(item.delivered_ctns), 0),
        total_pcs: lines.reduce((sum, item) => sum + Number(item.pcs), 0),
        total_exclusive_value: totals.exclusive,
        sales_tax_18: totals.salesTax,
        further_tax_4: totals.furtherTax,
        amount_before_236g: totals.amountBefore236g,
        advance_tax_236g: totals.advanceTax,
        net_invoice_total: totals.netTotal,
        amount_in_words: `${totals.netTotal}`,
        status: 'INVOICED' as const,
        created_by: session.user.username,
        booked_by_user_id: selectedGdn.booked_by_user_id || null,
        booked_by_name: selectedGdn.booked_by_name || null,
      }
      let saved: LedgerRow
      if (editing) saved = await updateRow<LedgerRow>(tables.ledger, editing.id, payload)
      else saved = await insertRow<LedgerRow>(tables.ledger, { voucher_type: 'SALES_TAX_INVOICE', ...payload })

      const gdnRow = ledger.rows.find((row) => row.voucher_type === 'GDN_GATE_PASS' && row.voucher_no === selectedGdn.voucher_no)
      if (gdnRow) await updateRow(tables.ledger, gdnRow.id, { status: 'INVOICED' })
      const order = ledger.rows.find((row) => row.voucher_type === 'SALES_ORDER' && row.voucher_no === selectedGdn.linked_so_no)
      if (order) await updateRow(tables.ledger, order.id, { status: 'INVOICED' })

      setCompleted(saved)
      setNotice(editing ? 'Invoice updated' : 'Sales tax invoice created')
      setShowForm(false)
      bump()
      invoices.reload()
      void ledger.reload()
      void gdns.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  const remove = async (row: LedgerRow) => {
    if (!canDelete) { setError('Permission denied: delete invoice'); return }
    const reason = lockReason(row, session.user, session.company)
    if (reason) { setError(reason); return }
    if (receiptsForInvoice(ledger.rows, row.voucher_no).length) { setError('Locked: Bank Receipt already posted'); return }
    if (!window.confirm(`Delete invoice ${row.voucher_no}?`)) return
    try {
      await deleteRow(tables.ledger, row.id)
      const gdnRow = ledger.rows.find((item) => item.voucher_type === 'GDN_GATE_PASS' && item.voucher_no === row.linked_gdn_no)
      if (gdnRow) {
        await updateRow(tables.ledger, gdnRow.id, { status: 'DELIVERED' })
        await callRpc('sync_sales_order', {
          p_company_code: session.company.company_code,
          p_so_no: gdnRow.linked_so_no,
        })
      }
      if (completed?.id === row.id) setCompleted(null)
      if (viewing?.id === row.id) setViewing(null)
      bump()
      invoices.reload()
      void ledger.reload()
      void gdns.reload()
    } catch (caught) { setError(errorMessage(caught)) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sales Tax Invoices</h1>
          <p className="text-xs text-slate-500">Section 23 invoices generated from dispatched GDNs.</p>
        </div>
        {canCreate && <Button onClick={openNew}><Plus className="h-3.5 w-3.5" /> New invoice</Button>}
      </div>
      <PipelineBreadcrumb row={completed || viewing} ledger={ledger.rows} />
      {completed && !showForm && (
        <Card title={`Invoice ${completed.voucher_no} posted`} actions={<NextStepButton row={completed} ledger={ledger.rows} />}>
          <p className="text-xs text-slate-600">Record the bank receipt against this invoice to update the customer ledger and aging report.</p>
        </Card>
      )}
      {(error || invoices.error) && <Notice type="error">{error || invoices.error}</Notice>}
      {notice && !showForm && <Notice type="success">{notice}</Notice>}
      <Card>
        <div className="app-scroll overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-xs">
            <thead className="table-head">
              <tr><th className="px-3 py-2">Invoice No</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Linked GDN</th><th className="px-3 py-2 text-right">Net total</th><th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2 text-right">Balance</th><th className="px-3 py-2">Status</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.rows.map((row) => (
                <tr key={row.id} className="table-row">
                  <td className="px-3 py-2 font-bold text-blue-800">{row.voucher_no}{recordLocked(row, session.user, session.company) && <div><span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Auto-Locked (&gt;3 Days)</span></div>}</td>
                  <td className="px-3 py-2">{row.voucher_date}</td>
                  <td className="px-3 py-2">{row.customer_name}</td>
                  <td className="px-3 py-2">{row.linked_gdn_no}</td>
                  <td className="px-3 py-2 text-right font-bold">{money(row.net_invoice_total)}</td>
                  <td className="px-3 py-2 text-right">{money(paidAmount(ledger.rows, row.voucher_no))}</td>
                  <td className="px-3 py-2 text-right font-bold text-amber-700">{money(balanceDue(ledger.rows, row))}</td>
                  <td className="px-3 py-2">{invoiceStatus(ledger.rows, row)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" onClick={() => setViewing(row)}><Eye className="h-3.5 w-3.5" /></Button>
                      {canPrint && <Button variant="ghost" onClick={() => printInvoice(row)}><Printer className="h-3.5 w-3.5" /></Button>}
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
        <Modal title={editing ? `Edit ${editing.voucher_no}` : 'New sales tax invoice'} onClose={() => setShowForm(false)} wide>
          <div className="space-y-4">
            {error && <Notice type="error">{error}</Notice>}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label="Select unbilled GDN" className="col-span-2">
                <select className="field-input" value={gdnNo} onChange={(event) => setGdnNo(event.target.value)} disabled={Boolean(editing)}>
                  <option value="">Select GDN</option>
                  {selectableGdns.map((row) => <option key={row.id} value={row.voucher_no}>{row.voucher_no} — {row.customer_name}</option>)}
                  {editing && !selectableGdns.some((row) => row.voucher_no === editing.linked_gdn_no) && <option value={editing.linked_gdn_no}>{editing.linked_gdn_no} (editing)</option>}
                </select>
              </Field>
              <Field label="Invoice date"><input className="field-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
              <Field label="Customer category">{registration}</Field>
            </div>
            {selectedGdn && (
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs md:grid-cols-4">
                <p><strong>Customer:</strong> {selectedGdn.customer_name}</p>
                <p><strong>Ship-To:</strong> {selectedGdn.ship_to_name}</p>
                <p><strong>Filer status:</strong> {selectedGdn.filer_status}</p>
                <p><strong>Sec 236G:</strong> {(taxRate * 100).toFixed(1)}%</p>
                <p className="col-span-2 md:col-span-4"><strong>Address:</strong> {selectedGdn.ship_to_address}</p>
              </div>
            )}
            <table className="w-full text-left text-xs">
              <thead className="table-head"><tr><th className="px-2 py-2">Product</th><th className="px-2 py-2 text-right">Cartons</th><th className="px-2 py-2 text-right">Pcs</th><th className="px-2 py-2 text-right">Rate</th><th className="px-2 py-2 text-right">Exclusive</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((line, index) => (
                  <tr key={index}><td className="px-2 py-2">{line.product_name}</td><td className="px-2 py-2 text-right">{quantity(line.delivered_ctns)}</td><td className="px-2 py-2 text-right">{quantity(line.pcs)}</td><td className="px-2 py-2 text-right">{money(line.rate, 3)}</td><td className="px-2 py-2 text-right">{money(line.exclusive_value)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="ml-auto w-full max-w-sm rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
              <div className="flex justify-between"><span>Exclusive</span><strong>{money(totals.exclusive)}</strong></div>
              <div className="flex justify-between"><span>Sales tax 18%</span><strong>{money(totals.salesTax)}</strong></div>
              <div className="flex justify-between"><span>Further tax 4%</span><strong className={totals.furtherTax === 0 ? 'text-red-600' : ''}>{money(totals.furtherTax)}</strong></div>
              <div className="flex justify-between"><span>Advance tax 236G</span><strong>{money(totals.advanceTax)}</strong></div>
              <div className="mt-1 flex justify-between border-t border-slate-300 pt-1 text-sm font-bold"><span>Net total</span><span>{money(totals.netTotal)}</span></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={() => void save()}>{editing ? 'Update invoice' : 'Generate invoice'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {viewing && (
        <Modal title={`Invoice ${viewing.voucher_no}`} onClose={() => setViewing(null)} wide>
          <div className="space-y-3">
            <div className="flex justify-end"><NextStepButton row={viewing} ledger={ledger.rows} /></div>
            {viewing.registration_status === 'Register'
              ? <PrintInvoiceRegistered company={session.company} row={viewing} />
              : <PrintInvoiceUnregistered company={session.company} row={viewing} />}
          </div>
        </Modal>
      )}
    </div>
  )
}
