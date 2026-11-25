import { useMemo, useState } from 'react'
import { Button, Card, Field, Input, Modal, PageHeader, Table, Badge } from '../components/ui'
import { PrintDocument } from '../components/PrintDocument'
import { VoucherActions } from '../components/VoucherActions'
import { useApp } from '../components/AppContext'
import { useRows } from '../lib/useRows'
import { createGdn, listRows } from '../lib/api'
import { exportRows } from '../lib/excel'
import { dateLabel, money, num, statusTone, today } from '../lib/format'
import type { Row } from '../lib/types'

export const OrdersPage = () => {
  const { session, permissions, notify, refresh } = useApp()
  const orders = useRows('sale_orders', { order: 'created_at', ascending: false })
  const gdnItems = useRows('gdn_items', {})
  const productMapRows = useRows('products', {})
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Row | null>(null)
  const [lines, setLines] = useState<Row[]>([])
  const [header, setHeader] = useState<Row>({ gdn_date: today(), vehicle_no: '', driver_name: '', driver_cnic: '' })
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [printDoc, setPrintDoc] = useState<Row | null>(null)
  const [printItems, setPrintItems] = useState<Row[]>([])

  const products = useMemo(() => new Map(productMapRows.rows.map((product) => [product.id, product])), [productMapRows.rows])
  const dispatched = useMemo(() => {
    const map = new Map<string, number>()
    gdnItems.rows.forEach((item) => map.set(item.product_id, Number(map.get(item.product_id) || 0) + Number(item.qty_cartons || 0)))
    return map
  }, [gdnItems.rows])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return orders.rows.filter((row) =>
      [row.order_number, row.customer_name, row.customer_type, row.status]
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [orders.rows, search])

  const openGdn = async (order: Row) => {
    try {
      const items = await listRows<Row>('sale_order_items', { filters: { sale_order_id: order.id }, order: 'created_at' })
      setSelected(order)
      setLines(
        items.map((item) => ({
          ...item,
          remaining: Math.max(Number(item.qty_cartons || 0) - Number(dispatched.get(item.product_id) || 0), 0),
          dispatch_qty: Math.max(Number(item.qty_cartons || 0) - Number(dispatched.get(item.product_id) || 0), 0),
        })),
      )
      setHeader({ gdn_date: today(), vehicle_no: '', driver_name: '', driver_cnic: '' })
      setOpen(true)
    } catch (cause: any) {
      notify(cause?.message || 'Unable to load order items', 'error')
    }
  }

  const saveGdn = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const payload = lines
        .filter((line) => Number(line.dispatch_qty) > 0)
        .map((line) => ({ product_id: line.product_id, qty_cartons: Number(line.dispatch_qty) }))
      if (!payload.length) throw new Error('Enter at least one dispatch quantity')
      const gdn = await createGdn(selected.id, header, payload)
      notify(`GDN ${gdn.gdn_number} posted`)
      setOpen(false)
      refresh()
      await orders.reload()
      await gdnItems.reload()
    } catch (cause: any) {
      notify(cause?.message || 'Unable to post GDN', 'error')
    } finally {
      setSaving(false)
    }
  }

  const openPrint = async (row: Row) => {
    try {
      const items = await listRows<Row>('sale_order_items', { filters: { sale_order_id: row.id }, order: 'created_at' })
      setPrintDoc(row)
      setPrintItems(items)
    } catch (cause: any) {
      notify(cause?.message || 'Unable to load sale order', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Sale Orders"
        subtitle="Approved orders, dispatch status and delivery note preparation."
        actions={
          <>
            <Input placeholder="Search orders…" value={search} onChange={(event) => setSearch(event.target.value)} className="w-64" />
            <Button variant="secondary" onClick={() => exportRows(filtered, `${session.company.company_code}_SaleOrders`, 'Sale Orders')}>
              Export
            </Button>
          </>
        }
      />
      <Card>
        <Table
          rowKey={(row) => row.id}
          rows={filtered}
          columns={[
            { key: 'order_number', label: 'Order', render: (row) => <span className="font-semibold text-cyan-300">{row.order_number}</span> },
            { key: 'customer_name', label: 'Customer' },
            { key: 'order_date', label: 'Date', render: (row) => dateLabel(row.order_date) },
            { key: 'net_total', label: 'Net Total', render: (row) => money(row.net_total, permissions.viewValues) },
            { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <VoucherActions
                  table="sale_orders"
                  row={row}
                  label="Sale Order"
                  editFields={[
                    { key: 'order_date', label: 'Order Date', type: 'date' },
                    { key: 'delivery_destination_address', label: 'Delivery Address', type: 'textarea' },
                  ]}
                  onPrint={() => void openPrint(row)}
                  extra={!['paid', 'cancelled'].includes(row.status) ? (
                    <Button size="sm" onClick={() => void openGdn(row)} disabled={!permissions.postGdn}>Prepare GDN</Button>
                  ) : undefined}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal open={open} title={`Prepare GDN — ${selected?.order_number || ''}`} onClose={() => setOpen(false)} width="max-w-5xl">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="GDN Date"><Input type="date" value={header.gdn_date} onChange={(event) => setHeader({ ...header, gdn_date: event.target.value })} /></Field>
          <Field label="Vehicle No"><Input value={header.vehicle_no} onChange={(event) => setHeader({ ...header, vehicle_no: event.target.value })} /></Field>
          <Field label="Driver Name"><Input value={header.driver_name} onChange={(event) => setHeader({ ...header, driver_name: event.target.value })} /></Field>
          <Field label="Driver CNIC"><Input value={header.driver_cnic} onChange={(event) => setHeader({ ...header, driver_cnic: event.target.value })} /></Field>
        </div>
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Ordered</th>
                <th className="px-3 py-2">Already Dispatched</th>
                <th className="px-3 py-2">Remaining</th>
                <th className="px-3 py-2">Dispatch Cartons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {lines.map((line, index) => (
                <tr key={line.id}>
                  <td className="px-3 py-2">
                    {products.get(line.product_id)?.full_kind_name || line.full_kind_name || line.product_id}
                  </td>
                  <td className="px-3 py-2">{num(line.qty_cartons)}</td>
                  <td className="px-3 py-2">{num(Number(line.qty_cartons || 0) - Number(line.remaining || 0))}</td>
                  <td className="px-3 py-2">{num(line.remaining)}</td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0"
                      max={line.remaining}
                      value={line.dispatch_qty}
                      onChange={(event) =>
                        setLines((previous) => previous.map((item, itemIndex) => (itemIndex === index ? { ...item, dispatch_qty: event.target.value } : item)))
                      }
                      className="w-28"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void saveGdn()} disabled={saving}>{saving ? 'Posting…' : 'Post GDN'}</Button>
        </div>
      </Modal>

      {printDoc && (
        <PrintDocument title="Sale Order" doc={printDoc} items={printItems} onClose={() => setPrintDoc(null)} />
      )}
    </div>
  )
}
