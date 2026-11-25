'use client'

import React, { useRef, useState } from 'react'
import { Download, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { deleteRow, insertRow, listRows, updateRow } from '@/lib/api'
import { downloadCsv, parseCsv } from '@/lib/csv'
import { errorMessage, quantity } from '@/lib/format'
import { hasPermission } from '@/lib/permissions'
import { useRows } from '@/lib/useRows'
import type { Product } from '@/lib/types'
import { useApp } from '../AppProvider'
import { Button, Card, Field, Modal, Notice } from '../Ui'

const empty = {
  size_category: 'NB',
  product_type: 'UNREGISTERED' as 'REGISTERED' | 'UNREGISTERED',
  product_name: '',
  hs_code: '9619.0090',
  diapers_per_bag: 50,
  bags_per_carton: 8,
  opening_stock_ctns: 0,
  per_diaper_rate: 0,
  per_carton_rate: 0,
}

type ProductFormState = typeof empty

function ProductForm({ form, setForm, onClose, onSave, editing }: {
  form: ProductFormState
  setForm: React.Dispatch<React.SetStateAction<ProductFormState>>
  onClose: () => void
  onSave: () => void
  editing: boolean
}) {
  const set = (key: keyof ProductFormState, value: any) => setForm((current) => ({ ...current, [key]: value }))
  return (
    <Modal title={editing ? 'Edit product' : 'New product'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Field label="Size category">
          <select className="field-input" value={form.size_category} onChange={(event) => set('size_category', event.target.value)}>
            {['NB', 'S', 'M', 'L', 'XL', 'XXL'].map((size) => <option key={size}>{size}</option>)}
          </select>
        </Field>
        <Field label="Product type">
          <select className="field-input" value={form.product_type} onChange={(event) => set('product_type', event.target.value)}>
            <option value="UNREGISTERED">UNREGISTERED</option>
            <option value="REGISTERED">REGISTERED</option>
          </select>
        </Field>
        <Field label="HS code">
          <input className="field-input" value={form.hs_code} onChange={(event) => set('hs_code', event.target.value)} />
        </Field>
        <Field label="Product name" className="col-span-2 md:col-span-3">
          <input className="field-input" value={form.product_name} onChange={(event) => set('product_name', event.target.value)} />
        </Field>
        <Field label="Diapers per bag">
          <input className="field-input" type="number" value={form.diapers_per_bag} onChange={(event) => set('diapers_per_bag', Number(event.target.value))} />
        </Field>
        <Field label="Bags per carton">
          <input className="field-input" type="number" value={form.bags_per_carton} onChange={(event) => set('bags_per_carton', Number(event.target.value))} />
        </Field>
        <Field label="Pcs per carton">
          <input className="field-input bg-slate-100" readOnly value={form.diapers_per_bag * form.bags_per_carton} />
        </Field>
        <Field label="Opening stock (ctns)">
          <input className="field-input" type="number" value={form.opening_stock_ctns} onChange={(event) => set('opening_stock_ctns', Number(event.target.value))} />
        </Field>
        <Field label="Per diaper rate">
          <input className="field-input" type="number" step="0.001" value={form.per_diaper_rate} onChange={(event) => set('per_diaper_rate', Number(event.target.value))} />
        </Field>
        <Field label="Per carton rate">
          <input className="field-input" type="number" step="0.01" value={form.per_carton_rate} onChange={(event) => set('per_carton_rate', Number(event.target.value))} />
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave}>Save product</Button>
      </div>
    </Modal>
  )
}

export function Products() {
  const { session, tables, version, bump } = useApp()
  const products = useRows<Product>(() => listRows(tables!.products, { order: 'product_name' }), [tables?.products, version])
  const [editing, setEditing] = useState<Product | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ProductFormState>({ ...empty })
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  if (!tables || !session) return null
  const canCreate = hasPermission(session.user.role, session.user.permissions, 'products_customers', 'create')
  const canEdit = hasPermission(session.user.role, session.user.permissions, 'products_customers', 'edit')
  const canDelete = hasPermission(session.user.role, session.user.permissions, 'products_customers', 'delete')

  const openNew = () => { if (!canCreate) return; setEditing(null); setForm({ ...empty }); setShowForm(true) }

  const openEdit = (product: Product) => {
    if (!canEdit) return
    setEditing(product)
    setForm({
      size_category: product.size_category,
      product_type: product.product_type,
      product_name: product.product_name,
      hs_code: product.hs_code,
      diapers_per_bag: Number(product.diapers_per_bag),
      bags_per_carton: Number(product.bags_per_carton),
      opening_stock_ctns: Number(product.opening_stock_ctns),
      per_diaper_rate: Number(product.per_diaper_rate),
      per_carton_rate: Number(product.per_carton_rate),
    })
    setShowForm(true)
  }

  const save = async () => {
    setError(''); setNotice('')
    if (editing ? !canEdit : !canCreate) { setError('Permission denied'); return }
    if (!form.product_name.trim()) { setError('Product name is required')
      return
    }
    const payload: any = { ...form }
    if (!editing) {
      payload.current_stock_ctns = form.opening_stock_ctns
      payload.current_stock_pcs = form.opening_stock_ctns * form.diapers_per_bag * form.bags_per_carton
    }
    try {
      if (editing) await updateRow(tables.products, editing.id, payload)
      else await insertRow(tables.products, payload)
      setNotice('Product saved')
      setShowForm(false)
      bump()
      products.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  const remove = async (product: Product) => {
    if (!window.confirm(`Delete ${product.product_name}?`)) return
    try {
      await deleteRow(tables.products, product.id)
      bump()
      products.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  const exportCsv = () => {
    downloadCsv('products_export.csv', [
      ['size_category', 'product_type', 'product_name', 'hs_code', 'diapers_per_bag', 'bags_per_carton', 'opening_stock_ctns', 'per_diaper_rate', 'per_carton_rate'],
      ...products.rows.map((product) => [
        product.size_category, product.product_type, product.product_name, product.hs_code,
        product.diapers_per_bag, product.bags_per_carton, product.opening_stock_ctns,
        product.per_diaper_rate, product.per_carton_rate,
      ]),
    ])
  }

  const importCsv = async (file: File) => {
    setError('')
    try {
      const rows = parseCsv(await file.text())
      const [header, ...data] = rows
      const index = (name: string) => header.findIndex((value) => value.trim().toLowerCase() === name)
      const records = data.map((row) => ({
        size_category: row[index('size_category')] || 'NB',
        product_type: (row[index('product_type')] || 'UNREGISTERED').toUpperCase() as 'REGISTERED' | 'UNREGISTERED',
        product_name: row[index('product_name')],
        hs_code: row[index('hs_code')] || '9619.0090',
        diapers_per_bag: Number(row[index('diapers_per_bag')] || 0),
        bags_per_carton: Number(row[index('bags_per_carton')] || 0),
        opening_stock_ctns: Number(row[index('opening_stock_ctns')] || 0),
        per_diaper_rate: Number(row[index('per_diaper_rate')] || 0),
        per_carton_rate: Number(row[index('per_carton_rate')] || 0),
      })).filter((record) => record.product_name && record.diapers_per_bag > 0 && record.bags_per_carton > 0)
      if (!records.length) throw new Error('No valid product rows found')
      for (const record of records) {
        await insertRow(tables.products, {
          ...record,
          current_stock_ctns: record.opening_stock_ctns,
          current_stock_pcs: record.opening_stock_ctns * record.diapers_per_bag * record.bags_per_carton,
        })
      }
      setNotice(`${records.length} products imported`)
      bump()
      products.reload()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Products / Finished Goods</h1>
          <p className="text-xs text-slate-500">Registered and unregistered product catalog with live FG stock.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => downloadCsv('products_template.csv', [
            ['size_category', 'product_type', 'product_name', 'hs_code', 'diapers_per_bag', 'bags_per_carton', 'opening_stock_ctns', 'per_diaper_rate', 'per_carton_rate'],
            ['NB', 'UNREGISTERED', 'SAMPLE PRODUCT 50*8', '9619.0090', 50, 8, 100, 11.65, 0],
          ])}><Download className="h-3.5 w-3.5" /> Template</Button>
          <Button variant="secondary" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Export</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" /> Import CSV</Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCsv(file); event.target.value = '' }}
          />
          {canCreate && <Button onClick={openNew}><Plus className="h-3.5 w-3.5" /> New product</Button>}
        </div>
      </div>
      {(error || products.error) && <Notice type="error">{error || products.error}</Notice>}
      {notice && <Notice type="success">{notice}</Notice>}
      <Card>
        <div className="app-scroll overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="table-head">
              <tr>
                <th className="px-3 py-2">Size</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">HS</th><th className="px-3 py-2 text-right">Pcs/Ctn</th>
                <th className="px-3 py-2 text-right">Opening</th><th className="px-3 py-2 text-right">Current</th>
                <th className="px-3 py-2 text-right">Pcs</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.rows.map((product) => (
                <tr key={product.id} className="table-row">
                  <td className="px-3 py-2 font-semibold">{product.size_category}</td>
                  <td className="px-3 py-2">{product.product_type}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{product.product_name}</td>
                  <td className="px-3 py-2">{product.hs_code}</td>
                  <td className="px-3 py-2 text-right">{product.pcs_per_carton}</td>
                  <td className="px-3 py-2 text-right">{quantity(product.opening_stock_ctns)}</td>
                  <td className={`px-3 py-2 text-right font-bold ${product.current_stock_ctns < 100 ? 'text-red-600' : 'text-emerald-700'}`}>{quantity(product.current_stock_ctns)}</td>
                  <td className="px-3 py-2 text-right">{quantity(product.current_stock_pcs)}</td>
                  <td className="px-3 py-2 text-right">{product.product_type === 'UNREGISTERED' ? product.per_diaper_rate : product.per_carton_rate}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {canEdit && <Button variant="ghost" onClick={() => openEdit(product)}><Pencil className="h-3.5 w-3.5" /></Button>}
                      {canDelete && <Button variant="ghost" onClick={() => void remove(product)}><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!products.loading && products.rows.length === 0 && <p className="p-6 text-center text-xs text-slate-500">No products yet.</p>}
        </div>
      </Card>

      {showForm && (
        <ProductForm form={form} setForm={setForm} onClose={() => setShowForm(false)} onSave={() => void save()} editing={Boolean(editing)} />
      )}
    </div>
  )
}
