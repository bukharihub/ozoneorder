'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, KeyRound, LogOut, Minus, Package, Plus, Printer, Search, ShoppingCart, Truck } from 'lucide-react'
import { callRpc, insertRow, listRows, nextVoucher } from '@/lib/api'
import { errorMessage, money, quantity } from '@/lib/format'
import {
  cartQty,
  clampCartons,
  prepareCustomerOrder,
  registrationGroupLabel,
  registrationLabel,
  registrationProductType,
  remainingStock,
  sortCustomerQueue,
  validateBatchStock,
  type BatchCarts,
} from '@/lib/customerOrder'
import { normalizeLinkedCustomerIds } from '@/lib/linkedCustomers'
import { orderStage, pipelineLinks, soProgress } from '@/lib/pipeline'
import { useRows } from '@/lib/useRows'
import type { Customer, LedgerRow, Product } from '@/lib/types'
import { useApp } from '../AppProvider'
import { CompanyLogo } from '../CompanyLogo'
import { DeveloperFooter } from '../DeveloperBranding'
import { UserGuide } from '../UserGuide'
import { PrintInvoiceRegistered, PrintInvoiceUnregistered } from '../print/Vouchers'
import { Button, Card, Field, Modal, Notice } from '../Ui'

type PortalTab = 'place' | 'track'

interface ConfirmedOrder {
  voucherNo: string
  customerName: string
  registrationStatus: Customer['registration_status']
}

const stageLabels = ['Order Placed', 'Preparing / Partial Dispatch', 'Dispatched & On the Way', 'Invoiced & Completed']
const stageIcons = [ShoppingCart, Package, Truck, Check]

export function CustomerPortal() {
  const { session, tables, version, bump, logout, showPrint } = useApp()
  const customers = useRows<Customer>(() => listRows(tables!.customers), [tables?.customers, version])
  const products = useRows<Product>(() => listRows(tables!.products, { order: 'product_name' }), [tables?.products, version])
  const ledger = useRows<LedgerRow>(() => listRows(tables!.ledger, { order: 'created_at', ascending: false }), [tables?.ledger, version])
  const [tab, setTab] = useState<PortalTab>('place')
  const [orderStep, setOrderStep] = useState<1 | 2 | 3>(1)
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([])
  const [selectionSearch, setSelectionSearch] = useState('')
  const [queue, setQueue] = useState<string[]>([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [carts, setCarts] = useState<BatchCarts>({})
  const [productSearch, setProductSearch] = useState('')
  const [confirmedOrders, setConfirmedOrders] = useState<ConfirmedOrder[]>([])
  const [confirmedBooker, setConfirmedBooker] = useState('')
  const [drawer, setDrawer] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNext, setPwNext] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwNotice, setPwNotice] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => {
      void ledger.reload()
      if (tab === 'place') void products.reload()
    }, 15000)
    return () => window.clearInterval(timer)
  }, [ledger.reload, products.reload, tab])

  const linkedIdsKey = session?.user.linked_customer_ids?.join('|') || ''
  const linkedCustomerIds = useMemo(
    () => normalizeLinkedCustomerIds(session?.user || { linked_customer_id: null, linked_customer_ids: [] }),
    [session?.user.linked_customer_id, linkedIdsKey],
  )
  const linkedCustomers = useMemo(() => {
    const ids = new Set(linkedCustomerIds)
    return customers.rows.filter((row) => ids.has(row.id))
  }, [customers.rows, linkedCustomerIds])
  const customersById = useMemo(() => new Map(linkedCustomers.map((customer) => [customer.id, customer])), [linkedCustomers])
  const selectedSet = useMemo(() => new Set(selectedCustomerIds), [selectedCustomerIds])
  const visibleCustomers = useMemo(() => {
    const term = selectionSearch.trim().toLowerCase()
    if (!term) return linkedCustomers
    return linkedCustomers.filter((customer) => `${customer.business_name} ${customer.delivery_destination} ${customer.bank_account_no || ''} ${customer.bank_branch_name || ''}`.toLowerCase().includes(term))
  }, [linkedCustomers, selectionSearch])
  const allSelected = linkedCustomers.length > 0 && linkedCustomers.every((customer) => selectedSet.has(customer.id))

  const queueCustomers = useMemo(
    () => queue.map((id) => customersById.get(id)).filter((customer): customer is Customer => Boolean(customer)),
    [queue, customersById],
  )
  const activeCustomer = queueCustomers[queueIndex] || null
  const eligibleProducts = useMemo(() => {
    if (!activeCustomer) return []
    const expectedType = registrationProductType(activeCustomer.registration_status)
    return products.rows.filter((product) => product.product_type === expectedType)
  }, [products.rows, activeCustomer])
  const visibleProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase()
    if (!term) return eligibleProducts
    return eligibleProducts.filter((product) => `${product.product_name} ${product.size_category} ${product.hs_code}`.toLowerCase().includes(term))
  }, [eligibleProducts, productSearch])
  const activeCart = activeCustomer ? carts[activeCustomer.id] || {} : {}
  const activeOrder = activeCustomer ? prepareCustomerOrder(activeCustomer, eligibleProducts, activeCart) : null
  const reviewOrders = useMemo(() => queueCustomers.map((customer) => {
    const expectedType = registrationProductType(customer.registration_status)
    const customerProducts = products.rows.filter((product) => product.product_type === expectedType)
    return { customer, order: prepareCustomerOrder(customer, customerProducts, carts[customer.id]) }
  }), [queueCustomers, products.rows, carts])
  const hideRates = Boolean(session?.user.hide_rates_and_amounts)

  if (!session || !tables) return null

  const statusBadge = (status: Customer['registration_status']) => (
    <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${status === 'Register' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
      {registrationLabel(status)}
    </span>
  )

  const toggleCustomer = (id: string) => {
    setError('')
    setNotice('')
    setConfirmedOrders([])
    setSelectedCustomerIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const selectAllCustomers = () => {
    setError('')
    setNotice('')
    setConfirmedOrders([])
    setSelectedCustomerIds(linkedCustomers.map((customer) => customer.id))
  }

  const clearSelection = () => {
    setError('')
    setNotice('')
    setConfirmedOrders([])
    setSelectedCustomerIds([])
  }

  const proceedWithSelection = () => {
    const sorted = sortCustomerQueue(linkedCustomers, selectedCustomerIds)
    if (!sorted.length) {
      setError('Select at least one customer before proceeding')
      return
    }
    setQueue(sorted)
    setQueueIndex(0)
    setCarts((current) => {
      const next: BatchCarts = {}
      sorted.forEach((id) => { next[id] = current[id] || {} })
      return next
    })
    setProductSearch('')
    setConfirmedOrders([])
    setError('')
    setNotice('')
    setDrawer(false)
    setOrderStep(2)
  }

  const remainingFor = (product: Product) => remainingStock(product, queue, carts, queueIndex)

  const updateCartons = (productId: string, value: unknown) => {
    if (!activeCustomer) return
    const product = eligibleProducts.find((item) => item.id === productId)
    if (!product) return
    setError('')
    const cartons = clampCartons(value, remainingFor(product))
    setCarts((current) => {
      const customerCart = { ...(current[activeCustomer.id] || {}) }
      if (cartons) customerCart[productId] = cartons
      else delete customerCart[productId]
      return { ...current, [activeCustomer.id]: customerCart }
    })
  }

  const changeActiveQty = (productId: string, delta: number) => {
    updateCartons(productId, cartQty(activeCart, productId) + delta)
  }

  const saveAndNext = () => {
    if (!activeCustomer) return
    if (!activeOrder || !activeOrder.details.length) {
      setError(`Add at least one product for ${activeCustomer.business_name}`)
      return
    }
    const stockError = validateBatchStock(queue, customersById, products.rows, carts, queueIndex + 1)
    if (stockError) {
      setError(stockError)
      return
    }
    setError('')
    setDrawer(false)
    if (queueIndex < queue.length - 1) {
      setQueueIndex(queueIndex + 1)
      setProductSearch('')
      setNotice(`${activeCustomer.business_name} saved. Next customer loaded.`)
      return
    }
    setOrderStep(3)
  }

  const goToPreviousCustomer = () => {
    setQueueIndex((current) => Math.max(0, current - 1))
    setProductSearch('')
    setError('')
  }

  const editCustomer = (index: number) => {
    setQueueIndex(index)
    setProductSearch('')
    setDrawer(false)
    setError('')
    setOrderStep(2)
  }

  const submitAllOrders = async () => {
    setError('')
    setNotice('')
    if (!reviewOrders.length) {
      setError('No customers are queued for submission')
      return
    }
    const emptyCustomer = reviewOrders.find((entry) => !entry.order.details.length)
    if (emptyCustomer) {
      setError(`Add at least one product for ${emptyCustomer.customer.business_name}`)
      return
    }
    const stockError = validateBatchStock(queue, customersById, products.rows, carts)
    if (stockError) {
      setError(stockError)
      return
    }
    setBusy(true)
    const bookedByName = session.user.full_name || session.user.username
    const posted: ConfirmedOrder[] = []
    setConfirmedBooker(bookedByName)
    try {
      for (const { customer, order } of reviewOrders) {
        const voucherNo = await nextVoucher('SO-{YYYY}-{SEQ}', 2)
        await insertRow(tables.ledger, {
          voucher_type: 'SALES_ORDER',
          voucher_no: voucherNo,
          voucher_date: new Date().toISOString().slice(0, 10),
          customer_id: customer.id,
          customer_name: customer.business_name,
          ship_to_name: customer.business_name,
          ship_to_address: customer.delivery_destination,
          cnic_ntn: customer.cnic_ntn,
          strn: customer.strn,
          filer_status: customer.income_tax_status,
          registration_status: customer.registration_status,
          line_items: order.lineItems,
          total_cartons: order.totalCartons,
          total_pcs: order.totalPcs,
          total_exclusive_value: order.totals.exclusive,
          sales_tax_18: order.totals.salesTax,
          further_tax_4: order.totals.furtherTax,
          amount_before_236g: order.totals.amountBefore236g,
          advance_tax_236g: order.totals.advanceTax,
          net_invoice_total: order.totals.netTotal,
          status: 'PENDING',
          created_by: session.user.username,
          booked_by_user_id: session.user.id,
          booked_by_name: bookedByName,
        })
        posted.push({
          voucherNo,
          customerName: customer.business_name,
          registrationStatus: customer.registration_status,
        })
        setConfirmedOrders([...posted])
      }
      setCarts({})
      setQueue([])
      setQueueIndex(0)
      setSelectedCustomerIds([])
      setConfirmedOrders(posted)
      setDrawer(false)
      setOrderStep(1)
      setTab('place')
      setNotice(`${posted.length} customer sales orders posted successfully`)
      bump()
      void products.reload()
      void ledger.reload()
    } catch (caught) {
      if (posted.length) setConfirmedOrders(posted)
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const myOrders = ledger.rows
    .filter((row) => row.voucher_type === 'SALES_ORDER' && (linkedCustomerIds.includes(String(row.customer_id || '')) || (row.booked_by_user_id && row.booked_by_user_id === session.user.id)))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))

  const printInvoice = (invoice: LedgerRow) => {
    if (hideRates) return
    const component = invoice.registration_status === 'Register'
      ? <PrintInvoiceRegistered company={session.company} row={invoice} />
      : <PrintInvoiceUnregistered company={session.company} row={invoice} />
    showPrint(component)
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 min-w-[70px] items-center justify-center">
              <CompanyLogo url={session.company.logo_url} companyCode={session.company.company_code} companyName={session.company.company_name} className="max-h-14" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-900">{session.company.company_name}</p>
              <p className="text-[11px] text-slate-500">{session.user.full_name || session.user.username} — Distributor / Customer Portal</p>
            </div>
          </div>
          <div className="flex gap-2"><UserGuide /><Button variant="secondary" onClick={() => { setPwOpen(true); setPwError(''); setPwNotice('') }}><KeyRound className="h-3.5 w-3.5" /> Change Password</Button><Button variant="secondary" onClick={() => void logout()}><LogOut className="h-3.5 w-3.5" /> Sign out</Button></div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 pb-20">
        <div className="mb-4 flex gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <button onClick={() => setTab('place')} className={`flex-1 rounded-lg px-4 py-2 text-xs font-bold transition ${tab === 'place' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Place New Order</button>
          <button onClick={() => setTab('track')} className={`flex-1 rounded-lg px-4 py-2 text-xs font-bold transition ${tab === 'track' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Track My Orders</button>
        </div>

        {error && <div className="mb-3"><Notice type="error">{error}</Notice></div>}
        {notice && <div className="mb-3"><Notice type="success">{notice}</Notice></div>}
        {!linkedCustomers.length && <div className="mb-3"><Notice type="warn">No customer profile is linked to this login yet.</Notice></div>}

        {tab === 'place' ? (
          <div className="space-y-4">
            <Card title="Place orders in 3 steps" subtitle="Select customers → enter each customer's products → review and submit separate orders">
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-bold">
                {['1. Select customers', '2. Enter customer orders', '3. Review & submit'].map((label, index) => (
                  <div key={label} className={`rounded-lg px-2 py-2 ${orderStep === index + 1 ? 'bg-blue-700 text-white' : orderStep > index + 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>{label}</div>
                ))}
              </div>
            </Card>

            {confirmedOrders.length > 0 && (
              <Card
                title="Orders posted successfully"
                subtitle={`Booked by ${confirmedBooker}`}
                actions={<Button onClick={() => setTab('track')}>Track My Orders</Button>}
              >
                <div className="grid gap-2 md:grid-cols-2">
                  {confirmedOrders.map((order) => (
                    <div key={order.voucherNo} className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs">
                      <span className="font-bold text-emerald-900">{order.voucherNo}</span>
                      <span className="text-emerald-800">{order.customerName} · {registrationLabel(order.registrationStatus)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {orderStep === 1 && (
              <Card title="Step 1 — Bulk select customers" subtitle={`${linkedCustomers.length} linked customers · ${selectedCustomerIds.length} selected`}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input className="field-input pl-9" placeholder="Search customer" value={selectionSearch} onChange={(event) => setSelectionSearch(event.target.value)} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={selectAllCustomers} disabled={!linkedCustomers.length || allSelected}>Select All ({linkedCustomers.length})</Button>
                    <Button variant="secondary" onClick={clearSelection} disabled={!selectedCustomerIds.length}>Clear Selection</Button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead>
                      <tr className="table-head">
                        <th className="w-12 px-3 py-2">Select</th>
                        <th className="px-3 py-2">Customer</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Delivery / Bank</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCustomers.map((customer) => (
                        <tr key={customer.id} className="table-row border-t border-slate-200">
                          <td className="px-3 py-2">
                            <input type="checkbox" checked={selectedSet.has(customer.id)} onChange={() => toggleCustomer(customer.id)} aria-label={`Select ${customer.business_name}`} />
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-900">{customer.business_name}</td>
                          <td className="px-3 py-2">{statusBadge(customer.registration_status)}</td>
                          <td className="px-3 py-2 text-[11px] text-slate-500">{customer.delivery_destination || '—'}{customer.bank_account_no ? ` · Bank ${customer.bank_account_no}${customer.bank_branch_name ? ` / ${customer.bank_branch_name}` : ''}` : ''}</td>
                        </tr>
                      ))}
                      {!visibleCustomers.length && (
                        <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">No customers found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-500">Registered customers are placed first in the order queue.</p>
                  <Button onClick={proceedWithSelection} disabled={!selectedCustomerIds.length}>Proceed with Selected Customers ({selectedCustomerIds.length}) ➔</Button>
                </div>
              </Card>
            )}

            {(orderStep === 2 || orderStep === 3) && queueCustomers.length > 0 && (
              <Card title="Auto-grouped order queue" subtitle="Registered group first, then Unregistered group">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                  {queueCustomers.map((customer, index) => (
                    <React.Fragment key={customer.id}>
                      <span className={`rounded-full px-3 py-1 ${index === queueIndex && orderStep === 2 ? 'bg-blue-700 text-white' : customer.registration_status === 'Register' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
                        {registrationGroupLabel(customer.registration_status)} ({index + 1} of {queueCustomers.length})
                      </span>
                      {index < queueCustomers.length - 1 && <span className="text-slate-400">➔</span>}
                    </React.Fragment>
                  ))}
                </div>
              </Card>
            )}

            {orderStep === 2 && activeCustomer && (
              <>
                <Card
                  title={`Customer ${queueIndex + 1} of ${queue.length}: ${activeCustomer.business_name} — [${activeCustomer.registration_status}]`}
                  subtitle={`Showing ${registrationLabel(activeCustomer.registration_status)} products only · stock reserved across the batch`}
                  actions={statusBadge(activeCustomer.registration_status)}
                >
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input className="field-input pl-9" placeholder="Search products" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleProducts.map((product) => {
                      const qty = cartQty(activeCart, product.id)
                      const available = remainingFor(product)
                      const outOfStock = available <= 0
                      return (
                        <div key={product.id} className={`rounded-xl border bg-white p-4 shadow-sm ${qty > available ? 'border-red-300' : 'border-slate-200'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold text-slate-900">{product.product_name}</p>
                              <p className="mt-1 text-[11px] text-slate-500">Size {product.size_category} · Packing {product.diapers_per_bag}*{product.bags_per_carton}</p>
                              <p className="mt-1 text-[11px] text-slate-500">Total Pcs {quantity(qty * Number(product.pcs_per_carton || 0))}</p>
                              <p className={`mt-1 text-[11px] font-semibold ${outOfStock ? 'text-red-600' : 'text-emerald-700'}`}>FG Stock: {quantity(available)} Ctns</p>
                              {qty > available && <p className="mt-1 text-[10px] font-bold text-red-600">Reduce quantity to available FG stock</p>}
                              {!hideRates && <p className="mt-1 text-xs font-semibold text-blue-700">Rate {money(activeCustomer.registration_status === 'Unregister' ? product.per_diaper_rate : product.per_carton_rate, 3)}</p>}
                            </div>
                            <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{product.product_type}</span>
                          </div>
                          <div className="mt-3 flex items-center justify-end gap-2">
                            <button onClick={() => changeActiveQty(product.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-700 disabled:opacity-40" disabled={qty === 0} aria-label="Decrease cartons"><Minus className="h-4 w-4" /></button>
                            <input
                              className="field-input w-16 text-center"
                              type="number"
                              min="0"
                              max={available}
                              step="1"
                              value={qty}
                              disabled={outOfStock && qty === 0}
                              onChange={(event) => updateCartons(product.id, event.target.value)}
                              aria-label={`Cartons for ${product.product_name}`}
                            />
                            <button onClick={() => changeActiveQty(product.id, 1)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-white disabled:cursor-not-allowed disabled:opacity-40" disabled={outOfStock || qty >= available} aria-label="Increase cartons"><Plus className="h-4 w-4" /></button>
                          </div>
                        </div>
                      )
                    })}
                    {!visibleProducts.length && <p className="col-span-full py-10 text-center text-xs text-slate-500">No products available for this registration type.</p>}
                  </div>
                </Card>
                <div className="hidden items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex">
                  <div className="text-xs"><strong>{quantity(activeOrder?.totalCartons || 0)}</strong> cartons · <strong>{quantity(activeOrder?.totalPcs || 0)}</strong> pcs</div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setOrderStep(1)}>Back to customers</Button>
                    {queueIndex > 0 && <Button variant="secondary" onClick={goToPreviousCustomer}>Previous customer</Button>}
                    <Button onClick={saveAndNext} disabled={!activeOrder?.details.length}>Save &amp; Next Customer ➔</Button>
                  </div>
                </div>
                <button onClick={() => setDrawer(true)} className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-blue-700 px-5 py-3 text-xs font-bold text-white shadow-xl lg:hidden">
                  <ShoppingCart className="h-4 w-4" /> Customer cart ({quantity(activeOrder?.totalCartons || 0)})
                </button>
              </>
            )}

            {orderStep === 3 && (
              <Card title="Step 3 — Final review" subtitle={`${reviewOrders.length} separate SALES_ORDER records will be created`}>
                <div className="grid gap-3 md:grid-cols-2">
                  {reviewOrders.map(({ customer, order }, index) => (
                    <div key={customer.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{customer.business_name}</p>
                          <div className="mt-1">{statusBadge(customer.registration_status)}</div>
                        </div>
                        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-500">#{index + 1}</span>
                      </div>
                      <div className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white px-3 text-[11px]">
                        {order.details.map((line) => (
                          <div key={line.product.id} className="flex justify-between gap-2 py-2">
                            <span>{line.product.product_name}</span>
                            <span className="font-semibold">{quantity(line.cartons)} Ctns · {quantity(line.pcs)} Pcs</span>
                          </div>
                        ))}
                        {!order.details.length && <p className="py-4 text-center text-slate-500">No items added.</p>}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                        <span>Total cartons: {quantity(order.totalCartons)}</span>
                        {!hideRates && <span className="text-blue-700">Net total: {money(order.totals.netTotal)}</span>}
                      </div>
                      <div className="mt-3 flex justify-end"><Button variant="secondary" onClick={() => editCustomer(index)}>Edit customer order</Button></div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button variant="secondary" onClick={() => editCustomer(Math.max(0, queue.length - 1))}>Back to customer entry</Button>
                  <Button onClick={() => void submitAllOrders()} disabled={busy}>{busy ? 'Submitting…' : `Submit All ${reviewOrders.length} Customer Orders`}</Button>
                </div>
              </Card>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-slate-900">Track My Orders</h1>
                <p className="text-[11px] text-slate-500"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" /> Live updates every 15 seconds</p>
              </div>
              <Button variant="secondary" onClick={() => void ledger.reload()}><ChevronRight className="h-3.5 w-3.5" /> Refresh</Button>
            </div>
            {myOrders.map((order) => {
              const links = pipelineLinks(ledger.rows, order)
              const progress = soProgress(ledger.rows, order)
              const { stage, status } = orderStage(ledger.rows, order)
              return (
                <Card key={order.id} title={order.voucher_no} subtitle={`${order.voucher_date} · ${order.customer_name} · Booker ${order.booked_by_name || '—'} · ${quantity(order.total_cartons)} cartons`} actions={<span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-700">{status}</span>}>
                  <div className="mb-5 grid grid-cols-4 gap-1">
                    {stageLabels.map((label, index) => {
                      const step = index + 1
                      const Icon = stageIcons[index]
                      return (
                        <div key={label} className="text-center">
                          <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${step <= stage ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-500'}`}><Icon className="h-4 w-4" /></div>
                          <p className={`mt-1 text-[9px] font-semibold leading-tight ${step <= stage ? 'text-blue-700' : 'text-slate-400'}`}>{label}</p>
                        </div>
                      )
                    })}
                  </div>
                  <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-xs">
                    <p><strong>Ordered:</strong> {quantity(progress.ordered)} cartons · <strong>Dispatched:</strong> {quantity(progress.delivered)} · <strong>Remaining:</strong> {quantity(progress.pending)}</p>
                    <p><strong>Items:</strong> {order.line_items.map((item) => `${item.product_name} (${quantity(item.ordered_ctns)})`).join(', ')}</p>
                    {links.gdn && <p><strong>Gate Pass:</strong> {links.gdn.voucher_no} · {links.gdn.voucher_date} · Vehicle {links.gdn.vehicle_1 || '—'} · Driver {links.gdn.driver_1 || '—'}</p>}
                    {links.invoice && <p><strong>Invoice:</strong> {links.invoice.voucher_no}</p>}
                    {links.receipt && <p><strong>Payment:</strong> {links.receipt.voucher_no}{!hideRates && ` · ${money(links.receipt.bank_receipt_amount)}`}</p>}
                  </div>
                  {stage === 2 && (
                    <div className="mt-3">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full bg-blue-600" style={{ width: `${progress.ordered ? (progress.delivered / progress.ordered) * 100 : 0}%` }} />
                      </div>
                    </div>
                  )}
                  {stage === 4 && links.invoice && !hideRates && (
                    <div className="mt-3 flex justify-end"><Button variant="secondary" onClick={() => printInvoice(links.invoice!)}><Printer className="h-3.5 w-3.5" /> Print invoice</Button></div>
                  )}
                </Card>
              )
            })}
            {!myOrders.length && <Card><p className="py-8 text-center text-xs text-slate-500">No orders placed yet.</p></Card>}
          </div>
        )}
      </main>

      {pwOpen && (
        <Modal title="Change My Password" onClose={() => setPwOpen(false)}>
          <div className="space-y-3">
            {pwError && <Notice type="error">{pwError}</Notice>}
            {pwNotice && <Notice type="success">{pwNotice}</Notice>}
            <Field label="Current password"><input className="field-input" type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} /></Field>
            <Field label="New password"><input className="field-input" type="password" value={pwNext} onChange={(e) => setPwNext(e.target.value)} /></Field>
            <Field label="Confirm new password"><input className="field-input" type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} /></Field>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setPwOpen(false)}>Close</Button><Button onClick={async () => {
              setPwError(''); setPwNotice('')
              if (pwNext !== pwConfirm) { setPwError('New password confirmation does not match'); return }
              try { await callRpc('change_own_password', { p_current_password: pwCurrent, p_new_password: pwNext }); setPwNotice('Password updated'); setPwCurrent(''); setPwNext(''); setPwConfirm('') } catch (caught) { setPwError(errorMessage(caught)) }
            }}>Update Password</Button></div>
          </div>
        </Modal>
      )}

      {drawer && activeCustomer && activeOrder && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50" onClick={() => setDrawer(false)}>
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-bold">Order cart · {activeCustomer.business_name}</h2>
              <Button variant="ghost" onClick={() => setDrawer(false)}>✕</Button>
            </div>
            <div className="flex-1 space-y-3 overflow-auto p-4">
              {activeOrder.details.map((line) => {
                const available = remainingFor(line.product)
                return (
                  <div key={line.product.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold">{line.product.product_name}</p>
                      <p className="text-[11px] text-slate-500">{line.cartons} cartons · {quantity(line.pcs)} pcs · FG Stock {quantity(available)} Ctns</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => changeActiveQty(line.product.id, -1)} className="flex h-7 w-7 items-center justify-center rounded border border-slate-300" aria-label="Decrease cartons"><Minus className="h-3 w-3" /></button>
                      <button onClick={() => changeActiveQty(line.product.id, 1)} className="flex h-7 w-7 items-center justify-center rounded bg-blue-700 text-white disabled:opacity-40" disabled={line.cartons >= available} aria-label="Increase cartons"><Plus className="h-3 w-3" /></button>
                    </div>
                  </div>
                )
              })}
              {!activeOrder.details.length && <p className="py-10 text-center text-xs text-slate-500">Your cart is empty.</p>}
            </div>
            <div className="space-y-3 border-t border-slate-200 p-4">
              <div className="flex justify-between text-sm font-bold"><span>Total cartons</span><span>{quantity(activeOrder.totalCartons)}</span></div>
              <div className="flex justify-between text-sm font-bold"><span>Total pcs</span><span>{quantity(activeOrder.totalPcs)}</span></div>
              {!hideRates && activeOrder.details.length > 0 && <div className="flex justify-between text-sm font-bold text-blue-700"><span>Net total</span><span>{money(activeOrder.totals.netTotal)}</span></div>}
              <Button className="w-full" onClick={saveAndNext} disabled={!activeOrder.details.length}>Save &amp; Next Customer ➔</Button>
            </div>
          </div>
        </div>
      )}

      <DeveloperFooter />
    </div>
  )
}
