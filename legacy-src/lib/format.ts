const moneyFormatter = new Intl.NumberFormat('en-PK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const qtyFormatter = new Intl.NumberFormat('en-PK', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
})

export const money = (value: any, visible = true): string => {
  if (!visible) return '••••••'
  const parsed = Number(value)
  return moneyFormatter.format(Number.isFinite(parsed) ? parsed : 0)
}

export const num = (value: any): string => {
  const parsed = Number(value)
  return qtyFormatter.format(Number.isFinite(parsed) ? parsed : 0)
}

export const dateLabel = (value: any): string => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const dateTimeLabel = (value: any): string => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const today = (): string => new Date().toISOString().slice(0, 10)

export const fileStamp = (): string => new Date().toISOString().slice(0, 10)

export const titleCase = (value: any): string => {
  const text = String(value || '').replace(/[_-]+/g, ' ')
  return text.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export const statusTone = (status: any): 'green' | 'amber' | 'red' | 'indigo' | 'slate' => {
  const value = String(status || '').toLowerCase()
  if (['paid', 'posted', 'cleared', 'approved', 'out', 'invoiced', 'active'].includes(value)) return 'green'
  if (['pending', 'draft', 'partially_paid', 'issued', 'received'].includes(value)) return 'amber'
  if (['rejected', 'cancelled', 'bounced', 'expired'].includes(value)) return 'red'
  if (['gdn_dispatched', 'gate_pass_out'].includes(value)) return 'indigo'
  return 'slate'
}

export const safeText = (value: any): string => String(value ?? '')
