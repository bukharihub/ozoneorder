import { Button, Card, Stat, Table, Badge } from '../components/ui'
import { useApp } from '../components/AppContext'
import { useRows } from '../lib/useRows'
import { dateLabel, money, num, statusTone } from '../lib/format'
import { exportSheets } from '../lib/excel'
import type { PageKey } from '../components/AppLayout'

export const DashboardPage = ({ onNavigate }: { onNavigate: (page: PageKey) => void }) => {
  const { session, permissions, refresh } = useApp()
  const quotations = useRows('quotations', { order: 'created_at', ascending: false, limit: 200 })
  const orders = useRows('sale_orders', { order: 'created_at', ascending: false, limit: 200 })
  const invoices = useRows('invoices', { order: 'created_at', ascending: false, limit: 200 })
  const receipts = useRows('bank_cash_receipts', { order: 'created_at', ascending: false, limit: 200 })
  const pipeline = useRows('v_pipeline_pending', { order: 'doc_date', ascending: false, limit: 200 })
  const aging = useRows('v_aging_report', { order: 'due_date', limit: 200 })

  const visible = permissions.viewValues
  const invoiceValue = invoices.rows.reduce((sum, row) => sum + Number(row.net_receipt_total || 0), 0)
  const receiptValue = receipts.rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const outstanding = aging.rows.reduce((sum, row) => sum + Number(row.balance_amount || 0), 0)

  const download = () =>
    exportSheets(
      [
        { name: 'Quotations', rows: quotations.rows },
        { name: 'Sale Orders', rows: orders.rows },
        { name: 'Invoices', rows: invoices.rows },
        { name: 'Receipts', rows: receipts.rows },
        { name: 'Pipeline', rows: pipeline.rows },
        { name: 'Aging', rows: aging.rows },
      ],
      `${session.company.company_code}_Dashboard`,
    )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Operations Dashboard</h2>
          <p className="mt-1 text-sm text-slate-400">Live status across the complete order-to-cash cycle.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={refresh}>
            Refresh
          </Button>
          <Button variant="secondary" onClick={download}>
            Export Workbook
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Pending Quotations" value={quotations.rows.filter((row) => row.status === 'pending').length} />
        <Stat label="Open Sale Orders" value={orders.rows.filter((row) => row.status !== 'paid' && row.status !== 'cancelled').length} />
        <Stat label="Invoiced Value" value={money(invoiceValue, visible)} />
        <Stat label="Received Value" value={money(receiptValue, visible)} />
        <Stat label="Outstanding" value={money(outstanding, visible)} tone="amber" />
        <Stat label="Invoices" value={invoices.rows.length} tone="amber" />
        <Stat label="Receipts" value={receipts.rows.length} tone="amber" />
        <Stat label="Pipeline Items" value={pipeline.rows.length} tone="amber" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <h3 className="font-bold text-white">Pending Pipeline</h3>
            <Button size="sm" variant="ghost" onClick={() => onNavigate('orders')}>
              View orders →
            </Button>
          </div>
          <Table
            rowKey={(row) => `${row.stage}-${row.doc_id}`}
            rows={pipeline.rows.slice(0, 12)}
            columns={[
              { key: 'stage', label: 'Stage', render: (row) => <Badge tone="indigo">{row.stage}</Badge> },
              { key: 'reference_no', label: 'Reference' },
              { key: 'doc_date', label: 'Date', render: (row) => dateLabel(row.doc_date) },
              { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
            ]}
          />
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
            <h3 className="font-bold text-white">Receivables Aging</h3>
            <Button size="sm" variant="ghost" onClick={() => onNavigate('ledger')}>
              View ledger →
            </Button>
          </div>
          <Table
            rowKey={(row) => row.invoice_id}
            rows={aging.rows.slice(0, 12)}
            columns={[
              { key: 'invoice_number', label: 'Invoice' },
              { key: 'business_name', label: 'Customer' },
              { key: 'aging_bucket', label: 'Bucket', render: (row) => <Badge tone={statusTone(row.aging_bucket)}>{row.aging_bucket}</Badge> },
              { key: 'balance_amount', label: 'Balance', render: (row) => money(row.balance_amount, visible) },
            ]}
          />
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-300">Quick Actions</h3>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => onNavigate('quotations')}>New Quotation</Button>
          <Button variant="secondary" onClick={() => onNavigate('gdn')}>Prepare Delivery</Button>
          <Button variant="secondary" onClick={() => onNavigate('gatepass')}>Issue Gate Pass</Button>
          <Button variant="secondary" onClick={() => onNavigate('invoices')}>Post Invoice</Button>
          <Button variant="secondary" onClick={() => onNavigate('receipts')}>Record Receipt</Button>
        </div>
      </Card>

      {(quotations.error || orders.error || invoices.error || pipeline.error) && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300">
          {quotations.error || orders.error || invoices.error || pipeline.error}
        </div>
      )}
      <div className="text-xs text-slate-600">Carton quantities use Up to {num(0)} decimals. All monetary values follow company settings.</div>
    </div>
  )
}
