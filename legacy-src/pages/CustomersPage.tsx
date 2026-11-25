import { useMemo, useState } from 'react'
import { Button, Card, Field, Input, Modal, PageHeader, Select, Table, Textarea, Badge } from '../components/ui'
import { useApp } from '../components/AppContext'
import { useRows } from '../lib/useRows'
import { deleteRow, insertRow, updateRow } from '../lib/api'
import { exportRows } from '../lib/excel'
import { dateLabel } from '../lib/format'
import type { Row } from '../lib/types'

const blank = {
  customer_code: '',
  customer_name: '',
  business_name: '',
  contact_person: '',
  phone: '',
  email: '',
  reg_no: 'unregistered',
  cnic_ntn: '',
  strn: '',
  filer_status: 'non-filer',
  delivery_destination_address: '',
  login_id: '',
  login_password: '',
}

const randomCnic = (): string => {
  const part = (length: number) => Math.floor(10 ** (length - 1) + Math.random() * 9 * 10 ** (length - 1)).toString()
  return `${part(5)}-${part(7)}-${Math.floor(Math.random() * 10)}`
}

export const CustomersPage = () => {
  const { session, notify } = useApp()
  const { rows, reload } = useRows('customers', { order: 'created_at', ascending: false })
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<Row>({ ...blank })
  const [editingId, setEditingId] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return rows.filter((row) =>
      [row.customer_code, row.customer_name, row.business_name, row.phone, row.login_id]
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [rows, search])

  const field = (key: string, value: any) => setForm((previous) => ({ ...previous, [key]: value }))

  const openNew = () => {
    setForm({ ...blank })
    setEditingId('')
    setError('')
    setOpen(true)
  }

  const openEdit = (row: Row) => {
    setForm({ ...row, login_password: '' })
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
        customer_code: form.customer_code.trim(),
        customer_name: form.customer_name.trim(),
        business_name: form.business_name.trim(),
        contact_person: form.contact_person || '',
        phone: form.phone || '',
        email: form.email || '',
        reg_no: String(form.reg_no).toLowerCase(),
        cnic_ntn: form.cnic_ntn || '',
        strn: form.strn || '',
        filer_status: String(form.filer_status).toLowerCase(),
        delivery_destination_address: form.delivery_destination_address || '',
        login_id: form.login_id || null,
      }
      let customerId = editingId
      if (editingId) {
        await updateRow('customers', editingId, payload)
      } else {
        const created = await insertRow<Row>('customers', payload)
        customerId = created.id
        if (form.login_id && form.login_password) {
          const role = payload.reg_no === 'registered' ? 'registered_user' : 'unregistered_user'
          const user = await insertRow<Row>('users', {
            company_id: session.company.company_id,
            company_code: session.company.company_code,
            cnic: randomCnic(),
            login_id: form.login_id,
            password: form.login_password,
            full_name: form.customer_name,
            email: form.email || '',
            phone: form.phone || '',
            role,
            customer_id: customerId,
          })
          await insertRow('user_policies', {
            company_id: session.company.company_id,
            user_id: user.id,
            can_view_rates: role === 'registered_user',
            can_view_values: role === 'registered_user',
            can_view_stock: true,
          })
        }
      }
      notify(editingId ? 'Customer updated' : 'Customer created')
      setOpen(false)
      await reload()
    } catch (cause: any) {
      setError(cause?.message || 'Unable to save customer')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (row: Row) => {
    if (!window.confirm(`Delete customer ${row.customer_code}?`)) return
    try {
      await deleteRow('customers', row.id)
      notify('Customer deleted')
      await reload()
    } catch (cause: any) {
      notify(cause?.message || 'Unable to delete customer', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Customer master, tax profile, delivery address and optional portal login."
        actions={
          <>
            <Input placeholder="Search customers…" value={search} onChange={(event) => setSearch(event.target.value)} className="w-64" />
            <Button variant="secondary" onClick={() => exportRows(filtered, `${session.company.company_code}_Customers`, 'Customers')}>
              Export
            </Button>
            <Button onClick={openNew}>Add Customer</Button>
          </>
        }
      />
      <Card>
        <Table
          rowKey={(row) => row.id}
          rows={filtered}
          columns={[
            { key: 'customer_code', label: 'Code', render: (row) => <span className="font-semibold text-cyan-300">{row.customer_code}</span> },
            { key: 'business_name', label: 'Business' },
            { key: 'customer_name', label: 'Contact' },
            { key: 'phone', label: 'Phone' },
            { key: 'reg_no', label: 'Registration', render: (row) => <Badge tone={row.reg_no === 'registered' ? 'green' : 'slate'}>{row.reg_no}</Badge> },
            { key: 'filer_status', label: 'Filer', render: (row) => <Badge tone={String(row.filer_status).toLowerCase() === 'filer' ? 'green' : 'amber'}>{row.filer_status}</Badge> },
            { key: 'login_id', label: 'Portal Login' },
            { key: 'created_at', label: 'Created', render: (row) => dateLabel(row.created_at) },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(row)}>
                    Delete
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>

      <Modal open={open} title={editingId ? 'Edit Customer' : 'New Customer'} onClose={() => setOpen(false)} width="max-w-4xl">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Customer Code"><Input value={form.customer_code} onChange={(event) => field('customer_code', event.target.value)} /></Field>
          <Field label="Customer Name"><Input value={form.customer_name} onChange={(event) => field('customer_name', event.target.value)} /></Field>
          <Field label="Business Name"><Input value={form.business_name} onChange={(event) => field('business_name', event.target.value)} /></Field>
          <Field label="Contact Person"><Input value={form.contact_person} onChange={(event) => field('contact_person', event.target.value)} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(event) => field('phone', event.target.value)} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(event) => field('email', event.target.value)} /></Field>
          <Field label="Registration">
            <Select value={form.reg_no} onChange={(event) => field('reg_no', event.target.value)}>
              <option value="registered">Registered</option>
              <option value="unregistered">Unregistered</option>
            </Select>
          </Field>
          <Field label="Filer Status">
            <Select value={form.filer_status} onChange={(event) => field('filer_status', event.target.value)}>
              <option value="filer">Filer</option>
              <option value="non-filer">Non-Filer</option>
            </Select>
          </Field>
          <Field label="CNIC / NTN"><Input value={form.cnic_ntn} onChange={(event) => field('cnic_ntn', event.target.value)} /></Field>
          <Field label="STRN"><Input value={form.strn} onChange={(event) => field('strn', event.target.value)} /></Field>
          <Field label="Portal Login ID"><Input value={form.login_id || ''} onChange={(event) => field('login_id', event.target.value)} /></Field>
          <Field label="Portal Password" hint="Only required when creating a new customer login.">
            <Input type="password" value={form.login_password || ''} onChange={(event) => field('login_password', event.target.value)} />
          </Field>
          <Field label="Delivery Address" className="sm:col-span-2 lg:col-span-3">
            <Textarea value={form.delivery_destination_address} onChange={(event) => field('delivery_destination_address', event.target.value)} />
          </Field>
        </div>
        {error && <div className="mt-4 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save Customer'}</Button>
        </div>
      </Modal>
    </div>
  )
}
