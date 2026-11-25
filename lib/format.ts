export const money = (value: any, decimals = 2) => {
  const number = Number(value || 0)
  return number.toLocaleString('en-PK', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export const quantity = (value: any) => {
  const number = Number(value || 0)
  return number.toLocaleString('en-PK', { maximumFractionDigits: 3 })
}

export const dateDMY = (value: any) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${String(date.getUTCDate()).padStart(2, '0')}-${months[date.getUTCMonth()]}-${date.getUTCFullYear()}`
}

export const todayIso = () => new Date().toISOString().slice(0, 10)

export const errorMessage = (error: any) =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : 'Something went wrong'
