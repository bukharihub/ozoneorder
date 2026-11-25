import { useMemo, useState } from 'react'
import { Button, Card, Field, Input, Modal, PageHeader, Select, Table, Badge } from '../components/ui'
import { PrintDocument } from '../components/PrintDocument'
import { VoucherActions } from '../components/VoucherActions'
import { useApp } from '../components/AppContext'
import { useRows } from '../lib/useRows'
import { postReceipt } from '../lib/api'
import { exportRows } from '../lib/excel'
import { dateLabel, money, statusTone, today } from '../lib/format'
import type { Row } from '../lib/types'

export const ReceiptsPage = () => {
  const { session, permissions, notify, refresh } = useApp()
  const receipts = useRows('bank_cash_receipts', { order: 'created_at', ascending: false })
  const invoices = useRows('invoices', { order: 'invoice_number' })
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<Row>({
    invoice_id: '',
    amount: 0,
    receipt_date: today(),
    payment_method: 'bank',
    bank_name: '',
    instrument_no: '',
    reference_no: '',
    remarks: '',
  })
  const [printDoc, setPrintDoc] = useState<Row | null>(null)

  const invoiceMap = useMemo(() => new Map(invoices.rows.map((invoice) => [invoice.id, invoice])), [invoices.rows])
  const openInvoices = invoices.rows.filter((invoice) => ['unpaid', 'partially_paid'].includes(invoice.status))
  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return receipts.rows.filter((row) =>
      [row.receipt_number, row.instrument_no, row.bank_name, row.payment_method, row.status]
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [receipts.rows, search])

  const chooseInvoice = (id: string) => {
    const invoice = invoiceMap.get(id)
    setForm((previous) => ({
      ...previous,
      invoice_id: id,
      amount: invoice?.balance_amount || invoice?.net_receipt_total || 0,
      bank_name: session.company.bank_name || '',
    }))
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const receipt = await postReceipt(form.invoice_id, form)
      notify(`Receipt ${receipt.receipt_number} posted`)
      setOpen(false)
      refresh()
      await receipts.reload()
      await invoices.reload()
    } catch (cause: any) {
      setError(cause?.message || 'Unable to post receipt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Bank & Cash Receipts"
        subtitle="Receipt posting automatically updates invoice balances and customer ledger."
        actions={
          <>
            <Input placeholder="Search receipts…" value={search} onChange={(event) => setSearch(event.target.value)} className="w-64" />
            <Button variant="secondary" onClick={() => exportRows(filtered, `${session.company.company_code}_Receipts`, 'Receipts')}>Export</Button>
            <Button onClick={() => setOpen(true)} disabled={!permissions.postReceipt}>New Receipt</Button>
          </>
        }
      />
      <Card>
        <Table
          rowKey={(row) => row.id}
          rows={filtered}
          columns={[
            { key: 'receipt_number', label: 'Receipt', render: (row) => <span className="font-semibold text-cyan-300">{row.receipt_number}</span> },
            { key: 'receipt_date', label: 'Date', render: (row) => dateLabel(row.receipt_date) },
            { key: 'invoice', label: 'Invoice', render: (row) => invoiceMap.get(row.invoice_id)?.invoice_number || '—' },
            { key: 'payment_method', label: 'Method', render: (row) => <Badge tone={row.payment_method === 'bank' ? 'indigo' : 'green'}>{row.payment_method}</Badge> },
            { key: 'amount', label: 'Amount', render: (row) => money(row.amount, permissions.viewValues) },
            { key: 'instrument_no', label: 'Instrument' },
            { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <VoucherActions
                  table="bank_cash_receipts"
                  row={row}
                  label="Receipt"
                  editFields={[
                    { key: 'receipt_date', label: 'Receipt Date', type: 'date' },
                    { key: 'amount', label: 'Amount', type: 'number' },
                    { key: 'payment_method', label: 'Payment Method' },
                    { key: 'bank_name', label: 'Bank Name' },
                    { key: 'instrument_no', label: 'Instrument No' },
                    { key: 'reference_no', label: 'Reference No' },
                    { key: 'remarks', label: 'Remarks', type: 'textarea' },
                  ]}
                  onPrint={() => setPrintDoc(row)}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal open={open} title="New Receipt" onClose={() => setOpen(false)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Invoice" className="sm:col-span-2">
            <Select value={form.invoice_id} onChange={(event) => chooseInvoice(event.target.value)}>
              <option value="">Select invoice</option>
              {openInvoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.invoice_number} — {invoice.customer_name} — balance {money(invoice.balance_amount, permissions.viewValues)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Receipt Date"><Input type="date" value={form.receipt_date} onChange={(event) => setForm({ ...form, receipt_date: event.target.value })} /></Field>
          <Field label="Amount"><Input type="number" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></Field>
          <Field label="Payment Method">
            <Select value={form.payment_method} onChange={(event) => setForm({ ...form, payment_method: event.target.value })}>
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
            </Select>
          </Field>
          <Field label="Bank Name"><Input value={form.bank_name} onChange={(event) => setForm({ ...form, bank_name: event.target.value })} /></Field>
          <Field label="Instrument No"><Input value={form.instrument_no} onChange={(event) => setForm({ ...form, instrument_no: event.target.value })} /></Field>
          <Field label="Reference No"><Input value={form.reference_no} onChange={(event) => setForm({ ...form, reference_no: event.target.value })} /></Field>
          <Field label="Remarks" className="sm:col-span-2"><Input value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} /></Field>
        </div>
        {error && <div className="mt-4 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving || !form.invoice_id}>{saving ? 'Posting…' : 'Post Receipt'}</Button>
        </div>
      </Modal>

      {printDoc && <PrintDocument title="Payment Receipt" doc={printDoc} items={[]} onClose={() => setPrintDoc(null)} />}
    </div>
  )
}
