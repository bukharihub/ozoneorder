export const normalizeLinkedCustomerIds = (user: {
  linked_customer_id?: string | null
  linked_customer_ids?: string[] | null
}): string[] => {
  const ids = Array.isArray(user.linked_customer_ids)
    ? user.linked_customer_ids.map((value) => String(value)).filter(Boolean)
    : []
  if (ids.length) return ids
  return user.linked_customer_id ? [user.linked_customer_id] : []
}

export const parseLinkedCustomerIds = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : []
    } catch {
      return []
    }
  }
  return []
}

export interface BookerInfo {
  id: string
  full_name: string
  linked_customer_ids: string[]
}

export const normalizeBookers = (rows: unknown[]): BookerInfo[] => rows.map((row: any) => ({
  id: String(row?.id || ''),
  full_name: String(row?.full_name || ''),
  linked_customer_ids: parseLinkedCustomerIds(row?.linked_customer_ids),
})).filter((row) => row.id && row.full_name)

export const bookerForCustomer = (bookers: BookerInfo[], customerId?: string | null): BookerInfo | undefined => {
  if (!customerId) return undefined
  return bookers.find((booker) => booker.linked_customer_ids.includes(customerId))
}

export const bookerForCustomers = (bookers: BookerInfo[], customerIds: string[]): BookerInfo | undefined => {
  if (!customerIds.length) return undefined
  return bookers
    .map((booker) => ({ booker, matches: customerIds.filter((id) => booker.linked_customer_ids.includes(id)).length }))
    .filter((entry) => entry.matches > 0)
    .sort((a, b) => b.matches - a.matches || a.booker.full_name.localeCompare(b.booker.full_name))[0]?.booker
}
