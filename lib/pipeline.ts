import type { LedgerRow, VoucherStatus } from './types'

export type OrderStage = 1 | 2 | 3 | 4

export interface PipelineLinks {
  so: LedgerRow | null
  gdn: LedgerRow | null
  invoice: LedgerRow | null
  receipt: LedgerRow | null
}

const num = (value: any) => Number(value || 0)

export const gdnsForSo = (ledger: LedgerRow[], soNo?: string) =>
  soNo ? ledger.filter((row) => row.voucher_type === 'GDN_GATE_PASS' && row.linked_so_no === soNo) : []

export const invoiceForGdn = (ledger: LedgerRow[], gdnNo?: string) =>
  gdnNo ? ledger.find((row) => row.voucher_type === 'SALES_TAX_INVOICE' && row.linked_gdn_no === gdnNo) || null : null

export const receiptsForInvoice = (ledger: LedgerRow[], invoiceNo?: string) =>
  invoiceNo ? ledger.filter((row) => row.voucher_type === 'BANK_RECEIPT' && row.linked_gdn_no === invoiceNo) : []

export const paidAmount = (ledger: LedgerRow[], invoiceNo?: string) =>
  receiptsForInvoice(ledger, invoiceNo).reduce((sum, row) => sum + num(row.bank_receipt_amount), 0)

export const balanceDue = (ledger: LedgerRow[], invoice: LedgerRow | null) =>
  invoice ? Math.max(num(invoice.net_invoice_total) - paidAmount(ledger, invoice.voucher_no), 0) : 0

export const invoiceStatus = (ledger: LedgerRow[], invoice: LedgerRow | null): VoucherStatus => {
  if (!invoice) return 'INVOICED'
  const due = balanceDue(ledger, invoice)
  if (due <= 0) return 'PAID'
  if (paidAmount(ledger, invoice.voucher_no) > 0) return 'PARTIAL_PAID'
  return 'INVOICED'
}

export const soProgress = (ledger: LedgerRow[], so: LedgerRow) => {
  const ordered = so.line_items.reduce((sum, item) => sum + num(item.ordered_ctns), 0)
  const delivered = gdnsForSo(ledger, so.voucher_no)
    .flatMap((row) => row.line_items)
    .reduce((sum, item) => sum + num(item.delivered_ctns), 0)
  return { ordered, delivered, pending: Math.max(ordered - delivered, 0) }
}

export const orderStage = (ledger: LedgerRow[], so: LedgerRow): { stage: OrderStage; status: VoucherStatus } => {
  const gdns = gdnsForSo(ledger, so.voucher_no)
  const progress = soProgress(ledger, so)
  const invoice = gdns.map((gdn) => invoiceForGdn(ledger, gdn.voucher_no)).find(Boolean)
  if (invoice) return { stage: 4, status: invoiceStatus(ledger, invoice) }
  if (gdns.length && progress.delivered <= 0) return { stage: 1, status: 'PENDING' }
  if (gdns.length && progress.delivered < progress.ordered) return { stage: 2, status: 'PARTIAL_DELIVERED' }
  if (gdns.length) return { stage: 3, status: 'DELIVERED' }
  return { stage: 1, status: so.status || 'PENDING' }
}

export const pipelineLinks = (ledger: LedgerRow[], row: LedgerRow): PipelineLinks => {
  if (row.voucher_type === 'SALES_ORDER') {
    const gdns = gdnsForSo(ledger, row.voucher_no)
    const gdn = gdns[gdns.length - 1] || null
    const invoice = gdn ? invoiceForGdn(ledger, gdn.voucher_no) : null
    const receipt = invoice ? receiptsForInvoice(ledger, invoice.voucher_no).slice(-1)[0] || null : null
    return { so: row, gdn, invoice, receipt }
  }
  if (row.voucher_type === 'GDN_GATE_PASS') {
    const so = ledger.find((item) => item.voucher_type === 'SALES_ORDER' && item.voucher_no === row.linked_so_no) || null
    const invoice = invoiceForGdn(ledger, row.voucher_no)
    const receipt = invoice ? receiptsForInvoice(ledger, invoice.voucher_no).slice(-1)[0] || null : null
    return { so, gdn: row, invoice, receipt }
  }
  if (row.voucher_type === 'SALES_TAX_INVOICE') {
    const gdn = ledger.find((item) => item.voucher_type === 'GDN_GATE_PASS' && item.voucher_no === row.linked_gdn_no) || null
    const so = ledger.find((item) => item.voucher_type === 'SALES_ORDER' && item.voucher_no === (row.linked_so_no || gdn?.linked_so_no)) || null
    const receipt = receiptsForInvoice(ledger, row.voucher_no).slice(-1)[0] || null
    return { so, gdn, invoice: row, receipt }
  }
  const invoice = ledger.find((item) => item.voucher_type === 'SALES_TAX_INVOICE' && item.voucher_no === row.linked_gdn_no) || null
  const gdn = invoice
    ? ledger.find((item) => item.voucher_type === 'GDN_GATE_PASS' && item.voucher_no === invoice.linked_gdn_no) || null
    : null
  const so = ledger.find((item) => item.voucher_type === 'SALES_ORDER' && item.voucher_no === (row.linked_so_no || gdn?.linked_so_no)) || null
  return { so, gdn, invoice, receipt: row }
}

export const pendingSoRows = (ledger: LedgerRow[]) =>
  ledger.filter((row) => row.voucher_type === 'SALES_ORDER'
    && ['PENDING', 'PARTIAL_DELIVERED'].includes(row.status)
    && row.line_items.some((item) => num(item.pending_ctns ?? num(item.ordered_ctns) - num(item.delivered_ctns)) > 0))

export const deliverableGdnRows = (ledger: LedgerRow[]) =>
  ledger.filter((row) => row.voucher_type === 'GDN_GATE_PASS'
    && row.status === 'DELIVERED'
    && !invoiceForGdn(ledger, row.voucher_no))

export const unpaidInvoiceRows = (ledger: LedgerRow[]) =>
  ledger.filter((row) => row.voucher_type === 'SALES_TAX_INVOICE' && balanceDue(ledger, row) > 0)
