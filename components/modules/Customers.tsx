'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Download, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { callRpcRows, deleteRow, insertRow, listRows, updateRow } from '@/lib/api'
import { downloadCsv, parseCsv } from '@/lib/csv'
import { errorMessage, money } from '@/lib/format'
import { bookerForCustomer, normalizeBookers, type BookerInfo } from '@/lib/linkedCustomers'
import { hasPermission } from '@/lib/permissions'
import { useRows } from '@/lib/useRows'
import type { Customer } from '@/lib/types'
import { useApp } from '../AppProvider'
import { Button, Card, Field, Modal, Notice } from '../Ui'

const empty: Omit<Customer, 'id' | 'created_at'> = {
  cnic_ntn: '',
  strn: '',
  business_name: '',
  delivery_destination: '',
  registration_status: 'Unregister',
  income_tax_status: 'Filer',
  tax_rate_236g: 0.001,
  opening_balance: 0,
  bank_account_no: '',
  bank_branch_name: '',
}

function CustomerForm({ form, setForm, onClose, onSave, editing }: {
  form: Omit<Customer, 'id' | 'created_at'>
  setForm: React.Dispatch<React.SetStateAction<Omit<Customer, 'id' | 'created_at'>>>
  onClose: () => void
  onSave: () => void
  editing: boolean
}) {
  const set = (key: keyof typeof form, value: any) => setForm((current) => ({ ...current, [key]: value }))
  return (
    <Modal title={editing ? 'Edit customer' : 'New customer'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="CNIC / NTN"><input className="field-input" value={form.cnic_ntn} onChange={(event) => set('cnic_ntn', event.target.value)} /></Field>
        <Field label="S.T Reg No (STRN)"><input className="field-input" value={form.strn} onChange={(event) => set('strn', event.target.value)} /></Field>
        <Field label="Business name" className="col-span-2"><input className="field-input" value={form.business_name} onChange={(event) => set('business_name', event.target.value)} /></Field>
        <Field label="Delivery destination" className="col-span-2"><input className="field-input" value={form.delivery_destination} onChange={(event) => set('delivery_destination', event.target.value)} /></Field>
        <Field label="Registration status">
          <select className="field-input" value={form.registration_status} onChange={(event) => set('registration_status', event.target.value)}>
            <option value="Unregister">Unregister</option>
            <option value="Register">Register</option>
          </select>
        </Field>
        <Field label="Income tax status">
          <select className="field-input" value={form.income_tax_status} onChange={(event) => {
            const status = event.target.value as 'Filer' | 'Non Filer'
            setForm((current) => ({ ...current, income_tax_status: status, tax_rate_236g: status === 'Filer' ? 0.001 : 0.02 }))
          }}>
            <option value="Filer">Filer</option>
            <option value="Non Filer">Non Filer</option>
          </select>
        </Field>
        <Field label="Tax rate 236G">
          <input className="field-input" type="number" step="0.001" value={form.tax_rate_236g} onChange={(event) => set('tax_rate_236g', Number(event.target.value))} />
        </Field>
        <Field label="Opening balance">
          <input className="field-input" type="number" step="0.01" value={form.opening_balance} onChange={(event) => set('opening_balance', Number(event.target.value))} />
        </Field>
        <Field label="BANK ACCOUNT NO / IBAN">
          <input className="field-input" value={form.bank_account_no || ''} onChange={(event) => set('bank_account_no', event.target.value)} />
        </Field>
        <Field label="BANK & BRANCH NAME">
          <input className="field-input" value={form.bank_branch_name || ''} onChange={(event) => set('bank_branch_name', event.target.value)} />
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={onSave}>Save customer</Button>
      </div>
    </Modal>
  )
}

export function Customers() {
  const { session, tables, version, bump } = useApp()
  const customers = useRows<Customer>(() => listRows(tables!.customers, { order: 'business_name' }), [tables?.customers, version])
  const [editing, setEditing] = useState<Customer | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Omit<Customer, 'id' | 'created_at'>>(empty)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [bookers, setBookers] = useState<BookerInfo[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    void callRpcRows<any>('list_company_bookers')
      .then((rows) => { if (active) setBookers(normalizeBookers(rows)) })
      .catch(() => { if (active) setBookers([]) })
    return () => { active = false }
  }, [version])

  if (!tables || !session) return null
  const canCreate = hasPermission(session.user.role, session.user.permissions, 'products_customers', 'create')
  const canEdit = hasPermission(session.user.role, session.user.permissions, 'products_customers', 'edit')
  const canDelete = hasPermission(session.user.role, session.user.permissions, 'products_customers', 'delete')

  const openNew = () => { if (!canCreate) return; setEditing(null); setForm(empty); setShowForm(true) }
  const openEdit = (customer: Customer) => {
    if (!canEdit) return
    setEditing(customer)
    setForm({
      cnic_ntn: customer.cnic_ntn, strn: customer.strn, business_name: customer.business_name,
      delivery_destination: customer.delivery_destination, registration_status: customer.registration_status,
      income_tax_status: customer.income_tax_status, tax_rate_236g: Number(customer.tax_rate_236g),
      opening_balance: Number(customer.opening_balance),
      bank_account_no: customer.bank_account_no || '',
      bank_branch_name: customer.bank_branch_name || '',
    })
    setShowForm(true)
  }

  const save = async () => {
    setError('')
    if (editing ? !canEdit : !canCreate) { setError('Permission denied'); return }
    if (!form.business_name.trim()) { setError('Business name is required'); return }
    try {
      if (editing) await updateRow(tables.customers, editing.id, form as any)
      else await insertRow(tables.customers, form as any)
      setShowForm(false)
      setNotice('Customer saved')
      bump()
      customers.reload()
    } catch (caught) { setError(errorMessage(caught)) }
  }

  const remove = async (customer: Customer) => {
    if (!canDelete) { setError('Permission denied'); return }
    if (!window.confirm(`Delete ${customer.business_name}?`)) return
    try { await deleteRow(tables.customers, customer.id); bump(); customers.reload() } catch (caught) { setError(errorMessage(caught)) }
  }

  const exportCsv = () => downloadCsv('customers_export.csv', [
    ['cnic_ntn', 'strn', 'business_name', 'delivery_destination', 'registration_status', 'income_tax_status', 'tax_rate_236g', 'opening_balance', 'bank_account_no', 'bank_branch_name'],
    ...customers.rows.map((row) => [row.cnic_ntn, row.strn, row.business_name, row.delivery_destination, row.registration_status, row.income_tax_status, row.tax_rate_236g, row.opening_balance, row.bank_account_no || '', row.bank_branch_name || '']),
  ])

  const importCsv = async (file: File) => {
    setError('')
    try {
      const [header, ...data] = parseCsv(await file.text())
      const index = (name: string) => header.findIndex((value) => value.trim().toLowerCase() === name)
      const records = data.map((row) => {
        const status = row[index('income_tax_status')] === 'Non Filer' ? 'Non Filer' : 'Filer'
        return {
          cnic_ntn: row[index('cnic_ntn')] || '',
          strn: row[index('strn')] || '',
          business_name: row[index('business_name')],
          delivery_destination: row[index('delivery_destination')] || '',
          registration_status: row[index('registration_status')] === 'Register' ? 'Register' : 'Unregister',
          income_tax_status: status,
          tax_rate_236g: Number(row[index('tax_rate_236g')] || (status === 'Filer' ? 0.001 : 0.02)),
          opening_balance: Number(row[index('opening_balance')] || 0),
          bank_account_no: row[index('bank_account_no')] || '',
          bank_branch_name: row[index('bank_branch_name')] || '',
        }
      }).filter((record) => record.business_name)
      if (!records.length) throw new Error('No valid customer rows found')
      for (const record of records) await insertRow(tables.customers, record as any)
      setNotice(`${records.length} customers imported`)
      bump()
      customers.reload()
    } catch (caught) { setError(errorMessage(caught)) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Customers</h1>
          <p className="text-xs text-slate-500">Registration status and Section 236G tax configuration.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => downloadCsv('customers_template.csv', [
            ['cnic_ntn', 'strn', 'business_name', 'delivery_destination', 'registration_status', 'income_tax_status', 'tax_rate_236g', 'opening_balance', 'bank_account_no', 'bank_branch_name'],
            ['1310203665017', '5478763-4', 'SAMPLE CUSTOMER', 'Karachi', 'Unregister', 'Filer', 0.001, 0, 'PK00BANK0000000000', 'Main Branch'],
          ])}><Download className="h-3.5 w-3.5" /> Template</Button>
          <Button variant="secondary" onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Export</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}><Upload className="h-3.5 w-3.5" /> Import CSV</Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importCsv(file); event.target.value = '' }} />
          {canCreate && <Button onClick={openNew}><Plus className="h-3.5 w-3.5" /> New customer</Button>}
        </div>
      </div>
      {(error || customers.error) && <Notice type="error">{error || customers.error}</Notice>}
      {notice && <Notice type="success">{notice}</Notice>}
      <Card>
        <div className="app-scroll overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-xs">
            <thead className="table-head">
              <tr><th className="px-3 py-2">Business name</th><th className="px-3 py-2">CNIC / NTN</th><th className="px-3 py-2">STRN</th><th className="px-3 py-2">Registration</th><th className="px-3 py-2">Group / Booker</th><th className="px-3 py-2">Filer</th><th className="px-3 py-2 text-right">236G</th><th className="px-3 py-2 text-right">Opening</th><th className="px-3 py-2">Destination</th><th className="px-3 py-2">Bank account / branch</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.rows.map((customer) => (
                <tr key={customer.id} className="table-row">
                  <td className="px-3 py-2 font-semibold text-slate-800">{customer.business_name}</td>
                  <td className="px-3 py-2">{customer.cnic_ntn}</td>
                  <td className="px-3 py-2">{customer.strn}</td>
                  <td className="px-3 py-2">{customer.registration_status}</td>
                  <td className="px-3 py-2">{bookerForCustomer(bookers, customer.id)?.full_name || <span className="text-slate-400">—</span>}</td>
                  <td className="px-3 py-2">{customer.income_tax_status}</td>
                  <td className="px-3 py-2 text-right">{(Number(customer.tax_rate_236g) * 100).toFixed(3)}%</td>
                  <td className="px-3 py-2 text-right">{money(customer.opening_balance)}</td>
                  <td className="max-w-[260px] truncate px-3 py-2" title={customer.delivery_destination}>{customer.delivery_destination}</td>
                  <td className="px-3 py-2">
                    {customer.bank_account_no || customer.bank_branch_name ? (
                      <span className="inline-flex flex-col rounded bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700">
                        <span>{customer.bank_account_no || '—'}</span>
                        <span className="font-medium text-indigo-500">{customer.bank_branch_name || '—'}</span>
                      </span>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {canEdit && <Button variant="ghost" onClick={() => openEdit(customer)}><Pencil className="h-3.5 w-3.5" /></Button>}
                      {canDelete && <Button variant="ghost" onClick={() => void remove(customer)}><Trash2 className="h-3.5 w-3.5 text-red-600" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {showForm && <CustomerForm form={form} setForm={setForm} onClose={() => setShowForm(false)} onSave={() => void save()} editing={Boolean(editing)} />}
    </div>
  )
}
