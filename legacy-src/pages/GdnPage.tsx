import { useMemo, useState } from 'react'
import { Button, Card, Field, Input, Modal, PageHeader, Table, Badge } from '../components/ui'
import { PrintDocument } from '../components/PrintDocument'
import { VoucherActions } from '../components/VoucherActions'
import { useApp } from '../components/AppContext'
import { useRows } from '../lib/useRows'
import { issueGatePass, listRows } from '../lib/api'
import { exportRows } from '../lib/excel'
import { dateLabel, statusTone, today } from '../lib/format'
import type { Row } from '../lib/types'

export const GdnPage = () => {
  const { session, permissions, notify, refresh } = useApp()
  const gdns = useRows('gdns', { order: 'created_at', ascending: false })
  const gatePasses = useRows('gate_passes', {})
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Row | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [header, setHeader] = useState<Row>({ passage_date: today(), vehicle_number: '', driver_name: '', driver_cnic: '', guard_badge_no: '', remarks: '' })
  const [printDoc, setPrintDoc] = useState<Row | null>(null)
  const [printItems, setPrintItems] = useState<Row[]>([])

  const passByGdn = useMemo(() => new Map(gatePasses.rows.map((pass) => [pass.gdn_id, pass])), [gatePasses.rows])
  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return gdns.rows.filter((row) => [row.gdn_number, row.vehicle_no, row.driver_name, row.status].join(' ').toLowerCase().includes(term))
  }, [gdns.rows, search])

  const openPass = (gdn: Row) => {
    setSelected(gdn)
    setHeader({
      passage_date: today(),
      vehicle_number: gdn.vehicle_no || '',
      driver_name: gdn.driver_name || '',
      driver_cnic: gdn.driver_cnic || '',
      guard_badge_no: '',
      remarks: '',
    })
    setOpen(true)
  }

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const pass = await issueGatePass(selected.id, header)
      notify(`Gate pass ${pass.gate_pass_number} issued`)
      setOpen(false)
      refresh()
      await gdns.reload()
      await gatePasses.reload()
    } catch (cause: any) {
      notify(cause?.message || 'Unable to issue gate pass', 'error')
    } finally {
      setSaving(false)
    }
  }

  const openPrint = async (row: Row) => {
    try {
      const items = await listRows<Row>('gdn_items', { filters: { gdn_id: row.id }, order: 'created_at' })
      setPrintDoc(row)
      setPrintItems(items)
    } catch (cause: any) {
      notify(cause?.message || 'Unable to load GDN items', 'error')
    }
  }

  return (
    <div>
      <PageHeader
        title="Delivery Notes"
        subtitle="Posted GDNs and gate pass issuance. Dispatch quantities are deducted from FG stock automatically."
        actions={
          <>
            <Input placeholder="Search GDNs…" value={search} onChange={(event) => setSearch(event.target.value)} className="w-64" />
            <Button variant="secondary" onClick={() => exportRows(filtered, `${session.company.company_code}_GDNs`, 'GDNs')}>Export</Button>
          </>
        }
      />
      <Card>
        <Table
          rowKey={(row) => row.id}
          rows={filtered}
          columns={[
            { key: 'gdn_number', label: 'GDN', render: (row) => <span className="font-semibold text-cyan-300">{row.gdn_number}</span> },
            { key: 'gdn_date', label: 'Date', render: (row) => dateLabel(row.gdn_date) },
            { key: 'vehicle_no', label: 'Vehicle' },
            { key: 'driver_name', label: 'Driver' },
            { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
            {
              key: 'gatepass',
              label: 'Gate Pass',
              render: (row) => {
                const pass = passByGdn.get(row.id)
                return pass ? <Badge tone="green">{pass.gate_pass_number}</Badge> : <Badge tone="slate">Not issued</Badge>
              },
            },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <VoucherActions
                  table="gdns"
                  row={row}
                  label="GDN"
                  editFields={[
                    { key: 'gdn_date', label: 'GDN Date', type: 'date' },
                    { key: 'vehicle_no', label: 'Vehicle No' },
                    { key: 'driver_name', label: 'Driver Name' },
                    { key: 'driver_cnic', label: 'Driver CNIC' },
                  ]}
                  onPrint={() => void openPrint(row)}
                  onChanged={() => void gdns.reload()}
                  extra={!passByGdn.has(row.id) && ['posted', 'gate_pass_out'].includes(row.status) ? (
                    <Button size="sm" onClick={() => openPass(row)} disabled={!permissions.issueGatePass}>Issue Gate Pass</Button>
                  ) : undefined}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal open={open} title={`Issue Gate Pass — ${selected?.gdn_number || ''}`} onClose={() => setOpen(false)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Passage Date"><Input type="date" value={header.passage_date} onChange={(event) => setHeader({ ...header, passage_date: event.target.value })} /></Field>
          <Field label="Vehicle Number"><Input value={header.vehicle_number} onChange={(event) => setHeader({ ...header, vehicle_number: event.target.value })} /></Field>
          <Field label="Driver Name"><Input value={header.driver_name} onChange={(event) => setHeader({ ...header, driver_name: event.target.value })} /></Field>
          <Field label="Driver CNIC"><Input value={header.driver_cnic} onChange={(event) => setHeader({ ...header, driver_cnic: event.target.value })} /></Field>
          <Field label="Guard Badge No"><Input value={header.guard_badge_no} onChange={(event) => setHeader({ ...header, guard_badge_no: event.target.value })} /></Field>
          <Field label="Remarks"><Input value={header.remarks} onChange={(event) => setHeader({ ...header, remarks: event.target.value })} /></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving ? 'Issuing…' : 'Issue Gate Pass'}</Button>
        </div>
      </Modal>

      {printDoc && (
        <PrintDocument title="Goods Delivery Note" doc={printDoc} items={printItems} onClose={() => setPrintDoc(null)} />
      )}
    </div>
  )
}
