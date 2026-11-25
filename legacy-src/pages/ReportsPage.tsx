import { useMemo } from 'react'
import { Button, Card, PageHeader, Table } from '../components/ui'
import { useApp } from '../components/AppContext'
import { useRows } from '../lib/useRows'
import { exportSheets } from '../lib/excel'
import { money, num } from '../lib/format'
import type { Row } from '../lib/types'

const dynamicColumns = (rows: Row[], visible: boolean) => {
  const keys = rows.length ? Object.keys(rows[0]).filter((key) => key !== 'company_id') : []
  return keys.map((key) => ({
    key,
    label: key,
    render: (row: Row) => {
      const value = row[key]
      if (/value|amount|rate|total|tax|excluding|receipt/i.test(key)) return money(value, visible)
      if (/qty|bags|cartons|diapers/i.test(key)) return num(value)
      if (/date/i.test(key)) return String(value || '').slice(0, 10)
      return String(value ?? '')
    },
  }))
}

export const ReportsPage = () => {
  const { session, permissions } = useApp()
  const registered = useRows('v_sales_report_registered', { order: 'date', ascending: false, limit: 500 })
  const unregistered = useRows('v_sales_report_unregistered', { order: 'date', ascending: false, limit: 500 })
  const aging = useRows('v_aging_report', { order: 'due_date', limit: 500 })
  const pipeline = useRows('v_pipeline_pending', { order: 'doc_date', ascending: false, limit: 500 })

  const registeredColumns = useMemo(() => dynamicColumns(registered.rows, permissions.viewValues), [registered.rows, permissions.viewValues])
  const unregisteredColumns = useMemo(() => dynamicColumns(unregistered.rows, permissions.viewValues), [unregistered.rows, permissions.viewValues])

  const download = () =>
    exportSheets(
      [
        { name: 'Registered Sales', rows: registered.rows },
        { name: 'Unregistered Sales', rows: unregistered.rows },
        { name: 'Aging', rows: aging.rows },
        { name: 'Pipeline', rows: pipeline.rows },
      ],
      `${session.company.company_code}_Reports`,
    )

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Statutory sales registers, aging buckets and pending pipeline."
        actions={<Button variant="secondary" onClick={download}>Export Workbook</Button>}
      />
      <div className="space-y-6">
        <Card>
          <div className="border-b border-slate-800 px-5 py-4 font-bold text-white">Registered Sales Register</div>
          <Table
            rowKey={(row) => `${row.invoice_number}-${row.item}-${row.date}`}
            rows={registered.rows}
            columns={registeredColumns as any}
          />
        </Card>
        <Card>
          <div className="border-b border-slate-800 px-5 py-4 font-bold text-white">Unregistered Sales Register</div>
          <Table
            rowKey={(row) => `${row.invoice_number}-${row.item}-${row.date}`}
            rows={unregistered.rows}
            columns={unregisteredColumns as any}
          />
        </Card>
        <Card>
          <div className="border-b border-slate-800 px-5 py-4 font-bold text-white">Receivables Aging</div>
          <Table
            rowKey={(row) => row.invoice_id}
            rows={aging.rows}
            columns={[
              { key: 'invoice_number', label: 'Invoice' },
              { key: 'business_name', label: 'Customer' },
              { key: 'due_date', label: 'Due', render: (row) => String(row.due_date || '').slice(0, 10) },
              { key: 'aging_bucket', label: 'Bucket' },
              { key: 'balance_amount', label: 'Balance', render: (row) => money(row.balance_amount, permissions.viewValues) },
            ]}
          />
        </Card>
        <Card>
          <div className="border-b border-slate-800 px-5 py-4 font-bold text-white">Pending Pipeline</div>
          <Table
            rowKey={(row) => `${row.stage}-${row.doc_id}`}
            rows={pipeline.rows}
            columns={[
              { key: 'stage', label: 'Stage' },
              { key: 'reference_no', label: 'Reference' },
              { key: 'doc_date', label: 'Date', render: (row) => String(row.doc_date || '').slice(0, 10) },
              { key: 'status', label: 'Status' },
            ]}
          />
        </Card>
      </div>
    </div>
  )
}
