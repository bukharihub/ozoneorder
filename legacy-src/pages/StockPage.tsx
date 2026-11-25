import { useMemo, useRef, useState } from 'react'
import { Button, Card, Field, Input, PageHeader, Select, Table, Badge } from '../components/ui'
import { useApp } from '../components/AppContext'
import { useRows } from '../lib/useRows'
import { insertRow, insertRows } from '../lib/api'
import { exportRows, readRows } from '../lib/excel'
import { dateLabel, money, num, today } from '../lib/format'
import type { Row } from '../lib/types'

export const StockPage = () => {
  const { session, permissions, notify } = useApp()
  const stock = useRows('v_fg_stock_balance', { order: 'full_kind_name' })
  const products = useRows('products', { order: 'full_kind_name' })
  const fileRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(false)

  const productMap = useMemo(() => new Map(products.rows.map((product) => [product.id, product])), [products.rows])

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return stock.rows.filter((row) =>
      [row.sku, row.full_kind_name, row.customer_type, row.invoice_short_name]
        .join(' ')
        .toLowerCase()
        .includes(term),
    )
  }, [stock.rows, search])

  const exportable = filtered.map((row) => {
    const product = productMap.get(row.product_id) || {}
    return {
      sku: row.sku,
      full_kind_name: row.full_kind_name,
      customer_type: row.customer_type,
      cnts_size: row.cnts_size,
      bags_size: row.bags_size,
      closing_cartons: row.closing_cartons,
      closing_bags: row.closing_bags,
      closing_diapers: row.closing_diapers,
      rate_per_carton: product.rate_per_carton || 0,
      stock_value: Number(row.closing_cartons || 0) * Number(product.rate_per_carton || 0),
      as_of_date: row.as_of_date,
    }
  })

  const downloadTemplate = () =>
    exportRows(
      [
        {
          sku: products.rows[0]?.sku || 'SKU',
          entry_date: today(),
          entry_type: 'excel_addition',
          cartons: 100,
          bags: 800,
          diapers: 40000,
          reference_no: 'FG-IMPORT-001',
          notes: 'Imported stock',
        },
      ],
      'Ozone_FG_Stock_Template',
      'FG Stock',
    )

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const imported = await readRows(file)
      const bySku = new Map<string, Row>()
      products.rows.forEach((product) => bySku.set(String(product.sku), product))
      const batch = await insertRow<Row>('fg_stock_batches', {
        company_id: session.company.company_id,
        batch_number: `FG-${Date.now()}`,
        file_name: file.name,
        sheet_name: 'Imported',
        row_count: imported.length,
        uploaded_by: session.user.id,
        notes: 'Finished goods stock upload',
      })
      const mapped: Row[] = []
      const rejected: string[] = []
      imported.forEach((row, index) => {
        const product = bySku.get(String(row.sku || '').trim())
        if (!product || !product.id) {
          rejected.push(String(row.sku || `row ${index + 1}`))
          return
        }
        mapped.push({
          company_id: session.company.company_id,
          entry_date: row.entry_date || today(),
          product_id: product.id,
          entry_type: ['opening', 'production', 'excel_addition'].includes(String(row.entry_type))
            ? String(row.entry_type)
            : 'excel_addition',
          cartons: Number(row.cartons || 0),
          bags: Number(row.bags || 0),
          diapers: Number(row.diapers || 0),
          reference_no: String(row.reference_no || `BATCH-${batch.batch_number}-${index + 1}`),
          batch_id: batch.id,
          source_file: file.name,
          notes: String(row.notes || ''),
          created_by: session.user.id,
        })
      })
      if (mapped.length) await insertRows('fg_stock_entries', mapped)
      notify(`${mapped.length} stock rows imported${rejected.length ? `, ${rejected.length} skipped` : ''}`)
      await stock.reload()
    } catch (cause: any) {
      notify(cause?.message || 'Unable to import stock', 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <PageHeader
        title="Finished Goods Stock"
        subtitle="Live carton, bag and diaper balances by product and customer type."
        actions={
          <>
            <Input placeholder="Search stock…" value={search} onChange={(event) => setSearch(event.target.value)} className="w-64" />
            <Button variant="secondary" onClick={downloadTemplate}>Template</Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={!permissions.uploadFgExcel || uploading}>
              {uploading ? 'Uploading…' : 'Upload Stock'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void upload(file)
              }}
            />
            <Button variant="secondary" onClick={() => exportRows(exportable, `${session.company.company_code}_FG_Stock`, 'Stock')}>
              Export
            </Button>
          </>
        }
      />
      <Card>
        <Table
          rowKey={(row) => row.product_id}
          rows={filtered}
          columns={[
            { key: 'sku', label: 'SKU', render: (row) => <span className="font-semibold text-cyan-300">{row.sku}</span> },
            { key: 'full_kind_name', label: 'Product' },
            { key: 'customer_type', label: 'Type', render: (row) => <Badge tone={row.customer_type === 'registered' ? 'green' : 'slate'}>{row.customer_type}</Badge> },
            { key: 'packing', label: 'Packing', render: (row) => `${num(row.cnts_size)} × ${num(row.bags_size)}` },
            { key: 'closing_cartons', label: 'Cartons', render: (row) => num(row.closing_cartons) },
            { key: 'closing_bags', label: 'Bags', render: (row) => num(row.closing_bags) },
            { key: 'closing_diapers', label: 'Diapers', render: (row) => num(row.closing_diapers) },
            {
              key: 'value',
              label: 'Stock Value',
              render: (row) => money(Number(row.closing_cartons || 0) * Number(productMap.get(row.product_id)?.rate_per_carton || 0), permissions.viewValues),
            },
            { key: 'as_of_date', label: 'As Of', render: (row) => dateLabel(row.as_of_date) },
          ]}
        />
      </Card>
    </div>
  )
}
