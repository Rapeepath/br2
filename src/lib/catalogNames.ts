// The showroom's POS names its products in Thai. English pages show these names instead (robots already
// carry their English trim names). Keep the ids in step with server/catalog.ts EXTRAS.
import type { Lang } from '../i18n'
import type { LiveItem } from './live'

const EN: Record<string, { name: string; subtitle: string }> = {
  'acc-battery': { name: 'Spare battery', subtitle: 'For mid-size robots, one pack' },
  'acc-battery-xl': { name: 'Spare battery, large', subtitle: 'For full-size robots, one pack' },
  'acc-gantry': { name: 'Fall-arrest gantry', subtitle: 'Electric hoist, 150 kg load' },
  'acc-mat': { name: 'Impact floor mats', subtitle: 'Set of 16 m²' },
  'acc-wifi': { name: 'Wi-Fi 6 router for robot control', subtitle: 'Mesh set of two' },
  'acc-case': { name: 'Shock-proof transport case', subtitle: 'On wheels, lockable' },
  'acc-remote': { name: 'Spare remote controller', subtitle: 'Twin-stick, with charging cable' },
  'svc-install': { name: 'Installation and user training', subtitle: 'An engineer on site for one day' },
  'svc-sdk': { name: 'SDK programming course', subtitle: 'Two days' },
  'svc-import': { name: 'Shipping and customs clearance', subtitle: 'From the factory to your site in Thailand' },
  'svc-care': { name: '12-month maintenance plan', subtitle: 'A check-up every 3 months, 15% off parts' },
  'svc-checkup': { name: 'Check-up and firmware update', subtitle: 'One visit to the service centre' },
}

const CATEGORY = {
  th: { robot: 'หุ่นยนต์', accessory: 'อุปกรณ์เสริม', service: 'บริการ' },
  en: { robot: 'Robots', accessory: 'Accessories', service: 'Services' },
} as const

export function itemName(item: Pick<LiveItem, 'id' | 'name' | 'subtitle' | 'categoryId'>, lang: Lang) {
  if (lang === 'en' && EN[item.id]) return EN[item.id]
  if (lang === 'en' && item.categoryId === 'robot') return { name: item.name, subtitle: '' }
  return { name: item.name, subtitle: item.subtitle }
}

export const categoryName = (id: string, lang: Lang) => (CATEGORY[lang] as Record<string, string>)[id] ?? id

/** Accessory and service ids the configurator suggests for a robot of this size */
export function suggestedFor(heightCm: number, locomotion: 'legs' | 'wheels'): string[] {
  return [heightCm >= 150 ? 'acc-battery-xl' : 'acc-battery', ...(locomotion === 'legs' ? ['acc-gantry'] : []), 'svc-install']
}

/** Thai names as the POS has them (server/catalog.ts EXTRAS), for pages drawn before live data arrives */
const TH: Record<string, { name: string; subtitle: string; categoryId: 'accessory' | 'service' }> = {
  'acc-battery': { name: 'แบตเตอรี่สำรอง', subtitle: 'สำหรับรุ่นขนาดกลาง 1 ก้อน', categoryId: 'accessory' },
  'acc-battery-xl': { name: 'แบตเตอรี่สำรองขนาดใหญ่', subtitle: 'สำหรับรุ่นขนาดเต็มตัว 1 ก้อน', categoryId: 'accessory' },
  'acc-gantry': { name: 'โครงแขวนกันล้ม (gantry)', subtitle: 'รอกไฟฟ้า รับน้ำหนัก 150 กก.', categoryId: 'accessory' },
  'acc-mat': { name: 'แผ่นยางกันกระแทกปูพื้น', subtitle: 'ชุด 16 ตารางเมตร', categoryId: 'accessory' },
  'acc-wifi': { name: 'เราเตอร์ Wi-Fi 6 สำหรับสั่งงานหุ่นยนต์', subtitle: 'ชุด 2 ตัว (mesh)', categoryId: 'accessory' },
  'acc-case': { name: 'กล่องขนย้ายกันกระแทก', subtitle: 'มีล้อ ล็อกได้', categoryId: 'accessory' },
  'acc-remote': { name: 'รีโมตควบคุมสำรอง', subtitle: 'จอยคู่ พร้อมสายชาร์จ', categoryId: 'accessory' },
  'svc-install': { name: 'ติดตั้งและอบรมการใช้งาน', subtitle: 'วิศวกรเข้าหน้างาน 1 วัน', categoryId: 'service' },
  'svc-sdk': { name: 'อบรมพัฒนาโปรแกรมด้วย SDK', subtitle: 'หลักสูตร 2 วัน', categoryId: 'service' },
  'svc-import': { name: 'ขนส่งและพิธีการศุลกากร', subtitle: 'จากโรงงานถึงหน้างานในไทย', categoryId: 'service' },
  'svc-care': { name: 'สัญญาบำรุงรักษา 12 เดือน', subtitle: 'ตรวจเช็กทุก 3 เดือน อะไหล่ลด 15%', categoryId: 'service' },
  'svc-checkup': { name: 'ตรวจเช็กและอัปเดตเฟิร์มแวร์', subtitle: 'ครั้งเดียว ที่ศูนย์บริการ', categoryId: 'service' },
}

/** A product as the page can name it without the POS: id, Thai name and subtitle, category */
export const staticItem = (id: string) => ({ id, name: TH[id]?.name ?? id, subtitle: TH[id]?.subtitle ?? '', categoryId: TH[id]?.categoryId ?? 'accessory' })