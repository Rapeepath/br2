import { describe, expect, it } from 'vitest'
import { models } from '../data'
import { applyFilters, DEFAULT_FILTERS, isFiltered, type Filters } from './filter'
import { formatListPrice, formatMillion, formatMonthTh, formatPrice, formatRange, msToKmh } from './format'

const run = (patch: Partial<Filters>) => applyFilters(models, { ...DEFAULT_FILTERS, ...patch })
const start = (id: string) => models.find((m) => m.id === id)!.span.price?.[0] ?? null

describe('applyFilters', () => {
  it('returns every model in catalogue order by default', () => {
    expect(run({}).map((m) => m.id)).toEqual(models.map((m) => m.id))
  })

  it('filters by category', () => {
    for (const category of new Set(models.map((m) => m.category))) {
      const res = run({ category })
      expect(res.length).toBeGreaterThan(0)
      expect(res.every((m) => m.category === category)).toBe(true)
    }
  })

  it('filters by brand', () => {
    for (const brand of new Set(models.map((m) => m.brand))) {
      const res = run({ brand })
      expect(res.length).toBeGreaterThan(0)
      expect(res.every((m) => m.brand === brand)).toBe(true)
    }
  })

  it('splits the lineup into budget bands by starting price, with no model in two bands', () => {
    const under = run({ budget: 'under500k' })
    const mid = run({ budget: '500kto1500k' })
    const over = run({ budget: 'over1500k' })
    expect(under.every((m) => start(m.id)! < 500_000)).toBe(true)
    expect(mid.every((m) => start(m.id)! >= 500_000 && start(m.id)! < 1_500_000)).toBe(true)
    expect(over.every((m) => start(m.id)! >= 1_500_000)).toBe(true)
    const priced = models.filter((m) => m.span.price != null).length
    expect(under.length + mid.length + over.length).toBe(priced)
  })

  it('searches brand and model names, case-insensitively', () => {
    const m = models[0]
    expect(run({ q: m.brand.toUpperCase() }).map((x) => x.id)).toContain(m.id)
    expect(run({ q: `  ${m.nameEn.toLowerCase()}  ` }).map((x) => x.id)).toContain(m.id)
  })

  it('finds a robot by a job it is used for', () => {
    const m = models.find((x) => x.useCases.length > 0)!
    expect(run({ q: m.useCases[0] }).map((x) => x.id)).toContain(m.id)
  })

  it('returns nothing for an unmatched query', () => {
    expect(run({ q: 'ไม่มีรุ่นนี้แน่นอน' })).toHaveLength(0)
  })

  it('sorts by starting price both ways, with unknown prices last', () => {
    const asc = run({ sort: 'priceAsc' }).map((m) => start(m.id))
    const known = asc.filter((x): x is number => x != null)
    expect(known).toEqual([...known].sort((a, b) => a - b))
    expect(asc.slice(known.length).every((x) => x == null)).toBe(true)

    const desc = run({ sort: 'priceDesc' }).map((m) => start(m.id)).filter((x): x is number => x != null)
    expect(desc).toEqual([...desc].sort((a, b) => b - a))
  })

  it('sorts by most DOF, highest payload and longest runtime, unknown figures last', () => {
    for (const [sort, key] of [
      ['dofDesc', 'dof'],
      ['payloadDesc', 'payloadKg'],
      ['runtimeDesc', 'runtimeH'],
    ] as const) {
      const xs = run({ sort }).map((m) => m.span[key]?.[1] ?? -1)
      expect(xs, sort).toEqual([...xs].sort((a, b) => b - a))
    }
  })

  it('does not mutate the source list', () => {
    const before = models.map((m) => m.id)
    run({ sort: 'name' })
    expect(models.map((m) => m.id)).toEqual(before)
  })
})

describe('isFiltered', () => {
  it('ignores sort and whitespace-only queries', () => {
    expect(isFiltered({ ...DEFAULT_FILTERS, sort: 'priceAsc', q: '   ' })).toBe(false)
    expect(isFiltered({ ...DEFAULT_FILTERS, category: 'research' })).toBe(true)
    expect(isFiltered({ ...DEFAULT_FILTERS, budget: 'under500k' })).toBe(true)
    expect(isFiltered({ ...DEFAULT_FILTERS, brand: models[0].brand })).toBe(true)
  })
})

describe('formatters', () => {
  it('formats ranges and collapses equal ends', () => {
    expect(formatRange([127, 180], 'ซม.')).toBe('127–180 ซม.')
    expect(formatRange([2.5, 2.5], 'ชม.')).toBe('2.5 ชม.')
    expect(formatRange(null, 'กก.')).toBeNull()
  })

  it('formats prices in baht with thousands separators', () => {
    expect(formatPrice([559000, 2250000])).toBe('559,000–2,250,000 บาท')
    expect(formatMillion(2250000)).toBe('2.25 ล้าน')
  })

  it('quotes the maker price in its own currency', () => {
    expect(formatListPrice({ amount: 16000, currency: 'USD' })).toBe('16,000 ดอลลาร์สหรัฐ')
    expect(formatListPrice({ amount: 39900, currency: 'CNY' }, true)).toBe('39,900 CNY')
  })

  it('converts m/s to km/h to one decimal', () => {
    expect(msToKmh(2)).toBe(7.2)
    expect(msToKmh(1.4)).toBe(5)
  })

  it('writes months in the Buddhist Era', () => {
    expect(formatMonthTh('2026-10')).toBe('ตุลาคม 2569')
  })
})
