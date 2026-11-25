import { useMemo, useState } from 'react'
import { Button, Card, Field, Input, Modal, PageHeader, Select, Table, Textarea, Badge } from '../components/ui'
import { PrintDocument } from '../components/PrintDocument'
import { VoucherActions } from '../components/VoucherActions'
import { useApp } from '../components/AppContext'
import { useRows } from '../lib/useRows'
import { createQuotation, createSaleOrder, listRows } from '../lib/api'
import { exportRows } from '../lib/excel'
import { dateLabel, money, num, statusTone, today } from '../lib/format'
import type { Row } from '../lib/types'

const emptyLine = (): Row => ({
  product_id: '',
  qty_cartons: 1,
  cnts_size: 0,
  bags_size: 0,
  rate_per_carton: 0,
  rate_per_diaper: 0,
})

export const QuotationsPage = () => {
  const { session, permissions, notify, refresh } = useApp()
  const quotations = useRows('quotations', { order: 'created_at', ascending: false })
  const customers = useRows('customers', { order: 'business_name' })
  const products = useRows('products', { order: 'full_kind_name' })
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [header, setHeader] = useState<Row>({
    customer_id: '',
    customer_name: '',
    customer_type: 'unregistered',
    reg_no: 'Unregistered',
    filer_status: 'Non-Filer',
    cnic_ntn: '',
    strn: '',
    delivery_destination_address: '',
    quotation_date: today(),
    valid_until: '',
    remark: '',
  })
  const [lines, setLines] = useState<Row[]>([emptyLine()])
  const [printDoc, setPrintDoc] = useState<Row | null>(null)
  const [printItems, setPrintItems] = useState<Row[]>([])

  const customerMap = useMemo(() => new Map(customers.rows.map((customer) => [customer.id, customer])), [customers.rows])
  const productMap = useMemo(() => new Map(products.rows.map((product) => [product.id, product])), [products.rows])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return quotations.rows.filter((row) =>
      [row.quotation_number, row.customer_name, row.customer_type, row.status]
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [quotations.rows, search])

  const availableProducts = products.rows.filter(
    (product) => product.customer_type === header.customer_type && product.is_active !== false,
  )

  const secRate = String(header.filer_status).toLowerCase() === 'filer'
    ? Number(session.settings.sec236g_filer_rate || 0.001)
    : Number(session.settings.sec236g_non_filer_rate || 0.02)

  const totals = useMemo(() => {
    return lines.reduce(
      (sum, line) => {
        const value = Number(line.qty_cartons || 0) * Number(line.rate_per_carton || 0)
        const tax = value * Number(session.settings.sales_tax_rate || 18) / 100
        const further = header.customer_type === 'unregistered' ? value * Number(session.settings.further_tax_rate || 0) / 100 : 0
        const before = value + tax + further
        const sec = before * secRate
        sum.subtotal += value
        sum.salesTax += tax
        sum.furtherTax += further
        sum.sec236g += sec
        sum.net += before + sec
        return sum
      },
      { subtotal: 0, salesTax: 0, furtherTax: 0, sec236g: 0, net: 0 },
    )
  }, [lines, header.customer_type, secRate, session.settings])

  const setHeaderField = (key: string, value: any) => setHeader((previous) => ({ ...previous, [key]: value }))

  const chooseCustomer = (id: string) => {
    const customer = customerMap.get(id)
    if (!customer) {
      setHeaderField('customer_id', '')
      return
    }
    setHeader((previous) => ({
      ...previous,
      customer_id: customer.id,
      customer_name: customer.business_name || customer.customer_name,
      customer_type: customer.customer_type || customer.reg_no,
      reg_no: customer.reg_no,
      filer_status: customer.filer_status,
      cnic_ntn: customer.cnic_ntn,
      strn: customer.strn,
      delivery_destination_address: customer.delivery_destination_address,
    }))
    setLines([emptyLine()])
  }

  const chooseProduct = (index: number, id: string) => {
    const product = productMap.get(id)
    setLines((previous) =>
      previous.map((line, lineIndex) =>
        lineIndex === index && product
          ? {
              ...line,
              product_id: product.id,
              cnts_size: product.cnts_size,
              bags_size: product.bags_size,
              rate_per_carton: product.rate_per_carton,
              rate_per_diaper: product.rate_per_diaper,
            }
          : line,
      ),
    )
  }

  const setLineField = (index: number, key: string, value: any) =>
    setLines((previous) => previous.map((line, lineIndex) => (lineIndex === index ? { ...line, [key]: value } : line)))

  const openNew = () => {
    setHeader({
      customer_id: '',
      customer_name: '',
      customer_type: 'unregistered',
      reg_no: 'Unregistered',
      filer_status: 'Non-Filer',
      cnic_ntn: '',
      strn: '',
      delivery_destination_address: '',
      quotation_date: today(),
      valid_until: '',
      remark: '',
    })
    setLines([emptyLine()])
    setError('')
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const created = await createQuotation(
        {
          ...header,
          valid_until: header.valid_until || new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
        },
        lines.filter((line) => line.product_id && Number(line.qty_cartons) > 0),
      )
      notify(`Quotation ${created.quotation_number} created`)
      setOpen(false)
      refresh()
      await quotations.reload()
    } catch (cause: any) {
      setError(cause?.message || 'Unable to create quotation')
    } finally {
      setSaving(false)
    }
  }

  const convert = async (row: Row) => {
    try {
      const order = await createSaleOrder(row.id)
      notify(`Sale order ${order.order_number} created`)
      refresh()
      await quotations.reload()
    } catch (cause: any) {
      notify(cause?.message || 'Unable to convert quotation', 'error')
    }
  }

  const openPrint = async (row: Row) => {
    try {
      const items = await listRows<Row>('quotation_items', { filters: { quotation_id: row.id }, order: 'created_at' })
      setPrintDoc(row)
      setPrintItems(items)
    } catch (cause: any) {
      notify(cause?.message || 'Unable to load quotation items', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Quotations"
        subtitle="Create customer quotations with tax, further tax and section 236G calculations."
        actions={
          <>
            <Input placeholder="Search quotations…" value={search} onChange={(event) => setSearch(event.target.value)} className="w-64" />
            <Button variant="secondary" onClick={() => exportRows(filtered, `${session.company.company_code}_Quotations`, 'Quotations')}>
              Export
            </Button>
            <Button onClick={openNew}>New Quotation</Button>
          </>
        }
      />
      <Card>
        <Table
          rowKey={(row) => row.id}
          rows={filtered}
          columns={[
            { key: 'quotation_number', label: 'Quotation', render: (row) => <span className="font-semibold text-cyan-300">{row.quotation_number}</span> },
            { key: 'customer_name', label: 'Customer' },
            { key: 'customer_type', label: 'Type', render: (row) => <Badge tone={row.customer_type === 'registered' ? 'green' : 'slate'}>{row.customer_type}</Badge> },
            { key: 'quotation_date', label: 'Date', render: (row) => dateLabel(row.quotation_date) },
            { key: 'net_total', label: 'Net Total', render: (row) => money(row.net_total, permissions.viewValues) },
            { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <VoucherActions
                  table="quotations"
                  row={row}
                  label="Quotation"
                  editFields={[
                    { key: 'customer_name', label: 'Customer' },
                    { key: 'customer_type', label: 'Customer Type' },
                    { key: 'quotation_date', label: 'Quotation Date', type: 'date' },
                    { key: 'valid_until', label: 'Valid Until', type: 'date' },
                    { key: 'remark', label: 'Remark', type: 'textarea' },
                  ]}
                  onPrint={() => void openPrint(row)}
                  extra={row.status === 'pending' ? (
                    <Button size="sm" onClick={() => void convert(row)} disabled={!permissions.approveOrders}>
                      Convert
                    </Button>
                  ) : undefined}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal open={open} title="New Quotation" onClose={() => setOpen(false)} width="max-w-6xl">
        <div className="grid gap-4 lg:grid-cols-3">
          <Field label="Customer" className="lg:col-span-2">
            <Select value={header.customer_id} onChange={(event) => chooseCustomer(event.target.value)}>
              <option value="">Walk-in / Manual Entry</option>
              {customers.rows.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customer_code} — {customer.business_name || customer.customer_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Customer Type">
            <Select value={header.customer_type} onChange={(event) => setHeaderField('customer_type', event.target.value)}>
              <option value="registered">Registered</option>
              <option value="unregistered">Unregistered</option>
            </Select>
          </Field>
          <Field label="Customer Name"><Input value={header.customer_name} onChange={(event) => setHeaderField('customer_name', event.target.value)} /></Field>
          <Field label="Reg No"><Input value={header.reg_no} onChange={(event) => setHeaderField('reg_no', event.target.value)} /></Field>
          <Field label="Filer Status">
            <Select value={header.filer_status} onChange={(event) => setHeaderField('filer_status', event.target.value)}>
              <option value="filer">Filer</option>
              <option value="Non-Filer">Non-Filer</option>
            </Select>
          </Field>
          <Field label="CNIC / NTN"><Input value={header.cnic_ntn} onChange={(event) => setHeaderField('cnic_ntn', event.target.value)} /></Field>
          <Field label="STRN"><Input value={header.strn} onChange={(event) => setHeaderField('strn', event.target.value)} /></Field>
          <Field label="Quotation Date"><Input type="date" value={header.quotation_date} onChange={(event) => setHeaderField('quotation_date', event.target.value)} /></Field>
          <Field label="Valid Until"><Input type="date" value={header.valid_until} onChange={(event) => setHeaderField('valid_until', event.target.value)} /></Field>
          <Field label="Delivery Address" className="lg:col-span-2"><Textarea value={header.delivery_destination_address} onChange={(event) => setHeaderField('delivery_destination_address', event.target.value)} /></Field>
          <Field label="Remark"><Textarea value={header.remark} onChange={(event) => setHeaderField('remark', event.target.value)} /></Field>
        </div>

        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Cartons</th>
                <th className="px-3 py-2">Packing</th>
                <th className="px-3 py-2">Rate / Carton</th>
                <th className="px-3 py-2">Line Net</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {lines.map((line, index) => {
                const value = Number(line.qty_cartons || 0) * Number(line.rate_per_carton || 0)
                const tax = value * Number(session.settings.sales_tax_rate || 18) / 100
                const further = header.customer_type === 'unregistered' ? value * Number(session.settings.further_tax_rate || 0) / 100 : 0
                const net = (value + tax + further) * (1 + secRate)
                return (
                  <tr key={index}>
                    <td className="px-3 py-2">
                      <Select value={line.product_id} onChange={(event) => chooseProduct(index, event.target.value)} className="min-w-64">
                        <option value="">Select product</option>
                        {availableProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.sku} — {product.full_kind_name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-2"><Input type="number" min="0" value={line.qty_cartons} onChange={(event) => setLineField(index, 'qty_cartons', event.target.value)} className="w-24" /></td>
                    <td className="px-3 py-2 whitespace-nowrap">{num(line.cnts_size)} × {num(line.bags_size)}</td>
                    <td className="px-3 py-2"><Input type="number" step="0.0001" value={line.rate_per_carton} onChange={(event) => setLineField(index, 'rate_per_carton', event.target.value)} className="w-32" /></td>
                    <td className="px-3 py-2">{money(net, permissions.viewRates)}</td>
                    <td className="px-3 py-2">
                      <Button size="sm" variant="danger" onClick={() => setLines((previous) => previous.filter((_, lineIndex) => lineIndex !== index))}>
                        ×
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <Button size="sm" variant="secondary" onClick={() => setLines((previous) => [...previous, emptyLine()])}>
            Add Item
          </Button>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-5">
            <div>Subtotal: {money(totals.subtotal, permissions.viewValues)}</div>
            <div>Tax: {money(totals.salesTax, permissions.viewValues)}</div>
            <div>Further: {money(totals.furtherTax, permissions.viewValues)}</div>
            <div>236G: {money(totals.sec236g, permissions.viewValues)}</div>
            <div className="font-bold text-cyan-300">Net: {money(totals.net, permissions.viewValues)}</div>
          </div>
        </div>

        {error && <div className="mt-4 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving || !lines.some((line) => line.product_id)}>
            {saving ? 'Saving…' : 'Create Quotation'}
          </Button>
        </div>
      </Modal>

      {printDoc && (
        <PrintDocument title="Commercial Quotation" doc={printDoc} items={printItems} onClose={() => setPrintDoc(null)} />
      )}
    </div>
  )
}
