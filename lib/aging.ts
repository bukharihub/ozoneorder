import type { Customer, LedgerRow } from './types'

export interface AgingRow {
  customer: Customer
  current: number
  days31to60: number
  days61to90: number
  days90plus: number
  total: number
}

const daysSince = (date: string) => {
  const then = new Date(date).getTime()
  return Math.max(0, Math.floor((Date.now() - then) / 86400000))
}

export const computeAging = (customers: Customer[], ledger: LedgerRow[]): AgingRow[] => {
  return customers.map((customer) => {
    const receipts = ledger
      .filter((row) => row.customer_id === customer.id && row.voucher_type === 'BANK_RECEIPT')
      .sort((a, b) => a.voucher_date.localeCompare(b.voucher_date))
      .map((row) => ({ remaining: Number(row.bank_receipt_amount), date: row.voucher_date }))

    const buckets = { current: 0, days31to60: 0, days61to90: 0, days90plus: 0 }
    const invoices = ledger
      .filter((row) => row.customer_id === customer.id && row.voucher_type === 'SALES_TAX_INVOICE')
      .sort((a, b) => a.voucher_date.localeCompare(b.voucher_date))

    invoices.forEach((invoice) => {
      let outstanding = Number(invoice.net_invoice_total)
      for (const receipt of receipts) {
        if (outstanding <= 0) break
        if (receipt.remaining <= 0) continue
        const used = Math.min(outstanding, receipt.remaining)
        receipt.remaining -= used
        outstanding -= used
      }
      if (outstanding <= 0) return
      const age = daysSince(invoice.voucher_date)
      if (age <= 30) buckets.current += outstanding
      else if (age <= 60) buckets.days31to60 += outstanding
      else if (age <= 90) buckets.days61to90 += outstanding
      else buckets.days90plus += outstanding
    })

    return {
      customer,
      ...buckets,
      total: buckets.current + buckets.days31to60 + buckets.days61to90 + buckets.days90plus,
    }
  }).filter((row) => row.total > 0).sort((a, b) => b.total - a.total)
}

export const currentQuarter = (date = new Date()) => `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`
