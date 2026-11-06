// @vitest-environment node
// The contact book, bookings, reviews and the brochure's public API. Shared by both shops (identical file).
import { mkdtempSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createApi } from './api.ts'
import { loadCatalog } from './catalog.ts'
import {
  anonymiseLead,
  createBooking,
  createLead,
  createReview,
  crmCounts,
  moderateReview,
  reviewSummary,
  slotsFor,
  updateBooking,
  updateLead,
} from './crm.ts'
import { rateLimiter } from './http.ts'
import { seed } from './seed.ts'
import type { Db, Staff } from './types.ts'
import { HttpError, addDays, bkkTime, dayKey, minutesOf, weekdayOf } from './util.ts'

const root = resolve(import.meta.dirname, '..')
const catalog = loadCatalog(root)
const NOW = bkkTime('2026-11-06', 15, 30)
const TODAY = '2026-11-06'
const TOMORROW = addDays(TODAY, 1)
const refId = [...catalog.records.keys()][0]

let db: Db
let manager: Staff
let staff: Staff
const person = { name: 'ทดสอบ ระบบ', phone: '081-000-0000', email: 'test@example.com' }

beforeEach(() => {
  db = seed(catalog, NOW)
  manager = db.staff.find((s) => s.role === 'manager')!
  staff = db.staff.find((s) => s.role === 'staff')!
})

const codeOf = (fn: () => unknown) => {
  try {
    fn()
  } catch (e) {
    return (e as HttpError).code
  }
  return null
}

describe('seeded contact book', () => {
  it('has contact settings and opening hours for the brochure', () => {
    const s = db.settings
    expect(s.email).toMatch(/@/)
    expect(s.lineId).toMatch(/^@/)
    expect(s.lineUrl).toMatch(/^https:\/\/line\.me\//)
    expect(s.mapUrl).toMatch(/^https:\/\/www\.google\.com\/maps/)
    expect(s.hours!.length).toBeGreaterThan(0)
    expect(s.siteUrl).toMatch(/^https:\/\//)
  })

  it('seeds inquiries, a PDPA request and past and upcoming bookings, but never reviews', () => {
    expect(db.leads.some((l) => l.kind === 'inquiry')).toBe(true)
    expect(db.leads.some((l) => l.kind === 'privacy' && l.request)).toBe(true)
    expect(db.bookings.some((b) => b.date < TODAY && b.status === 'done')).toBe(true)
    expect(db.bookings.some((b) => b.date > TODAY && (b.status === 'pending' || b.status === 'confirmed'))).toBe(true)
    expect(db.reviews).toEqual([])
    for (const b of db.bookings) {
      const lead = db.leads.find((l) => l.id === b.leadId)!
      expect(lead.kind).toBe('booking')
      expect(lead.linked.bookingNo).toBe(b.no)
    }
    expect(db.leads.every((l) => l.createdAt <= NOW.toISOString())).toBe(true)
    expect(new Set(db.leads.map((l) => l.no)).size).toBe(db.leads.length)
  })
})

describe('booking slots', () => {
  const step = catalog.booking.durationMin

  it('offers slots of the booking length inside opening hours, from tomorrow on', () => {
    const day = slotsFor(db, catalog, TOMORROW, NOW)
    const h = db.settings.hours!.find((x) => x.day === weekdayOf(TOMORROW))!
    expect(day.open).toBe(true)
    expect(day.slots[0].time).toBe(h.open)
    for (const s of day.slots) {
      expect((minutesOf(s.time) - minutesOf(h.open)) % step).toBe(0)
      expect(minutesOf(s.time) + step).toBeLessThanOrEqual(minutesOf(h.close))
    }
    expect(slotsFor(db, catalog, TODAY, NOW).open).toBe(false)
    expect(slotsFor(db, catalog, addDays(TODAY, catalog.booking.windowDays + 1), NOW).open).toBe(false)
    expect(slotsFor(db, catalog, 'not-a-day', NOW).open).toBe(false)
  })

  it('lets staff book later today but not a slot that has started', () => {
    const today = slotsFor(db, catalog, TODAY, NOW, { staffSide: true })
    expect(today.open).toBe(true)
    expect(today.slots.every((s) => minutesOf(s.time) > 15 * 60 + 30)).toBe(true)
  })

  it('treats a weekday missing from the hours as closed', () => {
    db.settings.hours = db.settings.hours!.filter((h) => h.day !== weekdayOf(TOMORROW))
    expect(slotsFor(db, catalog, TOMORROW, NOW)).toMatchObject({ open: false, slots: [] })
  })

  it('takes one booking per slot, and frees the slot when cancelled', () => {
    const time = slotsFor(db, catalog, TOMORROW, NOW).slots.find((s) => s.available)!.time
    const b = createBooking(db, catalog, { date: TOMORROW, time, refId, ...person }, NOW)
    expect(b.no).toMatch(/^BK691106-\d{4}$/)
    expect(db.leads.find((l) => l.id === b.leadId)!.linked.bookingNo).toBe(b.no)
    expect(slotsFor(db, catalog, TOMORROW, NOW).slots.find((s) => s.time === time)!.available).toBe(false)
    expect(codeOf(() => createBooking(db, catalog, { date: TOMORROW, time, ...person }, NOW))).toBe('SLOT_TAKEN')
    expect(codeOf(() => createBooking(db, catalog, { date: TOMORROW, time: '03:07', ...person }, NOW))).toBe('SLOT_INVALID')
    updateBooking(db, catalog, staff, b.id, { status: 'cancelled' }, NOW)
    expect(slotsFor(db, catalog, TOMORROW, NOW).slots.find((s) => s.time === time)!.available).toBe(true)
  })

  it('reschedules only into a free slot and confirms the lead', () => {
    const free = slotsFor(db, catalog, TOMORROW, NOW).slots.filter((s) => s.available)
    const a = createBooking(db, catalog, { date: TOMORROW, time: free[0].time, ...person }, NOW)
    const b = createBooking(db, catalog, { date: TOMORROW, time: free[1].time, ...person }, NOW)
    expect(codeOf(() => updateBooking(db, catalog, staff, b.id, { time: a.time }, NOW))).toBe('SLOT_TAKEN')
    updateBooking(db, catalog, staff, b.id, { status: 'confirmed' }, NOW)
    expect(db.leads.find((l) => l.id === b.leadId)!.status).toBe('scheduled')
  })
})

describe('leads', () => {
  it('numbers leads by day and records status, assignment and notes', () => {
    const lead = createLead(db, { kind: 'inquiry', ...person, message: 'สนใจ', refIds: [refId] }, NOW)
    expect(lead.no).toMatch(/^LD691106-\d{4}$/)
    updateLead(db, staff, lead.id, { status: 'contacted', assignedTo: staff.id, note: 'โทรกลับแล้ว' }, NOW)
    expect(lead).toMatchObject({ status: 'contacted', assignedTo: staff.id })
    expect(lead.notes.at(-1)).toMatchObject({ staffId: staff.id, text: 'โทรกลับแล้ว' })
    expect(() => updateLead(db, staff, lead.id, { status: 'maybe' }, NOW)).toThrow()
  })

  it('anonymises a lead and its booking on a PDPA request (managers only)', () => {
    const time = slotsFor(db, catalog, TOMORROW, NOW).slots.find((s) => s.available)!.time
    const b = createBooking(db, catalog, { date: TOMORROW, time, ...person, note: 'แพ้ขนแมว' }, NOW)
    const lead = db.leads.find((l) => l.id === b.leadId)!
    updateLead(db, staff, lead.id, { note: 'เบอร์สำรอง 089-999-9999' }, NOW)
    expect(() => anonymiseLead(db, staff, lead.id, NOW)).toThrow()
    anonymiseLead(db, manager, lead.id, NOW)
    expect(lead.anonymisedAt).toBeTruthy()
    expect(JSON.stringify(lead)).not.toContain('081-000-0000')
    expect(JSON.stringify(lead)).not.toContain('089-999-9999')
    expect(b).toMatchObject({ phone: '', email: null, note: null })
    expect(() => updateLead(db, staff, lead.id, { status: 'won' }, NOW)).toThrow()
  })
})

describe('reviews', () => {
  const body = { refId, name: 'ผู้ซื้อจริง', rating: 4, body: 'ประทับใจมาก ทีมงานให้ข้อมูลครบ' }

  it('stay hidden until a manager approves them', () => {
    const r = createReview(db, catalog, body, NOW)
    expect(reviewSummary(db, refId).count).toBe(0)
    expect(() => moderateReview(db, staff, r.id, 'approved', NOW)).toThrow()
    moderateReview(db, manager, r.id, 'approved', NOW)
    createReview(db, catalog, { ...body, rating: 5 }, NOW)
    const s = reviewSummary(db, refId)
    expect(s).toMatchObject({ count: 1, average: 4 })
    moderateReview(db, manager, r.id, 'rejected', NOW)
    expect(reviewSummary(db, refId).count).toBe(0)
  })

  it('checks the rating, the length and that the breed or model exists', () => {
    expect(codeOf(() => createReview(db, catalog, { ...body, rating: 6 }, NOW))).toBe('VALIDATION')
    expect(codeOf(() => createReview(db, catalog, { ...body, body: 'สั้น' }, NOW))).toBe('VALIDATION')
    expect(codeOf(() => createReview(db, catalog, { ...body, refId: 'nope' }, NOW))).toBe('VALIDATION')
  })
})

describe('overview counts', () => {
  it('counts new leads, today and upcoming bookings and pending reviews', () => {
    const before = crmCounts(db, NOW)
    createLead(db, { kind: 'inquiry', ...person, message: 'x' }, NOW)
    createReview(db, catalog, { refId, name: 'ก', rating: 5, body: 'ดีมากเลยครับทีมงาน' }, NOW)
    const after = crmCounts(db, NOW)
    expect(after.newLeads).toBe(before.newLeads + 1)
    expect(after.pendingReviews).toBe(before.pendingReviews + 1)
    expect(before.bookingsUpcoming).toBeGreaterThan(0)
  })
})

describe('rate limiter', () => {
  it('allows the limit per window per client, then answers 429', () => {
    const hit = rateLimiter(2, 1000)
    hit('a', 0)
    hit('a', 10)
    expect(() => hit('a', 20)).toThrow(HttpError)
    hit('b', 20)
    hit('a', 1015)
  })
})

describe('public and admin HTTP', () => {
  let server: Server
  let base = ''
  const call = async (method: string, path: string, body?: unknown, opts: { token?: string; ip?: string } = {}) => {
    const r = await fetch(base + path, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.ip ? { 'x-forwarded-for': opts.ip } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    return { status: r.status, data: (await r.json()) as any }
  }

  beforeAll(async () => {
    // The tests play several clients by address, as a reverse proxy would report them
    process.env.POS_TRUST_PROXY = '1'
    const file = join(mkdtempSync(join(tmpdir(), 'pos-crm-')), 'db.json')
    const api = createApi(root, file, { rateLimit: 5 })
    server = createServer((req, res) => {
      api.handle(req, res).then((h) => {
        if (!h) res.writeHead(404).end()
      })
    })
    await new Promise<void>((ok) => server.listen(0, ok))
    base = `http://localhost:${(server.address() as { port: number }).port}`
  })

  afterAll(() => {
    delete process.env.POS_TRUST_PROXY
    return new Promise<void>((ok) => server.close(() => ok()))
  })

  it('serves the store, the live catalogue and the booking calendar without signing in', async () => {
    const store = await call('GET', '/api/public/store')
    expect(store.status).toBe(200)
    expect(store.data).toMatchObject({ simulated: true, booking: { durationMin: catalog.booking.durationMin } })
    expect(store.data.lineUrl).toMatch(/line\.me/)
    const items = (await call('GET', '/api/public/catalog')).data
    expect(items.length).toBeGreaterThan(5)
    expect(items.every((i: any) => ['in', 'low', 'out', 'service'].includes(i.stockState))).toBe(true)
    const tomorrow = addDays(dayKey(new Date()), 1)
    const slots = (await call('GET', `/api/public/slots?date=${tomorrow}`)).data
    expect(slots.date).toBe(tomorrow)
  })

  it('needs consent, rejects the honeypot and explains errors in Thai and English', async () => {
    const msg = { ...person, message: 'สนใจครับ', refIds: [refId] }
    const noConsent = await call('POST', '/api/public/leads', msg, { ip: '10.0.0.1' })
    expect(noConsent).toMatchObject({ status: 400, data: { code: 'CONSENT_REQUIRED' } })
    expect(noConsent.data.errorEn).toMatch(/privacy/i)
    const bot = await call('POST', '/api/public/leads', { ...msg, consent: true, website: 'spam.example' }, { ip: '10.0.0.1' })
    expect(bot.data.code).toBe('SPAM')
    const badPhone = await call('POST', '/api/public/leads', { ...msg, phone: 'abc', consent: true }, { ip: '10.0.0.1' })
    expect(badPhone.data).toMatchObject({ code: 'VALIDATION', field: 'phone' })
    const ok = await call('POST', '/api/public/leads', { ...msg, consent: true, website: '' }, { ip: '10.0.0.1' })
    expect(ok.status).toBe(200)
    expect(ok.data.no).toMatch(/^LD\d{6}-\d{4}$/)
  })

  it('limits POSTs per client', async () => {
    const msg = { ...person, message: 'ทดสอบ', consent: true }
    for (let i = 0; i < 5; i++) expect((await call('POST', '/api/public/leads', msg, { ip: '10.9.9.9' })).status).toBe(200)
    expect((await call('POST', '/api/public/leads', msg, { ip: '10.9.9.9' })).data.code).toBe('RATE_LIMITED')
    expect((await call('POST', '/api/public/leads', msg, { ip: '10.9.9.8' })).status).toBe(200)
    // Staff sign-in from the same address is not limited
    for (let i = 0; i < 7; i++) expect((await call('POST', '/api/auth/login', { staffId: manager.id, pin: '1111' }, { ip: '10.9.9.9' })).status).toBe(200)
  })

  it('ignores a made-up X-Forwarded-For unless told to trust a proxy', async () => {
    process.env.POS_TRUST_PROXY = '0'
    try {
      const msg = { ...person, message: 'ทดสอบ', consent: true }
      let limited = false
      for (let i = 0; i < 8 && !limited; i++) {
        const r = await call('POST', '/api/public/leads', msg, { ip: `10.7.7.${i}` })
        limited = r.data.code === 'RATE_LIMITED'
      }
      expect(limited).toBe(true)
    } finally {
      process.env.POS_TRUST_PROXY = '1'
    }
  })

  it('books a slot once, moderates reviews and hands everything to the admin', async () => {
    const tomorrow = addDays(dayKey(new Date()), 1)
    const slots = (await call('GET', `/api/public/slots?date=${tomorrow}`)).data
    const time = slots.slots.find((s: any) => s.available)?.time
    if (time) {
      const booked = await call('POST', '/api/public/bookings', { date: tomorrow, time, refId, ...person, consent: true }, { ip: '10.1.1.1' })
      expect(booked.status).toBe(200)
      const again = await call('POST', '/api/public/bookings', { date: tomorrow, time, ...person, consent: true }, { ip: '10.1.1.2' })
      expect(again).toMatchObject({ status: 409, data: { code: 'SLOT_TAKEN' } })
    }

    const review = await call('POST', '/api/public/reviews', { refId, name: 'ลูกค้า', rating: 5, body: 'บริการดี อธิบายละเอียด', consent: true }, { ip: '10.2.2.2' })
    expect(review.data.status).toBe('pending')
    expect((await call('GET', `/api/public/reviews?refId=${refId}`)).data.count).toBe(0)

    const login = await call('POST', '/api/auth/login', { staffId: manager.id, pin: '1111' })
    const token = login.data.token
    const pending = (await call('GET', '/api/reviews?status=pending', undefined, { token })).data.rows
    expect(pending.length).toBe(1)
    await call('PATCH', `/api/reviews/${pending[0].id}`, { status: 'approved' }, { token })
    expect((await call('GET', `/api/public/reviews?refId=${refId}`)).data).toMatchObject({ count: 1, average: 5 })
    expect((await call('GET', '/api/public/reviews/summary')).data[refId]).toMatchObject({ count: 1 })

    const leads = (await call('GET', '/api/leads?kind=inquiry', undefined, { token })).data
    expect(leads.total).toBeGreaterThan(0)
    const id = leads.rows[0].id
    const patched = await call('PATCH', `/api/leads/${id}`, { status: 'contacted', note: 'โทรแล้ว' }, { token })
    expect(patched.data.status).toBe('contacted')
    const wiped = await call('POST', `/api/leads/${id}/anonymise`, {}, { token })
    expect(wiped.data.anonymisedAt).toBeTruthy()

    const dash = (await call('GET', '/api/dashboard', undefined, { token })).data
    expect(dash.crm).toMatchObject({ pendingReviews: 0 })
    expect((await call('GET', '/api/leads')).status).toBe(401)
  })

  it('takes the new contact settings from a manager', async () => {
    const token = (await call('POST', '/api/auth/login', { staffId: manager.id, pin: '1111' })).data.token
    const hours = [{ day: 1, open: '09:00', close: '18:00' }]
    const ok = await call('PATCH', '/api/settings', { lineId: '@newline', hours }, { token })
    expect(ok.data).toMatchObject({ lineId: '@newline', hours })
    const bad = await call('PATCH', '/api/settings', { hours: [{ day: 1, open: '18:00', close: '09:00' }] }, { token })
    expect(bad.status).toBe(400)
    expect((await call('GET', '/api/public/store')).data.lineId).toBe('@newline')
  })
})
