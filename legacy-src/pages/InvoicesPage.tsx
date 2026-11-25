import { useMemo, useState } from 'react'
import { Button, Card, Field, Input, Modal, PageHeader, Select, Table, Badge } from '../components/ui'
import { PrintDocument } from '../components/PrintDocument'
import { VoucherActions } from '../components/VoucherActions'
import { useApp } from '../components/AppContext'
import { useRows } from '../lib/useRows'
import { listRows, upsertRow } from '../lib/api'
import { exportRows } from '../lib/excel'
import { dateLabel, money, statusTone } from '../lib/format'
import type { Row } from '../lib/types'

export const InvoicesPage = () => {
  const { session, permissions, notify } = useApp()
  const invoices = useRows('invoices', { order: 'created_at', ascending: false })
  const displaySettings = useRows('invoice_display_settings', {})
  const [search, setSearch] = useState('')
  const [printDoc, setPrintDoc] = useState<Row | null>(null)
  const [printItems, setPrintItems] = useState<Row[]>([])
  const [printOptions, setPrintOptions] = useState<Row>({})
  const [settingsInvoice, setSettingsInvoice] = useState<Row | null>(null)
  const [settings, setSettings] = useState<Row>({
    description_mode: 'short',
    quantity_mode: 'cartons_pcs_per_diaper',
    show_bags: false,
    show_rates: true,
    show_totals: true,
  })
  const [savingSettings, setSavingSettings] = useState(false)

  const settingsByInvoice = useMemo(
    () => new Map(displaySettings.rows.map((setting) => [setting.invoice_id, setting])),
    [displaySettings.rows],
  )

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return invoices.rows.filter((row) =>
      [row.invoice_number, row.customer_name, row.reg_no, row.status].join(' ').toLowerCase().includes(term),
    )
  }, [invoices.rows, search])

  const openPrint = async (row: Row) => {
    try {
      const [items, options] = await Promise.all([
        listRows<Row>('invoice_items', { filters: { invoice_id: row.id }, order: 'created_at' }),
        listRows<Row>('invoice_display_settings', { filters: { invoice_id: row.id }, limit: 1 }),
      ])
      setPrintDoc(row)
      setPrintItems(items)
      setPrintOptions(options[0] || {})
    } catch (cause: any) {
      notify(cause?.message || 'Unable to load invoice', 'error')
    }
  }

  const openSettings = (row: Row) => {
    const existing = settingsByInvoice.get(row.id)
    setSettingsInvoice(row)
    setSettings(
      existing || {
        description_mode: 'short',
        quantity_mode: 'cartons_pcs_per_diaper',
        show_bags: false,
        show_rates: true,
        show_totals: true,
      },
    )
  }

  const saveSettings = async () => {
    if (!settingsInvoice) return
    setSavingSettings(true)
    try {
      await upsertRow(
        'invoice_display_settings',
        {
          company_id: session.company.company_id,
          invoice_id: settingsInvoice.id,
          description_mode: settings.description_mode,
          quantity_mode: settings.quantity_mode,
          show_bags: !!settings.show_bags,
          show_rates: !!settings.show_rates,
          show_totals: !!settings.show_totals,
        },
        'company_id,invoice_id',
      )
      notify('Invoice display settings saved')
      setSettingsInvoice(null)
      await displaySettings.reload()
    } catch (cause: any) {
      notify(cause?.message || 'Unable to save display settings', 'error')
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Sales Tax Invoices"
        subtitle="Posted invoices, tax breakup, payment position and print layouts."
        actions={
          <>
            <Input placeholder="Search invoices…" value={search} onChange={(event) => setSearch(event.target.value)} className="w-64" />
            <Button variant="secondary" onClick={() => exportRows(filtered, `${session.company.company_code}_Invoices`, 'Invoices')}>Export</Button>
          </>
        }
      />
      <Card>
        <Table
          rowKey={(row) => row.id}
          rows={filtered}
          columns={[
            { key: 'invoice_number', label: 'Invoice', render: (row) => <span className="font-semibold text-cyan-300">{row.invoice_number}</span> },
            { key: 'customer_name', label: 'Customer' },
            { key: 'invoice_date', label: 'Date', render: (row) => dateLabel(row.invoice_date) },
            { key: 'reg_no', label: 'Registration', render: (row) => <Badge tone={row.reg_no === 'registered' ? 'green' : 'slate'}>{row.reg_no}</Badge> },
            { key: 'net_receipt_total', label: 'Net', render: (row) => money(row.net_receipt_total, permissions.viewValues) },
            { key: 'paid_amount', label: 'Paid', render: (row) => money(row.paid_amount, permissions.viewValues) },
            { key: 'balance_amount', label: 'Balance', render: (row) => money(row.balance_amount, permissions.viewValues) },
            { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <VoucherActions
                  table="invoices"
                  row={row}
                  label="Invoice"
                  editFields={[
                    { key: 'customer_name', label: 'Customer' },
                    { key: 'invoice_date', label: 'Invoice Date', type: 'date' },
                    { key: 'due_date', label: 'Due Date', type: 'date' },
                  ]}
                  onPrint={() => void openPrint(row)}
                  extra={<Button size="sm" variant="secondary" onClick={() => openSettings(row)}>Layout</Button>}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal open={!!settingsInvoice} title={`Invoice Layout — ${settingsInvoice?.invoice_number || ''}`} onClose={() => setSettingsInvoice(null)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Description">
            <Select value={settings.description_mode} onChange={(event) => setSettings({ ...settings, description_mode: event.target.value })}>
              <option value="short">Short invoice name</option>
              <option value="full">Full kind name</option>
            </Select>
          </Field>
          <Field label="Quantity Format">
            <Select value={settings.quantity_mode} onChange={(event) => setSettings({ ...settings, quantity_mode: event.target.value })}>
              <option value="cartons_pcs_per_diaper">Cartons / Pcs per diaper</option>
              <option value="cartons_bags_pcs_per_carton">Cartons / Bags / Pcs per carton</option>
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={!!settings.show_bags} onChange={(event) => setSettings({ ...settings, show_bags: event.target.checked })} />
            Show bags column
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={!!settings.show_rates} onChange={(event) => setSettings({ ...settings, show_rates: event.target.checked })} />
            Show rates
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={!!settings.show_totals} onChange={(event) => setSettings({ ...settings, show_totals: event.target.checked })} />
            Show totals
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setSettingsInvoice(null)}>Cancel</Button>
          <Button onClick={() => void saveSettings()} disabled={savingSettings}>{savingSettings ? 'Saving…' : 'Save Layout'}</Button>
        </div>
      </Modal>

      {printDoc && (
        <PrintDocument title="Sales Tax Invoice" doc={printDoc} items={printItems} options={printOptions} onClose={() => setPrintDoc(null)} />
      )}
    </div>
  )
}
