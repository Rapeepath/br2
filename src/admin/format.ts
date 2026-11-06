import type { ActivityType, CustomerKind, MovementType, OrderStatus, PaymentMethod, Role } from './types'

const TZ = 'Asia/Bangkok'
const whole = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 })
const satang = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const upTo2 = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 })
const upTo1 = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 })

/** 1234 → "1,234", 1234.5 → "1,234.50": satang only when there are any. */
export function baht(n: number): string {
  const r = Math.round(n * 100) / 100
  return Number.isInteger(r) ? whole.format(r) : satang.format(r)
}

export const bahtText = (n: number) => `${baht(n)} บาท`

export const formatNumber = (n: number) => upTo2.format(n)

/**
 * Short figure for tiles and chart labels: millions as "1.8 ล้าน" / "12.4 ล้าน", smaller sums in full.
 * Tables keep full figures (baht()).
 */
export function compact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) {
    const m = n / 1_000_000
    return `${(abs >= 10_000_000 ? upTo1 : upTo2).format(m)} ล้าน`
  }
  return whole.format(Math.round(n))
}

/** Clean round ticks from 0 to at least `max` (steps of 1, 2, 2.5 or 5 × 10ⁿ). */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1]
  const raw = max / count
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return ticks
}

/** Axis labels that share one unit across the scale: "0", "0.5 ล้าน", "1 ล้าน"… or "20 พัน". */
export function axisFormatter(max: number): (v: number) => string {
  if (max >= 1_000_000) return (v) => (v === 0 ? '0' : `${upTo2.format(v / 1_000_000)} ล้าน`)
  if (max >= 10_000) return (v) => (v === 0 ? '0' : `${upTo1.format(v / 1000)} พัน`)
  return (v) => whole.format(v)
}

export const percent = (n: number) => `${upTo1.format(n)}%`

/** Change against a comparison figure; null when there is nothing to compare with. */
export function delta(now: number, before: number): { pct: number; dir: 'up' | 'down' | 'flat' } | null {
  if (!before) return null
  const pct = ((now - before) / before) * 100
  return { pct: Math.abs(pct), dir: Math.abs(pct) < 0.05 ? 'flat' : pct > 0 ? 'up' : 'down' }
}

// ---------- Dates (Buddhist era, Bangkok time) ----------

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' })

/** Compact stamp for busy tables: "5 พ.ย. 17:46" (no year) */
export const shortDateTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export const dateOnly = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { timeZone: TZ, dateStyle: 'medium' })

export const timeOnly = (iso: string) => new Date(iso).toLocaleTimeString('th-TH', { timeZone: TZ, timeStyle: 'short' })

/** Full receipt stamp: "6 พฤศจิกายน 2569 เวลา 14:32 น." */
export const receiptDate = (iso: string) =>
  `${new Date(iso).toLocaleDateString('th-TH', { timeZone: TZ, dateStyle: 'long' })} เวลา ${timeOnly(iso)} น.`

const noonOf = (day: string) => new Date(`${day}T12:00:00+07:00`)

/** "2026-11-06" → "6 พ.ย." for chart axes */
export const dayShort = (day: string) => noonOf(day).toLocaleDateString('th-TH', { timeZone: TZ, day: 'numeric', month: 'short' })

/** "2026-11-06" → "ศ. 6 พ.ย. 2569" */
export const dayLong = (day: string) =>
  noonOf(day).toLocaleDateString('th-TH', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

/** Today's Bangkok date as YYYY-MM-DD. */
export const todayKey = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

// ---------- Labels ----------

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: 'เงินสด',
  promptpay: 'พร้อมเพย์',
  card: 'บัตรเครดิต/เดบิต',
  transfer: 'โอนเงิน',
}

export const STATUS_LABEL: Record<OrderStatus, string> = { paid: 'ชำระแล้ว', refunded: 'คืนเงินแล้ว' }

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  initial: 'ยอดยกมา',
  receive: 'รับเข้า',
  adjust: 'ปรับยอดนับ',
  sale: 'ขาย',
  refund: 'คืนสินค้า',
}

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  login: 'เข้าสู่ระบบ',
  logout: 'ออกจากระบบ',
  sale: 'การขาย',
  refund: 'คืนเงิน',
  stock: 'สต็อก',
  product: 'สินค้า',
  customer: 'ลูกค้า',
  shift: 'กะและเงินสด',
  settings: 'ตั้งค่า',
  reset: 'สร้างข้อมูลใหม่',
}

export const ROLE_LABEL: Record<Role, string> = { manager: 'ผู้จัดการ', staff: 'พนักงาน' }

export const KIND_LABEL: Record<CustomerKind, string> = { person: 'บุคคลทั่วไป', company: 'นิติบุคคล' }

/** "ภัทรพล เกียรติศักดิ์" → "ภ" for avatar squares */
export const initial = (name: string) => [...name.replace(/^(ดร\.|นาย|นาง|นางสาว)\s*/, '')][0] ?? '?'
