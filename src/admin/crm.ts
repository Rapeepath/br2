// Labels and small pure helpers for the website-contact screens (leads, bookings, quotations, reviews).
import { models } from '../data'
import { addDays } from './format'
import type { BookingStatus, Financing, Lang, Lead, LeadKind, LeadStatus, QuotationStatus, ReviewStatus } from './types'

export const LEAD_KIND_LABEL: Record<LeadKind, string> = {
  inquiry: 'สอบถาม',
  booking: 'นัดชมการสาธิต',
  quote: 'ขอใบเสนอราคา',
  reservation: 'จอง',
  privacy: 'คำขอตาม PDPA',
}

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: 'ใหม่',
  contacted: 'ติดต่อแล้ว',
  scheduled: 'นัดแล้ว',
  won: 'ปิดการขายได้',
  lost: 'ไม่สำเร็จ',
  closed: 'ปิดเรื่อง',
}

/** The order a lead moves through; the screen offers these as the next steps */
export const LEAD_FLOW: LeadStatus[] = ['new', 'contacted', 'scheduled', 'won', 'lost', 'closed']

export const LEAD_STATUS_TONE: Record<LeadStatus, string> = {
  new: 'badge--new',
  contacted: 'badge--move-sale',
  scheduled: 'badge--gold',
  won: 'badge--ok',
  lost: 'badge--quiet',
  closed: 'badge--quiet',
}

export const PRIVACY_REQUEST_LABEL: Record<NonNullable<Lead['request']>, string> = {
  access: 'ขอดูข้อมูลส่วนบุคคล',
  delete: 'ขอลบข้อมูลส่วนบุคคล',
  correct: 'ขอแก้ไขข้อมูลส่วนบุคคล',
}

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'รอยืนยัน',
  confirmed: 'ยืนยันแล้ว',
  done: 'มาตามนัดแล้ว',
  cancelled: 'ยกเลิก',
  'no-show': 'ไม่มาตามนัด',
}

export const BOOKING_STATUS_TONE: Record<BookingStatus, string> = {
  pending: 'badge--warn',
  confirmed: 'badge--ok',
  done: 'badge--move-sale',
  cancelled: 'badge--quiet',
  'no-show': 'badge--bad',
}

/** What staff can do next with a booking in each state */
export const BOOKING_ACTIONS: Record<BookingStatus, { to: BookingStatus; label: string }[]> = {
  pending: [
    { to: 'confirmed', label: 'ยืนยันนัด' },
    { to: 'cancelled', label: 'ยกเลิกนัด' },
  ],
  confirmed: [
    { to: 'done', label: 'มาตามนัดแล้ว' },
    { to: 'no-show', label: 'ไม่มาตามนัด' },
    { to: 'cancelled', label: 'ยกเลิกนัด' },
  ],
  done: [],
  cancelled: [{ to: 'pending', label: 'เปิดนัดอีกครั้ง' }],
  'no-show': [{ to: 'confirmed', label: 'นัดยังมีผล' }],
}

export const QUOTE_STATUS_LABEL: Record<QuotationStatus, string> = {
  sent: 'ส่งให้ลูกค้าแล้ว',
  accepted: 'ลูกค้าตกลง',
  expired: 'หมดอายุ',
  converted: 'ออกบิลแล้ว',
}

export const QUOTE_STATUS_TONE: Record<QuotationStatus, string> = {
  sent: 'badge--move-sale',
  accepted: 'badge--gold',
  expired: 'badge--quiet',
  converted: 'badge--ok',
}

export const FINANCE_MODE_LABEL: Record<Financing['mode'], string> = {
  cash: 'ชำระเต็มจำนวน',
  hire: 'เช่าซื้อ (ดอกเบี้ยคงที่)',
  lease: 'ลีสซิ่ง',
}

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: 'รอตรวจ',
  approved: 'แสดงบนเว็บไซต์',
  rejected: 'ไม่อนุมัติ',
}

export const REVIEW_STATUS_TONE: Record<ReviewStatus, string> = {
  pending: 'badge--warn',
  approved: 'badge--ok',
  rejected: 'badge--quiet',
}

export const LANG_LABEL: Record<Lang, string> = { th: 'ภาษาไทย', en: 'English' }

const modelName = new Map(models.map((m) => [m.id, m.nameEn]))

/** "unitree-g1" → "Unitree G1"; unknown ids stay as they are */
export const refName = (id: string) => modelName.get(id) ?? id

/** "2 นาทีที่แล้ว", "3 ชม.ที่แล้ว", "5 วันที่แล้ว" — how long a lead has been waiting */
export function ageOf(iso: string, now = new Date()): string {
  const min = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000))
  if (min < 1) return 'เมื่อสักครู่'
  if (min < 60) return `${min} นาทีที่แล้ว`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} ชม.ที่แล้ว`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} วันที่แล้ว`
  return `${Math.floor(d / 30)} เดือนที่แล้ว`
}

/** A lead waiting this long without a first contact needs attention */
export const isOverdue = (lead: Pick<Lead, 'status' | 'createdAt'>, now = new Date()) =>
  lead.status === 'new' && now.getTime() - new Date(lead.createdAt).getTime() > 24 * 3_600_000

/** tel: link with only the digits and a leading + kept */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

/** A LINE chat link: an Official Account id starts with @, a personal id gets the ~ form */
export function lineHref(lineId: string): string {
  const id = lineId.trim()
  return id.startsWith('@') ? `https://line.me/R/ti/p/${encodeURIComponent(id)}` : `https://line.me/ti/p/~${encodeURIComponent(id)}`
}

/** Monday of the week a YYYY-MM-DD day falls in */
export function weekStart(day: string): string {
  const wd = new Date(`${day}T00:00:00Z`).getUTCDay()
  return addDays(day, wd === 0 ? -6 : 1 - wd)
}

/** The seven days of the week starting `monday` */
export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i))

/** "13:00" + 90 min → "14:30" */
export function endTime(time: string, durationMin: number): string {
  const [h, m] = time.split(':').map(Number)
  const t = h * 60 + m + durationMin
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Whole days until a quotation lapses (negative once it has) */
export function daysLeft(validUntil: string, now = new Date()): number {
  return Math.ceil((new Date(validUntil).getTime() - now.getTime()) / 86_400_000)
}

export const WEEKDAY_LABEL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']

/** 00:00, 00:30 … 23:30, for the 24-hour opening-hours pickers */
export const HALF_HOURS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

/** One editable row of the opening-hours form (every weekday, open or closed) */
export interface HoursRow {
  day: number
  open: boolean
  from: string
  to: string
}

export function hoursRows(hours: { day: number; open: string; close: string }[] | undefined): HoursRow[] {
  return WEEKDAY_LABEL.map((_, day) => {
    const h = hours?.find((x) => x.day === day)
    return { day, open: Boolean(h), from: h?.open ?? '10:00', to: h?.close ?? '19:00' }
  })
}

/** Rows back to the server's shape (closed days left out); throws a Thai message on a bad row */
export function hoursOf(rows: HoursRow[]): { day: number; open: string; close: string }[] {
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/
  return rows
    .filter((r) => r.open)
    .map((r) => {
      if (!hhmm.test(r.from) || !hhmm.test(r.to)) throw new Error(`วัน${WEEKDAY_LABEL[r.day]}: ใส่เวลาเป็น ชม.:นาที เช่น 10:00`)
      if (r.from >= r.to) throw new Error(`วัน${WEEKDAY_LABEL[r.day]}: เวลาปิดต้องหลังเวลาเปิด`)
      return { day: r.day, open: r.from, close: r.to }
    })
}
