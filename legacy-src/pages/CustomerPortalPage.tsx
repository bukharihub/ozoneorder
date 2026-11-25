import { useMemo, useState } from 'react'
import { Button, Card, Field, Input, Modal, PageHeader, Select, Table, Badge } from '../components/ui'
import { useApp } from '../components/AppContext'
import { useRows } from '../lib/useRows'
import { createQuotation, listRows } from '../lib/api'
import { exportRows } from '../lib/excel'
import { dateLabel, money, num, statusTone, today } from '../lib/format'
import type { Row } from '../lib/types'

export const CustomerPortalPage = () => {
  const { session, permissions, notify, refresh } = useApp()
  const customerId = session.user.customer_id
  const customerRows = useRows('customers', { filters: customerId ? { id: customerId } : { id: '00000000-0000-0000-0000-000000000000' } })
  const quotations = useRows('quotations', { filters: customerId ? { customer_id: customerId } : {}, order: 'created_at', ascending: false })
  const orders = useRows('sale_orders', { filters: customerId ? { customer_id: customerId } : {}, order: 'created_at', ascending: false })
  const invoices = useRows('invoices', { filters: customerId ? { customer_id: customerId } : {}, order: 'created_at', ascending: false })
  const ledger = useRows('customer_ledger', { filters: customerId ? { customer_id: customerId } : {}, order: 'entry_date', ascending: false })
  const tracking = useRows('v_tracking', { filters: customerId ? { customer_id: customerId } : {}, order: 'stage_order' })
  const stock = useRows('v_fg_stock_balance', {})
  const products = useRows('products', {})

  const [tab, setTab] = useState<'overview' | 'quotations' | 'orders' | 'invoices' | 'ledger' | 'stock' | 'tracking'>('overview')
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [header, setHeader] = useState<Row>({ delivery_destination_address: '', remark: '' })
  const [lines, setLines] = useState<Row[]>([{ product_id: '', qty_cartons: 1, rate_per_carton: 0, cnts_size: 0, bags_size: 0 }])

  const customer = customerRows.rows[0]
  const customerType = customer?.customer_type || (session.user.role === 'registered_user' ? 'registered' : 'unregistered')
  const productMap = useMemo(() => new Map(products.rows.map((product) => [product.id, product])), [products.rows])
  const availableProducts = products.rows.filter((product) => product.customer_type === customerType && product.is_active !== false)
  const visibleStock = permissions.viewStock ? stock.rows.filter((row) => row.customer_type === customerType) : []

  const netTotal = lines.reduce(
    (sum, line) => sum + Number(line.qty_cartons || 0) * Number(line.rate_per_carton || 0) * 1.18 * 1.02,
    0,
  )

  const chooseProduct = (index: number, id: string) => {
    const product = productMap.get(id)
    setLines((previous) =>
      previous.map((line, lineIndex) =>
        lineIndex === index && product
          ? { ...line, product_id: product.id, cnts_size: product.cnts_size, bags_size: product.bags_size, rate_per_carton: product.rate_per_carton }
          : line,
      ),
    )
  }

  const submitQuote = async () => {
    setSaving(true)
    setError('')
    try {
      await createQuotation(
        {
          customer_id: customerId,
          customer_name: customer?.business_name || customer?.customer_name || session.user.full_name,
          customer_type: customerType,
          reg_no: customer?.reg_no || (customerType === 'registered' ? 'Registered' : 'Unregistered'),
          filer_status: customer?.filer_status || 'Non-Filer',
          cnic_ntn: customer?.cnic_ntn || '',
          strn: customer?.strn || '',
          delivery_destination_address: header.delivery_destination_address || customer?.delivery_destination_address || '',
          remark: header.remark || '',
          quotation_date: today(),
        },
        lines.filter((line) => line.product_id && Number(line.qty_cartons) > 0),
      )
      notify('Quotation submitted')
      setQuoteOpen(false)
      refresh()
      await quotations.reload()
    } catch (cause: any) {
      setError(cause?.message || 'Unable to submit quotation')
    } finally {
      setSaving(false)
    }
  }

  if (!customerId) {
    return (
      <Card className="p-10 text-center">
        <h2 className="text-xl font-bold text-white">No customer profile linked</h2>
        <p className="mt-2 text-sm text-slate-400">Ask the administrator to link this login to a customer account.</p>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900/70 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-black tracking-wider text-cyan-400">OZONE CUSTOMER PORTAL</div>
            <div className="text-xs text-slate-400">
              {session.company.company_name} · {customer?.business_name || session.user.full_name}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setQuoteOpen(true)}>Request Quotation</Button>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6">
        <PageHeader title="Customer Dashboard" subtitle="Your quotations, orders, invoices, stock and ledger." />
        <div className="mb-5 flex flex-wrap gap-2">
          {(['overview', 'quotations', 'orders', 'invoices', 'ledger', 'stock', 'tracking'] as const).map((item) => (
            <Button key={item} variant={tab === item ? 'primary' : 'secondary'} size="sm" onClick={() => setTab(item)}>
              {item}
            </Button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="p-4"><div className="text-xs text-slate-500">Quotations</div><div className="mt-2 text-2xl font-bold text-white">{quotations.rows.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-slate-500">Orders</div><div className="mt-2 text-2xl font-bold text-white">{orders.rows.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-slate-500">Invoices</div><div className="mt-2 text-2xl font-bold text-white">{invoices.rows.length}</div></Card>
            <Card className="p-4"><div className="text-xs text-slate-500">Outstanding</div><div className="mt-2 text-2xl font-bold text-amber-300">{money(invoices.rows.reduce((sum, row) => sum + Number(row.balance_amount || 0), 0), permissions.viewValues)}</div></Card>
            <Card className="p-4 sm:col-span-2 xl:col-span-4">
              <div className="mb-3 text-sm font-bold text-white">Latest Tracking</div>
              <Table
                rowKey={(row) => `${row.stage_order}-${row.reference_no}`}
                rows={tracking.rows.slice(0, 10)}
                columns={[
                  { key: 'stage_order', label: 'Step' },
                  { key: 'stage', label: 'Stage', render: (row) => <Badge tone="indigo">{row.stage}</Badge> },
                  { key: 'reference_no', label: 'Reference' },
                  { key: 'event_date', label: 'Date', render: (row) => dateLabel(row.event_date) },
                  { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
                ]}
              />
            </Card>
          </div>
        )}

        {tab === 'quotations' && (
          <Card>
            <Table
              rowKey={(row) => row.id}
              rows={quotations.rows}
              columns={[
                { key: 'quotation_number', label: 'Quotation' },
                { key: 'quotation_date', label: 'Date', render: (row) => dateLabel(row.quotation_date) },
                { key: 'net_total', label: 'Total', render: (row) => money(row.net_total, permissions.viewValues) },
                { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
              ]}
            />
          </Card>
        )}

        {tab === 'orders' && (
          <Card>
            <Table
              rowKey={(row) => row.id}
              rows={orders.rows}
              columns={[
                { key: 'order_number', label: 'Order' },
                { key: 'order_date', label: 'Date', render: (row) => dateLabel(row.order_date) },
                { key: 'net_total', label: 'Total', render: (row) => money(row.net_total, permissions.viewValues) },
                { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
              ]}
            />
          </Card>
        )}

        {tab === 'invoices' && (
          <Card>
            <Table
              rowKey={(row) => row.id}
              rows={invoices.rows}
              columns={[
                { key: 'invoice_number', label: 'Invoice' },
                { key: 'invoice_date', label: 'Date', render: (row) => dateLabel(row.invoice_date) },
                { key: 'net_receipt_total', label: 'Net', render: (row) => money(row.net_receipt_total, permissions.viewValues) },
                { key: 'paid_amount', label: 'Paid', render: (row) => money(row.paid_amount, permissions.viewValues) },
                { key: 'balance_amount', label: 'Balance', render: (row) => money(row.balance_amount, permissions.viewValues) },
                { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
              ]}
            />
          </Card>
        )}

        {tab === 'ledger' && (
          <Card>
            <div className="flex justify-end border-b border-slate-800 p-3">
              <Button size="sm" variant="secondary" onClick={() => exportRows(ledger.rows, `${session.company.company_code}_MyLedger`, 'Ledger')}>Export</Button>
            </div>
            <Table
              rowKey={(row) => row.id}
              rows={ledger.rows}
              columns={[
                { key: 'entry_date', label: 'Date', render: (row) => dateLabel(row.entry_date) },
                { key: 'description', label: 'Description' },
                { key: 'debit', label: 'Debit', render: (row) => money(row.debit, permissions.viewValues) },
                { key: 'credit', label: 'Credit', render: (row) => money(row.credit, permissions.viewValues) },
                { key: 'balance', label: 'Balance', render: (row) => money(row.balance, permissions.viewValues) },
              ]}
            />
          </Card>
        )}

        {tab === 'stock' && (
          <Card>
            <Table
              rowKey={(row) => row.product_id}
              rows={visibleStock}
              columns={[
                { key: 'sku', label: 'SKU' },
                { key: 'full_kind_name', label: 'Product' },
                { key: 'packing', label: 'Packing', render: (row) => `${num(row.cnts_size)} × ${num(row.bags_size)}` },
                { key: 'closing_cartons', label: 'Cartons', render: (row) => num(row.closing_cartons) },
                { key: 'rate', label: 'Rate', render: (row) => money(productMap.get(row.product_id)?.rate_per_carton, permissions.viewRates) },
              ]}
            />
          </Card>
        )}

        {tab === 'tracking' && (
          <Card>
            <Table
              rowKey={(row) => `${row.stage_order}-${row.reference_no}`}
              rows={tracking.rows}
              columns={[
                { key: 'stage_order', label: 'Step' },
                { key: 'stage', label: 'Stage', render: (row) => <Badge tone="indigo">{row.stage}</Badge> },
                { key: 'reference_no', label: 'Reference' },
                { key: 'event_date', label: 'Date', render: (row) => dateLabel(row.event_date) },
                { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
              ]}
            />
          </Card>
        )}
      </main>

      <Modal open={quoteOpen} title="Request Quotation" onClose={() => setQuoteOpen(false)} width="max-w-5xl">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Delivery Address" className="sm:col-span-2">
            <Input value={header.delivery_destination_address} onChange={(event) => setHeader({ ...header, delivery_destination_address: event.target.value })} />
          </Field>
          <Field label="Remark" className="sm:col-span-2">
            <Input value={header.remark} onChange={(event) => setHeader({ ...header, remark: event.target.value })} />
          </Field>
        </div>
        <div className="mt-5 space-y-3">
          {lines.map((line, index) => (
            <div key={index} className="grid gap-3 sm:grid-cols-3">
              <Select value={line.product_id} onChange={(event) => chooseProduct(index, event.target.value)}>
                <option value="">Select product</option>
                {availableProducts.map((product) => (
                  <option key={product.id} value={product.id}>{product.sku} — {product.full_kind_name}</option>
                ))}
              </Select>
              <Input type="number" min="0" placeholder="Cartons" value={line.qty_cartons} onChange={(event) => setLines((previous) => previous.map((item, itemIndex) => (itemIndex === index ? { ...item, qty_cartons: event.target.value } : item)))} />
              <Input value={money(line.rate_per_carton, permissions.viewRates)} readOnly />
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between">
          <Button size="sm" variant="secondary" onClick={() => setLines((previous) => [...previous, { product_id: '', qty_cartons: 1, rate_per_carton: 0, cnts_size: 0, bags_size: 0 }])}>Add Item</Button>
          <div className="text-sm font-bold text-cyan-300">Estimated: {money(netTotal, permissions.viewValues)}</div>
        </div>
        {error && <div className="mt-4 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setQuoteOpen(false)}>Cancel</Button>
          <Button onClick={() => void submitQuote()} disabled={saving || !lines.some((line) => line.product_id)}>{saving ? 'Submitting…' : 'Submit'}</Button>
        </div>
      </Modal>
    </div>
  )
}
