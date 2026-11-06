// Dates, money and opening hours in the page's language: Buddhist-era Thai dates on Thai pages, Gregorian
// English ones on /en. Always Bangkok time.
import type { Lang } from '../i18n'
import type { OpeningHours } from './storeInfo'

const locale = (lang: Lang) => (lang === 'en' ? 'en-GB' : 'th-TH')

export const baht = (n: number, lang: Lang) =>
  lang === 'en'
    ? `THB ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
    : `${n.toLocaleString('th-TH', { maximumFractionDigits: 2 })} บาท`

/** A bare figure with digit grouping (units shown separately) */
export const num = (n: number, lang: Lang) => n.toLocaleString(lang === 'en' ? 'en-US' : 'th-TH', { maximumFractionDigits: 2 })

/** "2026-11-08" → "อาทิตย์ 8 พ.ย. 2569" / "Sun 8 Nov 2026" */
export function dayLabel(day: string, lang: Lang, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(locale(lang), { ...opts, timeZone: 'UTC' })
}

/** An ISO instant as a Bangkok date (and time) */
export function instantLabel(iso: string, lang: Lang, withTime = false) {
  return new Date(iso).toLocaleString(locale(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    timeZone: 'Asia/Bangkok',
  })
}

const DAY_TH = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
const DAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const weekdayName = (d: number, lang: Lang) => (lang === 'en' ? DAY_EN : DAY_TH)[d]

/** Today's weekday in Bangkok (0 = Sunday) */
export const bangkokWeekday = (now = new Date()) => new Date(now.getTime() + 7 * 3_600_000).getUTCDay()

/** The week's opening hours, Monday first, closed days included */
export function weekHours(hours: OpeningHours[]) {
  return [1, 2, 3, 4, 5, 6, 0].map((day) => ({ day, hours: hours.find((h) => h.day === day) ?? null }))
}

/** "10:00–19:00 every day" when every day is the same, else null (the page then lists each day) */
export function hoursSummary(hours: OpeningHours[], lang: Lang): string | null {
  if (hours.length !== 7) return null
  const first = hours[0]
  if (!hours.every((h) => h.open === first.open && h.close === first.close)) return null
  return lang === 'en' ? `Open every day ${first.open}–${first.close}` : `เปิดทุกวัน ${first.open}–${first.close} น.`
}

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`
