import { addDays, axisFormatter, baht, bahtText, compact, dayShort, delta, niceTicks, receiptDate, todayKey } from './format'

describe('admin formatting', () => {
  it('shows satang only when there are any', () => {
    expect(baht(3562500)).toBe('3,562,500')
    expect(baht(869050.5)).toBe('869,050.50')
    expect(baht(0.1 + 0.2)).toBe('0.30')
    expect(bahtText(1234)).toBe('1,234 บาท')
  })

  it('compacts millions for tiles and keeps smaller sums whole', () => {
    expect(compact(1_800_000)).toBe('1.8 ล้าน')
    expect(compact(3_562_500)).toBe('3.56 ล้าน')
    expect(compact(56_420_000)).toBe('56.4 ล้าน')
    expect(compact(456_000)).toBe('456,000')
    expect(compact(25_000.4)).toBe('25,000')
  })

  it('builds clean round ticks that cover the maximum', () => {
    expect(niceTicks(3_562_500)).toEqual([0, 1_000_000, 2_000_000, 3_000_000, 4_000_000])
    expect(niceTicks(900)).toEqual([0, 250, 500, 750, 1000])
    expect(niceTicks(0)).toEqual([0, 1])
    const ticks = niceTicks(1_234_567)
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(1_234_567)
  })

  it('labels an axis in one unit', () => {
    const f = axisFormatter(4_000_000)
    expect(f(0)).toBe('0')
    expect(f(500_000)).toBe('0.5 ล้าน')
    expect(f(2_000_000)).toBe('2 ล้าน')
    expect(axisFormatter(40_000)(25_000)).toBe('25 พัน')
    expect(axisFormatter(900)(250)).toBe('250')
  })

  it('compares with a previous figure, or says there is nothing to compare', () => {
    expect(delta(120, 100)).toEqual({ pct: 20, dir: 'up' })
    expect(delta(50, 100)).toEqual({ pct: 50, dir: 'down' })
    expect(delta(100, 100)?.dir).toBe('flat')
    expect(delta(100, 0)).toBeNull()
  })

  it('dates in the Buddhist era on Bangkok time', () => {
    expect(todayKey(new Date('2026-11-05T17:30:00Z'))).toBe('2026-11-06')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(dayShort('2026-11-06')).toBe('6 พ.ย.')
    expect(receiptDate('2026-11-06T07:32:00Z')).toBe('6 พฤศจิกายน 2569 เวลา 14:32 น.')
  })
})
