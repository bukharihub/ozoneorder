import { calculateTotals, lineExclusive, round2 } from './calc'
import type { Customer, LineItem, Product, VoucherTotals } from './types'

export type BatchCarts = Record<string, Record<string, number>>

export interface OrderLineDetail {
  product: Product
  cartons: number
  pcs: number
  rate: number
  exclusive: number
}

export interface PreparedCustomerOrder {
  details: OrderLineDetail[]
  totals: VoucherTotals
  lineItems: LineItem[]
  totalCartons: number
  totalPcs: number
}

const round3 = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000

const asQty = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? round3(parsed) : 0
}

export const registrationProductType = (status: Customer['registration_status'] | undefined) =>
  status === 'Register' ? 'REGISTERED' : 'UNREGISTERED'

export const registrationLabel = (status: Customer['registration_status'] | undefined) =>
  status === 'Register' ? 'Registered' : 'Unregistered'

export const registrationGroupLabel = (status: Customer['registration_status'] | undefined) =>
  status === 'Register' ? 'Registered Group' : 'Unregistered Group'

export const cartQty = (cart: Record<string, number> | undefined, productId: string) => asQty(cart?.[productId])

export const batchQty = (carts: BatchCarts, customerId: string, productId: string) =>
  asQty(carts[customerId]?.[productId])

export const sortCustomerQueue = (customers: Customer[], selectedIds: string[]) => {
  const byId = new Map(customers.map((customer) => [customer.id, customer]))
  const uniqueIds = Array.from(new Set(selectedIds))
  const originalIndex = new Map(uniqueIds.map((id, index) => [id, index]))
  return uniqueIds.filter((id) => byId.has(id)).sort((a, b) => {
    const aRank = byId.get(a)!.registration_status === 'Register' ? 0 : 1
    const bRank = byId.get(b)!.registration_status === 'Register' ? 0 : 1
    return aRank - bRank || originalIndex.get(a)! - originalIndex.get(b)!
  })
}

export const remainingStock = (product: Product, queue: string[], carts: BatchCarts, queueIndex: number) => {
  const reserved = queue.slice(0, queueIndex).reduce((sum, customerId) => sum + batchQty(carts, customerId, product.id), 0)
  return Math.max(0, round3(Number(product.current_stock_ctns || 0) - reserved))
}

export const clampCartons = (value: unknown, available: number) =>
  Math.min(asQty(value), Math.max(0, round3(available)))

export const prepareCustomerOrder = (
  customer: Customer,
  eligibleProducts: Product[],
  cart: Record<string, number> | undefined,
): PreparedCustomerOrder => {
  const rateFor = (product: Product) => customer.registration_status === 'Unregister'
    ? Number(product.per_diaper_rate || 0)
    : Number(product.per_carton_rate || 0)
  const details = eligibleProducts.reduce<OrderLineDetail[]>((result, product) => {
    const cartons = cartQty(cart, product.id)
    if (!cartons) return result
    const pcs = round3(cartons * Number(product.pcs_per_carton || 0))
    const rate = rateFor(product)
    const line: OrderLineDetail = {
      product,
      cartons,
      pcs,
      rate,
      exclusive: lineExclusive(customer.registration_status, {
        cartons,
        pcs,
        diaperRate: rate,
        cartonRate: rate,
      }),
    }
    result.push(line)
    return result
  }, [])
  const totals = calculateTotals(customer.registration_status, Number(customer.tax_rate_236g || 0.001), details.map((line) => ({
    cartons: line.cartons,
    pcs: line.pcs,
    diaperRate: line.rate,
    cartonRate: line.rate,
  })))
  const lineItems: LineItem[] = details.map((line) => ({
    product_id: line.product.id,
    product_name: line.product.product_name,
    hs_code: line.product.hs_code,
    size_category: line.product.size_category,
    pcs_per_carton: line.product.pcs_per_carton,
    ordered_ctns: line.cartons,
    delivered_ctns: 0,
    pending_ctns: line.cartons,
    pcs: line.pcs,
    rate: line.rate,
    exclusive_value: line.exclusive,
  }))
  return {
    details,
    totals,
    lineItems,
    totalCartons: round3(lineItems.reduce((sum, item) => sum + item.ordered_ctns, 0)),
    totalPcs: round3(lineItems.reduce((sum, item) => sum + item.pcs, 0)),
  }
}

export const validateBatchStock = (
  queue: string[],
  customersById: Map<string, Customer>,
  products: Product[],
  carts: BatchCarts,
  queueLimit = queue.length,
) => {
  const used: Record<string, number> = {}
  const limit = Math.min(queueLimit, queue.length)
  for (let index = 0; index < limit; index += 1) {
    const customerId = queue[index]
    const customer = customersById.get(customerId)
    if (!customer) return 'A selected customer profile is no longer available. Please refresh and try again.'
    if (customer.registration_status !== 'Register' && customer.registration_status !== 'Unregister') {
      return `${customer.business_name} has an invalid registration status.`
    }
    const expectedType = registrationProductType(customer.registration_status)
    for (const product of products) {
      if (product.product_type !== expectedType) continue
      const cartons = batchQty(carts, customerId, product.id)
      if (!cartons) continue
      const nextUsed = round3((used[product.id] || 0) + cartons)
      const stock = round3(Number(product.current_stock_ctns || 0))
      if (nextUsed > stock) {
        return `${customer.business_name}: ${product.product_name} exceeds available FG stock (${stock} Ctns).`
      }
      used[product.id] = nextUsed
    }
  }
  return ''
}
