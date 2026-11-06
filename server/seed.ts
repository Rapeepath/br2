// Builds a fresh database with 60 days of simulated trading, replayed through the real POS rules (shifts,
// checkout, refunds, deliveries) so every figure on the admin screens adds up.
import type { Catalog } from './catalog.ts'
import { housekeepDb, seedCrm } from './crm.ts'
import { seedExtras } from './extras.ts'
import { cashMove, checkout, closeShift, getStaff, log, nextId, openShift, quote, receiveStock, refund, shiftView } from './logic.ts'
import type { CartLineInput, Db, Order, Product } from './types.ts'
import { addDays, bkkTime, dayKey, dayRange, hashPin, money, rng, type Rng } from './util.ts'

// Bump when seeded data changes shape or ids, so an older .pos-data file reseeds itself on start
// (2: Servo robot trims got unique ids/SKUs, e.g. G1 vs G1+; 3: contact book, bookings, reviews, quotations,
// kittens and reservations)
export const DB_VERSION = 3
export const HISTORY_DAYS = 60

/** Opening stock for the first pass, large enough that nothing sells out. */
const PLENTY = 100_000

export function seed(catalog: Catalog, now = new Date()): Db {
  // Pass 1 finds how much opening stock each product needs; pass 2 replays the same days with exactly that,
  // so the shelves end at a believable level and every running balance in the stock card is real.
  const probe = simulate(catalog, now, () => PLENTY)
  const pick = rng(catalog.seed + 1)
  const opening = new Map<string, number>()
  for (const p of probe.products) {
    if (!p.trackStock) continue
    const balances = probe.movements.filter((m) => m.productId === p.id).map((m) => m.balance)
    const lowest = Math.min(...balances)
    const target = catalog.stockTarget(p, pick)
    const cut = Math.min(p.stock - target, lowest)
    opening.set(p.id, PLENTY - cut)
  }
  const db = simulate(catalog, now, (p) => opening.get(p.id) ?? 0)
  // The brochure's side of the shop: demo contacts and bookings, then each shop's own records
  seedCrm(db, catalog, rng(catalog.seed + 7), now)
  seedExtras(db, catalog, rng(catalog.seed + 11), now)
  housekeepDb(db, now)
  return db
}

function emptyDb(catalog: Catalog, now: Date, firstAt: Date): Db {
  return {
    version: DB_VERSION,
    seededAt: now.toISOString(),
    settings: { ...catalog.settings },
    categories: catalog.categories.map((c) => ({ ...c })),
    staff: catalog.staff.map(({ pin, ...s }) => ({ ...s, pinHash: hashPin(s.id, pin) })),
    sessions: [],
    products: catalog.products(firstAt.toISOString()),
    customers: [],
    orders: [],
    movements: [],
    shifts: [],
    activity: [],
    counters: {},
    leads: [],
    bookings: [],
    reviews: [],
    quotations: [],
    kittens: [],
    reservations: [],
  }
}

type DayEvent =
  | { at: Date; kind: 'sale'; lines: CartLineInput[]; refundLater: boolean; idx: number }
  | { at: Date; kind: 'refund'; idx: number }
  | { at: Date; kind: 'payout'; amount: number }

function simulate(catalog: Catalog, now: Date, openingStock: (p: Product) => number): Db {
  const r = rng(catalog.seed)
  const today = dayKey(now)
  const first = addDays(today, -(HISTORY_DAYS - 1))
  const firstAt = bkkTime(addDays(first, -1), 17)
  const db = emptyDb(catalog, now, firstAt)
  const manager = db.staff.find((s) => s.role === 'manager') ?? db.staff[0]
  const others = db.staff.filter((s) => s.id !== manager.id)

  // Regulars signed up over the months before the history starts and during it
  catalog.customers.forEach((c, i) => {
    const signed = i < catalog.customers.length * 0.6 ? addDays(first, -r.int(20, 240)) : addDays(first, r.int(0, HISTORY_DAYS - 5))
    db.customers.push({ ...c, id: nextId(db, 'c'), createdAt: bkkTime(signed, r.int(10, 19), r.int(0, 59)).toISOString() })
  })

  for (const p of db.products) {
    if (!p.trackStock) continue
    p.stock = openingStock(p)
    p.reorderLevel = catalog.reorderLevel(p)
    db.movements.push({
      id: nextId(db, 'mv'),
      at: firstAt.toISOString(),
      productId: p.id,
      type: 'initial',
      qty: p.stock,
      balance: p.stock,
      ref: null,
      staffId: manager.id,
      note: 'ยอดยกมาตอนเปิดใช้ระบบ',
    })
  }
  log(db, 'settings', manager, 'เปิดใช้ระบบ POS และนำเข้าสินค้าจากแค็ตตาล็อก', null, firstAt)

  const soldSinceDelivery = new Map<string, number>()
  const days = dayRange(first, today)

  days.forEach((day, dayIndex) => {
    const isToday = day === today
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
    const opener = r.pick(others.length ? others : [manager])
    let openAt = bkkTime(day, catalog.openHour - 1, 40 + r.int(0, 15))
    // Today's shift is always open, even when the admin is opened before trading hours
    if (isToday && openAt > now) openAt = new Date(now.getTime() - 30 * 60_000)
    log(db, 'login', opener, `${opener.name} เข้าสู่ระบบ`, null, new Date(openAt.getTime() - 60_000))
    openShift(db, opener, catalog.openingCash, openAt)

    // Deliveries top the shelves back up to where they were
    if (dayIndex > 0 && dayIndex % catalog.deliveryEvery === 0) {
      const at = bkkTime(day, catalog.openHour, 15 + r.int(0, 20))
      if (at <= now) {
        for (const p of db.products) {
          const qty = soldSinceDelivery.get(p.id) ?? 0
          if (p.trackStock && qty > 0) receiveStock(db, manager, p.id, qty, 'รับสินค้าตามรอบส่งของ', at)
        }
        soldSinceDelivery.clear()
      }
    }

    const events: DayEvent[] = []
    const n = catalog.ordersPerDay(r, weekday)
    const span = (catalog.closeHour - catalog.openHour) * 60 - 20
    for (let i = 0; i < n; i++) {
      const minute = catalog.openHour * 60 + 5 + r.int(0, span)
      const at = bkkTime(day, 0, minute, r.int(0, 59))
      events.push({ at, kind: 'sale', lines: catalog.basket(r, db.products), refundLater: r.chance(0.02), idx: i })
    }
    if (r.chance(0.25)) {
      events.push({ at: bkkTime(day, catalog.openHour + r.int(1, 6), r.int(0, 59)), kind: 'payout', amount: r.int(12, 45) * 10 })
    }
    events.sort((a, b) => a.at.getTime() - b.at.getTime())
    for (const e of [...events]) {
      if (e.kind === 'sale' && e.refundLater) {
        events.push({ at: new Date(e.at.getTime() + r.int(40, 150) * 60_000), kind: 'refund', idx: e.idx })
      }
    }
    events.sort((a, b) => a.at.getTime() - b.at.getTime())

    const placed = new Map<number, Order>()
    const closeAt = bkkTime(day, catalog.closeHour, 5 + r.int(0, 15))
    for (const e of events) {
      if (e.at > now || (!isToday && e.at > closeAt)) continue
      if (e.kind === 'sale') {
        const order = simulateSale(db, catalog, r, e.lines, e.at)
        if (order) {
          placed.set(e.idx, order)
          for (const l of order.lines) soldSinceDelivery.set(l.productId, (soldSinceDelivery.get(l.productId) ?? 0) + l.qty)
        }
      } else if (e.kind === 'refund') {
        const order = placed.get(e.idx)
        if (!order) continue
        const reason = r.pick(['ลูกค้าเปลี่ยนใจภายในวัน', 'คิดเงินผิดรายการ', 'สินค้ามีตำหนิ เปลี่ยนเป็นคืนเงิน'])
        refund(db, getStaff(db, order.staffId), manager, order.id, reason, e.at)
        for (const l of order.lines) soldSinceDelivery.set(l.productId, (soldSinceDelivery.get(l.productId) ?? 0) - l.qty)
      } else {
        cashMove(db, opener, 'out', e.amount, r.pick(['ซื้อของใช้ในร้าน', 'ค่าส่งเอกสาร', 'ค่าน้ำดื่มลูกค้า']), e.at)
      }
    }

    if (!isToday) {
      const shift = db.shifts[db.shifts.length - 1]
      const expected = shiftView(db, shift, closeAt).expectedNow
      const slip = r.chance(0.12) ? r.pick([-40, -20, 20]) : 0
      const closer = r.chance(0.5) ? manager : opener
      closeShift(db, closer, money(expected + slip), slip ? 'นับเงินซ้ำแล้วยอดเท่าเดิม' : null, closeAt)
      log(db, 'logout', closer, `${closer.name} ออกจากระบบ`, null, new Date(closeAt.getTime() + 60_000))
    }
  })

  return db
}

function simulateSale(db: Db, catalog: Catalog, r: Rng, lines: CartLineInput[], at: Date): Order | null {
  const staff = r.weighted(db.staff, (s) => (s.role === 'manager' ? 1 : 3))
  const eligible = db.customers.filter((c) => c.createdAt <= at.toISOString())
  const customerId = !eligible.length || r.chance(catalog.walkInRate) ? null : r.pick(eligible).id
  const billDiscount = r.chance(0.12) ? { type: 'percent' as const, value: r.pick([5, 10]) } : undefined
  const q = quote(db, { lines, billDiscount })
  const method = catalog.payment(r, q.total)
  const step = q.total < 1000 ? 100 : q.total < 5000 ? 500 : 1000
  const tendered = method === 'cash' ? (r.chance(0.3) ? q.total : Math.ceil(q.total / step) * step) : null
  return checkout(
    db,
    staff,
    { lines, billDiscount, customerId, payment: { method, tendered, cardLast4: method === 'card' ? String(r.int(1000, 9999)) : null } },
    at,
  )
}
