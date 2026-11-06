import type { CartLineInput, CheckoutInput } from './types'

export interface CartLine {
  productId: string
  qty: number
  /** Baht off the whole line */
  discount: number
}

export interface BillDiscount {
  type: 'amount' | 'percent'
  value: number
}

export interface Cart {
  lines: CartLine[]
  customerId: string | null
  billDiscount: BillDiscount
  note: string
  /** The quotation this bill rings up (QT…), so the sale marks it converted */
  quotationNo: string | null
}

export type CartAction =
  /** `max` is the stock on hand (null when the product isn't stock-counted) */
  | { type: 'add'; productId: string; max: number | null }
  | { type: 'qty'; productId: string; qty: number; max: number | null }
  | { type: 'discount'; productId: string; discount: number }
  | { type: 'remove'; productId: string }
  | { type: 'customer'; customerId: string | null }
  | { type: 'billDiscount'; discount: BillDiscount }
  | { type: 'note'; note: string }
  /** Replace the bill with a quotation's lines (prices already discounted to what was quoted) */
  | { type: 'loadQuote'; quotationNo: string; lines: { productId: string; qty: number; discount?: number }[]; customerId: string | null }
  | { type: 'unlinkQuote' }
  | { type: 'clear' }

export const emptyCart: Cart = { lines: [], customerId: null, billDiscount: { type: 'amount', value: 0 }, note: '', quotationNo: null }

const cap = (qty: number, max: number | null) => (max === null ? qty : Math.min(qty, max))

export function cartReducer(cart: Cart, action: CartAction): Cart {
  switch (action.type) {
    case 'add': {
      const found = cart.lines.find((l) => l.productId === action.productId)
      if (found) return cartReducer(cart, { type: 'qty', productId: action.productId, qty: found.qty + 1, max: action.max })
      if (action.max !== null && action.max < 1) return cart
      return { ...cart, lines: [...cart.lines, { productId: action.productId, qty: 1, discount: 0 }] }
    }
    case 'qty': {
      const qty = cap(Math.max(1, Math.floor(action.qty) || 1), action.max)
      if (qty < 1) return cartReducer(cart, { type: 'remove', productId: action.productId })
      return { ...cart, lines: cart.lines.map((l) => (l.productId === action.productId ? { ...l, qty } : l)) }
    }
    case 'discount': {
      const discount = Number.isFinite(action.discount) ? Math.max(0, Math.round(action.discount * 100) / 100) : 0
      return { ...cart, lines: cart.lines.map((l) => (l.productId === action.productId ? { ...l, discount } : l)) }
    }
    case 'remove':
      return { ...cart, lines: cart.lines.filter((l) => l.productId !== action.productId) }
    case 'customer':
      return { ...cart, customerId: action.customerId }
    case 'billDiscount': {
      const value = Number.isFinite(action.discount.value) ? Math.max(0, action.discount.value) : 0
      return { ...cart, billDiscount: { type: action.discount.type, value } }
    }
    case 'note':
      return { ...cart, note: action.note }
    case 'loadQuote':
      return {
        ...emptyCart,
        lines: action.lines.map((l) => ({ productId: l.productId, qty: Math.max(1, Math.floor(l.qty) || 1), discount: Math.max(0, l.discount ?? 0) })),
        customerId: action.customerId,
        quotationNo: action.quotationNo,
      }
    case 'unlinkQuote':
      return { ...cart, quotationNo: null }
    case 'clear':
      return emptyCart
  }
}

export const itemCount = (cart: Cart) => cart.lines.reduce((s, l) => s + l.qty, 0)

/** The cart as the API's quote/checkout lines (no zero discounts). */
export function toLines(cart: Cart): CartLineInput[] {
  return cart.lines.map((l) => (l.discount > 0 ? { productId: l.productId, qty: l.qty, discount: l.discount } : { productId: l.productId, qty: l.qty }))
}

export function toCheckout(cart: Cart, payment: CheckoutInput['payment']): CheckoutInput {
  return {
    lines: toLines(cart),
    billDiscount: cart.billDiscount.value > 0 ? cart.billDiscount : undefined,
    customerId: cart.customerId,
    payment,
    note: cart.note.trim() || null,
    ...(cart.quotationNo ? { quotationNo: cart.quotationNo } : {}),
  }
}

/**
 * Cash a customer is likely to hand over: the exact sum, then the next round notes up. Steps grow with
 * the bill, so a 1.5-million-baht robot isn't offered "1,500,100".
 */
export function quickTenders(total: number): number[] {
  const steps = total < 1000 ? [100, 500, 1000] : total < 10_000 ? [500, 1000, 5000] : total < 100_000 ? [1000, 10_000, 50_000] : [10_000, 100_000, 500_000]
  const ups = steps.map((s) => Math.ceil(total / s) * s).filter((v) => v > total)
  return [...new Set([total, ...ups])].sort((a, b) => a - b).slice(0, 4)
}
