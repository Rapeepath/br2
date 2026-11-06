// The showroom's contact details as the brochure knows them without the POS (static hosting, prerender,
// JSON-LD). Mirrors the defaults in server/catalog.ts settings; the live values from /api/public/store
// replace these at runtime (useStoreInfo in lib/live.ts). Keep the two in step when either changes.

export interface OpeningHours {
  /** 0 = Sunday … 6 = Saturday */
  day: number
  open: string
  close: string
}

export interface StoreInfo {
  storeName: string
  branch: string
  address: string
  phone: string
  email: string
  lineId: string
  lineUrl: string
  mapUrl: string
  hours: OpeningHours[]
  taxId: string
  vatRate: number
}

const ADDRESS = '1919 อาคารเซอร์โวทาวเวอร์ ชั้น 2 ถนนเทพรัตน แขวงบางนาใต้ เขตบางนา กรุงเทพฯ 10260'

export const STATIC_STORE: StoreInfo = {
  storeName: 'Servo Humanoid Showroom',
  branch: 'สำนักงานใหญ่ บางนา',
  address: ADDRESS,
  phone: '02-765-4321',
  email: 'hello@servo-showroom.example',
  lineId: '@servoshowroom',
  lineUrl: 'https://line.me/R/ti/p/@servoshowroom',
  mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`,
  hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: '10:00', close: '19:00' })),
  taxId: '0105568054321',
  vatRate: 7,
}
