import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en, market, models } from './index'

// Vitest runs from the project root; import.meta.url is an http URL under jsdom.
const publicDir = join(process.cwd(), 'public')
const rate = (c: string) => ({ THB: 1, USD: market.fx.usd, CNY: market.fx.cny, EUR: market.fx.eur })[c]!
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
const THAI = /[\u0E00-\u0E7F]/
const FREE = /^(CC0|Public domain|CC BY(-SA)? \d\.\d)$/
/** The robots the brochure sells; each must have a gallery array and complete English. */
const LISTED = ['agibot-x2', 'agibot-a2', 'unitree-g1', 'engineai-t800', 'nao6', 'limx-luna', 'galbot-g1']

describe('model data', () => {
  it('has a catalogue of 6 to 12 robots with unique ids', () => {
    expect(models.length).toBeGreaterThanOrEqual(6)
    expect(models.length).toBeLessThanOrEqual(12)
    expect(new Set(models.map((m) => m.id)).size).toBe(models.length)
  })

  it.each(models.map((m) => [m.id, m] as const))('%s has complete, well-formed fields', (_id, m) => {
    for (const key of ['brand', 'nameEn', 'nameTh', 'segment', 'tagline', 'summary', 'background', 'distributor', 'availabilityNote'] as const) {
      expect(m[key].trim().length, key).toBeGreaterThan(0)
    }
    expect(['research', 'education', 'home', 'industrial', 'service']).toContain(m.category)
    expect(['legs', 'wheels']).toContain(m.locomotion)
    expect(['china', 'japan', 'korea', 'europe', 'usa']).toContain(m.originGroup)
    expect(['thai-dealer', 'import', 'preorder']).toContain(m.availability)
    expect(m.launched).toMatch(/^\d{4}-\d{2}$/)
    expect(m.heightCm).toBeGreaterThan(30)
    expect(m.trims.length).toBeGreaterThan(0)
    for (const t of m.trims) {
      if (t.priceTHB != null) expect(t.priceTHB).toBeGreaterThan(10_000)
      if (t.speedMs != null) expect(t.speedMs).toBeLessThan(10)
      if (t.handDof != null && t.dof != null) expect(t.handDof).toBeLessThanOrEqual(t.dof)
    }
    for (const k of ['sensors', 'useCases', 'highlights', 'pros', 'cons', 'idealFor', 'considerations'] as const) {
      expect(m[k].length, k).toBeGreaterThan(0)
    }
    expect(m.sources.length).toBeGreaterThanOrEqual(3)
    for (const s of m.sources) expect(s.url).toMatch(/^https?:\/\//)
  })

  it.each(models.map((m) => [m.id, m] as const))('%s prices agree with their basis', (_id, m) => {
    for (const t of m.trims) {
      if (t.priceBasis === 'converted') {
        // A converted price is the list price at the published rate, to the nearest few hundred baht
        expect(t.listPrice).not.toBeNull()
        const expected = t.listPrice!.amount * rate(t.listPrice!.currency)
        expect(Math.abs(t.priceTHB! - expected) / expected).toBeLessThanOrEqual(0.02)
      }
      if (t.priceTHB == null) expect(t.priceBasis).toBeNull()
    }
  })

  it.each(models.map((m) => [m.id, m] as const))('%s spans match its trims', (_id, m) => {
    const prices = m.trims.map((t) => t.priceTHB).filter((p): p is number => p != null)
    expect(m.span.price).toEqual(prices.length ? [Math.min(...prices), Math.max(...prices)] : null)
    // Trims are listed cheapest first
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
    const dofs = m.trims.map((t) => t.dof).filter((d): d is number => d != null)
    expect(m.span.dof).toEqual(dofs.length ? [Math.min(...dofs), Math.max(...dofs)] : null)
  })

  it.each(models.map((m) => [m.id, m] as const))('%s has local photos and a credited free licence', (_id, m) => {
    expect(existsSync(join(publicDir, m.image.src))).toBe(true)
    expect(existsSync(join(publicDir, m.image.srcSmall))).toBe(true)
    expect(m.image.author.trim()).not.toBe('')
    expect(m.image.license).not.toMatch(/\b(NC|ND)\b/)
    expect(m.image.page).toMatch(/^https:\/\/commons\.wikimedia\.org\//)
  })

  it('orders the catalogue by maker shipments, then by starting price', () => {
    const ranks = models.map((m) => m.makerRank ?? Infinity)
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    for (let i = 1; i < models.length; i++) {
      const [a, b] = [models[i - 1], models[i]]
      if ((a.makerRank ?? Infinity) === (b.makerRank ?? Infinity)) {
        expect(a.span.price?.[0] ?? Infinity).toBeLessThanOrEqual(b.span.price?.[0] ?? Infinity)
      }
    }
  })

  it('ranks only makers that appear in the shipment table', () => {
    for (const m of models.filter((x) => x.makerRank != null)) {
      const brand = norm(m.brand)
      expect(market.shipments.some((s) => norm(s.brand).startsWith(brand) || brand.startsWith(norm(s.brand))), m.brand).toBe(true)
    }
  })
})

describe('market data', () => {
  it('has guide content for every section', () => {
    expect(market.buyerChecklist.length).toBeGreaterThanOrEqual(5)
    expect(market.setup.steps.length).toBeGreaterThan(0)
    expect(market.setup.costs.length).toBeGreaterThan(0)
    expect(market.electricity.length).toBeGreaterThan(0)
    expect(market.sellers.length).toBeGreaterThan(0)
    expect(market.notForSale.length).toBeGreaterThan(0)
    expect(market.shipments.length).toBeGreaterThan(0)
    expect(market.ownershipCost.yearly.length).toBeGreaterThan(0)
    expect(market.ownershipCost.oneTime.length).toBeGreaterThan(0)
    expect(market.priceFactors.length).toBeGreaterThan(0)
    expect(market.incentives.length).toBeGreaterThan(0)
    expect(market.legalNotes.length).toBeGreaterThan(0)
    expect(market.sources.length).toBeGreaterThan(0)
    expect(market.asOf).toMatch(/^\d{4}-\d{2}$/)
  })

  it('states a plausible exchange rate for every currency it converts', () => {
    expect(market.fx.usd).toBeGreaterThan(20)
    expect(market.fx.usd).toBeLessThan(50)
    expect(market.fx.cny).toBeGreaterThan(3)
    expect(market.fx.cny).toBeLessThan(7)
    expect(market.fx.eur).toBeGreaterThan(25)
    expect(market.fx.eur).toBeLessThan(55)
    expect(market.fx.source.url).toMatch(/^https?:\/\//)
  })

  it('keeps every cost range in order', () => {
    const costs = [...market.setup.costs, ...market.ownershipCost.yearly, ...market.ownershipCost.oneTime]
    for (const c of costs) expect(c.min, c.item).toBeLessThanOrEqual(c.max)
    for (const e of market.electricity) expect(e.min, e.label).toBeLessThanOrEqual(e.max)
  })

  it('lists shipments largest first', () => {
    const units = market.shipments.map((s) => s.units)
    expect(units).toEqual([...units].sort((a, b) => b - a))
  })
})

describe('gallery', () => {
  it('covers every listed robot', () => {
    for (const id of LISTED) {
      const m = models.find((x) => x.id === id)
      expect(m, id).toBeDefined()
      expect(Array.isArray(m!.gallery), id).toBe(true)
      expect(m!.gallery.length, id).toBeLessThanOrEqual(4)
    }
  })

  it('never uses a file twice', () => {
    const files = models.flatMap((m) => [m.image.src, m.image.srcSmall, ...m.gallery.flatMap((g) => [g.src, g.srcSmall])])
    expect(new Set(files).size).toBe(files.length)
  })

  it.each(models.map((m) => [m.id, m] as const))('%s gallery items are local, credited and freely licensed', (_id, m) => {
    for (const g of m.gallery) {
      expect(['image', 'video']).toContain(g.kind)
      for (const f of [g.src, g.srcSmall]) {
        expect(f).toMatch(/^images\/gallery\/[a-z0-9-]+\.jpg$/)
        expect(existsSync(join(publicDir, f)), f).toBe(true)
      }
      expect(g.author.trim(), g.src).not.toBe('')
      expect(g.license, g.src).toMatch(FREE)
      expect(g.page, g.src).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/)
      expect(THAI.test(g.alt), `${g.src} alt is Thai`).toBe(true)
      if (g.zoom != null) expect(g.zoom).toBeGreaterThanOrEqual(1)
      if (g.kind === 'image') {
        expect(g.video).toBeUndefined()
        // Not the main photo again; sharing its page is only allowed for another frame of the same video
        if (g.page === m.image.page) expect(m.image.page).toMatch(/\.(webm|ogv)$/i)
      } else {
        expect(g.video, g.src).toBeDefined()
        expect(g.video!.url).toMatch(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/.+\.(webm|ogv)$/i)
        expect(g.video!.duration).toBeGreaterThan(0)
        expect(g.video!.start).toBeGreaterThanOrEqual(0)
        expect(g.video!.start).toBeLessThan(g.video!.duration)
      }
    }
  })
})

// English mirror: 's' = translated text (null exactly where the Thai is null), 'key' = same value as the Thai
type Spec = 's' | 'key' | Spec[] | { [key: string]: Spec }
const MODEL_EN: Spec = {
  segment: 's', originCountry: 's', tagline: 's', summary: 's', background: 's', availabilityNote: 's', distributor: 's',
  trims: [{ name: 'key', hand: 's', compute: 's' }],
  sensors: ['s'],
  charging: { note: 's' },
  software: { sdk: 's', ai: 's' },
  warranty: { robot: 's', battery: 's', note: 's' },
  safety: { features: ['s'], certifications: ['s'] },
  useCases: ['s'], highlights: ['s'], pros: ['s'], cons: ['s'], idealFor: ['s'], considerations: ['s'],
  funFact: 's', priceNote: 's',
  gallery: [{ alt: 's' }],
}
const MARKET_EN: Spec = {
  fx: { note: 's' },
  marketContext: 's',
  shipments: [{ brand: 'key', period: 's', note: 's' }],
  priceFactors: ['s'],
  buyerChecklist: [{ title: 's', detail: 's' }],
  setup: { steps: [{ title: 's', detail: 's' }], costs: [{ item: 's' }] },
  electricity: [{ label: 's', unit: 's', note: 's' }],
  ownershipCost: { yearly: [{ item: 's' }], oneTime: [{ item: 's' }] },
  sellers: [{ name: 's', detail: 's' }],
  notForSale: [{ name: 's', status: 's' }],
  incentives: ['s'],
  legalNotes: ['s'],
}

/** Every difference between the Thai data and its English along `spec`, as readable paths. */
function mismatches(spec: Spec, th: unknown, enValue: unknown, path = ''): string[] {
  if (spec === 's') {
    if (th == null) return enValue == null ? [] : [`${path}: should be null like the Thai`]
    if (typeof enValue !== 'string' || !enValue.trim()) return [`${path}: English missing`]
    return THAI.test(enValue) ? [`${path}: English contains Thai script`] : []
  }
  if (spec === 'key') return enValue === th ? [] : [`${path}: expected "${String(th)}"`]
  if (Array.isArray(spec)) {
    const thArr = (th ?? []) as unknown[]
    if (!Array.isArray(enValue)) return [`${path}: English array missing`]
    const head = enValue.length === thArr.length ? [] : [`${path}: ${enValue.length} English items for ${thArr.length} Thai items`]
    return [...head, ...thArr.flatMap((t, i) => mismatches(spec[0], t, enValue[i], `${path}[${i}]`))]
  }
  if (enValue == null || typeof enValue !== 'object') return [`${path}: English object missing`]
  const thObj = th as Record<string, unknown>
  const enObj = enValue as Record<string, unknown>
  return Object.entries(spec).flatMap(([k, s]) => mismatches(s, thObj?.[k], enObj[k], path ? `${path}.${k}` : k))
}

describe('English content', () => {
  it('has a record for every robot in the catalogue', () => {
    expect(Object.keys(en.records).sort()).toEqual(models.map((m) => m.id).sort())
    for (const id of LISTED) expect(en.records[id], id).toBeDefined()
  })

  it.each(LISTED)('%s is complete and lines up with the Thai item for item', (id) => {
    const m = models.find((x) => x.id === id)!
    expect(mismatches(MODEL_EN, m, en.records[id])).toEqual([])
    // Same trim order as the Thai record, so pages can zip them
    expect(en.records[id].trims.map((t) => t.name)).toEqual(m.trims.map((t) => t.name))
    expect(en.records[id].tagline.length).toBeLessThanOrEqual(60)
  })

  it('translates every user-facing market text', () => {
    expect(mismatches(MARKET_EN, market, en.market)).toEqual([])
    expect(en.market.shipments.map((s) => s.brand)).toEqual(market.shipments.map((s) => s.brand))
  })
})
