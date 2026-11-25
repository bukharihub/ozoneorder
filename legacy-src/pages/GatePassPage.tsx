import { useMemo, useState } from 'react'
import { Button, Card, Field, Input, Modal, PageHeader, Table, Badge } from '../components/ui'
import { PrintDocument } from '../components/PrintDocument'
import { VoucherActions } from '../components/VoucherActions'
import { useApp } from '../components/AppContext'
import { useRows } from '../lib/useRows'
import { listRows, postInvoice, updateRow } from '../lib/api'
import { exportRows } from '../lib/excel'
import { dateLabel, statusTone, today } from '../lib/format'
import type { Row } from '../lib/types'

export const GatePassPage = () => {
  const { session, permissions, notify, refresh } = useApp()
  const passes = useRows('gate_passes', { order: 'created_at', ascending: false })
  const invoices = useRows('invoices', {})
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Row | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [header, setHeader] = useState<Row>({ invoice_date: today(), due_date: '' })
  const [printDoc, setPrintDoc] = useState<Row | null>(null)
  const [printItems, setPrintItems] = useState<Row[]>([])

  const invoiceByPass = useMemo(() => new Map(invoices.rows.map((invoice) => [invoice.gate_pass_id, invoice])), [invoices.rows])
  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return passes.rows.filter((row) =>
      [row.gate_pass_number, row.vehicle_number, row.driver_name, row.status].join(' ').toLowerCase().includes(term),
    )
  }, [passes.rows, search])

  const markOut = async (row: Row) => {
    try {
      await updateRow('gate_passes', row.id, { status: 'out' })
      notify('Gate pass marked out')
      refresh()
      await passes.reload()
    } catch (cause: any) {
      notify(cause?.message || 'Unable to update gate pass', 'error')
    }
  }

  const openInvoice = (row: Row) => {
    setSelected(row)
    setHeader({ invoice_date: today(), due_date: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10) })
    setOpen(true)
  }

  const saveInvoice = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const invoice = await postInvoice(selected.id, header)
      notify(`Invoice ${invoice.invoice_number} posted`)
      setOpen(false)
      refresh()
      await passes.reload()
      await invoices.reload()
    } catch (cause: any) {
      notify(cause?.message || 'Unable to post invoice', 'error')
    } finally {
      setSaving(false)
    }
  }

  const openPrint = async (row: Row) => {
    try {
      const items = await listRows<Row>('gate_pass_items', { filters: { gate_pass_id: row.id }, order: 'created_at' })
      setPrintDoc(row)
      setPrintItems(items)
    } catch (cause: any) {
      notify(cause?.message || 'Unable to load gate pass items', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Gate Passes"
        subtitle="Gate security record, vehicle movement and billing hand-off."
        actions={
          <>
            <Input placeholder="Search gate passes…" value={search} onChange={(event) => setSearch(event.target.value)} className="w-64" />
            <Button variant="secondary" onClick={() => exportRows(filtered, `${session.company.company_code}_GatePasses`, 'Gate Passes')}>Export</Button>
          </>
        }
      />
      <Card>
        <Table
          rowKey={(row) => row.id}
          rows={filtered}
          columns={[
            { key: 'gate_pass_number', label: 'Gate Pass', render: (row) => <span className="font-semibold text-cyan-300">{row.gate_pass_number}</span> },
            { key: 'passage_date', label: 'Date', render: (row) => dateLabel(row.passage_date) },
            { key: 'vehicle_number', label: 'Vehicle' },
            { key: 'driver_name', label: 'Driver' },
            { key: 'guard_badge_no', label: 'Guard' },
            { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
            {
              key: 'invoice',
              label: 'Invoice',
              render: (row) => {
                const invoice = invoiceByPass.get(row.id)
                return invoice ? <Badge tone="green">{invoice.invoice_number}</Badge> : <Badge tone="slate">Pending</Badge>
              },
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <VoucherActions
                  table="gate_passes"
                  row={row}
                  label="Gate Pass"
                  editFields={[
                    { key: 'passage_date', label: 'Passage Date', type: 'date' },
                    { key: 'vehicle_number', label: 'Vehicle No' },
                    { key: 'driver_name', label: 'Driver Name' },
                    { key: 'driver_cnic', label: 'Driver CNIC' },
                    { key: 'guard_badge_no', label: 'Guard Badge' },
                    { key: 'remarks', label: 'Remarks', type: 'textarea' },
                  ]}
                  onPrint={() => void openPrint(row)}
                  extra={(
                    <>
                      {row.status === 'issued' && (
                        <Button size="sm" variant="secondary" onClick={() => void markOut(row)} disabled={!permissions.issueGatePass}>
                          Mark Out
                        </Button>
                      )}
                      {!invoiceByPass.has(row.id) && ['issued', 'out'].includes(row.status) && (
                        <Button size="sm" onClick={() => openInvoice(row)} disabled={!permissions.createInvoice}>Post Invoice</Button>
                      )}
                    </>
                  )}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal open={open} title={`Post Invoice — ${selected?.gate_pass_number || ''}`} onClose={() => setOpen(false)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Invoice Date"><Input type="date" value={header.invoice_date} onChange={(event) => setHeader({ ...header, invoice_date: event.target.value })} /></Field>
          <Field label="Due Date"><Input type="date" value={header.due_date} onChange={(event) => setHeader({ ...header, due_date: event.target.value })} /></Field>
        </div>
        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-400">
          Invoice items, customer ledger debit, gate pass status and sale order status are created automatically by database triggers.
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void saveInvoice()} disabled={saving}>{saving ? 'Posting…' : 'Post Invoice'}</Button>
        </div>
      </Modal>

      {printDoc && (
        <PrintDocument title="Gate Pass" doc={printDoc} items={printItems} onClose={() => setPrintDoc(null)} />
      )}
    </div>
  )
}
