// What this showroom sells and how its simulated days go. Everything specific to Servo lives here; the rest
// of server/ is the same POS engine the Maew shop runs.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BookingSeed, LeadSeed } from './crm.ts'
import type { CartLineInput, Category, Customer, PaymentMethod, Product, Settings } from './types.ts'
import type { Rng } from './util.ts'

export interface CatalogRecord {
  id: string
  [key: string]: unknown
}

export interface Catalog {
  /** Seeds the PRNG so every reset replays the same history */
  seed: number
  settings: Settings
  categories: Category[]
  staff: { id: string; name: string; title: string; role: 'manager' | 'staff'; pin: string; tone: string }[]
  customers: Omit<Customer, 'id' | 'createdAt'>[]
  /** Catalogue records (robot models) by id, returned with a product so the admin can show everything known */
  records: Map<string, CatalogRecord>
  products: (now: string) => Product[]
  /** How many units to have on the shelf after the simulated history */
  stockTarget: (p: Product, r: Rng) => number
  reorderLevel: (p: Product) => number
  openHour: number
  closeHour: number
  openingCash: number
  /** Bills on a given weekday (0 = Sunday) */
  ordersPerDay: (r: Rng, weekday: number) => number
  basket: (r: Rng, products: Product[]) => CartLineInput[]
  /** Share of bills rung up without a customer record */
  walkInRate: number
  payment: (r: Rng, total: number) => PaymentMethod
  /** Days between deliveries from the distributors */
  deliveryEvery: number
  /** Visits booked from the brochure: Servo books 90-minute demonstrations */
  booking: { kind: 'visit' | 'demo'; label: string; durationMin: number; windowDays: number }
  /** Demo contacts for the admin's contact book (no reviews: those only come from real visitors) */
  crmSeed: { leads: LeadSeed[]; bookings: BookingSeed[] }
}

interface Trim {
  name: string
  priceTHB: number | null
  priceBasis: 'dealer' | 'converted' | null
  dof: number | null
  handDof: number | null
  hand: string | null
  payloadKg: number | null
  runtimeH: number | null
  compute: string | null
}

interface Model {
  id: string
  brand: string
  nameEn: string
  nameTh: string
  originCountry: string
  availability: 'thai-dealer' | 'import' | 'preorder'
  distributor: string
  heightCm: number
  weightKg: [number, number] | null
  locomotion: 'legs' | 'wheels'
  warranty: { robot: string }
  trims: Trim[]
  image: { srcSmall: string }
  [key: string]: unknown
}

const AVAILABILITY = { 'thai-dealer': 'มีตัวแทนจำหน่ายในไทย', import: 'นำเข้าตามสั่ง', preorder: 'สั่งจองล่วงหน้า' } as const

/** "AGIBOT X2" → "AGX2", "Maxtronics NAO6" → "MANAO6": brand initials + the model's own name */
const modelCode = (m: Model) => `${m.brand.slice(0, 2)}${m.nameEn.split(/\s+/).at(-1)}`.toUpperCase().replace(/[^A-Z0-9]/g, '')

/** The words of a trim name that aren't the model's name: "X2 Neo" → "NEO", "G1+" → "G1PLUS", "G1" → "STD" */
function trimCode(m: Model, t: Trim): string {
  const modelWords = new Set(m.nameEn.toLowerCase().split(/\s+/))
  const rest = t.name.split(/\s+/).filter((w) => !modelWords.has(w.toLowerCase()))
  return rest.length ? rest.join('').replace(/\+/g, 'PLUS').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) : 'STD'
}
const kg = (r: [number, number] | null) => (!r ? 'ไม่ระบุ' : r[0] === r[1] ? `${r[0]} กก.` : `${r[0]}–${r[1]} กก.`)
const orNone = (v: number | null, unit: string) => (v === null ? 'ไม่ระบุ' : `${v.toLocaleString('th-TH')} ${unit}`)

function readModels(root: string): Model[] {
  return JSON.parse(readFileSync(join(root, 'src/data/models.json'), 'utf8')) as Model[]
}

/** Add-ons and services, priced inside the ranges in the site's set-up and ownership cost tables. */
const EXTRAS: { id: string; sku: string; name: string; subtitle: string; categoryId: string; price: number; cost: number; facts: [string, string][] }[] = [
  { id: 'acc-battery', sku: 'SV-AC-01', name: 'แบตเตอรี่สำรอง', subtitle: 'สำหรับรุ่นขนาดกลาง 1 ก้อน', categoryId: 'accessory', price: 45900, cost: 36700, facts: [['ใช้กับ', 'หุ่นยนต์ขนาดกลาง (สูง 1.2–1.4 ม.)'], ['ประกัน', '6 เดือน']] },
  { id: 'acc-battery-xl', sku: 'SV-AC-02', name: 'แบตเตอรี่สำรองขนาดใหญ่', subtitle: 'สำหรับรุ่นขนาดเต็มตัว 1 ก้อน', categoryId: 'accessory', price: 128000, cost: 104000, facts: [['ใช้กับ', 'หุ่นยนต์ขนาดเต็มตัว (สูง 1.6 ม. ขึ้นไป)'], ['ประกัน', '6 เดือน']] },
  { id: 'acc-gantry', sku: 'SV-AC-03', name: 'โครงแขวนกันล้ม (gantry)', subtitle: 'รอกไฟฟ้า รับน้ำหนัก 150 กก.', categoryId: 'accessory', price: 34900, cost: 26500, facts: [['ความสูงโครง', '2.4 ม.'], ['รับน้ำหนัก', '150 กก.']] },
  { id: 'acc-mat', sku: 'SV-AC-04', name: 'แผ่นยางกันกระแทกปูพื้น', subtitle: 'ชุด 16 ตารางเมตร', categoryId: 'accessory', price: 24900, cost: 17800, facts: [['พื้นที่', '16 ตร.ม. (4 × 4 ม.)'], ['ความหนา', '4 ซม.']] },
  { id: 'acc-wifi', sku: 'SV-AC-05', name: 'เราเตอร์ Wi-Fi 6 สำหรับสั่งงานหุ่นยนต์', subtitle: 'ชุด 2 ตัว (mesh)', categoryId: 'accessory', price: 5390, cost: 3900, facts: [['มาตรฐาน', 'Wi-Fi 6 (802.11ax)']] },
  { id: 'acc-case', sku: 'SV-AC-06', name: 'กล่องขนย้ายกันกระแทก', subtitle: 'มีล้อ ล็อกได้', categoryId: 'accessory', price: 18500, cost: 13200, facts: [['ใช้กับ', 'หุ่นยนต์สูงไม่เกิน 1.4 ม.']] },
  { id: 'acc-remote', sku: 'SV-AC-07', name: 'รีโมตควบคุมสำรอง', subtitle: 'จอยคู่ พร้อมสายชาร์จ', categoryId: 'accessory', price: 8900, cost: 6200, facts: [['ระยะสัญญาณ', 'ประมาณ 50 ม.']] },
  { id: 'svc-install', sku: 'SV-SV-01', name: 'ติดตั้งและอบรมการใช้งาน', subtitle: 'วิศวกรเข้าหน้างาน 1 วัน', categoryId: 'service', price: 25000, cost: 9000, facts: [['รวม', 'ตั้งค่าเครือข่าย ทดสอบเดิน อบรมผู้ใช้ 4 คน']] },
  { id: 'svc-sdk', sku: 'SV-SV-02', name: 'อบรมพัฒนาโปรแกรมด้วย SDK', subtitle: 'หลักสูตร 2 วัน', categoryId: 'service', price: 45000, cost: 16000, facts: [['ผู้เรียน', 'ไม่เกิน 8 คน'], ['เนื้อหา', 'ROS 2, Python SDK, การจำลองบนคอมพิวเตอร์']] },
  { id: 'svc-import', sku: 'SV-SV-03', name: 'ขนส่งและพิธีการศุลกากร', subtitle: 'จากโรงงานถึงหน้างานในไทย', categoryId: 'service', price: 28000, cost: 21000, facts: [['ระยะเวลา', '2–6 สัปดาห์ตามเส้นทาง'], ['อากรขาเข้า', 'ร้อยละ 0 (พิกัด 8479)']] },
  { id: 'svc-care', sku: 'SV-SV-04', name: 'สัญญาบำรุงรักษา 12 เดือน', subtitle: 'ตรวจเช็กทุก 3 เดือน อะไหล่ลด 15%', categoryId: 'service', price: 89000, cost: 52000, facts: [['รวม', 'ตรวจเช็ก 4 ครั้ง อัปเดตเฟิร์มแวร์ รถรับส่งเครื่อง']] },
  { id: 'svc-checkup', sku: 'SV-SV-05', name: 'ตรวจเช็กและอัปเดตเฟิร์มแวร์', subtitle: 'ครั้งเดียว ที่ศูนย์บริการ', categoryId: 'service', price: 6500, cost: 2400, facts: [['ใช้เวลา', 'ประมาณ 3 ชั่วโมง']] },
]

export function loadCatalog(root: string): Catalog {
  const models = readModels(root)
  const records = new Map<string, CatalogRecord>(models.map((m) => [m.id, m]))

  const products = (now: string): Product[] => {
    const robots = models.flatMap((m) =>
      m.trims
        .filter((t) => t.priceTHB !== null)
        .map((t): Product => {
          const price = t.priceTHB!
          const name = t.name.toLowerCase().startsWith(m.brand.toLowerCase()) ? t.name : `${m.brand} ${t.name}`
          const code = trimCode(m, t)
          return {
            id: `${m.id}-${code.toLowerCase()}`,
            sku: `SV-${modelCode(m)}-${code}`,
            name,
            subtitle: m.nameTh,
            categoryId: 'robot',
            refId: m.id,
            variant: t.name,
            price,
            // Dealer margin on imported robots is thin
            cost: Math.round(price * 0.82),
            stock: 0,
            reorderLevel: 1,
            trackStock: true,
            active: true,
            image: m.image.srcSmall,
            facts: [
              { label: 'ผู้ผลิต', value: `${m.brand} (${m.originCountry})` },
              { label: 'การจำหน่ายในไทย', value: AVAILABILITY[m.availability] },
              { label: 'ความสูง', value: `${m.heightCm} ซม.` },
              { label: 'น้ำหนัก', value: kg(m.weightKg) },
              { label: 'การเคลื่อนที่', value: m.locomotion === 'legs' ? 'เดินสองขา' : 'ฐานล้อ' },
              { label: 'องศาอิสระ', value: orNone(t.dof, 'DoF') },
              { label: 'มือ', value: t.hand ?? (t.handDof ? `${t.handDof} DoF ต่อข้าง` : 'ไม่ระบุ') },
              { label: 'รับน้ำหนัก', value: orNone(t.payloadKg, 'กก.') },
              { label: 'ใช้งานต่อการชาร์จ', value: orNone(t.runtimeH, 'ชม.') },
              { label: 'ราคา', value: t.priceBasis === 'dealer' ? 'ราคาตัวแทนจำหน่ายในไทย' : 'แปลงจากราคาผู้ผลิต' },
              { label: 'รับประกัน', value: m.warranty.robot },
            ],
            createdAt: now,
            updatedAt: now,
          }
        }),
    )
    const extras = EXTRAS.map(
      (e): Product => ({
        id: e.id,
        sku: e.sku,
        name: e.name,
        subtitle: e.subtitle,
        categoryId: e.categoryId,
        refId: null,
        variant: null,
        price: e.price,
        cost: e.cost,
        stock: 0,
        reorderLevel: 0,
        trackStock: e.categoryId === 'accessory',
        active: true,
        image: null,
        facts: e.facts.map(([label, value]) => ({ label, value })),
        createdAt: now,
        updatedAt: now,
      }),
    )
    return [...robots, ...extras]
  }

  const robots = (ps: Product[]) => ps.filter((p) => p.categoryId === 'robot')
  const addOns = (ps: Product[]) => ps.filter((p) => p.categoryId !== 'robot')

  return {
    seed: 20261107,
    settings: {
      storeName: 'Servo Humanoid Showroom',
      branch: 'สำนักงานใหญ่ บางนา',
      address: '1919 อาคารเซอร์โวทาวเวอร์ ชั้น 2 ถนนเทพรัตน แขวงบางนาใต้ เขตบางนา กรุงเทพฯ 10260',
      phone: '02-765-4321',
      taxId: '0105568054321',
      vatRate: 7,
      receiptFooter: 'สินค้ารับประกันตามเงื่อนไขของผู้ผลิต นัดวิศวกรติดตั้งได้ที่ 02-765-4321 ต่อ 2',
      receiptPrefix: 'SV',
      email: 'hello@servo-showroom.example',
      lineId: '@servoshowroom',
      lineUrl: 'https://line.me/R/ti/p/@servoshowroom',
      mapUrl: "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent('1919 ถนนเทพรัตน แขวงบางนาใต้ เขตบางนา กรุงเทพฯ 10260'),
      hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: '10:00', close: '19:00' })),
      siteUrl: 'https://servo-showroom.example',
    },
    categories: [
      { id: 'robot', label: 'หุ่นยนต์', unit: 'เครื่อง' },
      { id: 'accessory', label: 'อุปกรณ์เสริม', unit: 'ชิ้น' },
      { id: 'service', label: 'บริการ', unit: 'งาน' },
    ],
    staff: [
      { id: 'st-1', name: 'กฤษดา วัฒนกุล', title: 'ผู้จัดการโชว์รูม', role: 'manager', pin: '1111', tone: 'gold' },
      { id: 'st-2', name: 'อรอนงค์ ศรีประเสริฐ', title: 'ที่ปรึกษาการขาย', role: 'staff', pin: '2222', tone: 'sky' },
      { id: 'st-3', name: 'ภัทรพล เกียรติศักดิ์', title: 'วิศวกรบริการ', role: 'staff', pin: '3333', tone: 'sage' },
    ],
    customers: CUSTOMERS,
    records,
    products,
    stockTarget: (p, r) => (p.categoryId === 'robot' ? r.int(0, 3) : r.int(2, 9)),
    reorderLevel: (p) => (p.categoryId === 'robot' ? 1 : 2),
    openHour: 10,
    closeHour: 19,
    openingCash: 5000,
    ordersPerDay: (r, weekday) => (weekday === 0 ? r.int(0, 1) : r.int(1, 3)),
    // Only the seed calls this; it ignores stock on purpose (the seed sizes opening stock to fit what sold)
    basket: (r, ps) => {
      const lines: CartLineInput[] = []
      if (r.chance(0.3)) {
        // Cheaper research and education robots sell far more often than the flagship service humanoids
        const robot = r.weighted(robots(ps), (p) => 2_000_000 / p.price)
        lines.push({ productId: robot.id, qty: 1 })
        if (r.chance(0.8)) lines.push({ productId: 'svc-install', qty: 1 })
        if (r.chance(0.45)) lines.push({ productId: 'acc-gantry', qty: 1 })
        if (r.chance(0.35)) lines.push({ productId: robot.price > 1_200_000 ? 'acc-battery-xl' : 'acc-battery', qty: 1 })
        if (r.chance(0.3)) lines.push({ productId: 'svc-care', qty: 1 })
        if (r.chance(0.25)) lines.push({ productId: 'svc-sdk', qty: 1 })
        return lines
      }
      const n = r.int(1, 2)
      for (let i = 0; i < n; i++) {
        const p = r.weighted(addOns(ps), (x) => (x.price < 10000 ? 4 : x.price < 50000 ? 2 : 1))
        if (lines.some((l) => l.productId === p.id)) continue
        lines.push({ productId: p.id, qty: p.id === 'acc-wifi' || p.id === 'acc-remote' ? r.int(1, 3) : 1 })
      }
      return lines
    },
    walkInRate: 0.15,
    payment: (r, total) => {
      if (total > 300_000) return r.weighted(['transfer', 'card'] as const, (m) => (m === 'transfer' ? 6 : 2))
      return r.weighted(['cash', 'promptpay', 'card', 'transfer'] as const, (m) => ({ cash: 1, promptpay: 2, card: 3, transfer: 3 })[m])
    },
    deliveryEvery: 14,
    booking: { kind: 'demo', label: 'ชมการสาธิต', durationMin: 90, windowDays: 21 },
    crmSeed: CRM_SEED,
  }
}

const CRM_SEED: Catalog['crmSeed'] = {
  leads: [
    { kind: 'inquiry', name: 'คุณศิริวรรณ เตชะวงศ์', phone: '081-552-7140', email: 'siriwan.t@example.com', message: 'สนใจหุ่นยนต์ต้อนรับลูกค้าสำหรับโชว์รูมรถยนต์ 2 สาขา อยากทราบระยะเวลาส่งมอบและการอบรมพนักงาน', refIds: ['agibot-x2'], daysAgo: 1, status: 'new' },
    { kind: 'inquiry', name: 'อาจารย์ธนพล ศรีนวล', phone: '089-114-6632', email: 'thanaphon.s@example.com', message: 'ภาควิชาต้องการหุ่นยนต์สำหรับวิจัยการเดิน ขอเอกสารสเปกและราคารุ่น EDU พร้อม SDK', refIds: ['unitree-g1', 'engineai-t800'], daysAgo: 3, status: 'contacted', note: 'ส่งสเปกทางอีเมลแล้ว นัดโทรคุยรายละเอียดอีกครั้งวันศุกร์' },
    { kind: 'inquiry', name: 'คุณปกรณ์ วิไลรัตน์', phone: '062-905-3381', lineId: '@pakornv', message: 'มีบริการเช่ารายเดือนสำหรับงานอีเวนต์ 3 วันไหมครับ', refIds: ['agibot-x2'], daysAgo: 6, status: 'contacted', note: 'แจ้งว่าร้านยังไม่มีบริการเช่าระยะสั้น แนะนำพาร์ทเนอร์อีเวนต์' },
    { kind: 'inquiry', name: 'คุณเบญจวรรณ ทองสุข', phone: '095-337-2018', email: 'benjawan@example.com', message: 'โรงเรียนประถมสนใจ NAO6 สำหรับชมรมหุ่นยนต์ ใช้กับ Scratch หรือ Python ได้ไหม', refIds: ['nao6'], daysAgo: 9, status: 'won', note: 'ปิดการขาย 1 เครื่องพร้อมอบรม' },
    { kind: 'inquiry', name: 'คุณวสันต์ พงษ์ประเสริฐ', phone: '086-771-9054', message: 'ขอทราบราคา Galbot G1 แบบรวมติดตั้งในคลังสินค้า', refIds: ['galbot-g1'], daysAgo: 14, status: 'lost', note: 'ลูกค้าเลื่อนงบไปปีหน้า' },
    { kind: 'inquiry', name: 'คุณมาลินี จันทร์หอม', phone: '091-208-4475', email: 'malinee.c@example.com', message: 'สนใจ LimX Luna สำหรับงานบริการในโรงแรม สั่งจองแล้วรอนานเท่าไร', refIds: ['limx-luna'], daysAgo: 0, status: 'new' },
    { kind: 'privacy', name: 'คุณกฤติน อ่อนละมัย', phone: '084-660-1297', email: 'krittin.o@example.com', message: 'ขอลบข้อมูล: เคยกรอกแบบฟอร์มสอบถามเมื่อเดือนก่อน ขอให้ลบเบอร์โทรออกจากระบบ', request: 'delete', daysAgo: 2, status: 'new' },
  ],
  bookings: [
    { name: 'คุณอรรถพล ศักดิ์ดี', phone: '081-993-2046', email: 'attaphon@example.com', note: 'มากัน 3 คนจากฝ่ายวิศวกรรม', refId: 'unitree-g1', dayOffset: -12, slot: 1, status: 'done' },
    { name: 'คุณนิตยา ชูชื่น', phone: '089-224-7713', refId: 'agibot-a2', dayOffset: -6, slot: 3, status: 'done' },
    { name: 'คุณภูมิ เกียรติไกร', phone: '062-417-8890', refId: 'engineai-t800', dayOffset: -3, slot: 2, status: 'no-show' },
    { name: 'คุณจันทร์จิรา มณีรัตน์', phone: '094-552-3310', note: 'ขอเลื่อน', refId: 'nao6', dayOffset: -1, slot: 0, status: 'cancelled' },
    { name: 'คุณสมชาย วงศ์ไทย', phone: '081-446-2290', email: 'somchai.w@example.com', note: 'อยากเห็นการเดินบนพื้นต่างระดับ', refId: 'unitree-g1', dayOffset: 1, slot: 1, status: 'confirmed' },
    { name: 'คุณแพรวา อินทรสุวรรณ', phone: '095-118-6604', refId: 'agibot-x2', dayOffset: 2, slot: 3, status: 'pending' },
    { name: 'บริษัท สมาร์ทรีเทล (คุณอนันต์)', phone: '02-640-9900', email: 'innovation@smartretail.example', note: 'ทีมนวัตกรรม 4 คน', refId: 'galbot-g1', dayOffset: 4, slot: 2, status: 'confirmed' },
    { name: 'คุณธิดารัตน์ แก้วกาญจนา', phone: '086-503-7742', refId: 'limx-luna', dayOffset: 7, slot: 0, status: 'pending' },
  ],
}

type Row = [name: string, phone: string, email: string | null, kind: 'person' | 'company', taxId: string | null, address: string | null]

// Fictional buyers: companies and institutions take full tax invoices
const CUSTOMERS: Omit<Customer, 'id' | 'createdAt'>[] = (
  [
    ['บริษัท ไทยโรโบติกส์ โซลูชั่น จำกัด', '02-118-2240', 'purchasing@thairobotics.example', 'company', '0105561123401', '55 ถนนวิภาวดีรังสิต แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900'],
    ['ศูนย์วิจัยหุ่นยนต์และระบบอัตโนมัติบางนา', '02-330-1188', 'lab@bangna-rai.example', 'company', '0994000123452', '99 ถนนบางนา-ตราด กม.3 เขตบางนา กรุงเทพฯ 10260'],
    ['โรงเรียนสาธิตนวัตกรรมการเรียนรู้', '02-551-7720', 'stem@satitinno.example', 'company', '0994000223453', '12 ถนนงามวงศ์วาน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ 10900'],
    ['บริษัท เอเชีย สมาร์ทแวร์เฮาส์ จำกัด', '038-221-554', 'ops@asiasmartwh.example', 'company', '0205562334404', '88/2 นิคมอุตสาหกรรมอมตะซิตี้ ชลบุรี 20000'],
    ['สถาบันเทคโนโลยีบูรพานคร', '038-102-300', 'procure@burapha-tech.example', 'company', '0994000334455', '169 ถนนลงหาดบางแสน ตำบลแสนสุข อำเภอเมือง ชลบุรี 20131'],
    ['บริษัท สมาร์ทรีเทล กรุ๊ป จำกัด (มหาชน)', '02-640-9900', 'innovation@smartretail.example', 'company', '0107563445406', '999 ถนนพระราม 1 แขวงปทุมวัน เขตปทุมวัน กรุงเทพฯ 10330'],
    ['โรงแรมริเวอร์ไซด์ แกรนด์ เจริญนคร', '02-438-5000', 'gm@riversidegrand.example', 'company', '0105564556407', '257 ถนนเจริญนคร แขวงสำเหร่ เขตธนบุรี กรุงเทพฯ 10600'],
    ['บริษัท เมดิแคร์ ซัพพลาย จำกัด', '02-954-3311', 'admin@medicare-supply.example', 'company', '0105565667408', '41 ถนนงามวงศ์วาน ตำบลบางกระสอ อำเภอเมือง นนทบุรี 11000'],
    ['มหาวิทยาลัยเทคโนโลยีราชพฤกษ์', '053-221-900', 'eng@ratchaphruek-tech.example', 'company', '0994000778459', '239 ถนนห้วยแก้ว ตำบลสุเทพ อำเภอเมือง เชียงใหม่ 50200'],
    ['บริษัท ไทยออโตพาร์ท แมนูแฟคเจอริ่ง จำกัด', '038-650-120', 'engineering@thaiautopart.example', 'company', '0215566889410', '7/120 นิคมอุตสาหกรรมเหมราช ระยอง 21140'],
    ['ศูนย์การเรียนรู้วิทยาศาสตร์เยาวชนขอนแก่น', '043-202-611', 'kkscience@learn.example', 'company', '0994000990461', '123 ถนนมิตรภาพ ตำบลในเมือง อำเภอเมือง ขอนแก่น 40000'],
    ['บริษัท ฟิวเจอร์ เอ็กซ์โป ครีเอชั่น จำกัด', '02-277-4545', 'event@futureexpo.example', 'company', '0105567001412', '33 ถนนรัชดาภิเษก แขวงดินแดง เขตดินแดง กรุงเทพฯ 10400'],
    ['ดร.วิชัย พงศ์ไพบูลย์', '081-445-2290', 'wichai.p@example.com', 'person', null, null],
    ['ณัฐวดี ศรีสกุล', '089-662-1043', 'natwadee.s@example.com', 'person', null, null],
    ['ธีรภัทร์ อัครเดช', '086-120-7781', null, 'person', null, null],
    ['พชร ลิ้มเจริญ', '092-338-4410', 'pachara.l@example.com', 'person', null, null],
    ['กานต์ธิดา รุ่งโรจน์', '095-771-2306', null, 'person', null, null],
    ['สุทธิพงษ์ แก้วมณี', '084-550-9182', 'sutthipong.k@example.com', 'person', null, null],
    ['วริศรา ทองประเสริฐ', '063-284-5517', null, 'person', null, null],
    ['อัครพล ชัยวัฒน์', '091-903-6624', 'akkharaphon@example.com', 'person', null, null],
  ] as Row[]
).map(([name, phone, email, kind, taxId, address]) => ({ name, phone, email, kind, taxId, address, note: null }))
