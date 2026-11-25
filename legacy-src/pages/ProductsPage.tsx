import { useMemo, useRef, useState } from 'react'
import { Button, Card, Field, Input, Modal, PageHeader, Select, Table, Badge } from '../components/ui'
import { useApp } from '../components/AppContext'
import { useRows } from '../lib/useRows'
import { deleteRow, insertRow, insertRows, updateRow } from '../lib/api'
import { exportRows, readRows } from '../lib/excel'
import { money, num } from '../lib/format'
import type { Row } from '../lib/types'

const blank = {
  sku: '',
  base_sku: '',
  full_kind_name: '',
  invoice_short_name: '',
  hs_code: '9619.0090',
  customer_type: 'registered',
  cnts_size: 50,
  bags_size: 8,
  units_per_carton: 0,
  rate_per_carton: 0,
  rate_per_diaper: 0,
  brand: 'OZONE',
}

export const ProductsPage = () => {
  const { session, permissions, notify } = useApp()
  const { rows, reload } = useRows('products', { order: 'full_kind_name' })
  const fileRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<Row>({ ...blank })
  const [editingId, setEditingId] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const canManage = permissions.manageProducts

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return rows.filter((row) =>
      [row.sku, row.base_sku, row.full_kind_name, row.invoice_short_name, row.customer_type]
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [rows, search])

  const field = (key: string, value: any) => setForm((previous) => ({ ...previous, [key]: value }))

  const openNew = () => {
    setForm({ ...blank, hs_code: session.settings.default_hs_code || '9619.0090' })
    setEditingId('')
    setError('')
    setOpen(true)
  }

  const openEdit = (row: Row) => {
    setForm({ ...row })
    setEditingId(row.id)
    setError('')
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = {
        company_id: session.company.company_id,
        sku: form.sku.trim(),
        base_sku: (form.base_sku || form.sku).trim(),
        full_kind_name: form.full_kind_name.trim(),
        invoice_short_name: form.invoice_short_name.trim(),
        hs_code: form.hs_code || '9619.0090',
        customer_type: form.customer_type,
        cnts_size: Number(form.cnts_size),
        bags_size: Number(form.bags_size),
        units_per_carton: Number(form.units_per_carton || 0),
        rate_per_carton: Number(form.rate_per_carton || 0),
        rate_per_diaper: Number(form.rate_per_diaper || 0),
        brand: form.brand || 'OZONE',
      }
      if (editingId) await updateRow('products', editingId, payload)
      else await insertRow('products', payload)
      notify(editingId ? 'Product updated' : 'Product created')
      setOpen(false)
      await reload()
    } catch (cause: any) {
      setError(cause?.message || 'Unable to save product')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (row: Row) => {
    if (!window.confirm(`Delete product ${row.sku}?`)) return
    try {
      await deleteRow('products', row.id)
      notify('Product deleted')
      await reload()
    } catch (cause: any) {
      notify(cause?.message || 'Unable to delete product', 'error')
    }
  }

  const downloadTemplate = () =>
    exportRows(
      [
        {
          sku: 'OZONE-DEMO-REG',
          base_sku: 'OZONE-DEMO',
          full_kind_name: 'DEMO PRODUCT 50*8',
          invoice_short_name: 'DEMO PRODUCT Bags-50',
          hs_code: '9619.0090',
          customer_type: 'registered',
          cnts_size: 50,
          bags_size: 8,
          units_per_carton: 400,
          rate_per_carton: 5000,
          rate_per_diaper: 12.5,
          brand: 'OZONE',
        },
      ],
      'Ozone_Product_Template',
      'Products',
    )

  const upload = async (file: File) => {
    try {
      const imported = await readRows(file)
      const mapped = imported
        .filter((row) => row.sku && row.full_kind_name)
        .map((row) => ({
          company_id: session.company.company_id,
          sku: String(row.sku),
          base_sku: String(row.base_sku || row.sku),
          full_kind_name: String(row.full_kind_name),
          invoice_short_name: String(row.invoice_short_name || row.full_kind_name),
          hs_code: String(row.hs_code || session.settings.default_hs_code || '9619.0090'),
          customer_type: String(row.customer_type || 'registered').toLowerCase() === 'unregistered' ? 'unregistered' : 'registered',
          cnts_size: Number(row.cnts_size || 0),
          bags_size: Number(row.bags_size || 0),
          units_per_carton: Number(row.units_per_carton || 0),
          rate_per_carton: Number(row.rate_per_carton || 0),
          rate_per_diaper: Number(row.rate_per_diaper || 0),
          brand: String(row.brand || 'OZONE'),
        }))
      if (!mapped.length) throw new Error('No valid product rows found')
      await insertRows('products', mapped)
      notify(`${mapped.length} product rows imported`)
      await reload()
    } catch (cause: any) {
      notify(cause?.message || 'Unable to import products', 'error')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Registered and unregistered product masters with packing, rates and HS codes."
        actions={
          <>
            <Input placeholder="Search products…" value={search} onChange={(event) => setSearch(event.target.value)} className="w-64" />
            <Button variant="secondary" onClick={downloadTemplate}>Template</Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={!canManage}>Import Excel</Button>
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
            <Button variant="secondary" onClick={() => exportRows(filtered, `${session.company.company_code}_Products`, 'Products')}>
              Export
            </Button>
            <Button onClick={openNew} disabled={!canManage}>Add Product</Button>
          </>
        }
      />
      <Card>
        <Table
          rowKey={(row) => row.id}
          rows={filtered}
          columns={[
            { key: 'sku', label: 'SKU', render: (row) => <span className="font-semibold text-cyan-300">{row.sku}</span> },
            { key: 'full_kind_name', label: 'Full Kind Name' },
            { key: 'invoice_short_name', label: 'Invoice Name' },
            { key: 'customer_type', label: 'Type', render: (row) => <Badge tone={row.customer_type === 'registered' ? 'green' : 'slate'}>{row.customer_type}</Badge> },
            { key: 'packing', label: 'Packing', render: (row) => `${num(row.cnts_size)} × ${num(row.bags_size)}` },
            { key: 'rate_per_carton', label: 'Rate/Carton', render: (row) => money(row.rate_per_carton, permissions.viewRates) },
            { key: 'rate_per_diaper', label: 'Rate/Pc', render: (row) => money(row.rate_per_diaper, permissions.viewRates) },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(row)} disabled={!canManage}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(row)} disabled={!canManage}>Delete</Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={open} title={editingId ? 'Edit Product' : 'New Product'} onClose={() => setOpen(false)} width="max-w-4xl">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="SKU"><Input value={form.sku} onChange={(event) => field('sku', event.target.value)} /></Field>
          <Field label="Base SKU"><Input value={form.base_sku} onChange={(event) => field('base_sku', event.target.value)} /></Field>
          <Field label="Customer Type">
            <Select value={form.customer_type} onChange={(event) => field('customer_type', event.target.value)}>
              <option value="registered">Registered</option>
              <option value="unregistered">Unregistered</option>
            </Select>
          </Field>
          <Field label="Full Kind Name" className="lg:col-span-2"><Input value={form.full_kind_name} onChange={(event) => field('full_kind_name', event.target.value)} /></Field>
          <Field label="Invoice Short Name"><Input value={form.invoice_short_name} onChange={(event) => field('invoice_short_name', event.target.value)} /></Field>
          <Field label="HS Code"><Input value={form.hs_code} onChange={(event) => field('hs_code', event.target.value)} /></Field>
          <Field label="Cnts / Carton"><Input type="number" value={form.cnts_size} onChange={(event) => field('cnts_size', event.target.value)} /></Field>
          <Field label="Bags / Cnt"><Input type="number" value={form.bags_size} onChange={(event) => field('bags_size', event.target.value)} /></Field>
          <Field label="Units / Carton"><Input type="number" value={form.units_per_carton} onChange={(event) => field('units_per_carton', event.target.value)} /></Field>
          <Field label="Rate / Carton"><Input type="number" step="0.0001" value={form.rate_per_carton} onChange={(event) => field('rate_per_carton', event.target.value)} /></Field>
          <Field label="Rate / Diaper"><Input type="number" step="0.000001" value={form.rate_per_diaper} onChange={(event) => field('rate_per_diaper', event.target.value)} /></Field>
          <Field label="Brand"><Input value={form.brand} onChange={(event) => field('brand', event.target.value)} /></Field>
        </div>
        {error && <div className="mt-4 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save Product'}</Button>
        </div>
      </Modal>
    </div>
  )
}
