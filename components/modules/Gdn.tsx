'use client'

import React, { useEffect, useState } from 'react'
import { Eye, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { callRpc, deleteRow, insertRow, listRows, nextVoucher, updateRow } from '@/lib/api'
import { errorMessage, quantity, todayIso } from '@/lib/format'
import { invoiceForGdn, pendingSoRows } from '@/lib/pipeline'
import { useRows } from '@/lib/useRows'
import type { LedgerRow, LineItem, Product } from '@/lib/types'
import { lockReason, recordLocked } from '@/lib/guards'
import { hasPermission } from '@/lib/permissions'
import { useApp } from '../AppProvider'
import { NextStepButton, PipelineBreadcrumb } from '../Pipeline'
import { PrintGdn } from '../print/Vouchers'
import { Button, Card, Field, Modal, Notice } from '../Ui'

export function Gdn() {
  const { session, tables, version, bump, showPrint, pipelineSeed, clearPipelineSeed } = useApp()
  const orders = useRows<LedgerRow>(() => listRows(tables!.ledger, { filters: { voucher_type: 'SALES_ORDER' }, order: 'created_at', ascending: false }), [tables?.ledger, version])
  const gdns = useRows<LedgerRow>(() => listRows(tables!.ledger, { filters: { voucher_type: 'GDN_GATE_PASS' }, order: 'created_at', ascending: false }), [tables?.ledger, version])
  const ledger = useRows<LedgerRow>(() => listRows(tables!.ledger, { order: 'created_at', ascending: false }), [tables?.ledger, version])
  const products = useRows<Product>(() => listRows(tables!.products), [tables?.products, version])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<LedgerRow | null>(null)
  const [soNo, setSoNo] = useState('')
  const [date, setDate] = useState(todayIso())
  const [dispatch, setDispatch] = useState<Record<string, number>>({})
  const [header, setHeader] = useState({ vehicle_1: '', driver_1: '', remarks_1: '', vehicle_2: '', driver_2: '', remarks_2: '', outward_time: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [viewing, setViewing] = useState<LedgerRow | null>(null)
  const [completed, setCompleted] = useState<LedgerRow | null>(null)

  useEffect(() => {
    const seedSo = pipelineSeed?.soNo
    if (!seedSo) return
    setEditing(null)
    setSoNo(seedSo)
    setDate(todayIso())
    setDispatch({})
    setHeader({ vehicle_1: '', driver_1: '', remarks_1: '', vehicle_2: '', driver_2: '', remarks_2: '', outward_time: '' })
    setError('')
    setShowForm(true)
    clearPipelineSeed()
  }, [pipelineSeed, clearPipelineSeed])

  if (!session || !tables) return null
  const canCreate = hasPermission(session.user.role, session.user.permissions, 'gdn_gate_pass', 'create')
  const canEdit = hasPermission(session.user.role, session.user.permissions, 'gdn_gate_pass', 'edit')
  const canDelete = hasPermission(session.user.role, session.user.permissions, 'gdn_gate_pass', 'delete')
  const canPrint = hasPermission(session.user.role, session.user.permissions, 'gdn_gate_pass', 'print')

  const selectableOrders = pendingSoRows(ledger.rows)
  const selectedOrder = ledger.rows.find((row) => row.voucher_type === 'SALES_ORDER' && row.voucher_no === soNo) || null
  const lines = selectedOrder?.line_items.filter((item) => Number(item.pending_ctns) > 0 || editing?.line_items.some((line) => line.product_id === item.product_id)) || []

  const openNew = () => {
    if (!canCreate) { setError('Permission denied: create GDN'); return }
    setEditing(null); setSoNo(''); setDate(todayIso()); setDispatch({})
    setHeader({ vehicle_1: '', driver_1: '', remarks_1: '', vehicle_2: '', driver_2: '', remarks_2: '', outward_time: '' })
    setError(''); setShowForm(true)
  }

  const openEdit = (row: LedgerRow) => {
    if (!canEdit) { setError('Permission denied: edit GDN'); return }
    const reason = lockReason(row, session.user, session.company)
    if (reason) { setError(reason); return }
    if (invoiceForGdn(ledger.rows, row.voucher_no)) { setError('Locked: Sales Tax Invoice already generated'); return }
    setEditing(row)
    setSoNo(row.linked_so_no)
    setDate(row.voucher_date)
    const values: Record<string, number> = {}
    row.line_items.forEach((item) => { values[item.product_id] = Number(item.delivered_ctns) })
    setDispatch(values)
    setHeader({
      vehicle_1: row.vehicle_1, driver_1: row.driver_1, remarks_1: row.remarks_1,
      vehicle_2: row.vehicle_2, driver_2: row.driver_2, remarks_2: row.remarks_2,
      outward_time: row.outward_time,
    })
    setError('')
    setShowForm(true)
  }

  const save = async () => {
    setError('')
    try {
      if (!selectedOrder) throw new Error('Select an approved sales order')
      const sourceLines = selectedOrder.line_items.filter((item) => Number(item.pending_ctns) > 0 || editing?.line_items.some((line) => line.product_id === item.product_id))
      const built: LineItem[] = []
      for (const item of sourceLines) {
        const cartons = Number(dispatch[item.product_id] || 0)
        if (cartons <= 0) continue
        const product = products.rows.find((candidate) => candidate.id === item.product_id)
        const previouslyDispatched = Number(editing?.line_items.find((line) => line.product_id === item.product_id)?.delivered_ctns || 0)
        const available = Number(product?.current_stock_ctns || 0) + previouslyDispatched
        if (cartons > Number(item.pending_ctns) + previouslyDispatched) throw new Error(`Dispatch exceeds pending quantity for ${item.product_name}`)
        if (cartons > available) throw new Error(`Insufficient FG stock for ${item.product_name}. Available: ${quantity(available)} cartons`)
        const pcsPerCarton = Number(product?.pcs_per_carton || item.pcs_per_carton || 0)
        built.push({
          ...item,
          delivered_ctns: cartons,
          pending_ctns: Math.max(Number(item.pending_ctns) - cartons, 0),
          pcs: cartons * pcsPerCarton,
        })
      }
      if (!built.length) throw new Error('Enter at least one dispatched carton quantity')
      const voucherNo = editing?.voucher_no || await nextVoucher('GDN-{YYYY}-{SEQ}', 2)
      const payload: any = {
        voucher_no: voucherNo,
        linked_so_no: selectedOrder.voucher_no,
        linked_gdn_no: voucherNo,
        voucher_date: date,
        customer_id: selectedOrder.customer_id,
        customer_name: selectedOrder.customer_name,
        ship_to_name: selectedOrder.ship_to_name,
        ship_to_address: selectedOrder.ship_to_address,
        cnic_ntn: selectedOrder.cnic_ntn,
        strn: selectedOrder.strn,
        filer_status: selectedOrder.filer_status,
        registration_status: selectedOrder.registration_status,
        line_items: built,
        total_cartons: built.reduce((sum, item) => sum + Number(item.delivered_ctns), 0),
        total_pcs: built.reduce((sum, item) => sum + Number(item.pcs), 0),
        ...header,
        status: 'DELIVERED' as const,
        created_by: session.user.username,
        booked_by_user_id: selectedOrder.booked_by_user_id || null,
        booked_by_name: selectedOrder.booked_by_name || null,
      }
      let saved: LedgerRow
      if (editing) saved = await updateRow<LedgerRow>(tables.ledger, editing.id, payload)
      else saved = await insertRow<LedgerRow>(tables.ledger, { voucher_type: 'GDN_GATE_PASS', ...payload })
      await callRpc('sync_sales_order', {
        p_company_code: session.company.company_code,
        p_so_no: selectedOrder.voucher_no,
      })
      setCompleted(saved)
      setNotice(editing ? 'GDN updated and stock adjusted' : 'GDN created and stock deducted')
      setShowForm(false)
      bump()
      gdns.reload()
      orders.reload()
      products.reload()
      void ledger.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  const remove = async (row: LedgerRow) => {
    if (!canDelete) { setError('Permission denied: delete GDN'); return }
    const reason = lockReason(row, session.user, session.company)
    if (reason) { setError(reason); return }
    if (invoiceForGdn(ledger.rows, row.voucher_no)) { setError('Locked: Sales Tax Invoice already generated'); return }
    if (!window.confirm(`Delete GDN ${row.voucher_no}? Stock will be restored.`)) return
    try {
      await deleteRow(tables.ledger, row.id)
      await callRpc('sync_sales_order', { p_company_code: session.company.company_code, p_so_no: row.linked_so_no })
      if (completed?.id === row.id) setCompleted(null)
      if (viewing?.id === row.id) setViewing(null)
      bump(); gdns.reload(); orders.reload(); products.reload(); void ledger.reload()
    } catch (caught) { setError(errorMessage(caught)) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">GDN &amp; Gate Pass</h1>
          <p className="text-xs text-slate-500">Partial dispatch tracking with automatic FG stock reversal on edit or delete.</p>
        </div>
        {canCreate && <Button onClick={openNew}><Plus className="h-3.5 w-3.5" /> New GDN / Gate Pass</Button>}
      </div>
      <PipelineBreadcrumb row={completed || viewing} ledger={ledger.rows} />
      {completed && !showForm && (
        <Card title={`Dispatch ${completed.voucher_no} ready for billing`} actions={<NextStepButton row={completed} ledger={ledger.rows} />}>
          <p className="text-xs text-slate-600">Generate the sales tax invoice from the dispatched quantities to complete the billing step.</p>
        </Card>
      )}
      {(error || gdns.error) && <Notice type="error">{error || gdns.error}</Notice>}
      {notice && !showForm && <Notice type="success">{notice}</Notice>}
      <Card>
        <div className="app-scroll overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead className="table-head">
              <tr><th className="px-3 py-2">Gate Pass No</th><th className="px-3 py-2">Linked SO</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2 text-right">Cartons</th><th className="px-3 py-2">Vehicle</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {gdns.rows.map((row) => (
                <tr key={row.id} className="table-row">
                  <td className="px-3 py-2 font-bold text-blue-800">{row.voucher_no}{recordLocked(row, session.user, session.company) && <div><span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Auto-Locked (&gt;3 Days)</span></div>}</td>
                  <td className="px-3 py-2">{row.linked_so_no}</td>
                  <td className="px-3 py-2">{row.customer_name}</td>
                  <td className="px-3 py-2 text-right">{quantity(row.total_cartons)}</td>
                  <td className="px-3 py-2">{row.vehicle_1}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" onClick={() => setViewing(row)}><Eye className="h-3.5 w-3.5" /></Button>
                      {canPrint && <Button variant="ghost" onClick={() => showPrint(<PrintGdn company={session.company} row={row} />)}><Printer className="h-3.5 w-3.5" /></Button>}
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
        <Modal title={editing ? `Edit ${editing.voucher_no}` : 'New GDN / Gate Pass'} onClose={() => setShowForm(false)} wide>
          <div className="space-y-4">
            {error && <Notice type="error">{error}</Notice>}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label="Approved sales order" className="col-span-2">
                <select className="field-input" value={soNo} onChange={(event) => { setSoNo(event.target.value); setDispatch({}) }} disabled={Boolean(editing)}>
                  <option value="">Select order</option>
                  {selectableOrders.map((row) => <option key={row.id} value={row.voucher_no}>{row.voucher_no} — {row.customer_name} ({row.status})</option>)}
                  {editing && !selectableOrders.some((row) => row.voucher_no === editing.linked_so_no) && <option value={editing.linked_so_no}>{editing.linked_so_no} (editing)</option>}
                </select>
              </Field>
              <Field label="GDN date"><input className="field-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
              <Field label="Outward time"><input className="field-input" value={header.outward_time} onChange={(event) => setHeader({ ...header, outward_time: event.target.value })} placeholder="HH:MM" /></Field>
            </div>
            {selectedOrder && (
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs md:grid-cols-4">
                <p><strong>Customer:</strong> {selectedOrder.customer_name}</p>
                <p><strong>Ship-To:</strong> {selectedOrder.ship_to_name}</p>
                <p className="col-span-2"><strong>Address:</strong> {selectedOrder.ship_to_address}</p>
              </div>
            )}
            <div className="app-scroll overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="table-head"><tr><th className="px-2 py-2">Product</th><th className="px-2 py-2 text-right">Ordered</th><th className="px-2 py-2 text-right">Delivered</th><th className="px-2 py-2 text-right">Remaining</th><th className="px-2 py-2 text-right">Stock</th><th className="px-2 py-2 text-right">Dispatch cartons</th><th className="px-2 py-2 text-right">Pcs</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((item) => {
                    const product = products.rows.find((candidate) => candidate.id === item.product_id)
                    const cartons = Number(dispatch[item.product_id] || 0)
                    const alreadyDelivered = Math.max(Number(item.ordered_ctns) - Number(item.pending_ctns), 0)
                    return (
                      <tr key={item.product_id}>
                        <td className="px-2 py-2 font-medium">{item.product_name}</td>
                        <td className="px-2 py-2 text-right">{quantity(item.ordered_ctns)}</td>
                        <td className="px-2 py-2 text-right">{quantity(alreadyDelivered)}</td>
                        <td className="px-2 py-2 text-right font-bold text-blue-700">{quantity(item.pending_ctns)}</td>
                        <td className="px-2 py-2 text-right">{product ? quantity(product.current_stock_ctns) : '—'}</td>
                        <td className="px-2 py-2 text-right">
                          <input className="field-input w-24 text-right" type="number" min="0" max={Number(item.pending_ctns)} value={dispatch[item.product_id] ?? 0} onChange={(event) => setDispatch((current) => ({ ...current, [item.product_id]: Number(event.target.value) }))} />
                        </td>
                        <td className="px-2 py-2 text-right">{quantity(cartons * Number(product?.pcs_per_carton || 0))}</td>
                      </tr>
                    )
                  })}
                  {!lines.length && <tr><td colSpan={7} className="px-2 py-6 text-center text-slate-500">No pending sales orders available.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label="Vehicle #1"><input className="field-input" value={header.vehicle_1} onChange={(event) => setHeader({ ...header, vehicle_1: event.target.value })} /></Field>
              <Field label="Driver #1"><input className="field-input" value={header.driver_1} onChange={(event) => setHeader({ ...header, driver_1: event.target.value })} /></Field>
              <Field label="Remarks #1"><input className="field-input" value={header.remarks_1} onChange={(event) => setHeader({ ...header, remarks_1: event.target.value })} /></Field>
              <Field label="Vehicle #2"><input className="field-input" value={header.vehicle_2} onChange={(event) => setHeader({ ...header, vehicle_2: event.target.value })} /></Field>
              <Field label="Driver #2"><input className="field-input" value={header.driver_2} onChange={(event) => setHeader({ ...header, driver_2: event.target.value })} /></Field>
              <Field label="Remarks #2"><input className="field-input" value={header.remarks_2} onChange={(event) => setHeader({ ...header, remarks_2: event.target.value })} /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={() => void save()}>{editing ? 'Update GDN' : 'Post GDN & Gate Pass'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {viewing && (
        <Modal title={`GDN / Gate Pass ${viewing.voucher_no}`} onClose={() => setViewing(null)} wide>
          <div className="space-y-3">
            <div className="flex justify-end"><NextStepButton row={viewing} ledger={ledger.rows} /></div>
            <PrintGdn company={session.company} row={viewing} />
          </div>
        </Modal>
      )}
    </div>
  )
}
