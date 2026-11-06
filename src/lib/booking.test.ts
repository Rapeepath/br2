import { describe, expect, it } from 'vitest'
import { addDays, bangkokToday, bookingCalendar, bookingIcs, defaultWindow, endTime, icsStamp, weekday } from './booking'

const everyDay = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: '10:00', close: '19:00' }))

describe('booking calendar', () => {
  it('lays the window out in whole Monday-first weeks', () => {
    const weeks = bookingCalendar('2026-11-07', '2026-11-27', everyDay)
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    expect(weekday(weeks[0][0].date)).toBe(1)
    expect(weekday(weeks.at(-1)![6].date)).toBe(0)
    const bookable = weeks.flat().filter((d) => d.bookable).map((d) => d.date)
    expect(bookable[0]).toBe('2026-11-07')
    expect(bookable.at(-1)).toBe('2026-11-27')
    expect(bookable).toHaveLength(21)
  })

  it('marks days outside the window and closed days as not bookable', () => {
    const noSundays = everyDay.filter((h) => h.day !== 0)
    const days = bookingCalendar('2026-11-07', '2026-11-27', noSundays).flat()
    expect(days.find((d) => d.date === '2026-11-06')?.reason).toBe('past')
    expect(days.find((d) => d.date === '2026-11-08')).toMatchObject({ bookable: false, reason: 'closed' })
    expect(days.find((d) => d.date === '2026-11-29')?.reason).toBe('beyond')
  })

  it('uses Bangkok dates: 20:00 UTC is already tomorrow there', () => {
    expect(bangkokToday(new Date('2026-11-06T20:00:00Z'))).toBe('2026-11-07')
    expect(defaultWindow(new Date('2026-11-06T03:00:00Z'))).toEqual({ from: '2026-11-07', to: '2026-11-27' })
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('calendar file', () => {
  it('converts Bangkok wall time to UTC stamps', () => {
    expect(icsStamp('2026-11-08', '10:00')).toBe('20261108T030000Z')
    expect(icsStamp('2026-11-08', '17:30', 90)).toBe('20261108T120000Z')
    expect(endTime('17:30', 90)).toBe('19:00')
  })

  it('writes one escaped event with start, end and place', () => {
    const ics = bookingIcs({
      no: 'BK691108-0001',
      date: '2026-11-08',
      time: '10:00',
      durationMin: 90,
      title: 'Demo, Unitree G1',
      location: 'Servo; Bang Na',
      description: 'line 1\nline 2',
      now: new Date('2026-11-06T00:00:00Z'),
    })
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('DTSTART:20261108T030000Z')
    expect(ics).toContain('DTEND:20261108T043000Z')
    expect(ics).toContain('SUMMARY:Demo\\, Unitree G1')
    expect(ics).toContain('LOCATION:Servo\\; Bang Na')
    expect(ics).toContain('DESCRIPTION:line 1\\nline 2')
    expect(ics.split('\r\n').filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1)
  })
})
