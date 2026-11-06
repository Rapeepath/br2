// Business rules of the simulated POS, kept free of HTTP so they can be unit-tested and reused by the seed.
// Every function takes `now` explicitly: the seed replays 60 days of trading through the same code paths.
import type {
  Activity,
  CartLineInput,
  ActivityType,
  CheckoutInput,
  Dashboard,
  Db,
  DayPoint,
  KittenUnit,
  Order,
  OrderLine,
  PaymentMethod,
  Product,
  PublicStaff,
  Quote,
  Reservation,
  SalesReport,
  SalesSummary,
  Shift,
  Staff,
  StockMovement,
} from './types.ts'
import { HttpError, addDays, beStamp, bkkHour, dayKey, dayRange, hashPin, money } from './util.ts'

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'promptpay', 'card', 'transfer']

export const publicStaff = ({ pinHash: _pinHash, ...rest }: Staff): PublicStaff => rest

export function nextId(db: Db, prefix: string): string {
  db.counters[prefix] = (db.counters[prefix] ?? 0) + 1
  return `${prefix}${String(db.counters[prefix]).padStart(5, '0')}`
}

function nextReceiptNo(db: Db, day: string): string {
  const key = `receipt:${day}`
  db.counters[key] = (db.counters[key] ?? 0) + 1
  return `${db.settings.receiptPrefix}${beStamp(day)}-${String(db.counters[key]).padStart(4, '0')}`
}

export function log(db: Db, type: ActivityType, staff: Staff | null, message: string, ref: string | null, now: Date) {
  const entry: Activity = {
    id: nextId(db, 'act'),
    at: now.toISOString(),
    type,
    staffId: staff?.id ?? null,
    staffName: staff?.name ?? null,
    message,
    ref,
  }
  db.activity.push(entry)
}

export function getProduct(db: Db, id: string): Product {
  const p = db.products.find((x) => x.id === id)
  if (!p) throw new HttpError(404, 'ไม่พบสินค้านี้')
  return p
}

export function getStaff(db: Db, id: string): Staff {
  const s = db.staff.find((x) => x.id === id)
  if (!s) throw new HttpError(404, 'ไม่พบพนักงานนี้')
  return s
}

function moveStock(
  db: Db,
  product: Product,
  type: StockMovement['type'],
  qty: number,
  now: Date,
  staff: Staff | null,
  ref: string | null,
  note: string | null,
) {
  product.stock += qty
  product.updatedAt = now.toISOString()
  db.movements.push({
    id: nextId(db, 'mv'),
    at: now.toISOString(),
    productId: product.id,
    type,
    qty,
    balance: product.stock,
    ref,
    staffId: staff?.id ?? null,
    note,
  })
}

// ---------- Pricing ----------

const isWholePositive = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0

/** The kittens a cart line names: `unitIds`, or the single `unitId` */
const namedUnits = (l: CartLineInput): string[] =>
  Array.isArray(l.unitIds) && l.unitIds.length ? l.unitIds.map(String) : l.unitId ? [String(l.unitId)] : []

const byAge = (a: KittenUnit, b: KittenUnit) => a.birthDate.localeCompare(b.birthDate) || a.code.localeCompare(b.code)

/** A reservation the till may complete: found, and paid (held) */
function heldReservation(db: Db, no: string): Reservation {
  const r = db.reservations.find((x) => x.no === no || x.id === no)
  if (!r) throw new HttpError(404, 'ไม่พบการจองนี้')
  if (r.status !== 'held') {
    throw new HttpError(409, r.status === 'pending-payment' ? 'การจองนี้ยังไม่ได้ชำระมัดจำ' : `การจอง ${r.no} ไม่อยู่ในสถานะรอรับลูกแมว`)
  }
  return r
}

/**
 * Prices a cart from the catalogue (never from what the client sends) and checks stock. A quotation prices
 * items for later delivery, so it skips the stock check (ignoreStock).
 *
 * Unit-tracked products (kittens) are priced kitten by kitten: a line names its kittens (`unitIds`/`unitId`,
 * qty = how many) or takes the oldest available ones, and each is charged its own price (the record's
 * override, else the product's). With `reservationNo` the reserved kitten counts as on sale, is put on the
 * bill, and its paid deposit comes off what is due.
 */
export function quote(
  db: Db,
  input: Pick<CheckoutInput, 'lines' | 'billDiscount' | 'reservationNo'>,
  opts: { ignoreStock?: boolean } = {},
): Quote {
  if (!Array.isArray(input.lines) || input.lines.length === 0) throw new HttpError(400, 'ยังไม่มีสินค้าในบิล')
  const reservation = input.reservationNo ? heldReservation(db, input.reservationNo) : null

  const rows = input.lines.map((l) => {
    const named = namedUnits(l)
    if (named.length) {
      if (l.qty !== undefined && l.qty !== null && l.qty !== named.length) throw new HttpError(400, 'จำนวนในรายการไม่ตรงกับจำนวนลูกแมวที่เลือก')
      return { ...l, qty: named.length, named }
    }
    if (!isWholePositive(l.qty)) throw new HttpError(400, 'จำนวนสินค้าต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป')
    return { ...l, named }
  })

  // The reserved kitten must be on the bill: named on a line, or taken by a one-kitten line of its product
  if (reservation) {
    const reservedUnit = db.kittens.find((u) => u.id === reservation.unitId)
    const named = rows.some((r) => r.named.some((id) => id === reservation.unitId || id === reservedUnit?.code))
    if (!named) {
      const line = rows.find((r) => r.productId === reservation.productId && !r.named.length)
      if (!line) throw new HttpError(400, 'บิลต้องมีลูกแมวตัวที่จองไว้')
      if (line.qty !== 1) throw new HttpError(400, 'ลูกแมวที่จองขายได้ทีละตัว')
      line.named = [reservation.unitId]
    }
  }

  // Named kittens: each once, of the line's product, on sale (or held by this reservation)
  const taken = new Set<string>()
  for (const r of rows) {
    r.named = r.named.map((id) => {
      const u = db.kittens.find((x) => x.id === id || x.code === id)
      if (!u || u.productId !== r.productId) throw new HttpError(400, 'ลูกแมวที่เลือกไม่ตรงกับสินค้าในบิล')
      if (taken.has(u.id)) throw new HttpError(400, `เลือกลูกแมว ${u.name} (${u.code}) ซ้ำในบิล`)
      const onSale = u.status === 'available' || (u.status === 'reserved' && reservation?.unitId === u.id)
      if (!onSale) throw new HttpError(409, `ลูกแมว ${u.name} (${u.code}) ไม่พร้อมขาย`)
      taken.add(u.id)
      return u.id
    })
  }

  // The same product added twice counts against one stock figure
  const wanted = new Map<string, number>()
  for (const r of rows) wanted.set(r.productId, (wanted.get(r.productId) ?? 0) + r.qty)

  const lines: OrderLine[] = rows.map((r) => {
    const p = getProduct(db, r.productId)
    if (!p.active) throw new HttpError(400, `${p.name} ปิดการขายอยู่`)
    if (r.named.length && !p.unitTracked) throw new HttpError(400, `${p.name} ไม่ได้ขายเป็นรายตัว`)

    let gross: number
    let unitIds: string[] | undefined
    if (p.unitTracked) {
      // Kittens the line doesn't name: the oldest on sale that no other line took
      const missing = r.qty - r.named.length
      const pool = db.kittens.filter((u) => u.productId === p.id && u.status === 'available' && !taken.has(u.id)).sort(byAge)
      if (missing > pool.length && !opts.ignoreStock) {
        throw new HttpError(409, `${p.name} เหลือในสต็อก ${pool.length} ${unitOf(db, p)} ไม่พอสำหรับ ${missing} ${unitOf(db, p)}`)
      }
      const picked = pool.slice(0, missing).map((u) => u.id)
      picked.forEach((id) => taken.add(id))
      unitIds = [...r.named, ...picked]
      const units = unitIds.map((id) => db.kittens.find((u) => u.id === id)!)
      // A quotation may price more kittens than are on sale: those at the product's price
      gross = money(units.reduce((s, u) => s + (u.price ?? p.price), 0) + p.price * (r.qty - units.length))
    } else {
      if (!opts.ignoreStock && p.trackStock && (wanted.get(p.id) ?? 0) > p.stock) {
        throw new HttpError(409, `${p.name} เหลือในสต็อก ${p.stock} ${unitOf(db, p)} ไม่พอสำหรับ ${wanted.get(p.id)} ${unitOf(db, p)}`)
      }
      gross = money(p.price * r.qty)
    }

    const discount = money(r.discount ?? 0)
    if (discount < 0 || discount > gross) throw new HttpError(400, `ส่วนลดของ ${p.name} ต้องอยู่ระหว่าง 0 ถึงราคารวมของรายการ`)
    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      qty: r.qty,
      // Kittens of one line may differ in price: the line's average (total and subtotal use the exact sum)
      unitPrice: money(gross / r.qty),
      discount,
      total: money(gross - discount),
      // Margins stay on the product's cost
      unitCost: p.cost,
      ...(unitIds ? { unitIds } : {}),
    }
  })

  const subtotal = money(lines.reduce((s, l) => s + l.total + l.discount, 0))
  const lineDiscount = money(lines.reduce((s, l) => s + l.discount, 0))
  const afterLines = money(subtotal - lineDiscount)

  let billDiscount = 0
  const bd = input.billDiscount
  if (bd && bd.value) {
    if (typeof bd.value !== 'number' || bd.value < 0) throw new HttpError(400, 'ส่วนลดท้ายบิลต้องไม่ติดลบ')
    if (bd.type === 'percent') {
      if (bd.value > 100) throw new HttpError(400, 'ส่วนลดเป็นเปอร์เซ็นต์ต้องไม่เกิน 100%')
      billDiscount = money((afterLines * bd.value) / 100)
    } else {
      if (bd.value > afterLines) throw new HttpError(400, 'ส่วนลดท้ายบิลมากกว่ายอดสินค้า')
      billDiscount = money(bd.value)
    }
  }

  const total = money(afterLines - billDiscount)
  const vatRate = db.settings.vatRate
  const vat = money((total * vatRate) / (100 + vatRate))
  const priced: Quote = { lines, subtotal, lineDiscount, billDiscount, total, vat, beforeVat: money(total - vat), vatRate }
  if (!reservation) return priced
  const deposit = reservation.deposit.amount
  if (deposit > total) throw new HttpError(400, `ยอดบิล ${total} บาท น้อยกว่าเงินมัดจำ ${deposit} บาท`)
  return { ...priced, reservationNo: reservation.no, depositApplied: deposit, amountDue: money(total - deposit) }
}
export const unitOf = (db: Db, p: Product) => db.categories.find((c) => c.id === p.categoryId)?.unit ?? 'ชิ้น'

const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: 'เงินสด',
  promptpay: 'พร้อมเพย์',
  card: 'บัตรเครดิต/เดบิต',
  transfer: 'โอนเงิน',
}

const refCode = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 8).toUpperCase()}`

// ---------- Selling ----------

export function openShiftOf(db: Db): Shift | undefined {
  return db.shifts.find((s) => s.status === 'open')
}

export function checkout(db: Db, staff: Staff, input: CheckoutInput, now: Date): Order {
  const shift = openShiftOf(db)
  if (!shift) throw new HttpError(409, 'ยังไม่ได้เปิดกะ เปิดกะและใส่เงินทอนตั้งต้นก่อนเริ่มขาย')

  // A paid reservation: quote() puts its kitten on the bill and takes the deposit off what is due
  const reservation = input.reservationNo ? heldReservation(db, input.reservationNo) : null
  const quotation = input.quotationNo ? db.quotations.find((x) => x.no === input.quotationNo || x.id === input.quotationNo) : null
  if (input.quotationNo && !quotation) throw new HttpError(404, 'ไม่พบใบเสนอราคานี้')
  if (quotation?.status === 'converted') throw new HttpError(409, `ใบเสนอราคา ${quotation.no} ออกบิลไปแล้ว (${quotation.orderNo})`)

  const { reservationNo: _r, depositApplied: _d, amountDue, ...q } = quote(db, input)
  const method = input.payment?.method
  if (!PAYMENT_METHODS.includes(method)) throw new HttpError(400, 'เลือกวิธีชำระเงิน')

  const deposit = reservation ? reservation.deposit.amount : 0
  const due = amountDue ?? q.total

  let tendered: number | null = null
  let change: number | null = null
  if (method === 'cash') {
    tendered = money(Number(input.payment.tendered ?? due))
    if (!(tendered >= due)) throw new HttpError(400, `รับเงินมา ${tendered} บาท น้อยกว่ายอดที่ต้องชำระ ${due} บาท`)
    change = money(tendered - due)
  }
  const last4 = input.payment.cardLast4 ?? null
  if (method === 'card' && last4 !== null && !/^\d{4}$/.test(last4)) throw new HttpError(400, 'เลขท้ายบัตรต้องเป็นตัวเลข 4 หลัก')

  let customerName: string | null = null
  if (input.customerId) {
    const c = db.customers.find((x) => x.id === input.customerId)
    if (!c) throw new HttpError(404, 'ไม่พบลูกค้านี้')
    customerName = c.name
  }

  const day = dayKey(now)
  const order: Order = {
    id: nextId(db, 'o'),
    no: nextReceiptNo(db, day),
    createdAt: now.toISOString(),
    staffId: staff.id,
    staffName: staff.name,
    shiftId: shift.id,
    customerId: input.customerId ?? null,
    customerName,
    ...q,
    payment: {
      method,
      amount: due,
      tendered,
      change,
      reference: method === 'card' ? refCode('AP') : method === 'cash' ? null : refCode(method === 'promptpay' ? 'PP' : 'TR'),
      cardLast4: method === 'card' ? (last4 ?? String(1000 + Math.floor(Math.random() * 9000))) : null,
    },
    status: 'paid',
    refund: null,
    note: input.note?.trim() || null,
    ...(deposit ? { depositApplied: deposit } : {}),
    reservationNo: reservation?.no ?? null,
    quotationNo: quotation?.no ?? null,
  }

  // The reserved kitten comes off hold for this sale, then every kitten the quote priced is sold
  if (reservation) {
    const held = db.kittens.find((u) => u.id === reservation.unitId)
    if (held) releaseUnit(db, held, now, staff, `นำลูกแมวที่จองไว้ (${reservation.no}) มาออกบิล`)
  }
  for (const l of q.lines) {
    const p = getProduct(db, l.productId)
    for (const id of l.unitIds ?? []) {
      const u = db.kittens.find((x) => x.id === id)!
      u.status = 'sold'
      u.orderNo = order.no
      u.updatedAt = now.toISOString()
    }
    if (p.trackStock) moveStock(db, p, 'sale', -l.qty, now, staff, order.no, null)
  }
  db.orders.push(order)

  if (reservation) {
    reservation.status = 'completed'
    reservation.orderNo = order.no
    reservation.updatedAt = now.toISOString()
    markLead(db, reservation.leadId, 'won', now)
  }
  if (quotation) {
    quotation.status = 'converted'
    quotation.orderNo = order.no
    quotation.updatedAt = now.toISOString()
    markLead(db, quotation.leadId, 'won', now)
  }
  const extra = reservation ? ` หักมัดจำ ${reservation.no} ${fmt(deposit)} บาท` : quotation ? ` ตามใบเสนอราคา ${quotation.no}` : ''
  log(db, 'sale', staff, `ขาย ${order.no} ยอด ${fmt(order.total)} บาท (${PAYMENT_LABEL[method]})${extra}`, order.no, now)
  return order
}

function markLead(db: Db, leadId: string | null, status: 'won', now: Date) {
  const lead = leadId ? db.leads.find((l) => l.id === leadId) : undefined
  if (lead && lead.status !== 'won') {
    lead.status = status
    lead.updatedAt = now.toISOString()
  }
}

// ---------- Individual units (kittens) ----------

/** A kitten goes on hold for a reservation: off the shelf (stock −1). */
export function reserveUnit(db: Db, unit: KittenUnit, reservationNo: string, now: Date, staff: Staff | null) {
  if (unit.status !== 'available') throw new HttpError(409, `ลูกแมว ${unit.name} ไม่พร้อมให้จองแล้ว`, 'UNIT_UNAVAILABLE', 'This kitten is no longer available.')
  const p = getProduct(db, unit.productId)
  unit.status = 'reserved'
  unit.reservationNo = reservationNo
  unit.updatedAt = now.toISOString()
  moveStock(db, p, 'adjust', -1, now, staff, reservationNo, `จอง ${unit.name} (${unit.code})`)
}

/** A held kitten comes back on the shelf (stock +1): a reservation ends or is about to be sold. */
export function releaseUnit(db: Db, unit: KittenUnit, now: Date, staff: Staff | null, note: string) {
  if (unit.status !== 'reserved') return
  const p = getProduct(db, unit.productId)
  const ref = unit.reservationNo
  unit.status = 'available'
  unit.reservationNo = null
  unit.updatedAt = now.toISOString()
  moveStock(db, p, 'adjust', 1, now, staff, ref, note)
}

/** Fields of a new kitten; the shop fills in the rest (id, code, status). */
export type KittenFields = Omit<KittenUnit, 'id' | 'code' | 'productId' | 'refId' | 'grade' | 'status' | 'orderNo' | 'reservationNo' | 'createdAt' | 'updatedAt'>

/** A kitten's record with its id and code (K-SIA-0001), without touching stock (the seed uses this directly). */
export function newUnitRecord(db: Db, p: Product, fields: KittenFields, now: Date): KittenUnit {
  const prefix = p.sku.split('-')[1] ?? 'X'
  const key = `kitten:${prefix}`
  db.counters[key] = (db.counters[key] ?? 0) + 1
  const unit: KittenUnit = {
    ...fields,
    id: nextId(db, 'k'),
    code: `K-${prefix}-${String(db.counters[key]).padStart(4, '0')}`,
    productId: p.id,
    refId: p.refId ?? p.id,
    grade: p.variant,
    status: 'available',
    orderNo: null,
    reservationNo: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
  db.kittens.push(unit)
  return unit
}

/** Adds a kitten to a unit-tracked product: a record plus one more on the shelf (stock +1). */
export function addUnit(db: Db, p: Product, fields: KittenFields, now: Date, staff: Staff | null, note: string | null): KittenUnit {
  if (!p.unitTracked) throw new HttpError(400, `ไม่ได้ขาย ${p.name} เป็นรายตัว`)
  const unit = newUnitRecord(db, p, fields, now)
  moveStock(db, p, 'receive', 1, now, staff, unit.code, note ?? `รับลูกแมว ${unit.name} (${unit.code})`)
  return unit
}

/** Takes a kitten off sale (or puts it back): stock follows. */
export function setUnitWithdrawn(db: Db, unit: KittenUnit, withdrawn: boolean, now: Date, staff: Staff, reason: string) {
  const p = getProduct(db, unit.productId)
  if (withdrawn && unit.status === 'available') {
    unit.status = 'withdrawn'
    moveStock(db, p, 'adjust', -1, now, staff, unit.code, reason)
  } else if (!withdrawn && unit.status === 'withdrawn') {
    unit.status = 'available'
    moveStock(db, p, 'adjust', 1, now, staff, unit.code, reason)
  } else return
  unit.updatedAt = now.toISOString()
}

const fmt = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

/** Refunds and stock counts need a manager: a manager signs in themselves, staff enter a manager's PIN. */
export function approver(db: Db, staff: Staff, managerPin: string | null | undefined): Staff {
  if (staff.role === 'manager') return staff
  const manager = managerPin ? db.staff.find((s) => s.role === 'manager' && hashPin(s.id, managerPin) === s.pinHash) : undefined
  if (!manager) throw new HttpError(403, 'ต้องให้ผู้จัดการอนุมัติ ใส่รหัส PIN ของผู้จัดการ')
  return manager
}

export function refund(db: Db, staff: Staff, approvedBy: Staff, orderId: string, reason: string, now: Date): Order {
  const order = db.orders.find((o) => o.id === orderId || o.no === orderId)
  if (!order) throw new HttpError(404, 'ไม่พบบิลนี้')
  if (order.status === 'refunded') throw new HttpError(409, 'บิลนี้คืนเงินไปแล้ว')
  if (!reason?.trim()) throw new HttpError(400, 'ระบุเหตุผลการคืนเงิน')
  if (order.payment.method === 'cash' && !openShiftOf(db)) throw new HttpError(409, 'คืนเงินสดได้เมื่อเปิดกะอยู่เท่านั้น')

  order.status = 'refunded'
  order.refund = { at: now.toISOString(), staffId: staff.id, staffName: staff.name, approvedBy: approvedBy.name, reason: reason.trim() }
  for (const l of order.lines) {
    const p = db.products.find((x) => x.id === l.productId)
    if (p?.trackStock) moveStock(db, p, 'refund', l.qty, now, staff, order.no, reason.trim())
    // Returned kittens are back on sale
    for (const id of l.unitIds ?? []) {
      const u = db.kittens.find((x) => x.id === id)
      if (u && u.status === 'sold') {
        u.status = 'available'
        u.orderNo = null
        u.updatedAt = now.toISOString()
      }
    }
  }
  log(db, 'refund', staff, `คืนเงิน ${order.no} ยอด ${fmt(order.total)} บาท อนุมัติโดย ${approvedBy.name}: ${reason.trim()}`, order.no, now)
  return order
}

// ---------- Stock ----------

export function receiveStock(db: Db, staff: Staff, productId: string, qty: number, note: string | null, now: Date) {
  const p = getProduct(db, productId)
  if (!p.trackStock) throw new HttpError(400, `${p.name} ไม่ได้นับสต็อก`)
  if (p.unitTracked) throw new HttpError(400, 'ลูกแมวรับเข้าเป็นรายตัวที่หน้าลูกแมว เพื่อให้มีประวัติสุขภาพครบ', 'UNIT_TRACKED')
  if (!isWholePositive(qty)) throw new HttpError(400, 'จำนวนที่รับเข้าต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป')
  moveStock(db, p, 'receive', qty, now, staff, null, note?.trim() || null)
  log(db, 'stock', staff, `รับเข้า ${p.name} ${qty} ${unitOf(db, p)} (คงเหลือ ${p.stock})`, p.id, now)
  return p
}

/** Sets the counted stock; the movement records the difference. */
export function adjustStock(db: Db, staff: Staff, productId: string, counted: number, note: string, now: Date) {
  const p = getProduct(db, productId)
  if (!p.trackStock) throw new HttpError(400, `${p.name} ไม่ได้นับสต็อก`)
  if (p.unitTracked) throw new HttpError(400, 'ลูกแมวปรับยอดเป็นรายตัวที่หน้าลูกแมว (ถอนออกจากการขายหรือเพิ่มตัวใหม่)', 'UNIT_TRACKED')
  if (!Number.isInteger(counted) || counted < 0) throw new HttpError(400, 'จำนวนที่นับได้ต้องเป็นจำนวนเต็ม 0 ขึ้นไป')
  if (!note?.trim()) throw new HttpError(400, 'ระบุเหตุผลการปรับสต็อก')
  const diff = counted - p.stock
  if (diff === 0) throw new HttpError(400, 'จำนวนที่นับได้เท่ากับสต็อกในระบบอยู่แล้ว')
  moveStock(db, p, 'adjust', diff, now, staff, null, note.trim())
  log(db, 'stock', staff, `ปรับสต็อก ${p.name} ${diff > 0 ? '+' : ''}${diff} (คงเหลือ ${p.stock}): ${note.trim()}`, p.id, now)
  return p
}

// ---------- Shifts ----------

function shiftCash(db: Db, shift: Shift, until: Date) {
  const from = shift.openedAt
  const to = shift.closedAt ?? until.toISOString()
  let cashSales = 0
  let cashRefunds = 0
  for (const o of db.orders) {
    if (o.payment.method !== 'cash') continue
    // What the drawer took (a reservation's deposit was paid earlier, by transfer)
    if (o.shiftId === shift.id) cashSales += o.payment.amount
    if (o.refund && o.refund.at >= from && o.refund.at <= to) cashRefunds += o.payment.amount
  }
  const moves = shift.cashMoves.reduce((s, m) => s + (m.type === 'in' ? m.amount : -m.amount), 0)
  return { cashSales: money(cashSales), cashRefunds: money(cashRefunds), expected: money(shift.openingCash + cashSales - cashRefunds + moves) }
}

export function shiftView(db: Db, shift: Shift, now: Date) {
  const c = shiftCash(db, shift, now)
  const orders = db.orders.filter((o) => o.shiftId === shift.id)
  return {
    ...shift,
    expectedNow: c.expected,
    cashSales: c.cashSales,
    cashRefunds: c.cashRefunds,
    summary: summarize(orders),
    byPayment: byPayment(orders),
  }
}

export function openShift(db: Db, staff: Staff, openingCash: number, now: Date): Shift {
  if (openShiftOf(db)) throw new HttpError(409, 'มีกะที่เปิดอยู่แล้ว ปิดกะเดิมก่อน')
  if (typeof openingCash !== 'number' || !(openingCash >= 0)) throw new HttpError(400, 'เงินทอนตั้งต้นต้องไม่ติดลบ')
  const shift: Shift = {
    id: nextId(db, 'sh'),
    no: (db.counters.shiftNo = (db.counters.shiftNo ?? 0) + 1),
    status: 'open',
    openedAt: now.toISOString(),
    openedBy: staff.name,
    openingCash: money(openingCash),
    cashMoves: [],
    closedAt: null,
    closedBy: null,
    expectedCash: null,
    countedCash: null,
    difference: null,
    note: null,
  }
  db.shifts.push(shift)
  log(db, 'shift', staff, `เปิดกะ #${shift.no} เงินทอนตั้งต้น ${fmt(shift.openingCash)} บาท`, shift.id, now)
  return shift
}

export function cashMove(db: Db, staff: Staff, type: 'in' | 'out', amount: number, reason: string, now: Date): Shift {
  const shift = openShiftOf(db)
  if (!shift) throw new HttpError(409, 'ยังไม่ได้เปิดกะ')
  if (typeof amount !== 'number' || !(amount > 0)) throw new HttpError(400, 'จำนวนเงินต้องมากกว่า 0')
  if (!reason?.trim()) throw new HttpError(400, 'ระบุเหตุผล')
  if (type === 'out' && amount > shiftCash(db, shift, now).expected) throw new HttpError(409, 'เงินในลิ้นชักไม่พอสำหรับนำออก')
  shift.cashMoves.push({ at: now.toISOString(), type, amount: money(amount), reason: reason.trim(), staffId: staff.id })
  log(db, 'shift', staff, `${type === 'in' ? 'นำเงินเข้า' : 'นำเงินออก'}ลิ้นชัก ${fmt(amount)} บาท: ${reason.trim()}`, shift.id, now)
  return shift
}

export function closeShift(db: Db, staff: Staff, countedCash: number, note: string | null, now: Date): Shift {
  const shift = openShiftOf(db)
  if (!shift) throw new HttpError(409, 'ไม่มีกะที่เปิดอยู่')
  if (typeof countedCash !== 'number' || !(countedCash >= 0)) throw new HttpError(400, 'ยอดเงินที่นับได้ต้องไม่ติดลบ')
  const { expected } = shiftCash(db, shift, now)
  shift.status = 'closed'
  shift.closedAt = now.toISOString()
  shift.closedBy = staff.name
  shift.expectedCash = expected
  shift.countedCash = money(countedCash)
  shift.difference = money(countedCash - expected)
  shift.note = note?.trim() || null
  const diff = shift.difference === 0 ? 'ตรงยอด' : `${shift.difference > 0 ? 'เกิน' : 'ขาด'} ${fmt(Math.abs(shift.difference))} บาท`
  log(db, 'shift', staff, `ปิดกะ #${shift.no} นับได้ ${fmt(shift.countedCash)} บาท (${diff})`, shift.id, now)
  return shift
}

// ---------- Reports ----------

export function summarize(orders: Order[]): SalesSummary {
  const paid = orders.filter((o) => o.status === 'paid')
  const refunded = orders.filter((o) => o.status === 'refunded')
  const revenue = money(paid.reduce((s, o) => s + o.total, 0))
  const vat = money(paid.reduce((s, o) => s + o.vat, 0))
  const cost = money(paid.reduce((s, o) => s + o.lines.reduce((t, l) => t + l.unitCost * l.qty, 0), 0))
  return {
    orders: paid.length,
    items: paid.reduce((s, o) => s + o.lines.reduce((t, l) => t + l.qty, 0), 0),
    revenue,
    discounts: money(paid.reduce((s, o) => s + o.lineDiscount + o.billDiscount, 0)),
    vat,
    cost,
    grossProfit: money(revenue - vat - cost),
    avgTicket: paid.length ? money(revenue / paid.length) : 0,
    refunds: refunded.length,
    refundAmount: money(refunded.reduce((s, o) => s + o.total, 0)),
  }
}

export function byPayment(orders: Order[]) {
  return PAYMENT_METHODS.map((method) => {
    const os = orders.filter((o) => o.status === 'paid' && o.payment.method === method)
    return { method, orders: os.length, revenue: money(os.reduce((s, o) => s + o.total, 0)) }
  })
}

function byDay(orders: Order[], from: string, to: string): DayPoint[] {
  const map = new Map(dayRange(from, to).map((d) => [d, { day: d, revenue: 0, orders: 0 }]))
  for (const o of orders) {
    if (o.status !== 'paid') continue
    const p = map.get(dayKey(o.createdAt))
    if (p) {
      p.revenue = money(p.revenue + o.total)
      p.orders += 1
    }
  }
  return [...map.values()]
}

/** Each line's share of the bill discount, so per-product revenue adds up to the order totals. */
function lineRevenue(o: Order, l: OrderLine): number {
  const afterLines = o.subtotal - o.lineDiscount
  return afterLines > 0 ? (l.total / afterLines) * o.total : 0
}

function byProduct(db: Db, orders: Order[]) {
  const map = new Map<string, SalesReport['byProduct'][number]>()
  for (const o of orders) {
    if (o.status !== 'paid') continue
    for (const l of o.lines) {
      const p = db.products.find((x) => x.id === l.productId)
      const row = map.get(l.productId) ?? {
        productId: l.productId,
        sku: l.sku,
        name: l.name,
        categoryId: p?.categoryId ?? '',
        qty: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
      }
      const rev = lineRevenue(o, l)
      const vatShare = (rev * o.vatRate) / (100 + o.vatRate)
      row.qty += l.qty
      row.revenue += rev
      row.cost += l.unitCost * l.qty
      row.profit += rev - vatShare - l.unitCost * l.qty
      map.set(l.productId, row)
    }
  }
  return [...map.values()]
    .map((r) => ({ ...r, revenue: money(r.revenue), cost: money(r.cost), profit: money(r.profit) }))
    .sort((a, b) => b.revenue - a.revenue)
}

function byCategory(db: Db, rows: ReturnType<typeof byProduct>) {
  return db.categories.map((c) => {
    const rs = rows.filter((r) => r.categoryId === c.id)
    return { categoryId: c.id, label: c.label, qty: rs.reduce((s, r) => s + r.qty, 0), revenue: money(rs.reduce((s, r) => s + r.revenue, 0)) }
  })
}

const inRange = (o: Order, from: string, to: string) => {
  const d = dayKey(o.createdAt)
  return d >= from && d <= to
}

export function salesReport(db: Db, from: string, to: string): SalesReport {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new HttpError(400, 'รูปแบบวันที่ต้องเป็น YYYY-MM-DD')
  if (from > to) throw new HttpError(400, 'วันเริ่มต้องไม่อยู่หลังวันสิ้นสุด')
  if (dayRange(from, to).length > 366) throw new HttpError(400, 'เลือกช่วงได้ไม่เกิน 366 วัน')
  const orders = db.orders.filter((o) => inRange(o, from, to))
  const products = byProduct(db, orders)
  const paid = orders.filter((o) => o.status === 'paid')
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 }))
  for (const o of paid) {
    const h = hours[bkkHour(o.createdAt)]
    h.orders += 1
    h.revenue = money(h.revenue + o.total)
  }
  return {
    from,
    to,
    summary: summarize(orders),
    byDay: byDay(orders, from, to),
    byProduct: products,
    byCategory: byCategory(db, products),
    byPayment: byPayment(orders),
    byStaff: db.staff.map((s) => {
      const os = paid.filter((o) => o.staffId === s.id)
      return { staffId: s.id, name: s.name, orders: os.length, revenue: money(os.reduce((t, o) => t + o.total, 0)) }
    }),
    byHour: hours,
  }
}

export function dashboard(db: Db, now: Date): Dashboard {
  const today = dayKey(now)
  const yesterday = addDays(today, -1)
  const from30 = addDays(today, -29)
  const todayOrders = db.orders.filter((o) => dayKey(o.createdAt) === today)
  // Yesterday up to this time of day
  const cut = new Date(now.getTime() - 86_400_000).toISOString()
  const ySoFar = db.orders.filter((o) => dayKey(o.createdAt) === yesterday && o.createdAt <= cut)
  const last30 = db.orders.filter((o) => inRange(o, from30, today))
  const products30 = byProduct(db, last30)
  const shift = openShiftOf(db)
  const tracked = db.products.filter((p) => p.trackStock && p.active)
  return {
    now: now.toISOString(),
    today: summarize(todayOrders),
    yesterdaySoFar: summarize(ySoFar),
    last30: summarize(last30),
    days: byDay(last30, from30, today),
    topProducts: products30.slice(0, 8).map((r) => ({ productId: r.productId, name: r.name, qty: r.qty, revenue: r.revenue })),
    byPayment: byPayment(last30),
    byCategory: byCategory(db, products30),
    lowStock: tracked.filter((p) => p.stock <= p.reorderLevel).sort((a, b) => a.stock - b.stock),
    recentOrders: [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
    shift: shift ? shiftView(db, shift, now) : null,
    counts: {
      products: db.products.filter((p) => p.active).length,
      customers: db.customers.length,
      orders: db.orders.length,
      stockUnits: tracked.reduce((s, p) => s + p.stock, 0),
      stockValue: money(tracked.reduce((s, p) => s + p.stock * p.cost, 0)),
    },
  }
}

/** Per-customer totals for lists and the customer sheet. */
export function customerStats(db: Db, customerId: string) {
  const os = db.orders.filter((o) => o.customerId === customerId)
  const paid = os.filter((o) => o.status === 'paid')
  const last = os.reduce<string | null>((m, o) => (!m || o.createdAt > m ? o.createdAt : m), null)
  return { orders: paid.length, spent: money(paid.reduce((s, o) => s + o.total, 0)), lastOrderAt: last }
}

/** Units sold and revenue per product over all time, for the product list. */
export function productStats(db: Db) {
  const map = new Map<string, { sold: number; revenue: number; lastSoldAt: string | null }>()
  for (const o of db.orders) {
    if (o.status !== 'paid') continue
    for (const l of o.lines) {
      const r = map.get(l.productId) ?? { sold: 0, revenue: 0, lastSoldAt: null }
      r.sold += l.qty
      r.revenue = money(r.revenue + lineRevenue(o, l))
      if (!r.lastSoldAt || o.createdAt > r.lastSoldAt) r.lastSoldAt = o.createdAt
      map.set(l.productId, r)
    }
  }
  return map
}

export const PAYMENT_LABELS = PAYMENT_LABEL
