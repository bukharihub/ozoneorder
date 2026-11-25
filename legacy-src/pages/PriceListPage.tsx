import { useMemo, useRef, useState } from 'react'
import { Button, Card, Field, Input, Modal, PageHeader, Select, Table, Badge } from '../components/ui'
import { useApp } from '../components/AppContext'
import { useRows } from '../lib/useRows'
import { deleteRow, insertRow, updateRow } from '../lib/api'
import { exportRows, readRows } from '../lib/excel'
import { dateLabel, money, today } from '../lib/format'
import type { Row } from '../lib/types'

export const PriceListPage = () => {
  const { session, permissions, notify } = useApp()
  const prices = useRows('price_lists', { order: 'effective_from', ascending: false })
  const products = useRows('products', { order: 'full_kind_name' })
  const fileRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<Row>({
    product_id: '',
    customer_type: 'registered',
    rate_per_carton: 0,
    rate_per_bag: 0,
    rate_per_diaper: 0,
    effective_from: today(),
    is_active: true,
  })

  const productMap = useMemo(() => new Map(products.rows.map((product) => [product.id, product])), [products.rows])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return prices.rows.filter((price) => {
      const product = productMap.get(price.product_id)
      return [product?.sku, product?.full_kind_name, price.customer_type, price.effective_from]
        .join(' ')
        .toLowerCase()
        .includes(term)
    })
  }, [prices.rows, productMap, search])

  const field = (key: string, value: any) => setForm((previous) => ({ ...previous, [key]: value }))

  const openNew = () => {
    setForm({
      product_id: products.rows[0]?.id || '',
      customer_type: 'registered',
      rate_per_carton: 0,
      rate_per_bag: 0,
      rate_per_diaper: 0,
      effective_from: today(),
      is_active: true,
    })
    setError('')
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = {
        company_id: session.company.company_id,
        product_id: form.product_id,
        customer_type: form.customer_type,
        rate_per_carton: Number(form.rate_per_carton),
        rate_per_bag: Number(form.rate_per_bag || 0),
        rate_per_diaper: Number(form.rate_per_diaper || 0),
        effective_from: form.effective_from,
        is_active: form.is_active !== false,
      }
      await insertRow('price_lists', payload)
      notify('Price list version created')
      setOpen(false)
      await prices.reload()
    } catch (cause: any) {
      setError(cause?.message || 'Unable to save price')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (row: Row) => {
    try {
      await updateRow('price_lists', row.id, { is_active: !row.is_active })
      await prices.reload()
    } catch (cause: any) {
      notify(cause?.message || 'Unable to update price', 'error')
    }
  }

  const remove = async (row: Row) => {
    if (!window.confirm('Delete this price list version?')) return
    try {
      await deleteRow('price_lists', row.id)
      await prices.reload()
    } catch (cause: any) {
      notify(cause?.message || 'Unable to delete price', 'error')
    }
  }

  const exportRowsForFile = filtered.map((price) => {
    const product = productMap.get(price.product_id) || {}
    return {
      sku: product.sku || '',
      full_kind_name: product.full_kind_name || '',
      customer_type: price.customer_type,
      rate_per_carton: price.rate_per_carton,
      rate_per_bag: price.rate_per_bag,
      rate_per_diaper: price.rate_per_diaper,
      effective_from: price.effective_from,
      is_active: price.is_active,
    }
  })

  const downloadTemplate = () =>
    exportRows(
      [{ sku: products.rows[0]?.sku || 'SKU', customer_type: 'registered', rate_per_carton: 5000, effective_from: today() }],
      'Ozone_PriceList_Template',
      'PriceList',
    )

  const upload = async (file: File) => {
    try {
      const imported = await readRows(file)
      const bySku = new Map<string, Row>()
      products.rows.forEach((product) => bySku.set(`${product.sku}|${product.customer_type}`, product))
      const mapped: Row[] = []
      imported.forEach((row) => {
        const product = bySku.get(`${row.sku}|${String(row.customer_type || 'registered').toLowerCase()}`)
        if (!product) return
        mapped.push({
          company_id: session.company.company_id,
          product_id: product.id,
          customer_type: product.customer_type,
          rate_per_carton: Number(row.rate_per_carton || 0),
          rate_per_bag: Number(row.rate_per_bag || 0),
          rate_per_diaper: Number(row.rate_per_diaper || 0),
          effective_from: row.effective_from || today(),
          is_active: true,
        })
      })
      if (!mapped.length) throw new Error('No rows matched existing product SKUs')
      for (const row of mapped) await insertRow('price_lists', row)
      notify(`${mapped.length} price rows imported`)
      await prices.reload()
    } catch (cause: any) {
      notify(cause?.message || 'Unable to import prices', 'error')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <PageHeader
        title="Price Lists"
        subtitle="Versioned registered and unregistered rates with effective dates."
        actions={
          <>
            <Input placeholder="Search price list…" value={search} onChange={(event) => setSearch(event.target.value)} className="w-64" />
            <Button variant="secondary" onClick={downloadTemplate}>Template</Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={!permissions.manageProducts}>Import Excel</Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void upload(file)
              }}
            />
            <Button variant="secondary" onClick={() => exportRows(exportRowsForFile, `${session.company.company_code}_PriceList`, 'PriceList')}>
              Export
            </Button>
            <Button onClick={openNew} disabled={!permissions.manageProducts}>New Version</Button>
          </>
        }
      />
      <Card>
        <Table
          rowKey={(row) => row.id}
          rows={filtered}
          columns={[
            { key: 'sku', label: 'SKU', render: (row) => productMap.get(row.product_id)?.sku || '—' },
            { key: 'product', label: 'Product', render: (row) => productMap.get(row.product_id)?.full_kind_name || '—' },
            { key: 'customer_type', label: 'Type', render: (row) => <Badge tone={row.customer_type === 'registered' ? 'green' : 'slate'}>{row.customer_type}</Badge> },
            { key: 'rate_per_carton', label: 'Carton Rate', render: (row) => money(row.rate_per_carton, permissions.viewRates) },
            { key: 'rate_per_bag', label: 'Bag Rate', render: (row) => money(row.rate_per_bag, permissions.viewRates) },
            { key: 'rate_per_diaper', label: 'Pc Rate', render: (row) => money(row.rate_per_diaper, permissions.viewRates) },
            { key: 'effective_from', label: 'Effective', render: (row) => dateLabel(row.effective_from) },
            { key: 'is_active', label: 'Active', render: (row) => <Badge tone={row.is_active ? 'green' : 'slate'}>{row.is_active ? 'yes' : 'no'}</Badge> },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void toggle(row)}>{row.is_active ? 'Disable' : 'Enable'}</Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(row)}>Delete</Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={open} title="New Price Version" onClose={() => setOpen(false)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product" className="sm:col-span-2">
            <Select value={form.product_id} onChange={(event) => field('product_id', event.target.value)}>
              {products.rows.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} — {product.full_kind_name} ({product.customer_type})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Customer Type">
            <Select value={form.customer_type} onChange={(event) => field('customer_type', event.target.value)}>
              <option value="registered">Registered</option>
              <option value="unregistered">Unregistered</option>
            </Select>
          </Field>
          <Field label="Effective From"><Input type="date" value={form.effective_from} onChange={(event) => field('effective_from', event.target.value)} /></Field>
          <Field label="Rate / Carton"><Input type="number" step="0.0001" value={form.rate_per_carton} onChange={(event) => field('rate_per_carton', event.target.value)} /></Field>
          <Field label="Rate / Bag"><Input type="number" step="0.0001" value={form.rate_per_bag} onChange={(event) => field('rate_per_bag', event.target.value)} /></Field>
          <Field label="Rate / Diaper"><Input type="number" step="0.000001" value={form.rate_per_diaper} onChange={(event) => field('rate_per_diaper', event.target.value)} /></Field>
        </div>
        {error && <div className="mt-4 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save Version'}</Button>
        </div>
      </Modal>
    </div>
  )
}
