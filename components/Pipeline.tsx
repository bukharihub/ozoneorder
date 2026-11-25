'use client'

import React from 'react'
import { ArrowRight } from 'lucide-react'
import { pipelineLinks } from '@/lib/pipeline'
import type { AppPage, LedgerRow, PipelineSeed } from '@/lib/types'
import { useApp } from './AppProvider'
import { Button } from './Ui'

interface Crumb {
  key: string
  label: string
  page: AppPage
  seed: PipelineSeed
}

export function PipelineBreadcrumb({ row, ledger }: { row: LedgerRow | null; ledger: LedgerRow[] }) {
  const { navigate } = useApp()
  if (!row) return null
  const links = pipelineLinks(ledger, row)
  const crumbs: Crumb[] = []
  if (links.so) crumbs.push({ key: links.so.id, label: links.so.voucher_no, page: 'orders', seed: { soNo: links.so.voucher_no } })
  if (links.gdn) crumbs.push({ key: links.gdn.id, label: links.gdn.voucher_no, page: 'gdn', seed: { gdnNo: links.gdn.voucher_no } })
  if (links.invoice) crumbs.push({ key: links.invoice.id, label: links.invoice.voucher_no, page: 'invoices', seed: { invoiceNo: links.invoice.voucher_no } })
  if (links.receipt) crumbs.push({ key: links.receipt.id, label: links.receipt.voucher_no, page: 'receipts', seed: { invoiceNo: links.invoice?.voucher_no } })

  return (
    <div className="print-hidden glass-static mb-3 flex flex-wrap items-center gap-1 rounded-lg px-3 py-2 text-[11px]">
      {crumbs.map((crumb, index) => (
        <React.Fragment key={crumb.key}>
          {index > 0 && <ArrowRight className="h-3 w-3 text-slate-400" />}
          <button className="font-bold text-blue-700 hover:underline" onClick={() => navigate(crumb.page, crumb.seed)}>{crumb.label}</button>
        </React.Fragment>
      ))}
    </div>
  )
}

export function NextStepButton({ row, ledger }: { row: LedgerRow; ledger: LedgerRow[] }) {
  const { navigate } = useApp()
  const links = pipelineLinks(ledger, row)
  let page: AppPage = 'dashboard'
  let seed: PipelineSeed = {}
  let label = 'View Customer Ledger'

  if (row.voucher_type === 'SALES_ORDER') {
    page = 'gdn'
    seed = { soNo: row.voucher_no }
    label = 'Create GDN & Gate Pass'
  } else if (row.voucher_type === 'GDN_GATE_PASS') {
    page = 'invoices'
    seed = { gdnNo: links.gdn?.voucher_no || row.voucher_no }
    label = 'Generate Sales Tax Invoice'
  } else if (row.voucher_type === 'SALES_TAX_INVOICE') {
    page = 'receipts'
    seed = { invoiceNo: row.voucher_no }
    label = 'Record Bank Receipt'
  } else {
    page = 'ledger'
    label = 'View Customer Ledger'
  }

  return (
    <Button className="print-hidden" onClick={() => navigate(page, seed)}>
      Proceed to Next Step ➔ <span className="font-normal">{label}</span>
    </Button>
  )
}
