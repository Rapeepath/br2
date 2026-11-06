import { describe, expect, it } from 'vitest'
import { FINANCE_TERMS as SERVER_TERMS, financingOf } from '../../server/extras'
import { FINANCE_TERMS, finance, lowestMonthly, rent, sumRanges } from './finance'

describe('financing estimates', () => {
  it('uses the same terms as the quotation server', () => {
    expect(FINANCE_TERMS).toEqual(SERVER_TERMS)
  })

  it('gives the same monthly figure the quotation will carry', () => {
    for (const price of [381_700, 456_000, 864_800, 1_799_000, 3_562_500]) {
      for (const mode of ['hire', 'lease'] as const) {
        for (const months of FINANCE_TERMS[mode].months) {
          const down = FINANCE_TERMS[mode].downPct.default
          const ours = finance(price, mode, down, months)
          const theirs = financingOf(price, { mode, downPct: down, months })!
          expect(ours.monthly).toBe(theirs.monthly)
          expect(ours.downPayment).toBe(theirs.downPayment)
          expect(ours.totalPayable).toBe(theirs.totalPayable)
        }
      }
    }
  })

  it('works out a flat-rate hire purchase by hand', () => {
    // 1,000,000 at 25% down → 750,000 financed; 4.5% × 5 years = 168,750 interest; ÷ 60 = 15,312.5 → 15,313
    const f = finance(1_000_000, 'hire', 25, 60)
    expect(f.downPayment).toBe(250_000)
    expect(f.financed).toBe(750_000)
    expect(f.monthly).toBe(15_313)
    expect(f.totalPayable).toBe(250_000 + 15_313 * 60)
    expect(f.interest).toBe(f.totalPayable - 1_000_000)
  })

  it('keeps inputs inside the terms', () => {
    const f = finance(500_000, 'lease', 90, 7)
    expect(f.downPct).toBe(FINANCE_TERMS.lease.downPct.max)
    expect(FINANCE_TERMS.lease.months).toContain(f.months)
  })

  it('offers the lowest monthly on the longest hire term', () => {
    const low = lowestMonthly(864_800)
    expect(low.months).toBe(60)
    for (const m of FINANCE_TERMS.hire.months) expect(finance(864_800, 'hire', 25, m).monthly).toBeGreaterThanOrEqual(low.monthly)
  })

  it('rents at a factor that falls with the term, rounded up to 100 baht', () => {
    const short = rent(1_000_000, 6)
    const long = rent(1_000_000, 24)
    expect(short.monthly).toBeGreaterThan(long.monthly)
    expect(long.monthly % 100).toBe(0)
    expect(long.total).toBe(long.monthly * 24)
  })

  it('adds ranges item by item', () => {
    expect(sumRanges([{ min: 1, max: 5 }, { min: 2, max: 3 }])).toEqual({ min: 3, max: 8 })
  })
})
