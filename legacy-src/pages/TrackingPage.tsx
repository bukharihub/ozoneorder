import { useMemo, useState } from 'react'
import { Button, Card, PageHeader, Select, Table, Badge } from '../components/ui'
import { useApp } from '../components/AppContext'
import { useRows } from '../lib/useRows'
import { exportRows } from '../lib/excel'
import { dateLabel } from '../lib/format'
import type { Row } from '../lib/types'

export const TrackingPage = () => {
  const { session } = useApp()
  const tracking = useRows('v_tracking', { order: 'event_date', ascending: false })
  const customers = useRows('customers', { order: 'business_name' })
  const [customerId, setCustomerId] = useState('')

  const filtered = useMemo(
    () => (customerId ? tracking.rows.filter((row) => row.customer_id === customerId) : tracking.rows),
    [tracking.rows, customerId],
  )

  return (
    <div>
      <PageHeader
        title="Order Tracking"
        subtitle="Customer-visible pipeline from quotation through payment realization."
        actions={
          <>
            <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="w-72">
              <option value="">All Customers</option>
              {customers.rows.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customer_code} — {customer.business_name || customer.customer_name}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={() => exportRows(filtered, `${session.company.company_code}_Tracking`, 'Tracking')}>Export</Button>
          </>
        }
      />
      <Card>
        <Table
          rowKey={(row) => `${row.stage_order}-${row.reference_no}-${row.event_date}`}
          rows={filtered}
          columns={[
            { key: 'stage_order', label: 'Step', render: (row) => <span className="font-bold text-cyan-300">{row.stage_order}</span> },
            { key: 'stage', label: 'Stage', render: (row) => <Badge tone="indigo">{row.stage}</Badge> },
            { key: 'reference_no', label: 'Reference' },
            { key: 'event_date', label: 'Date', render: (row) => dateLabel(row.event_date) },
            { key: 'status', label: 'Status', render: (row) => <Badge tone="slate">{row.status}</Badge> },
          ]}
        />
      </Card>
    </div>
  )
}
