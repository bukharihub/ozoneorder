'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Eye, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { callRpcRows, deleteRow, insertRow, listRows, nextVoucher, updateRow } from '@/lib/api'
import { calculateTotals, round2 } from '@/lib/calc'
import { errorMessage, money, quantity, todayIso } from '@/lib/format'
import { bookerForCustomer, normalizeBookers, normalizeLinkedCustomerIds, type BookerInfo } from '@/lib/linkedCustomers'
import { useRows } from '@/lib/useRows'
import type { Customer, LedgerRow, LineItem, Product } from '@/lib/types'
import { lockReason, recordLocked } from '@/lib/guards'
import { hasPermission } from '@/lib/permissions'
import { useApp } from '../AppProvider'
import { NextStepButton, PipelineBreadcrumb } from '../Pipeline'
import { PrintSalesOrder } from '../print/Vouchers'
import { Button, Card, Field, Modal, Notice } from '../Ui'

interface DraftLine {
  product_id: string
  cartons: number
}

export function Orders() {
  const { session, tables, version, bump, showPrint, pipelineSeed, clearPipelineSeed } = useApp()
  const customers = useRows<Customer>(() => listRows(tables!.customers, { order: 'business_name' }), [tables?.customers, version])
  const products = useRows<Product>(() => listRows(tables!.products, { order: 'product_name' }), [tables?.products, version])
  const orders = useRows<LedgerRow>(() => listRows(tables!.ledger, { filters: { voucher_type: 'SALES_ORDER' }, order: 'created_at', ascending: false }), [tables?.ledger, version])
  const ledger = useRows<LedgerRow>(() => listRows(tables!.ledger, { order: 'created_at', ascending: false }), [tables?.ledger, version])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<LedgerRow | null>(null)
  const [customerId, setCustomerId] = useState('')
  const [voucherDate, setVoucherDate] = useState(todayIso())
  const [lines, setLines] = useState<DraftLine[]>([{ product_id: '', cartons: 1 }])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [viewing, setViewing] = useState<LedgerRow | null>(null)
  const [completed, setCompleted] = useState<LedgerRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [bookers, setBookers] = useState<BookerInfo[]>([])

  const linkedCustomerIds = normalizeLinkedCustomerIds(session?.user || { linked_customer_id: null, linked_customer_ids: [] })
  const hideRates = Boolean(session?.user.role === 'CUSTOMER' && session.user.hide_rates_and_amounts)
  const canCreate = hasPermission(session.user.role, session.user.permissions, 'sales_order', 'create')
  const canEdit = hasPermission(session.user.role, session.user.permissions, 'sales_order', 'edit')
  const canDelete = hasPermission(session.user.role, session.user.permissions, 'sales_order', 'delete')
  const canPrint = hasPermission(session.user.role, session.user.permissions, 'sales_order', 'print')

  useEffect(() => {
    let active = true
    void callRpcRows<any>('list_company_bookers')
      .then((rows) => { if (active) setBookers(normalizeBookers(rows)) })
      .catch(() => { if (active) setBookers([]) })
    return () => { active = false }
  }, [version])

  useEffect(() => {
    if (session?.user.role === 'CUSTOMER' && linkedCustomerIds.length) {
      setCustomerId((current) => (linkedCustomerIds.includes(current) ? current : linkedCustomerIds[0]))
    }
  }, [session?.user.role, linkedCustomerIds.join('|'), customers.rows])

  useEffect(() => {
    const soNo = pipelineSeed?.soNo
    if (!soNo) return
    const row = orders.rows.find((item) => item.voucher_no === soNo)
    if (row) {
      setViewing(row)
      clearPipelineSeed()
    }
  }, [pipelineSeed, orders.rows, clearPipelineSeed])

  const customer = customers.rows.find((item) => item.id === customerId) || null
  const inheritedBooker = bookerForCustomer(bookers, customerId)
  const eligibleProducts = useMemo(
    () => products.rows.filter((product) => product.product_type === (customer?.registration_status === 'Register' ? 'REGISTERED' : 'UNREGISTERED')),
    [products.rows, customer?.registration_status],
  )

  if (!session || !tables) return null

  const detailedLines = lines.map((line) => {
    const product = products.rows.find((item) => item.id === line.product_id)
    if (!product) return null
    const rate = customer?.registration_status === 'Unregister' ? Number(product.per_diaper_rate) : Number(product.per_carton_rate)
    const pcs = line.cartons * product.pcs_per_carton
    return {
      product,
      cartons: line.cartons,
      pcs,
      rate,
      exclusive: customer?.registration_status === 'Unregister' ? round2(pcs * rate) : round2(line.cartons * rate),
    }
  }).filter(Boolean) as Array<{ product: Product; cartons: number; pcs: number; rate: number; exclusive: number }>

  const totals = calculateTotals(
    customer?.registration_status || 'Unregister',
    Number(customer?.tax_rate_236g || 0.001),
    detailedLines.map((line) => ({
      cartons: line.cartons,
      pcs: line.pcs,
      diaperRate: line.rate,
      cartonRate: line.rate,
    })),
  )

  const openNew = () => {
    if (!canCreate) { setError('Permission denied: create Sales Order'); return }
    setEditing(null)
    setCustomerId(session.user.role === 'CUSTOMER' ? linkedCustomerIds[0] || '' : '')
    setVoucherDate(todayIso())
    setLines([{ product_id: '', cartons: 1 }])
    setError('')
    setShowForm(true)
  }

  const openEdit = (row: LedgerRow) => {
    if (!canEdit) { setError('Permission denied: edit Sales Order'); return }
    const reason = lockReason(row, session.user, session.company)
    if (reason) { setError(reason); return }
    const hasGdn = ledger.rows.some((item) => item.voucher_type === 'GDN_GATE_PASS' && item.linked_so_no === row.voucher_no)
    if (hasGdn) { setError('Locked: Delivery/GDN already processed'); return }
    setEditing(row)
    setCustomerId(row.customer_id || '')
    setVoucherDate(row.voucher_date)
    setLines(row.line_items.map((item) => ({ product_id: item.product_id, cartons: Number(item.ordered_ctns) })))
    setError('')
    setShowForm(true)
  }

  const buildLineItems = (): LineItem[] => detailedLines.map((line) => ({
    product_id: line.product.id,
    product_name: line.product.product_name,
    hs_code: line.product.hs_code,
    size_category: line.product.size_category,
    pcs_per_carton: line.product.pcs_per_carton,
    ordered_ctns: line.cartons,
    delivered_ctns: 0,
    pending_ctns: line.cartons,
    pcs: line.pcs,
    rate: line.rate,
    exclusive_value: line.exclusive,
  }))

  const save = async () => {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (!customer) throw new Error('Select a customer')
      if (!detailedLines.length) throw new Error('Add at least one valid product line')
      for (const line of detailedLines) {
        const available = Number(line.product.current_stock_ctns)
        if (line.cartons <= 0) throw new Error(`Cartons must be positive for ${line.product.product_name}`)
        if (line.cartons > available) {
          throw new Error(`Insufficient FG stock for ${line.product.product_name}. Available: ${quantity(available)} cartons`)
        }
      }
      const lineItems = buildLineItems()
      const payload = {
        voucher_no: editing?.voucher_no || await nextVoucher('SO-{YYYY}-{SEQ}', 2),
        voucher_date: voucherDate,
        customer_id: customer.id,
        customer_name: customer.business_name,
        ship_to_name: customer.business_name,
        ship_to_address: customer.delivery_destination,
        cnic_ntn: customer.cnic_ntn,
        strn: customer.strn,
        filer_status: customer.income_tax_status,
        registration_status: customer.registration_status,
        line_items: lineItems,
        total_cartons: lineItems.reduce((sum, item) => sum + item.ordered_ctns, 0),
        total_pcs: lineItems.reduce((sum, item) => sum + item.pcs, 0),
        total_exclusive_value: totals.exclusive,
        sales_tax_18: totals.salesTax,
        further_tax_4: totals.furtherTax,
        amount_before_236g: totals.amountBefore236g,
        advance_tax_236g: totals.advanceTax,
        net_invoice_total: totals.netTotal,
        status: 'PENDING' as const,
        created_by: session.user.username,
        booked_by_user_id: session.user.role !== 'CUSTOMER' && inheritedBooker ? inheritedBooker.id : session.user.id,
        booked_by_name: session.user.role !== 'CUSTOMER' && inheritedBooker ? inheritedBooker.full_name : (session.user.full_name || session.user.username),
      }
      let saved: LedgerRow
      if (editing) {
        const { voucher_no, ...patch } = payload
        saved = await updateRow<LedgerRow>(tables.ledger, editing.id, patch as any)
        setNotice('Sales order updated')
      } else {
        saved = await insertRow<LedgerRow>(tables.ledger, { voucher_type: 'SALES_ORDER', ...payload })
        setNotice('Sales order created')
      }
      setCompleted(saved)
      setShowForm(false)
      bump()
      orders.reload()
      void ledger.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row: LedgerRow) => {
    if (!canDelete) { setError('Permission denied: delete Sales Order'); return }
    const reason = lockReason(row, session.user, session.company)
    if (reason) { setError(reason); return }
    if (ledger.rows.some((item) => item.voucher_type === 'GDN_GATE_PASS' && item.linked_so_no === row.voucher_no)) { setError('Locked: Delivery/GDN already processed'); return }
    if (!window.confirm(`Delete sales order ${row.voucher_no}?`)) return
    try {
      await deleteRow(tables.ledger, row.id)
      if (completed?.id === row.id) setCompleted(null)
      if (viewing?.id === row.id) setViewing(null)
      bump(); orders.reload(); void ledger.reload()
    } catch (caught) { setError(errorMessage(caught)) }
  }

  const print = (row: LedgerRow) => { if (!canPrint) return; showPrint(<PrintSalesOrder company={session.company} row={row} hideRates={hideRates} />) }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sales Orders</h1>
          <p className="text-xs text-slate-500">Stock-validated orders with live pending quantity tracking.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => orders.reload()}>Refresh</Button>
          {canCreate && <Button onClick={openNew}><Plus className="h-3.5 w-3.5" /> New sales order</Button>}
        </div>
      </div>
      <PipelineBreadcrumb row={completed || viewing} ledger={ledger.rows} />
      {completed && !showForm && (
        <Card title={`Sales order ${completed.voucher_no} ready for dispatch`} actions={<NextStepButton row={completed} ledger={ledger.rows} />}>
          <p className="text-xs text-slate-600">Create the GDN &amp; Gate Pass against this order to continue the synced ERP pipeline.</p>
        </Card>
      )}
      {error && !showForm && <Notice type="error">{error}</Notice>}
      {notice && !showForm && <Notice type="success">{notice}</Notice>}
      <Card>
        <div className="app-scroll overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead className="table-head">
              <tr><th className="px-3 py-2">Order No</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Booker</th><th className="px-3 py-2 text-right">Cartons</th><th className="px-3 py-2">Status</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.rows.map((row) => (
                <tr key={row.id} className="table-row">
                  <td className="px-3 py-2 font-bold text-blue-800">{row.voucher_no}</td>
                  <td className="px-3 py-2">{row.voucher_date}</td>
                  <td className="px-3 py-2">{row.customer_name}</td>
                  <td className="px-3 py-2">{row.booked_by_name || <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-2 text-right">{quantity(row.total_cartons)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-block w-fit rounded px-2 py-0.5 text-[10px] font-bold ${row.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : row.status === 'PARTIAL_DELIVERED' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>{row.status}</span>
                      {recordLocked(row, session.user, session.company) && <span className="inline-block w-fit rounded bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Auto-Locked (&gt;3 Days)</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" onClick={() => setViewing(row)}><Eye className="h-3.5 w-3.5" /></Button>
                      {canPrint && <Button variant="ghost" onClick={() => print(row)}><Printer className="h-3.5 w-3.5" /></Button>}
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
        <Modal title={editing ? `Edit ${editing.voucher_no}` : 'New sales order'} onClose={() => setShowForm(false)} wide>
          <div className="space-y-4">
            {error && <Notice type="error">{error}</Notice>}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Field label="Customer" className="col-span-2">
                <select className="field-input" value={customerId} onChange={(event) => { setCustomerId(event.target.value); setLines([{ product_id: '', cartons: 1 }]) }} disabled={session.user.role === 'CUSTOMER' && linkedCustomerIds.length <= 1}>
                  <option value="">Select customer</option>
                  {(session.user.role === 'CUSTOMER' ? customers.rows.filter((item) => linkedCustomerIds.includes(item.id)) : customers.rows).map((item) => <option key={item.id} value={item.id}>{item.business_name} ({item.registration_status}) · Booker: {bookerForCustomer(bookers, item.id)?.full_name || 'Unassigned'}</option>)}
                </select>
              </Field>
              <Field label="Order date">
                <input className="field-input" type="date" value={voucherDate} onChange={(event) => setVoucherDate(event.target.value)} />
              </Field>
              <Field label="Product list">{customer?.registration_status === 'Register' ? 'Registered' : 'Unregistered'}</Field>
              <Field label="Booker / Group (auto)">{session.user.role !== 'CUSTOMER' && inheritedBooker ? inheritedBooker.full_name : (session.user.full_name || session.user.username)}</Field>
            </div>
            <div className="app-scroll overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="table-head">
                  <tr>
                    <th className="px-2 py-2">Product</th><th className="px-2 py-2 text-right">Available</th>
                    <th className="px-2 py-2 text-right">Cartons</th><th className="px-2 py-2 text-right">Pcs</th>
                    {!hideRates && <><th className="px-2 py-2 text-right">Rate</th><th className="px-2 py-2 text-right">Exclusive</th></>}
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((line, index) => {
                    const detail = detailedLines[index]
                    return (
                      <tr key={index}>
                        <td className="px-2 py-2">
                          <select className="field-input" value={line.product_id} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, product_id: event.target.value } : item))}>
                            <option value="">Select product</option>
                            {eligibleProducts.map((product) => <option key={product.id} value={product.id}>{product.product_name} ({product.size_category})</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2 text-right">{detail ? quantity(detail.product.current_stock_ctns) : '—'}</td>
                        <td className="px-2 py-2 text-right">
                          <input className="field-input w-24 text-right" type="number" min="1" value={line.cartons} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, cartons: Number(event.target.value) } : item))} />
                        </td>
                        <td className="px-2 py-2 text-right">{detail ? quantity(detail.pcs) : '—'}</td>
                        {!hideRates && <><td className="px-2 py-2 text-right">{detail ? money(detail.rate, 3) : '—'}</td><td className="px-2 py-2 text-right">{detail ? money(detail.exclusive) : '—'}</td></>}
                        <td className="px-2 py-2 text-right">
                          <Button variant="ghost" onClick={() => setLines((current) => current.filter((_, i) => i !== index))} disabled={lines.length === 1}><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Button variant="secondary" onClick={() => setLines((current) => [...current, { product_id: '', cartons: 1 }])}><Plus className="h-3.5 w-3.5" /> Add line</Button>
            {!hideRates && (
              <div className="ml-auto w-full max-w-sm rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex justify-between py-0.5"><span>Exclusive value</span><strong>{money(totals.exclusive)}</strong></div>
                <div className="flex justify-between py-0.5"><span>Sales tax 18%</span><strong>{money(totals.salesTax)}</strong></div>
                <div className="flex justify-between py-0.5"><span>Further tax 4%</span><strong>{money(totals.furtherTax)}</strong></div>
                <div className="flex justify-between py-0.5"><span>Advance tax 236G</span><strong>{money(totals.advanceTax)}</strong></div>
                <div className="mt-1 flex justify-between border-t border-slate-300 pt-1 text-sm font-bold text-slate-900"><span>Net total</span><span>{money(totals.netTotal)}</span></div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={() => void save()} disabled={busy}>{busy ? 'Saving…' : editing ? 'Update order' : 'Create order'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {viewing && (
        <Modal title={`Sales order ${viewing.voucher_no}`} onClose={() => setViewing(null)} wide>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <p><strong>Customer:</strong> {viewing.customer_name}</p>
              <p><strong>Booker:</strong> {viewing.booked_by_name || '—'}</p>
              <p><strong>Date:</strong> {viewing.voucher_date}</p>
              <p><strong>Status:</strong> {viewing.status}</p>
              <p><strong>Cartons:</strong> {quantity(viewing.total_cartons)}</p>
            </div>
            <table className="w-full text-left">
              <thead className="table-head"><tr><th className="px-2 py-2">Product</th><th className="px-2 py-2 text-right">Ordered</th><th className="px-2 py-2 text-right">Delivered</th><th className="px-2 py-2 text-right">Pending</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {viewing.line_items.map((item, index) => (
                  <tr key={index}><td className="px-2 py-2">{item.product_name}</td><td className="px-2 py-2 text-right">{quantity(item.ordered_ctns)}</td><td className="px-2 py-2 text-right">{quantity(item.delivered_ctns)}</td><td className="px-2 py-2 text-right font-bold">{quantity(item.pending_ctns)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-2"><NextStepButton row={viewing} ledger={ledger.rows} />{canPrint && <Button onClick={() => print(viewing)}><Printer className="h-3.5 w-3.5" /> Print</Button>}</div>
          </div>
        </Modal>
      )}
    </div>
  )
}
