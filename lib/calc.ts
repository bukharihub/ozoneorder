import type { VoucherTotals } from './types'

export interface CalcLine {
  cartons: number
  pcs: number
  diaperRate: number
  cartonRate: number
}

export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export const lineExclusive = (registration: 'Register' | 'Unregister', line: CalcLine) =>
  round2(
    registration === 'Unregister'
      ? line.pcs * line.diaperRate
      : line.cartons * line.cartonRate,
  )

export const calculateTotals = (
  registration: 'Register' | 'Unregister',
  taxRate236g: number,
  lines: CalcLine[],
): VoucherTotals => {
  const exclusive = round2(lines.reduce((sum, line) => sum + lineExclusive(registration, line), 0))
  const salesTax = round2(exclusive * 0.18)
  const furtherTax = registration === 'Unregister' ? round2(exclusive * 0.04) : 0
  const amountBefore236g = round2(exclusive + salesTax + furtherTax)
  const advanceTax = round2(amountBefore236g * Number(taxRate236g || 0))
  const netTotal = round2(amountBefore236g + advanceTax)
  return { exclusive, salesTax, furtherTax, amountBefore236g, advanceTax, netTotal }
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

const underThousand = (value: number): string => {
  if (value < 20) return ONES[value]
  if (value < 100) return [TENS[Math.floor(value / 10)], ONES[value % 10]].filter(Boolean).join(' ')
  return [ONES[Math.floor(value / 100)], 'Hundred', underThousand(value % 100)].filter(Boolean).join(' ')
}

export const amountInWords = (value: number): string => {
  const amount = Math.floor(Math.abs(round2(value)))
  if (amount === 0) return 'Zero'
  const parts: string[] = []
  const crore = Math.floor(amount / 10000000)
  const lakh = Math.floor((amount % 10000000) / 100000)
  const thousand = Math.floor((amount % 100000) / 1000)
  const rest = amount % 1000
  if (crore) parts.push(`${underThousand(crore)} Crore`)
  if (lakh) parts.push(`${underThousand(lakh)} Lakh`)
  if (thousand) parts.push(`${underThousand(thousand)} Thousand`)
  if (rest) parts.push(underThousand(rest))
  return parts.join(' ')
}
