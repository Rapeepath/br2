// @vitest-environment node
import { resolve } from 'node:path'
import { loadCatalog } from './catalog.ts'
import { adjustStock, approver, cashMove, checkout, closeShift, openShift, openShiftOf, quote, receiveStock, refund, salesReport, shiftView } from './logic.ts'
import { seed } from './seed.ts'
import type { Db, Product, Staff } from './types.ts'
import { addDays, beStamp, bkkTime, dayKey, money } from './util.ts'

const root = resolve(import.meta.dirname, '..')
const catalog = loadCatalog(root)
// Mid-afternoon in Bangkok, so "today" already has trading in it
const NOW = bkkTime('2026-11-06', 15, 30)

let db: Db
let cashier: Staff
let manager: Staff
const later = (min: number) => new Date(NOW.getTime() + min * 60_000)
// Bulk-counted stock (kittens are counted one record at a time, see extras.test.ts)
const stocked = () => db.products.find((p) => p.trackStock && !p.unitTracked && p.stock >= 2 && p.price > 1000)!
const service = () => db.products.find((p) => !p.trackStock)!

beforeEach(() => {
  db = seed(catalog, NOW)
  cashier = db.staff.find((s) => s.role === 'staff')!
  manager = db.staff.find((s) => s.role === 'manager')!
})

describe('utilities', () => {
  it('uses Bangkok days and Buddhist-era receipt stamps', () => {
    expect(dayKey('2026-11-05T17:30:00Z')).toBe('2026-11-06')
    expect(beStamp('2026-11-06')).toBe('691106')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(money(0.1 + 0.2)).toBe(0.3)
  })
})

describe('simulated history', () => {
  it('is the same on every reset', () => {
    const again = seed(catalog, NOW)
    expect(again.orders.map((o) => o.total)).toEqual(db.orders.map((o) => o.total))
  })

  it('covers 60 days with one shift per day and only today still open', () => {
    expect(db.shifts).toHaveLength(60)
    expect(db.shifts.filter((s) => s.status === 'open')).toHaveLength(1)
    expect(dayKey(openShiftOf(db)!.openedAt)).toBe('2026-11-06')
    expect(db.orders.some((o) => dayKey(o.createdAt) === '2026-11-06')).toBe(true)
    expect(db.orders.every((o) => o.createdAt <= NOW.toISOString())).toBe(true)
  })

  it('never takes stock below zero and ends with the shelf figure on each product', () => {
    expect(db.movements.every((m) => m.balance >= 0)).toBe(true)
    for (const p of db.products.filter((x) => x.trackStock)) {
      const moves = db.movements.filter((m) => m.productId === p.id)
      expect(moves.reduce((s, m) => s + m.qty, 0)).toBe(p.stock)
      expect(moves[moves.length - 1].balance).toBe(p.stock)
    }
  })

  it('closes past shifts against the cash the drawer should hold', () => {
    for (const s of db.shifts.filter((x) => x.status === 'closed')) {
      expect(s.difference).toBe(money(s.countedCash! - s.expectedCash!))
      expect(Math.abs(s.difference!)).toBeLessThanOrEqual(40)
    }
  })

  it('gives every product its own id and SKU', () => {
    expect(new Set(db.products.map((p) => p.id)).size).toBe(db.products.length)
    expect(new Set(db.products.map((p) => p.sku)).size).toBe(db.products.length)
  })

  it('gives every bill a unique receipt number', () => {
    expect(new Set(db.orders.map((o) => o.no)).size).toBe(db.orders.length)
  })
})

describe('pricing', () => {
  it('applies line and bill discounts and extracts the VAT included in the price', () => {
    const p = stocked()
    const s = service()
    const q = quote(db, {
      lines: [
        { productId: p.id, qty: 2, discount: 100 },
        { productId: s.id, qty: 1 },
      ],
      billDiscount: { type: 'percent', value: 10 },
    })
    const subtotal = p.price * 2 + s.price
    expect(q.subtotal).toBe(subtotal)
    expect(q.lineDiscount).toBe(100)
    expect(q.billDiscount).toBe(money((subtotal - 100) * 0.1))
    expect(q.total).toBe(money(subtotal - 100 - q.billDiscount))
    expect(q.vat).toBe(money((q.total * 7) / 107))
    expect(q.beforeVat).toBe(money(q.total - q.vat))
  })

  it('refuses more than is in stock, counting repeated lines together', () => {
    const p = stocked()
    expect(() => quote(db, { lines: [{ productId: p.id, qty: p.stock }, { productId: p.id, qty: 1 }] })).toThrow(/ไม่พอ/)
  })

  it('refuses to pick individual kittens on a product sold by count', () => {
    const p = stocked()
    expect(() => quote(db, { lines: [{ productId: p.id, qty: 1, unitIds: ['k00001'] }] })).toThrow()
    expect(() => quote(db, { lines: [{ productId: p.id, qty: 1 }], reservationNo: 'RS000000-0000' })).toThrow(/ไม่พบการจอง/)
  })

  it('rejects bad quantities and discounts', () => {
    const p = stocked()
    expect(() => quote(db, { lines: [] })).toThrow()
    expect(() => quote(db, { lines: [{ productId: p.id, qty: 1.5 }] })).toThrow()
    expect(() => quote(db, { lines: [{ productId: p.id, qty: 1, discount: p.price + 1 }] })).toThrow()
    expect(() => quote(db, { lines: [{ productId: p.id, qty: 1 }], billDiscount: { type: 'percent', value: 120 } })).toThrow()
  })
})

describe('checkout and refunds', () => {
  it('sells, takes stock off and gives change', () => {
    const p = stocked()
    const before = p.stock
    const order = checkout(db, cashier, { lines: [{ productId: p.id, qty: 1 }], payment: { method: 'cash', tendered: p.price + 500 } }, later(1))
    expect(order.no).toMatch(new RegExp(`^${catalog.settings.receiptPrefix}691106-\\d{4}$`))
    expect(order.payment.change).toBe(500)
    expect(db.products.find((x) => x.id === p.id)!.stock).toBe(before - 1)
    expect(db.movements.at(-1)).toMatchObject({ type: 'sale', qty: -1, ref: order.no })
  })

  it('refuses short cash and selling with no open shift', () => {
    const p = stocked()
    expect(() => checkout(db, cashier, { lines: [{ productId: p.id, qty: 1 }], payment: { method: 'cash', tendered: p.price - 1 } }, later(1))).toThrow(/น้อยกว่า/)
    closeShift(db, cashier, 0, null, later(2))
    expect(() => checkout(db, cashier, { lines: [{ productId: p.id, qty: 1 }], payment: { method: 'card' } }, later(3))).toThrow(/เปิดกะ/)
  })

  it('needs a manager to refund, returns stock and only once', () => {
    const p = stocked()
    const order = checkout(db, cashier, { lines: [{ productId: p.id, qty: 2 }], payment: { method: 'card', cardLast4: '4242' } }, later(1))
    expect(() => approver(db, cashier, '0000')).toThrow(/ผู้จัดการ/)
    const ok = approver(db, cashier, '1111')
    expect(ok.id).toBe(manager.id)
    const stockAfterSale = db.products.find((x) => x.id === p.id)!.stock
    refund(db, cashier, ok, order.id, 'ลูกค้าเปลี่ยนใจ', later(5))
    expect(db.products.find((x) => x.id === p.id)!.stock).toBe(stockAfterSale + 2)
    expect(() => refund(db, cashier, ok, order.id, 'ซ้ำ', later(6))).toThrow(/คืนเงินไปแล้ว/)
  })
})

describe('shift cash', () => {
  it('expects opening cash + cash sales − cash refunds ± drawer moves', () => {
    closeShift(db, cashier, 0, null, later(0))
    const shift = openShift(db, cashier, 2000, later(1))
    const s = service()
    const a = checkout(db, cashier, { lines: [{ productId: s.id, qty: 1 }], payment: { method: 'cash', tendered: s.price + 500 } }, later(2))
    checkout(db, cashier, { lines: [{ productId: s.id, qty: 1 }], payment: { method: 'promptpay' } }, later(3))
    const b = checkout(db, cashier, { lines: [{ productId: s.id, qty: 2 }], payment: { method: 'cash' } }, later(4))
    refund(db, manager, manager, b.id, 'ทดสอบ', later(5))
    cashMove(db, cashier, 'out', 150, 'ซื้อของใช้', later(6))
    cashMove(db, cashier, 'in', 500, 'แลกเหรียญ', later(7))
    const expected = money(2000 + a.total + b.total - b.total - 150 + 500)
    expect(shiftView(db, shift, later(8)).expectedNow).toBe(expected)
    const closed = closeShift(db, cashier, expected - 20, null, later(9))
    expect(closed.difference).toBe(-20)
  })
})

describe('stock', () => {
  it('receives and counts with a reason, keeping a running balance', () => {
    const p: Product = stocked()
    receiveStock(db, cashier, p.id, 5, null, later(1))
    adjustStock(db, manager, p.id, 3, 'นับสต็อกประจำเดือน', later(2))
    expect(db.products.find((x) => x.id === p.id)!.stock).toBe(3)
    expect(db.movements.at(-1)).toMatchObject({ type: 'adjust', balance: 3 })
    expect(() => adjustStock(db, manager, p.id, 3, 'ซ้ำ', later(3))).toThrow()
    expect(() => receiveStock(db, cashier, service().id, 1, null, later(4))).toThrow()
  })
})

describe('reports', () => {
  it('splits revenue by product, category, payment, staff and hour without losing a baht', () => {
    const r = salesReport(db, addDays('2026-11-06', -29), '2026-11-06')
    const total = r.summary.revenue
    const sum = (rows: { revenue: number }[]) => Math.round(rows.reduce((s, x) => s + x.revenue, 0))
    expect(sum(r.byProduct)).toBe(Math.round(total))
    expect(sum(r.byCategory)).toBe(Math.round(total))
    expect(sum(r.byPayment)).toBe(Math.round(total))
    expect(sum(r.byStaff)).toBe(Math.round(total))
    expect(sum(r.byHour)).toBe(Math.round(total))
    expect(sum(r.byDay)).toBe(Math.round(total))
    expect(r.byDay).toHaveLength(30)
    expect(r.summary.grossProfit).toBe(money(total - r.summary.vat - r.summary.cost))
  })

  it('rejects reversed or malformed ranges', () => {
    expect(() => salesReport(db, '2026-11-06', '2026-11-01')).toThrow()
    expect(() => salesReport(db, '6/11/2026', '2026-11-06')).toThrow()
  })
})
