// @vitest-environment node
// Servo's quotations: financing estimates, pricing, expiry, and ringing a quotation up at the till.
import { resolve } from 'node:path'
import { loadCatalog } from './catalog.ts'
import { housekeepDb } from './crm.ts'
import { createQuotation, financingOf, quotationToCart, setQuotationStatus } from './extras.ts'
import { checkout, quote } from './logic.ts'
import { seed } from './seed.ts'
import type { Db, Staff } from './types.ts'
import { bkkTime } from './util.ts'

const root = resolve(import.meta.dirname, '..')
const catalog = loadCatalog(root)
const NOW = bkkTime('2026-11-06', 15, 30)
let db: Db
let staff: Staff
const customer = { name: 'คุณทดสอบ', company: 'บริษัท ทดสอบ จำกัด', taxId: '0105500000001', phone: '02-000-0000', email: 'buy@example.com' }
const robot = () => db.products.find((p) => p.categoryId === 'robot')!

beforeEach(() => {
  db = seed(catalog, NOW)
  staff = db.staff.find((s) => s.role === 'staff')!
})

describe('financing estimates', () => {
  it('works out a flat-rate hire purchase', () => {
    const f = financingOf(1_000_000, { mode: 'hire', downPct: 25, months: 36, ratePct: 4.5 })!
    expect(f).toMatchObject({ downPayment: 250_000, financed: 750_000, monthly: 23_646 })
    expect(f.totalPayable).toBe(250_000 + 23_646 * 36)
    expect(financingOf(1_000_000, { mode: 'cash' })).toBeNull()
    expect(financingOf(1_000_000, null)).toBeNull()
  })

  it('uses the defaults and refuses terms outside the limits', () => {
    expect(financingOf(500_000, { mode: 'lease', months: 24 })).toMatchObject({ downPct: 0, ratePct: 6.5 })
    expect(() => financingOf(1, { mode: 'hire', downPct: 5, months: 36 })).toThrow()
    expect(() => financingOf(1, { mode: 'hire', months: 7 })).toThrow()
    expect(() => financingOf(1, { mode: 'loan', months: 12 })).toThrow()
  })
})

describe('quotations', () => {
  it('prices from the catalogue, ignores stock and opens a lead', () => {
    const p = robot()
    p.stock = 0
    const q = createQuotation(db, { lines: [{ productId: p.id, qty: 2 }, { productId: 'svc-install', qty: 1 }], customer, financing: { mode: 'hire', months: 36 } }, NOW)
    const priced = quote(db, { lines: [{ productId: p.id, qty: 2 }, { productId: 'svc-install', qty: 1 }] }, { ignoreStock: true })
    expect(q.totals.total).toBe(priced.total)
    expect(q.no).toMatch(/^QT691106-\d{4}$/)
    expect(q.token).toHaveLength(48)
    expect(new Date(q.validUntil).getTime() - NOW.getTime()).toBe(30 * 86_400_000)
    expect(q.financing!.months).toBe(36)
    const lead = db.leads.find((l) => l.id === q.leadId)!
    expect(lead).toMatchObject({ kind: 'quote', linked: { quoteNo: q.no } })
    expect(lead.refIds).toContain(p.refId)
  })

  it('checks the tax id and the quantities', () => {
    expect(() => createQuotation(db, { lines: [{ productId: robot().id, qty: 1 }], customer: { ...customer, taxId: '123' } }, NOW)).toThrow()
    expect(() => createQuotation(db, { lines: [{ productId: robot().id, qty: 11 }], customer }, NOW)).toThrow()
    expect(() => createQuotation(db, { lines: [], customer }, NOW)).toThrow()
  })

  it('lapses after 30 days unless accepted', () => {
    const a = createQuotation(db, { lines: [{ productId: robot().id, qty: 1 }], customer }, NOW)
    const b = createQuotation(db, { lines: [{ productId: robot().id, qty: 1 }], customer }, NOW)
    setQuotationStatus(db, staff, b.id, { status: 'accepted' }, NOW)
    housekeepDb(db, new Date(NOW.getTime() + 31 * 86_400_000))
    expect(a.status).toBe('expired')
    expect(b.status).toBe('accepted')
  })

  it('rings up at the quoted price and is converted by the sale', () => {
    const p = robot()
    p.stock = 5
    const q = createQuotation(db, { lines: [{ productId: p.id, qty: 1 }], customer }, NOW)
    p.price += 10_000
    const cart = quotationToCart(db, q.id, NOW)
    expect(cart.lines[0]).toMatchObject({ productId: p.id, qty: 1, discount: 10_000 })
    const order = checkout(db, staff, { lines: cart.lines, quotationNo: cart.quotationNo, payment: { method: 'transfer' } }, NOW)
    expect(order.total).toBe(q.totals.total)
    expect(order.quotationNo).toBe(q.no)
    expect(q).toMatchObject({ status: 'converted', orderNo: order.no })
    expect(db.leads.find((l) => l.id === q.leadId)!.status).toBe('won')
    expect(() => quotationToCart(db, q.id, NOW)).toThrow()
    expect(() => checkout(db, staff, { lines: cart.lines, quotationNo: q.no, payment: { method: 'transfer' } }, NOW)).toThrow()
  })

  it('seeds open, accepted and lapsed demo quotations', () => {
    expect(db.quotations.length).toBeGreaterThanOrEqual(4)
    expect(db.quotations.some((q) => q.status === 'expired')).toBe(true)
    expect(db.quotations.some((q) => q.status === 'accepted' && q.financing)).toBe(true)
    expect(db.quotations.every((q) => db.leads.some((l) => l.id === q.leadId && l.kind === 'quote'))).toBe(true)
  })
})
