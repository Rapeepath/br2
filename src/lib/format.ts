import type { Availability, Category, Currency, Locomotion, OriginGroup, Range } from './types'

// Up to two decimals, so published figures (0.75 m/s, 2.5 ชั่วโมง) read the same everywhere
const number = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 })

export const formatNumber = (n: number) => number.format(n)

/** "120–180 ซม." — collapses equal ends, returns null when unknown. */
export function formatRange(range: Range | null | undefined, unit: string): string | null {
  if (!range) return null
  const [min, max] = range
  const body = min === max ? formatNumber(min) : `${formatNumber(min)}–${formatNumber(max)}`
  return unit ? `${body} ${unit}` : body
}

/** "559,000 บาท", or a span "559,000–1,980,000 บาท". */
export function formatPrice(range: Range | null | undefined): string | null {
  return formatRange(range, 'บาท')
}

/** Short figure for tight spots: 1,099,900 → "1.10 ล้าน". */
export function formatMillion(n: number): string {
  return `${(n / 1_000_000).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ล้าน`
}

export const CATEGORY_LABEL: Record<Category, string> = {
  research: 'วิจัยและพัฒนา',
  education: 'การศึกษา',
  home: 'ผู้ช่วยในบ้าน',
  industrial: 'อุตสาหกรรม',
  service: 'งานบริการ',
}

/** Brief category names for tight spots (the lineup's filter, phone cards). */
export const CATEGORY_BRIEF: Record<Category, string> = {
  research: 'วิจัย',
  education: 'การศึกษา',
  home: 'ในบ้าน',
  industrial: 'อุตสาหกรรม',
  service: 'บริการ',
}

export const LOCOMOTION_LABEL: Record<Locomotion, string> = {
  legs: 'เดินสองขา',
  wheels: 'ฐานล้อ',
}

export const ORIGIN_LABEL: Record<OriginGroup, string> = {
  china: 'จีน',
  japan: 'ญี่ปุ่น',
  korea: 'เกาหลีใต้',
  europe: 'ยุโรป',
  usa: 'สหรัฐอเมริกา',
}

export const AVAILABILITY_LABEL: Record<Availability, string> = {
  'thai-dealer': 'มีตัวแทนในไทย',
  import: 'สั่งนำเข้า',
  preorder: 'เปิดจอง',
}

export const CURRENCY_LABEL: Record<Currency, string> = {
  THB: 'บาท',
  USD: 'ดอลลาร์สหรัฐ',
  CNY: 'หยวน',
  EUR: 'ยูโร',
}

/** The maker's own price as it is quoted: "16,000 ดอลลาร์สหรัฐ" (or "16,000 USD" with `brief`). */
export function formatListPrice(p: { amount: number; currency: Currency }, brief = false): string {
  return `${formatNumber(p.amount)} ${brief ? p.currency : CURRENCY_LABEL[p.currency]}`
}

/** m/s → km/h, the speed Thai readers picture ("7.2 กม./ชม."). */
export const msToKmh = (ms: number) => Math.round(ms * 3.6 * 10) / 10

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

/** "2026-10" → "ต.ค. 2569", for labels with little room. */
export function formatMonthShortTh(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  if (!y || !m) return yyyyMm
  return `${THAI_MONTHS_SHORT[m - 1]} ${y + 543}`
}

/** "2026-10" → "ตุลาคม 2569" (Buddhist Era, as Thai readers expect). */
export function formatMonthTh(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  if (!y || !m) return yyyyMm
  return `${THAI_MONTHS[m - 1]} ${y + 543}`
}
