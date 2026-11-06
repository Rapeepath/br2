// The shop's contact book: everyone who got in touch from the brochure (inquiries, visit or demo bookings,
// quotation requests, reservations, PDPA requests), bookings against opening hours, and moderated reviews.
// Shared by both shops; the shop-specific parts (quotations, kittens) live in extras.ts.
import type { Catalog } from './catalog.ts'
import { emailOf, lineIdOf, phoneOf, requireManager, route, text } from './http.ts'
import { getStaff, log, nextId, publicStaff, releaseUnit } from './logic.ts'
import type { Store } from './store.ts'
import type {
  Booking,
  BookingStatus,
  CrmCounts,
  Db,
  Lang,
  Lead,
  LeadKind,
  LeadStatus,
  Review,
  ReviewStatus,
  Staff,
} from './types.ts'
import { HttpError, addDays, beStamp, dayKey, hhmm, minutesOf, weekdayOf, type Rng } from './util.ts'

export const LEAD_STATUSES: LeadStatus[] = ['new', 'contacted', 'scheduled', 'won', 'lost', 'closed']
export const BOOKING_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'done', 'cancelled', 'no-show']
/** Bookings that hold their slot */
const HOLDS_SLOT: BookingStatus[] = ['pending', 'confirmed']

/** LD691106-0001: prefix, Buddhist-era date, running number of the day. */
export function nextNo(db: Db, prefix: string, now: Date): string {
  const d = dayKey(now)
  const key = `${prefix}:${d}`
  db.counters[key] = (db.counters[key] ?? 0) + 1
  return `${prefix}${beStamp(d)}-${String(db.counters[key]).padStart(4, '0')}`
}

const KIND_LABEL: Record<LeadKind, string> = {
  inquiry: 'สอบถาม',
  booking: 'นัดหมาย',
  quote: 'ขอใบเสนอราคา',
  reservation: 'จองลูกแมว',
  privacy: 'คำขอตาม PDPA',
}

// ---------- Leads ----------

export interface LeadInput {
  kind: LeadKind
  name: string
  phone: string
  email?: string | null
  lineId?: string | null
  message?: string | null
  refIds?: string[]
  page?: string | null
  lang?: Lang
  request?: Lead['request']
}

export function createLead(db: Db, input: LeadInput, now: Date): Lead {
  const at = now.toISOString()
  const lead: Lead = {
    id: nextId(db, 'ld'),
    no: nextNo(db, 'LD', now),
    createdAt: at,
    updatedAt: at,
    kind: input.kind,
    status: 'new',
    name: input.name,
    phone: input.phone,
    email: input.email ?? null,
    lineId: input.lineId ?? null,
    message: input.message ?? null,
    refIds: input.refIds ?? [],
    page: input.page ?? null,
    lang: input.lang ?? 'th',
    consentAt: at,
    notes: [],
    assignedTo: null,
    linked: {},
    request: input.request ?? null,
    anonymisedAt: null,
  }
  db.leads.push(lead)
  log(db, 'customer', null, `${KIND_LABEL[lead.kind]}ใหม่จากเว็บไซต์ ${lead.no}: ${lead.name}`, lead.no, now)
  return lead
}

/** Contact details every public form asks for, validated. */
export function personOf(body: any) {
  return {
    name: text(body?.name, 'ชื่อ', { max: 120, en: 'your name', key: 'name' })!,
    phone: phoneOf(body?.phone),
    email: emailOf(body?.email),
    lineId: lineIdOf(body?.lineId),
  }
}

/** Breed or model ids a form refers to, kept only when the catalogue knows them. */
export function refIdsOf(v: unknown, catalog: Catalog): string[] {
  const list = Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : []
  return [...new Set(list.filter((x): x is string => typeof x === 'string' && catalog.records.has(x)))].slice(0, 10)
}

export const findLead = (db: Db, id: string) => {
  const lead = db.leads.find((l) => l.id === id || l.no === id)
  if (!lead) throw new HttpError(404, 'ไม่พบรายชื่อนี้')
  return lead
}

export function updateLead(db: Db, staff: Staff, id: string, patch: { status?: unknown; assignedTo?: unknown; note?: unknown }, now: Date): Lead {
  const lead = findLead(db, id)
  if (lead.anonymisedAt) throw new HttpError(409, 'ข้อมูลรายนี้ถูกลบตามคำขอแล้ว แก้ไขไม่ได้')
  const changes: string[] = []
  if (patch.status !== undefined) {
    if (!LEAD_STATUSES.includes(patch.status as LeadStatus)) throw new HttpError(400, 'สถานะไม่ถูกต้อง')
    if (patch.status !== lead.status) changes.push(`สถานะ ${lead.status} → ${patch.status}`)
    lead.status = patch.status as LeadStatus
  }
  if (patch.assignedTo !== undefined) {
    const to = patch.assignedTo === null || patch.assignedTo === '' ? null : String(patch.assignedTo)
    if (to) getStaff(db, to)
    if (to !== lead.assignedTo) changes.push(to ? `มอบหมายให้ ${getStaff(db, to).name}` : 'ยกเลิกการมอบหมาย')
    lead.assignedTo = to
  }
  const note = text(patch.note, 'บันทึก', { required: false, max: 1000 })
  if (note) {
    lead.notes.push({ at: now.toISOString(), staffId: staff.id, staffName: staff.name, text: note })
    changes.push('เพิ่มบันทึก')
  }
  if (!changes.length) return lead
  lead.updatedAt = now.toISOString()
  log(db, 'customer', staff, `อัปเดต ${lead.no} (${lead.name}): ${changes.join(', ')}`, lead.no, now)
  return lead
}

const WIPED = '[ลบข้อมูลตามคำขอ]'

/**
 * PDPA erasure: personal details on the lead and everything linked to it (booking, quotation, reservation)
 * are replaced; the record, its dates and its status stay for the audit trail.
 */
export function anonymiseLead(db: Db, staff: Staff, id: string, now: Date): Lead {
  requireManager(staff)
  const lead = findLead(db, id)
  if (lead.anonymisedAt) return lead
  const at = now.toISOString()
  Object.assign(lead, { name: WIPED, phone: '', email: null, lineId: null, message: null, anonymisedAt: at, updatedAt: at })
  lead.notes = lead.notes.map((n) => ({ ...n, text: WIPED }))
  for (const b of db.bookings.filter((x) => x.leadId === lead.id)) Object.assign(b, { name: WIPED, phone: '', email: null, note: null, updatedAt: at })
  for (const q of db.quotations.filter((x) => x.leadId === lead.id)) {
    q.customer = { name: WIPED, company: null, taxId: null, phone: '', email: null, address: null }
    q.updatedAt = at
  }
  for (const r of db.reservations.filter((x) => x.leadId === lead.id)) {
    r.customer = { name: WIPED, phone: '', email: null, lineId: null, address: null }
    r.updatedAt = at
  }
  log(db, 'customer', staff, `ลบข้อมูลส่วนบุคคลของ ${lead.no} ตามคำขอ (PDPA)`, lead.no, now)
  return lead
}

// ---------- Bookings ----------

export interface SlotDay {
  date: string
  open: boolean
  /** Opening hours that day, when open */
  hours: { open: string; close: string } | null
  durationMin: number
  slots: { time: string; available: boolean }[]
}

/** Visitors book from tomorrow up to `windowDays` ahead; staff may also book today. */
export function bookingWindow(catalog: Catalog, now: Date, staffSide = false) {
  const today = dayKey(now)
  return { from: staffSide ? today : addDays(today, 1), to: addDays(today, catalog.booking.windowDays) }
}

export function slotsFor(db: Db, catalog: Catalog, date: string, now: Date, opts: { staffSide?: boolean; ignoreId?: string } = {}): SlotDay {
  const durationMin = catalog.booking.durationMin
  const closed: SlotDay = { date, open: false, hours: null, durationMin, slots: [] }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return closed
  const { from, to } = bookingWindow(catalog, now, opts.staffSide)
  if (date < from || date > to) return closed
  const h = (db.settings.hours ?? []).find((x) => x.day === weekdayOf(date))
  if (!h) return closed
  const taken = new Set(
    db.bookings.filter((b) => b.date === date && HOLDS_SLOT.includes(b.status) && b.id !== opts.ignoreId).map((b) => b.time),
  )
  const slots: SlotDay['slots'] = []
  // Same-day staff bookings only offer slots that haven't started yet
  const nowMin = date === dayKey(now) ? minutesOf(new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(11, 16)) : -1
  for (let m = minutesOf(h.open); m + durationMin <= minutesOf(h.close); m += durationMin) {
    if (m <= nowMin) continue
    slots.push({ time: hhmm(m), available: !taken.has(hhmm(m)) })
  }
  return { date, open: true, hours: { open: h.open, close: h.close }, durationMin, slots }
}

function checkSlot(db: Db, catalog: Catalog, date: unknown, time: unknown, now: Date, opts: { staffSide?: boolean; ignoreId?: string } = {}) {
  const d = typeof date === 'string' ? date : ''
  const t = typeof time === 'string' ? time : ''
  const day = slotsFor(db, catalog, d, now, opts)
  const slot = day.slots.find((s) => s.time === t)
  if (!day.open || !slot) {
    throw new HttpError(400, 'วันหรือเวลานัดนี้ไม่เปิดให้จอง เลือกช่วงเวลาที่มีในปฏิทิน', 'SLOT_INVALID', 'That date or time is not open for booking. Please pick a listed slot.')
  }
  if (!slot.available) throw new HttpError(409, 'ช่วงเวลานี้มีผู้จองแล้ว เลือกเวลาอื่น', 'SLOT_TAKEN', 'That slot was just taken. Please pick another time.')
  return { date: d, time: t }
}

export interface BookingInput {
  date: unknown
  time: unknown
  refId?: string | null
  name: string
  phone: string
  email?: string | null
  lineId?: string | null
  note?: string | null
  lang?: Lang
  page?: string | null
}

export function createBooking(db: Db, catalog: Catalog, input: BookingInput, now: Date, opts: { staffSide?: boolean } = {}): Booking {
  const { date, time } = checkSlot(db, catalog, input.date, input.time, now, opts)
  const at = now.toISOString()
  const lead = createLead(
    db,
    {
      kind: 'booking',
      name: input.name,
      phone: input.phone,
      email: input.email,
      lineId: input.lineId,
      message: input.note ?? null,
      refIds: input.refId ? [input.refId] : [],
      page: input.page ?? null,
      lang: input.lang,
    },
    now,
  )
  const booking: Booking = {
    id: nextId(db, 'bk'),
    no: nextNo(db, 'BK', now),
    createdAt: at,
    updatedAt: at,
    date,
    time,
    durationMin: catalog.booking.durationMin,
    refId: input.refId ?? null,
    name: input.name,
    phone: input.phone,
    email: input.email ?? null,
    note: input.note ?? null,
    lang: input.lang ?? 'th',
    status: 'pending',
    leadId: lead.id,
  }
  db.bookings.push(booking)
  lead.linked.bookingNo = booking.no
  log(db, 'customer', null, `นัด${catalog.booking.label} ${booking.no} วันที่ ${date} เวลา ${time} (${booking.name})`, booking.no, now)
  return booking
}

export const findBooking = (db: Db, id: string) => {
  const b = db.bookings.find((x) => x.id === id || x.no === id)
  if (!b) throw new HttpError(404, 'ไม่พบนัดหมายนี้')
  return b
}

export function updateBooking(db: Db, catalog: Catalog, staff: Staff, id: string, patch: any, now: Date): Booking {
  const b = findBooking(db, id)
  const changes: string[] = []
  if (patch.date !== undefined || patch.time !== undefined) {
    const slot = checkSlot(db, catalog, patch.date ?? b.date, patch.time ?? b.time, now, { staffSide: true, ignoreId: b.id })
    if (slot.date !== b.date || slot.time !== b.time) changes.push(`เลื่อนเป็น ${slot.date} ${slot.time}`)
    b.date = slot.date
    b.time = slot.time
  }
  if (patch.status !== undefined) {
    if (!BOOKING_STATUSES.includes(patch.status)) throw new HttpError(400, 'สถานะนัดหมายไม่ถูกต้อง')
    if (patch.status !== b.status) changes.push(`สถานะ ${b.status} → ${patch.status}`)
    b.status = patch.status
    const lead = b.leadId ? db.leads.find((l) => l.id === b.leadId) : undefined
    if (lead && patch.status === 'confirmed' && (lead.status === 'new' || lead.status === 'contacted')) {
      lead.status = 'scheduled'
      lead.updatedAt = now.toISOString()
    }
  }
  if (patch.note !== undefined) {
    b.note = text(patch.note, 'หมายเหตุ', { required: false, max: 500 })
    changes.push('แก้หมายเหตุ')
  }
  if (!changes.length) return b
  b.updatedAt = now.toISOString()
  log(db, 'customer', staff, `นัดหมาย ${b.no} (${b.name}): ${changes.join(', ')}`, b.no, now)
  return b
}

// ---------- Reviews ----------

export function createReview(db: Db, catalog: Catalog, body: any, now: Date): Review {
  const refId = typeof body?.refId === 'string' ? body.refId : ''
  if (!catalog.records.has(refId)) throw new HttpError(400, 'ไม่พบรุ่นหรือสายพันธุ์ที่รีวิว', 'VALIDATION', 'Unknown model or breed.')
  const rating = Number(body?.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new HttpError(400, 'ให้คะแนน 1 ถึง 5 ดาว', 'VALIDATION', 'Please give a rating from 1 to 5 stars.')
  }
  const name = text(body?.name, 'ชื่อที่แสดง', { max: 60, en: 'a display name', key: 'name' })!
  const title = text(body?.title, 'หัวข้อรีวิว', { required: false, max: 120, en: 'a title', key: 'title' })
  const reviewBody = text(body?.body, 'ข้อความรีวิว', { max: 2000, en: 'your review', key: 'body' })!
  if (reviewBody.length < 10) throw new HttpError(400, 'เล่าประสบการณ์อย่างน้อย 10 ตัวอักษร', 'VALIDATION', 'Please write at least 10 characters.')
  const review: Review = {
    id: nextId(db, 'rv'),
    refId,
    name,
    rating,
    title,
    body: reviewBody,
    lang: body?.lang === 'en' ? 'en' : 'th',
    status: 'pending',
    createdAt: now.toISOString(),
    moderatedBy: null,
    moderatedAt: null,
  }
  db.reviews.push(review)
  log(db, 'product', null, `รีวิวใหม่รอตรวจ ${rating} ดาว (${refId}) จาก ${name}`, review.id, now)
  return review
}

export function reviewSummary(db: Db, refId?: string | null) {
  const rows = db.reviews
    .filter((r) => r.status === 'approved' && (!refId || r.refId === refId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const average = rows.length ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / rows.length) * 10) / 10 : null
  return {
    average,
    count: rows.length,
    rows: rows.map(({ id, refId: ref, name, rating, title, body, lang, createdAt }) => ({ id, refId: ref, name, rating, title, body, lang, createdAt })),
  }
}

/** Average and count per breed/model, for cards */
export function reviewTotals(db: Db) {
  const out: Record<string, { average: number; count: number }> = {}
  for (const r of db.reviews) {
    if (r.status !== 'approved') continue
    const t = (out[r.refId] ??= { average: 0, count: 0 })
    t.average = (t.average * t.count + r.rating) / (t.count + 1)
    t.count += 1
  }
  for (const t of Object.values(out)) t.average = Math.round(t.average * 10) / 10
  return out
}

export function moderateReview(db: Db, staff: Staff, id: string, status: unknown, now: Date): Review {
  requireManager(staff)
  const r = db.reviews.find((x) => x.id === id)
  if (!r) throw new HttpError(404, 'ไม่พบรีวิวนี้')
  if (!(['approved', 'rejected', 'pending'] as ReviewStatus[]).includes(status as ReviewStatus)) throw new HttpError(400, 'สถานะรีวิวไม่ถูกต้อง')
  r.status = status as ReviewStatus
  r.moderatedBy = staff.name
  r.moderatedAt = now.toISOString()
  log(db, 'product', staff, `${status === 'approved' ? 'อนุมัติ' : status === 'rejected' ? 'ไม่อนุมัติ' : 'ย้อนสถานะ'}รีวิวของ ${r.name} (${r.refId})`, r.id, now)
  return r
}

// ---------- Overview & housekeeping ----------

export function crmCounts(db: Db, now: Date): CrmCounts {
  const today = dayKey(now)
  const at = now.toISOString()
  const active = (b: Booking) => HOLDS_SLOT.includes(b.status)
  return {
    newLeads: db.leads.filter((l) => l.status === 'new' && !l.anonymisedAt).length,
    openLeads: db.leads.filter((l) => ['new', 'contacted', 'scheduled'].includes(l.status) && !l.anonymisedAt).length,
    bookingsToday: db.bookings.filter((b) => b.date === today && active(b)).length,
    bookingsUpcoming: db.bookings.filter((b) => b.date > today && active(b)).length,
    pendingReviews: db.reviews.filter((r) => r.status === 'pending').length,
    quotesOpen: db.quotations.filter((q) => (q.status === 'sent' || q.status === 'accepted') && q.validUntil > at).length,
    reservationsHeld: db.reservations.filter((r) => r.status === 'pending-payment' || r.status === 'held').length,
  }
}

/** Anything whose time ran out: unpaid or uncollected reservations, unanswered quotations. */
export function housekeepingDue(db: Db, now: Date): boolean {
  const at = now.toISOString()
  return (
    db.reservations.some((r) => (r.status === 'pending-payment' || r.status === 'held') && r.holdUntil <= at) ||
    db.quotations.some((q) => q.status === 'sent' && q.validUntil <= at)
  )
}

export function housekeepDb(db: Db, now: Date) {
  const at = now.toISOString()
  for (const r of db.reservations) {
    if ((r.status !== 'pending-payment' && r.status !== 'held') || r.holdUntil > at) continue
    const unpaid = r.status === 'pending-payment'
    r.status = 'expired'
    r.updatedAt = at
    r.cancelReason = unpaid ? 'ไม่ได้ชำระมัดจำภายในเวลา' : 'ไม่ได้มารับลูกแมวภายในเวลาที่จอง'
    const unit = db.kittens.find((u) => u.id === r.unitId)
    if (unit) releaseUnit(db, unit, now, null, `การจอง ${r.no} หมดอายุ`)
    log(db, 'stock', null, `การจอง ${r.no} หมดอายุ (${r.cancelReason})`, r.no, now)
  }
  for (const q of db.quotations) {
    if (q.status !== 'sent' || q.validUntil > at) continue
    q.status = 'expired'
    q.updatedAt = at
  }
}

/** Runs housekeeping through the store, writing only when something lapsed. */
export function housekeep(store: Store, now: Date) {
  if (housekeepingDue(store.get(), now)) store.write((db) => housekeepDb(db, now))
}

// ---------- Seeding ----------

export interface LeadSeed {
  kind: 'inquiry' | 'privacy'
  name: string
  phone: string
  email?: string | null
  lineId?: string | null
  message: string
  refIds?: string[]
  daysAgo: number
  status: LeadStatus
  note?: string
  request?: Lead['request']
}

export interface BookingSeed {
  name: string
  phone: string
  email?: string | null
  note?: string | null
  refId?: string | null
  /** Days from today: negative = already happened */
  dayOffset: number
  /** Which slot of that day */
  slot: number
  status: BookingStatus
}

/** Demo contacts for the admin: inquiries, privacy requests and bookings (past and upcoming). No reviews. */
export function seedCrm(db: Db, catalog: Catalog, r: Rng, now: Date) {
  const staff = db.staff.filter((s) => s.role === 'staff')
  const manager = db.staff.find((s) => s.role === 'manager') ?? db.staff[0]
  for (const s of catalog.crmSeed.leads) {
    const at = new Date(now.getTime() - s.daysAgo * 86_400_000 - r.int(1, 8) * 3_600_000)
    const lead = createLead(
      db,
      { kind: s.kind, name: s.name, phone: s.phone, email: s.email, lineId: s.lineId, message: s.message, refIds: s.refIds, page: '/contact', request: s.request },
      at,
    )
    lead.status = s.status
    if (s.status !== 'new') lead.assignedTo = r.pick(staff.length ? staff : [manager]).id
    if (s.note) {
      const by = db.staff.find((x) => x.id === lead.assignedTo) ?? manager
      lead.notes.push({ at: new Date(at.getTime() + 3 * 3_600_000).toISOString(), staffId: by.id, staffName: by.name, text: s.note })
    }
    lead.updatedAt = new Date(at.getTime() + 3 * 3_600_000).toISOString()
  }
  for (const s of catalog.crmSeed.bookings) {
    // Book on the right day by pretending "now" is the day before, inside the visitor window
    const target = addDays(dayKey(now), s.dayOffset)
    const planned = new Date(`${addDays(target, -r.int(2, 6))}T03:00:00Z`)
    const madeAt = planned < now ? planned : new Date(now.getTime() - 2 * 3_600_000)
    const day = slotsFor(db, catalog, target, madeAt)
    const free = day.slots.filter((x) => x.available)
    if (!free.length) continue
    const slot = free[Math.min(s.slot, free.length - 1)]
    const b = createBooking(
      db,
      catalog,
      { date: target, time: slot.time, refId: s.refId ?? null, name: s.name, phone: s.phone, email: s.email ?? null, note: s.note ?? null, page: '/booking' },
      madeAt,
    )
    b.status = s.status
    const lead = db.leads.find((l) => l.id === b.leadId)
    if (lead) {
      lead.status = s.status === 'done' ? 'won' : s.status === 'confirmed' ? 'scheduled' : s.status === 'cancelled' || s.status === 'no-show' ? 'lost' : 'new'
      if (lead.status !== 'new') lead.assignedTo = r.pick(staff.length ? staff : [manager]).id
    }
  }
}

// ---------- Admin routes ----------

const leadView = (db: Db, lead: Lead) => ({
  ...lead,
  assignee: lead.assignedTo ? publicStaff(getStaff(db, lead.assignedTo)) : null,
})

export function registerCrmRoutes() {
  route('GET', '/api/leads', ({ store, query }) => {
    const db = store.get()
    const kind = query.get('kind')
    const status = query.get('status')
    const q = (query.get('q') ?? '').trim().toLowerCase()
    const limit = Math.min(Number(query.get('limit') ?? 50) || 50, 500)
    const offset = Math.max(Number(query.get('offset') ?? 0) || 0, 0)
    const rows = db.leads
      .filter((l) => (!kind || l.kind === kind) && (!status || l.status === status))
      .filter((l) => !q || `${l.no} ${l.name} ${l.phone} ${l.email ?? ''} ${l.message ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const counts = Object.fromEntries(LEAD_STATUSES.map((s) => [s, db.leads.filter((l) => l.status === s).length]))
    return { total: rows.length, counts, rows: rows.slice(offset, offset + limit).map((l) => leadView(db, l)) }
  })

  route('GET', '/api/leads/:id', ({ store, params }) => {
    const db = store.get()
    const lead = findLead(db, params.id)
    return {
      lead: leadView(db, lead),
      booking: db.bookings.find((b) => b.leadId === lead.id) ?? null,
      quotation: db.quotations.find((q) => q.leadId === lead.id) ?? null,
      reservation: db.reservations.find((r) => r.leadId === lead.id) ?? null,
    }
  })

  route('PATCH', '/api/leads/:id', ({ store, params, body, staff, now }) =>
    store.write((db) => leadView(db, updateLead(db, staff, params.id, body ?? {}, now))),
  )

  route('POST', '/api/leads/:id/anonymise', ({ store, params, staff, now }) =>
    store.write((db) => leadView(db, anonymiseLead(db, staff, params.id, now))),
  )

  route('GET', '/api/bookings', ({ store, query }) => {
    const db = store.get()
    const from = query.get('from')
    const to = query.get('to')
    const status = query.get('status')
    const rows = db.bookings
      .filter((b) => (!from || b.date >= from) && (!to || b.date <= to) && (!status || b.status === status))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    return { rows }
  })

  route('GET', '/api/bookings/slots', ({ store, catalog, query, now }) =>
    slotsFor(store.get(), catalog, query.get('date') ?? '', now, { staffSide: true }),
  )

  route('PATCH', '/api/bookings/:id', ({ store, catalog, params, body, staff, now }) =>
    store.write((db) => updateBooking(db, catalog, staff, params.id, body ?? {}, now)),
  )

  route('GET', '/api/reviews', ({ store, query }) => {
    const db = store.get()
    const status = query.get('status')
    const refId = query.get('refId')
    return {
      rows: db.reviews
        .filter((r) => (!status || r.status === status) && (!refId || r.refId === refId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    }
  })

  route('PATCH', '/api/reviews/:id', ({ store, params, body, staff, now }) =>
    store.write((db) => moderateReview(db, staff, params.id, body?.status, now)),
  )
}
