import { describe, expect, it } from 'vitest'
import { cartReducer, emptyCart, toCheckout } from './cart'
import { ageOf, BOOKING_ACTIONS, daysLeft, endTime, hoursOf, hoursRows, isOverdue, lineHref, refName, telHref, weekDays, weekStart } from './crm'

const NOW = new Date('2026-11-06T08:00:00Z')
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()

describe('lead age', () => {
  it('reads like a person would say it', () => {
    expect(ageOf(ago(20_000), NOW)).toBe('เมื่อสักครู่')
    expect(ageOf(ago(5 * 60_000), NOW)).toBe('5 นาทีที่แล้ว')
    expect(ageOf(ago(3 * 3_600_000), NOW)).toBe('3 ชม.ที่แล้ว')
    expect(ageOf(ago(2 * 86_400_000), NOW)).toBe('2 วันที่แล้ว')
    expect(ageOf(ago(65 * 86_400_000), NOW)).toBe('2 เดือนที่แล้ว')
  })

  it('flags new leads left over a day', () => {
    expect(isOverdue({ status: 'new', createdAt: ago(25 * 3_600_000) }, NOW)).toBe(true)
    expect(isOverdue({ status: 'new', createdAt: ago(2 * 3_600_000) }, NOW)).toBe(false)
    expect(isOverdue({ status: 'contacted', createdAt: ago(9 * 86_400_000) }, NOW)).toBe(false)
  })
})

describe('contact links', () => {
  it('dials only digits and a leading plus', () => {
    expect(telHref('02-765-4321')).toBe('tel:027654321')
    expect(telHref('+66 81 445 2290')).toBe('tel:+66814452290')
  })

  it('opens an Official Account or a personal LINE id', () => {
    expect(lineHref('@servoshowroom')).toBe('https://line.me/R/ti/p/%40servoshowroom')
    expect(lineHref('wichai.p')).toBe('https://line.me/ti/p/~wichai.p')
  })

  it('names robots by their catalogue name', () => {
    expect(refName('unitree-g1')).toBe('Unitree G1')
    expect(refName('not-a-model')).toBe('not-a-model')
  })
})

describe('agenda dates', () => {
  it('starts weeks on Monday', () => {
    expect(weekStart('2026-11-06')).toBe('2026-11-02') // Friday
    expect(weekStart('2026-11-08')).toBe('2026-11-02') // Sunday belongs to the week before
    expect(weekStart('2026-11-02')).toBe('2026-11-02')
    expect(weekDays('2026-11-02')).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'])
  })

  it('works out when a demo ends', () => {
    expect(endTime('10:00', 90)).toBe('11:30')
    expect(endTime('17:30', 90)).toBe('19:00')
  })

  it('offers sensible next steps for each booking state', () => {
    expect(BOOKING_ACTIONS.pending.map((a) => a.to)).toEqual(['confirmed', 'cancelled'])
    expect(BOOKING_ACTIONS.done).toEqual([])
  })
})

describe('quotation expiry', () => {
  it('counts whole days left and goes negative once lapsed', () => {
    expect(daysLeft(new Date(NOW.getTime() + 29.5 * 86_400_000).toISOString(), NOW)).toBe(30)
    expect(daysLeft(new Date(NOW.getTime() + 3_600_000).toISOString(), NOW)).toBe(1)
    expect(daysLeft(new Date(NOW.getTime() - 2 * 86_400_000).toISOString(), NOW)).toBeLessThan(0)
  })
})

describe('opening hours editor', () => {
  const seeded = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: '10:00', close: '19:00' }))

  it('lists every weekday and round-trips the server shape', () => {
    const rows = hoursRows(seeded)
    expect(rows).toHaveLength(7)
    expect(hoursOf(rows)).toEqual(seeded)
  })

  it('leaves closed days out and refuses back-to-front hours', () => {
    const rows = hoursRows(seeded).map((r) => (r.day === 1 ? { ...r, open: false } : r))
    expect(hoursOf(rows).map((h) => h.day)).toEqual([0, 2, 3, 4, 5, 6])
    expect(() => hoursOf(rows.map((r) => (r.day === 2 ? { ...r, from: '19:00', to: '10:00' } : r)))).toThrow(/หลังเวลาเปิด/)
    expect(() => hoursOf(rows.map((r) => (r.day === 3 ? { ...r, from: '9' } : r)))).toThrow(/ชม.:นาที/)
  })

  it('treats a weekday missing from the server as closed', () => {
    expect(hoursRows([{ day: 6, open: '10:00', close: '16:00' }]).filter((r) => r.open).map((r) => r.day)).toEqual([6])
  })
})

describe('a bill from a quotation', () => {
  const loaded = cartReducer(emptyCart, {
    type: 'loadQuote',
    quotationNo: 'QT691106-0001',
    lines: [
      { productId: 'unitree-g1-pro', qty: 2, discount: 12_000 },
      { productId: 'svc-install', qty: 1 },
    ],
    customerId: 'c00003',
  })

  it('takes the quoted lines and customer and keeps the quotation number', () => {
    expect(loaded.lines).toEqual([
      { productId: 'unitree-g1-pro', qty: 2, discount: 12_000 },
      { productId: 'svc-install', qty: 1, discount: 0 },
    ])
    expect(loaded.customerId).toBe('c00003')
    expect(toCheckout(loaded, { method: 'transfer' }).quotationNo).toBe('QT691106-0001')
  })

  it('can be unlinked or cleared', () => {
    expect(toCheckout(cartReducer(loaded, { type: 'unlinkQuote' }), { method: 'cash' })).not.toHaveProperty('quotationNo')
    expect(cartReducer(loaded, { type: 'clear' }).quotationNo).toBeNull()
  })
})
