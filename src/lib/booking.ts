// Dates and calendar files for the demo booking page. Every date is a Bangkok calendar day (YYYY-MM-DD);
// Thailand has no daylight saving, so Bangkok is always UTC+7.
import type { OpeningHours } from './storeInfo'

const BKK_MS = 7 * 3_600_000

/** Today's Bangkok date as YYYY-MM-DD. */
export const bangkokToday = (now = new Date()) => new Date(now.getTime() + BKK_MS).toISOString().slice(0, 10)

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** 0 = Sunday … 6 = Saturday */
export const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay()

export interface CalendarDay {
  date: string
  /** Inside the booking window and the showroom opens that day */
  bookable: boolean
  /** Before the window, after it, or a closed day */
  reason: 'past' | 'closed' | 'beyond' | null
  hours: OpeningHours | null
}

/**
 * The calendar the booking page draws: whole weeks (Monday first) covering the window `from`–`to`, each day
 * marked bookable or not. The server has the final say; this only keeps closed and out-of-range days
 * from being picked.
 */
export function bookingCalendar(from: string, to: string, hours: OpeningHours[]): CalendarDay[][] {
  // Back up to the Monday on or before `from`, forward to the Sunday on or after `to`
  const start = addDays(from, -((weekday(from) + 6) % 7))
  const end = addDays(to, (7 - weekday(to)) % 7)
  const weeks: CalendarDay[][] = []
  let week: CalendarDay[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const h = hours.find((x) => x.day === weekday(d)) ?? null
    const reason = d < from ? 'past' : d > to ? 'beyond' : !h ? 'closed' : null
    week.push({ date: d, bookable: reason === null, reason, hours: h })
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  return weeks
}

/** The booking window when the API can't say: tomorrow to 21 days ahead. */
export function defaultWindow(now = new Date(), days = 21) {
  const today = bangkokToday(now)
  return { from: addDays(today, 1), to: addDays(today, days) }
}

/** "2026-11-08" + "10:00" (Bangkok) → "20261108T030000Z" */
export function icsStamp(date: string, time: string, plusMinutes = 0): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const at = new Date(Date.UTC(y, m - 1, d, hh, mm + plusMinutes) - BKK_MS)
  return at.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')

/** A one-event iCalendar file for the confirmed booking (opens in any calendar app). */
export function bookingIcs(input: {
  no: string
  date: string
  time: string
  durationMin: number
  title: string
  location: string
  description: string
  now?: Date
}): string {
  const stamp = (input.now ?? new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Servo Humanoid Showroom//Booking//TH',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${input.no}@servo-showroom.example`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsStamp(input.date, input.time)}`,
    `DTEND:${icsStamp(input.date, input.time, input.durationMin)}`,
    `SUMMARY:${icsText(input.title)}`,
    `LOCATION:${icsText(input.location)}`,
    `DESCRIPTION:${icsText(input.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

/** "10:00" + 90 → "11:30" */
export function endTime(time: string, durationMin: number): string {
  const [h, m] = time.split(':').map(Number)
  const t = h * 60 + m + durationMin
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
