// Financing estimates on the brochure. The terms and the formula mirror server/extras.ts (FINANCE_TERMS,
// financingOf), so a figure shown here is the figure the quotation will carry; finance.test.ts checks the
// two agree. Thai hire purchase and leasing are quoted at a flat rate per year.

export type FinanceMode = 'hire' | 'lease'

export const FINANCE_TERMS = {
  hire: { downPct: { min: 10, max: 50, default: 25 }, months: [12, 24, 36, 48, 60], ratePct: 4.5 },
  lease: { downPct: { min: 0, max: 30, default: 0 }, months: [12, 24, 36, 48], ratePct: 6.5 },
} as const

export interface FinanceResult {
  mode: FinanceMode
  downPct: number
  months: number
  ratePct: number
  downPayment: number
  financed: number
  monthly: number
  totalPayable: number
  /** totalPayable − price */
  interest: number
}

const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Monthly payment on a flat rate: (financed + financed × rate × years) ÷ months, rounded up to the baht. */
export function finance(price: number, mode: FinanceMode, downPct?: number, months?: number, ratePct?: number): FinanceResult {
  const terms = FINANCE_TERMS[mode]
  const d = clamp(downPct ?? terms.downPct.default, terms.downPct.min, terms.downPct.max)
  const m = (terms.months as readonly number[]).includes(months ?? -1) ? months! : (terms.months[2] ?? terms.months[0])
  const r = clamp(ratePct ?? terms.ratePct, 0, 15)
  const downPayment = money(Math.round((price * d) / 100))
  const financed = money(price - downPayment)
  const monthly = Math.ceil((financed + (financed * r * m) / 1200) / m)
  const totalPayable = money(downPayment + monthly * m)
  return { mode, downPct: d, months: m, ratePct: r, downPayment, financed, monthly, totalPayable, interest: money(totalPayable - price) }
}

/** The lowest monthly figure a model can be had for: hire purchase, default down payment, longest term. */
export const lowestMonthly = (price: number) => finance(price, 'hire', FINANCE_TERMS.hire.downPct.default, 60)

/**
 * Renting instead of buying (robot-as-a-service), the showroom's simulated terms: a monthly fee of the
 * price × the term's factor, maintenance included, the robot returned at the end. Shorter terms cost more a
 * month. These factors are the demo showroom's own assumptions, not a market rate.
 */
export const RENT_FACTORS: Record<number, number> = { 6: 0.16, 12: 0.095, 24: 0.055 }

export function rent(price: number, months: number) {
  const factor = RENT_FACTORS[months] ?? RENT_FACTORS[12]
  const monthly = Math.ceil((price * factor) / 100) * 100
  return { months, factor, monthly, total: monthly * months }
}

/** Ranges (min–max baht) summed item by item. */
export function sumRanges(items: { min: number; max: number }[]) {
  return items.reduce((a, b) => ({ min: a.min + b.min, max: a.max + b.max }), { min: 0, max: 0 })
}

function clamp(n: number, lo: number, hi: number) {
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo
}
