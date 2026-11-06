import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { ArrowRight, ArrowUpRight, BatteryCharging, Info, RotateCcw } from 'lucide-react'
import { CountUp } from '../components/CountUp'
import { PriceRangeChart } from '../components/PriceRangeChart'
import { useLang } from '../i18n'
import { GuideEn } from './GuidePage.en'
import { market, models } from '../data'
import { focusSoon, langOf, useTitle } from '../lib/a11y'
import { useReveal } from '../lib/motion'
import { CURRENCY_LABEL, formatMonthTh, formatNumber, formatRange } from '../lib/format'
import type { Availability, CostItem, Currency, Model } from '../lib/types'
import './GuidePage.css'

const SECTIONS = [
  { id: 'market', label: 'ภาพรวมตลาด', title: 'ภาพรวมตลาดหุ่นยนต์ฮิวแมนนอยด์', en: 'Market Overview' },
  { id: 'checklist', label: 'เช็กลิสต์ก่อนซื้อ', title: 'เช็กลิสต์ก่อนซื้อ', en: 'Buyer’s Checklist' },
  { id: 'setup', label: 'การเตรียมพื้นที่', title: 'การเตรียมพื้นที่', en: 'Site Preparation' },
  { id: 'buying', label: 'ช่องทางซื้อในไทย', title: 'ช่องทางซื้อในไทย', en: 'Where to Buy' },
  { id: 'energy', label: 'ค่าไฟต่อการชาร์จ', title: 'ค่าไฟต่อการชาร์จ', en: 'Energy Cost' },
  { id: 'costs', label: 'ค่าใช้จ่ายรายปี', title: 'ค่าใช้จ่ายรายปี', en: 'Cost of Ownership' },
  { id: 'prices', label: 'ราคาแต่ละรุ่น', title: 'ราคาแต่ละรุ่น', en: 'Price Guide' },
  { id: 'law', label: 'มาตรการรัฐและกฎหมาย', title: 'มาตรการรัฐและกฎหมาย', en: 'Incentives & Law' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']
const isSection = (id: unknown): id is SectionId => SECTIONS.some((s) => s.id === id)

const CHECK_KEY = 'servo.checklist'

/** "01", "02"… for numbered items; always decorative. */
const nn = (i: number) => String(i + 1).padStart(2, '0')

// ---------- Figures ----------

const whole = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 })
const satang = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Baht as a bill prints it: whole baht when exact, otherwise to the satang (645.21, 4,012.50). */
const baht = (n: number) => (Number.isInteger(n) ? whole.format(n) : satang.format(n))
const bahtSpan = (min: number, max: number) => (min === max ? baht(min) : `${baht(min)}–${baht(max)}`)
/** Rates and per-charge costs always to two places, so a column of them lines up (3.00, 4.90). */
const rateSpan = (min: number, max: number) =>
  min === max ? satang.format(min) : `${satang.format(min)}–${satang.format(max)}`

/** Totals of estimates are quoted to the hundred baht: "29,800", not "29,845.21". */
const round100 = (n: number) => Math.round(n / 100) * 100

const sum = (xs: { min: number; max: number }[]) =>
  xs.reduce((acc, x) => ({ min: acc.min + x.min, max: acc.max + x.max }), { min: 0, max: 0 })

/** "2026-10-24" → "24 ตุลาคม 2569" (Buddhist Era, as on a Thai bill). */
const dayTh = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return d ? `${Number(d)} ${formatMonthTh(`${y}-${m}`)}` : formatMonthTh(iso)
}

/** Thai lists run on with spaces and "และ" before the last: "ก ข และ ค". */
const thaiList = (xs: string[]) =>
  xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(' ')} และ${langOf(xs[xs.length - 1]) ? ' ' : ''}${xs[xs.length - 1]}`

// ---------- Thai line breaking ----------

/**
 * Runs this page keeps on one line: numeric and month ranges ("160,000–180,000", "ม.ค.–ก.ย."),
 * compound units ("บาท/หน่วย", "บาท/ชม."), hyphenated names ("Off-Peak", "Wi-Fi"), and robot, import
 * and legal compounds the browser's Thai breaker splits ("หุ่น / ยนต์", "ฮิว / แมน / นอยด์"). Longer
 * entries come first so they win over words inside them. Every entry is short enough to fit a 320px
 * phone column.
 */
const KEEP = new RegExp(
  '(' +
    [
      '\\d[\\d,.]*–\\d[\\d,.]*',
      '[ก-๙]{1,2}\\.[ก-๙]{1,2}\\.–[ก-๙]{1,2}\\.[ก-๙]{1,2}\\.',
      'บาท/หน่วย',
      'บาท/kWh',
      'บาท/ชั่วโมง',
      'บาท/ชม\\.',
      'กม\\./ชม\\.',
      'กฟน\\./กฟภ\\.',
      'O(?:ff|n)-Peak',
      'Wi-Fi',
      // Compounds found by running the data through Intl.Segmenter('th'): pairs it splits whose halves
      // read wrongly alone ("หุ่น / ยนต์", "องศา / อิสระ", "อากร / ขา / เข้า")
      'ส่งเสริมการลงทุน',
      'ข้อมูลส่วนบุคคล',
      'ภาษีมูลค่าเพิ่ม',
      'อัตราแลกเปลี่ยน',
      'ห้องปฏิบัติการ',
      'ปัญญาประดิษฐ์',
      'น้ำหนักบรรทุก',
      'ผู้จัดจำหน่าย',
      'ตัวแทนจำหน่าย',
      'พระราชบัญญัติ',
      'ระบบอัตโนมัติ',
      'ปุ่มหยุดฉุกเฉิน',
      'คลื่นความถี่',
      'วิทยุคมนาคม',
      'จองล่วงหน้า',
      'ใบกำกับภาษี',
      'ใบเสนอราคา',
      'สิทธิประโยชน์',
      'ความปลอดภัย',
      'ฮิวแมนนอยด์',
      'แค็ตตาล็อก',
      'กรมศุลกากร',
      'กรมสรรพากร',
      'ค่าธรรมเนียม',
      'ผู้ให้บริการ',
      'อากรขาเข้า',
      'ภาษีนำเข้า',
      'องศาอิสระ',
      'ผู้จำหน่าย',
      'สั่งนำเข้า',
      'ผู้นำเข้า',
      'ผู้ใช้งาน',
      'ผู้ผลิต',
      'ผู้ซื้อ',
      'เครื่องชาร์จ',
      'การชาร์จ',
      'แท่นชาร์จ',
      'จุดชาร์จ',
      'บำรุงรักษา',
      'ซ่อมบำรุง',
      'ศูนย์บริการ',
      'เปรียบเทียบ',
      'ค่าใช้จ่าย',
      'ค่าบริการ',
      'ค่าขนส่ง',
      'ค่าไฟฟ้า',
      'ค่าไฟ',
      'การไฟฟ้า',
      'ทางอากาศ',
      'ทางเรือ',
      'ประกันภัย',
      'รับประกัน',
      'ใบอนุญาต',
      'ตัดไฟรั่ว',
      'เบรกเกอร์',
      'แบตเตอรี่',
      'หุ่นยนต์',
      'รุ่นย่อย',
      'ความจุ',
      'ข้อกำหนด',
      'ระยะเวลา',
      'ชิ้นส่วน',
      'หยิบจับ',
      'โครงแขวน',
      'กันล้ม',
      'ข้อต่อ',
      'แรงบิด',
      'สองขา',
      'ฐานล้อ',
      'ลิดาร์',
      'เปิดจอง',
      'ภาครัฐ',
      'หน่วยงาน',
      'เช่าซื้อ',
      'ผ่อนชำระ',
      'ลดหย่อน',
      'อย่างน้อย',
      'ส่วนใหญ่',
      'ด้านล่าง',
      'ตรวจสอบ',
      'ติดตั้ง',
      'อยู่อาศัย',
      'ส่งมอบ',
      'รับมอบ',
      'ทั่วโลก',
      'สูงกว่า',
      'ต่ำกว่า',
      'ไม่เกิน',
      'ขึ้นไป',
      'ร้อยละ',
      'รายปี',
      'ปีละ',
    ].join('|') +
    ')',
)

/** Words that lead their figure: a letter ("ROS 2"), a month or "ปี" before its year ("ตุลาคม 2569"). */
const LEADS_FIGURE =
  /([A-Za-z]|[ก-๙]{1,2}\.[ก-๙]{1,2}\.|ร้อยละ|อันดับ|ปี|(?:มกรา|มีนา|พฤษภา|กรกฎา|สิงหา|ตุลา|ธันวา)คม|(?:เมษา|มิถุนา|กันยา|พฤศจิกา)ยน|กุมภาพันธ์)\s+(?=\d)/g

/**
 * Thai line breaking for running text: a number stays with its unit ("864 Wh", "25,000 บาท"), a label
 * or date with its figure ("ROS 2", "ร้อยละ 30", "ตุลาคม 2569" — but not a unit with the next figure,
 * as in "35 กก. 1,000 บาท"), a dash with the word before it, and the runs above stay whole. Only
 * no-break spaces and nowrap spans are added, so the text reads and announces exactly the same.
 */
export function tie(s: string): ReactNode {
  const glued = s
    .replace(/(\d%?)\s+(?=\S)/g, '$1\xA0')
    .replace(LEADS_FIGURE, '$1\xA0')
    .replace(/\s+–\s+/g, '\xA0–\xA0')
  const parts = glued.split(KEEP)
  return parts.length === 1
    ? glued
    : parts.map((p, i) =>
        i % 2 ? (
          <span key={i} className="nowrap">
            {p}
          </span>
        ) : (
          p
        ),
      )
}

/** "แบตเตอรี่สำรอง (ไม่บังคับ)" → the name and its closing bracketed aside (nested brackets allowed). */
export function splitAside(s: string): [string, string | null] {
  const t = s.trim()
  if (!t.endsWith(')')) return [t, null]
  let depth = 0
  for (let i = t.length - 1; i >= 0; i--) {
    if (t[i] === ')') depth++
    else if (t[i] === '(' && --depth === 0) {
      const main = t.slice(0, i).trim()
      return main ? [main, t.slice(i)] : [t, null]
    }
  }
  return [t, null]
}

const unbracket = (s: string) => s.replace(/^\((.*)\)$/, '$1')

/** A name with its bracketed aside set on a quieter second line; it reads exactly like the original string. */
function WithAside({ text }: { text: string }) {
  const [main, aside] = splitAside(text)
  return (
    <>
      <span lang={langOf(main)}>{tie(main)}</span>
      {aside && (
        <>
          {' '}
          <span className="g-aside" lang={langOf(aside)}>
            {tie(aside)}
          </span>
        </>
      )}
    </>
  )
}

/** "หัวข้อ: รายละเอียด" (price factors) → a bold lead-in and the body. */
function splitLead(s: string): [string | null, string] {
  const i = s.indexOf(': ')
  return i > 0 && i < 60 ? [s.slice(0, i), s.slice(i + 2)] : [null, s]
}

// ---------- Derived data ----------

/** Yearly costs may list electricity once per tariff; those rows are alternatives, so each total counts one. */
function yearlyCosts(items: CostItem[]) {
  const power = items.filter((c) => /^ค่าไฟฟ้า/.test(c.item))
  if (power.length < 2) return { fixed: items, choice: null, totals: [{ label: 'รวมต่อปี', note: null, ...sum(items) }] }
  const fixed = items.filter((c) => !power.includes(c))
  const base = sum(fixed)
  const mains = power.map((c) => splitAside(c.item))
  const shared = mains.every(([m, a]) => m === mains[0][0] && a) ? mains[0][0] : null
  const options = power.map((c, i) => ({ ...c, label: shared ? unbracket(mains[i][1]!) : c.item }))
  return {
    fixed,
    choice: { label: shared ?? 'ค่าไฟฟ้าสำหรับชาร์จ', options },
    totals: options.map((o) => ({ label: 'รวมต่อปี', note: o.label, min: base.min + o.min, max: base.max + o.max })),
  }
}

const isOptional = (c: CostItem) => /ไม่บังคับ/.test(c.item)

/** One-off costs: optional items ("ไม่บังคับ") only count toward the top of the range. */
function oneTimeTotal(items: CostItem[]) {
  const optional = items.filter(isOptional)
  return {
    label: 'รวม',
    note: optional.length ? 'ปลายล่างไม่รวมรายการที่ไม่บังคับ' : null,
    min: sum(items.filter((c) => !optional.includes(c))).min,
    max: sum(items).max,
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/** The maker match build-data uses for makerRank: "Booster" is "Booster Robotics". */
function sameMaker(a: string, b: string) {
  const [x, y] = [norm(a), norm(b)]
  return x !== '' && y !== '' && (x === y || x.startsWith(y) || y.startsWith(x))
}

/** A note that names where the figure comes from belongs in the table's source line, not on its row. */
const isSourceNote = (n: string | null) => n != null && /^(ที่มา|ข้อมูลจาก|อ้างอิง)/.test(n.trim())

const shipments = [...market.shipments].sort((a, b) => b.units - a.units)
// A note every row shares ("ประมาณการ") is said once, under the table
const sharedNote =
  shipments.length > 1 && shipments.every((r) => r.note && r.note === shipments[0].note) && !isSourceNote(shipments[0].note)
    ? shipments[0].note
    : null

/** Shipments per maker with ties sharing a rank, and the catalogue's robots from each maker. */
const ranked = shipments.map((r) => ({
  ...r,
  rank: 1 + shipments.filter((o) => o.units > r.units).length,
  note: isSourceNote(r.note) || r.note === sharedNote ? null : r.note,
  models: models.filter((m) => sameMaker(m.brand, r.brand)),
}))

/** Tariffs priced per unit (kWh); a fixed monthly charge has no place in the cost of one charge. */
const perUnit = market.electricity.filter((e) => /หน่วย|kWh/i.test(e.unit))
const TARIFFS = perUnit.length > 0 ? perUnit : market.electricity

export interface ChargeCost {
  model: Model
  /** One full charge, baht: the smallest battery at the cheapest rate to the largest at the dearest */
  charge: { min: number; max: number }
  /** The same per hour of work, from the trims whose runtime the maker states; null when none does */
  hour: { min: number; max: number } | null
}

/**
 * What a full charge costs for each robot that states its battery: kWh × the cheapest tariff's low
 * rate for the low end, × the dearest tariff's high rate for the high end, and that over the runtime
 * for an hour of work. Charger losses are left out. Cheapest first.
 */
export function chargeCosts(list: Model[], rates: { min: number; max: number }[]): ChargeCost[] {
  if (rates.length === 0) return []
  const lo = Math.min(...rates.map((r) => r.min))
  const hi = Math.max(...rates.map((r) => r.max))
  return list
    .flatMap((model) => {
      const trims = model.trims.filter((t) => t.batteryWh != null && t.batteryWh > 0)
      if (trims.length === 0) return []
      const kwh = (t: (typeof trims)[number]) => t.batteryWh! / 1000
      const timed = trims.filter((t) => t.runtimeH != null && t.runtimeH > 0)
      return [
        {
          model,
          charge: { min: Math.min(...trims.map((t) => kwh(t) * lo)), max: Math.max(...trims.map((t) => kwh(t) * hi)) },
          hour: timed.length
            ? {
                min: Math.min(...timed.map((t) => (kwh(t) * lo) / t.runtimeH!)),
                max: Math.max(...timed.map((t) => (kwh(t) * hi) / t.runtimeH!)),
              }
            : null,
        },
      ]
    })
    .sort((a, b) => a.charge.min - b.charge.min || a.charge.max - b.charge.max)
}

const CHARGES = chargeCosts(models, TARIFFS)

/** Round gridline steps in baht for the charge chart, finest first; at most eight intervals. */
const CHARGE_STEPS = [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]

function chargeAxis(top: number) {
  for (const step of CHARGE_STEPS) {
    const intervals = Math.max(1, Math.ceil(top / step - 1e-9))
    if (intervals <= 8) return { step, intervals, max: step * intervals }
  }
  const step = CHARGE_STEPS[CHARGE_STEPS.length - 1]
  const intervals = Math.ceil(top / step)
  return { step, intervals, max: step * intervals }
}

// ---------- Checklist ----------

/** Ticks are a per-visitor convenience (e.g. at a demonstration), kept in this browser only, by item title. */
function useChecklist(titles: string[]) {
  const [done, setDone] = useState<Set<string>>(() => {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(CHECK_KEY) ?? '[]')
      return new Set(Array.isArray(raw) ? raw.filter((t): t is string => typeof t === 'string' && titles.includes(t)) : [])
    } catch {
      return new Set()
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(CHECK_KEY, JSON.stringify([...done]))
    } catch {
      // Not persisted; ticks still work for this visit.
    }
  }, [done])
  const toggle = (t: string) =>
    setDone((d) => {
      const next = new Set(d)
      if (!next.delete(t)) next.add(t)
      return next
    })
  return { done, toggle, reset: () => setDone(new Set()), count: done.size }
}

// ---------- Building blocks ----------

function Section({ n, intro, className, children }: { n: number; intro?: ReactNode; className?: string; children: ReactNode }) {
  const s = SECTIONS[n]
  return (
    <section id={s.id} tabIndex={-1} aria-labelledby={`${s.id}-title`} className={className ? `gsec ${className}` : 'gsec'}>
      <div className="gsec__head">
        <h2 id={`${s.id}-title`}>{tie(s.title)}</h2>
        {intro && <p className="gsec__intro">{intro}</p>}
      </div>
      {children}
    </section>
  )
}

interface Total {
  label: string
  note: string | null
  min: number
  max: number
}

/** Item / baht table on a sunk panel: navy head row, hairlines between items, gold total rows. */
function CostTable({
  caption,
  items,
  choice,
  totals,
}: {
  caption: string
  items: CostItem[]
  choice?: { label: string; options: (CostItem & { label: string })[] } | null
  totals?: Total[]
}) {
  const row = (key: string, label: ReactNode, min: number, max: number) => (
    <tr key={key}>
      <th scope="row">{label}</th>
      <td>{bahtSpan(min, max)}</td>
    </tr>
  )
  return (
    <div className="gtable">
      <table className="cost">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">รายการ</th>
            <th scope="col">บาท</th>
          </tr>
        </thead>
        <tbody>{items.map((c) => row(c.item, <WithAside text={c.item} />, c.min, c.max))}</tbody>
        {choice && (
          <tbody className="cost__choice">
            <tr>
              <th scope="rowgroup" colSpan={2}>
                {tie(choice.label)} <span className="g-aside">เลือกตามอัตราที่ใช้ นับรวมเพียงรายการเดียว</span>
              </th>
            </tr>
            {choice.options.map((o) => row(o.item, tie(o.label), o.min, o.max))}
          </tbody>
        )}
        {totals && totals.length > 0 && (
          <tfoot>
            {totals.map((t) => (
              <tr key={t.note ?? t.label}>
                <th scope="row">
                  {t.label}
                  {t.note && (
                    <>
                      {' '}
                      <span className="g-aside">{tie(t.note)}</span>
                    </>
                  )}
                </th>
                <td>{bahtSpan(round100(t.min), round100(t.max))}</td>
              </tr>
            ))}
          </tfoot>
        )}
      </table>
    </div>
  )
}

/** Cost of a full charge per robot on one zero-based axis: the solid bar runs to the low end, the paler part to the high end. */
function ChargeTable({ rows }: { rows: ChargeCost[] }) {
  const axis = chargeAxis(Math.max(...rows.map((r) => r.charge.max)))
  const ticks = Array.from({ length: axis.intervals + 1 }, (_, i) => i * axis.step)
  const pct = (v: number) => `${(v / axis.max) * 100}%`
  const scale = (className: string) => (
    <div className={className} aria-hidden="true">
      {ticks.map((t) => (
        <span key={t} style={{ left: pct(t) }}>
          {formatNumber(t)}
        </span>
      ))}
    </div>
  )
  return (
    <div className="energy" style={{ '--energy-intervals': axis.intervals } as CSSProperties}>
      <div className="energy__legend" aria-hidden="true">
        <span className="energy__key">
          <span className="energy__swatch" />
          ค่าไฟชาร์จเต็มหนึ่งครั้ง
        </span>
        <span className="energy__key energy__key--note">หน่วย: บาท · แถบสีอ่อนคือปลายบนของช่วง</span>
      </div>
      {scale('energy__scale')}
      <table className="energy__table">
        <caption className="visually-hidden">
          ค่าไฟชาร์จเต็มหนึ่งครั้งและค่าไฟต่อชั่วโมงการทำงานของหุ่นยนต์แต่ละรุ่น เรียงจากต่ำไปสูง
        </caption>
        <thead>
          <tr>
            <th scope="col">หุ่นยนต์</th>
            <th scope="col" className="energy__axis-head">
              <span className="visually-hidden">เทียบบนแกนเดียวกัน</span>
              {scale('energy__ticks')}
            </th>
            <th scope="col" className="energy__fig">
              ชาร์จเต็ม (บาท)
            </th>
            <th scope="col" className="energy__hour">
              ต่อชั่วโมงทำงาน (บาท)
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ model: m, charge, hour }) => {
            const specs = [
              formatRange(m.span.batteryWh, 'Wh'),
              m.span.runtimeH && `ใช้งาน ${formatRange(m.span.runtimeH, 'ชม.')}`,
            ].filter(Boolean)
            return (
              <tr key={m.id}>
                <th scope="row" className="energy__name">
                  <Link to={`/models/${m.id}`} lang="en">
                    {m.nameEn}
                  </Link>
                  <span className="g-aside">{tie(specs.join(' · '))}</span>
                </th>
                <td className="energy__plot-cell">
                  <div className="energy__plot" aria-hidden="true">
                    <span className="energy__bar" style={{ width: pct(charge.min) }} />
                    <span
                      className="energy__reach"
                      style={{ left: pct(charge.min), width: pct(charge.max - charge.min) }}
                    />
                  </div>
                </td>
                <td className="energy__fig">{rateSpan(charge.min, charge.max)}</td>
                <td className="energy__hour">
                  {/* Phones hide the head row, so the figure names itself there */}
                  <span className="energy__hour-label" aria-hidden="true">
                    ต่อชั่วโมงทำงาน{' '}
                  </span>
                  {hour ? (
                    <>
                      <span className="nowrap">{rateSpan(hour.min, hour.max)}</span>
                      <span className="energy__hour-label" aria-hidden="true">
                        {' '}
                        บาท
                      </span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">–</span>
                      <span className="visually-hidden">ผู้ผลิตไม่ระบุเวลาใช้งาน</span>
                    </>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Robot links in running text: "Unitree G1, Unitree H2". */
function ModelLinks({ list }: { list: Model[] }) {
  return (
    <>
      {list.map((m, i) => (
        <Fragment key={m.id}>
          {i > 0 && ', '}
          <Link to={`/models/${m.id}`} lang="en" className="nowrap">
            {m.nameEn}
          </Link>
        </Fragment>
      ))}
    </>
  )
}

// ---------- Page ----------

/** How a buyer gets each kind of model, as the "where to buy" intro counts them, in this order. */
const BUY_ROUTE: [Availability, string][] = [
  ['thai-dealer', 'ซื้อผ่านตัวแทนในไทยได้'],
  ['import', 'ต้องสั่งนำเข้า'],
  ['preorder', 'เปิดให้จองล่วงหน้า'],
]

/** Thai readers get the full guide; the English page is a summary of each section (GuidePage.en.tsx). */
export function GuidePage() {
  return useLang() === 'en' ? <GuideEn /> : <GuideTh />
}

function GuideTh() {
  useTitle('คู่มือก่อนซื้อหุ่นยนต์ฮิวแมนนอยด์')
  const main = useRef<HTMLDivElement>(null)
  useReveal(main)
  const location = useLocation()
  const titles = market.buyerChecklist.map((c) => c.title)
  const checklist = useChecklist(titles)
  const checkTotal = titles.length

  const yearly = yearlyCosts(market.ownershipCost.yearly)
  const oneTime = oneTimeTotal(market.ownershipCost.oneTime)
  const setupTotal = oneTimeTotal(market.setup.costs)
  // The headline yearly figure spans every tariff: the cheapest one's low end to the dearest one's
  // high end (the home page quotes the same figure)
  const lowYear = yearly.totals.reduce((a, b) => (b.min < a.min ? b : a))
  const highYear = yearly.totals.reduce((a, b) => (b.max > a.max ? b : a))
  const yearEnvelope = {
    min: lowYear.min,
    max: highYear.max,
    basis:
      lowYear.note && highYear.note && lowYear !== highYear
        ? `ปลายล่างคิดค่าไฟฟ้าด้วย${lowYear.note} ปลายบนคิดด้วย${highYear.note}`
        : lowYear.note
          ? `คิดค่าไฟฟ้าด้วย${lowYear.note}`
          : null,
  }

  // Charging: the cheapest charge in the catalogue, the dearest (rounded up to the baht), the hourly span
  const cheapestCharge = CHARGES.length ? Math.min(...CHARGES.map((c) => c.charge.min)) : null
  const dearestCharge = CHARGES.length ? Math.max(...CHARGES.map((c) => c.charge.max)) : null
  const hours = CHARGES.flatMap((c) => (c.hour ? [c.hour] : []))
  const hourSpan = hours.length
    ? { min: Math.min(...hours.map((h) => h.min)), max: Math.max(...hours.map((h) => h.max)) }
    : null
  const noBattery = models.filter((m) => !CHARGES.some((c) => c.model === m))
  const lowTariff = TARIFFS.reduce<(typeof TARIFFS)[number] | null>((a, b) => (!a || b.min < a.min ? b : a), null)
  const highTariff = TARIFFS.reduce<(typeof TARIFFS)[number] | null>((a, b) => (!a || b.max > a.max ? b : a), null)

  // The rates that convert the catalogue's list prices (all three when none is used)
  const listCurrencies = new Set(models.flatMap((m) => m.trims.flatMap((t) => (t.listPrice ? [t.listPrice.currency] : []))))
  const fxRates = (
    [
      ['USD', market.fx.usd],
      ['CNY', market.fx.cny],
      ['EUR', market.fx.eur],
    ] as [Exclude<Currency, 'THB'>, number][]
  ).filter(([c], _, all) => listCurrencies.has(c) || !all.some(([o]) => listCurrencies.has(o)))

  const routes = BUY_ROUTE.map(([a, label]) => ({ label, n: models.filter((m) => m.availability === a).length })).filter(
    (r) => r.n > 0,
  )

  const jump = useCallback((id: string, smooth = true) => {
    const el = document.getElementById(id)
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: smooth && !reduce ? 'smooth' : 'auto', block: 'start' })
    el.focus({ preventScroll: true })
  }, [])

  // Links from the home page say which section to open (hash URLs are taken by the router). The
  // jump waits a frame for the layout's scroll-to-top, and is repeated once the web fonts have
  // loaded, since the text above re-flows when they swap in.
  useEffect(() => {
    const section = (location.state as { section?: unknown } | null)?.section
    if (!isSection(section)) return
    const frame = requestAnimationFrame(() => jump(section, false))
    let live = true
    document.fonts?.ready.then(() => {
      const el = document.getElementById(section)
      if (live && el && document.activeElement === el) el.scrollIntoView({ block: 'start' })
    })
    return () => {
      live = false
      cancelAnimationFrame(frame)
    }
  }, [location.key, location.state, jump])

  // "You are here" in the index: the last section whose top has passed the band between the site
  // header and the middle of the viewport.
  const [current, setCurrent] = useState<string | null>(null)
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const visible = new Set<string>()
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id)
          else visible.delete(e.target.id)
        }
        const last = SECTIONS.filter((s) => visible.has(s.id)).pop()
        setCurrent(last ? last.id : null)
      },
      { rootMargin: '-96px 0px -50% 0px' },
    )
    for (const { id } of SECTIONS) {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [])

  const periods = [...new Set(shipments.map((r) => r.period))]
  const topUnits = Math.max(1, ...shipments.map((r) => r.units))
  // Where the shipment figures come from: notes that name a source, then the publishers of the
  // market sources about shipments
  const shipmentNotes = [
    ...new Set(
      shipments
        .map((r) => r.note)
        .filter(isSourceNote)
        .map((n) => n!.replace(/^ที่มา\s*[:：]?\s*/, '').trim()),
    ),
  ]
  const shipmentSources = [
    ...new Set(
      market.sources
        .filter((s) => /shipment|ส่งมอบ|ยอดจัดส่ง|ส่วนแบ่งตลาด|market share/i.test(s.title))
        .map((s) => s.title.split(' – ').pop()!.trim()),
    ),
  ]
  const rateUnits = [...new Set(market.electricity.map((e) => e.unit))]

  return (
    <>
      {/* A dark stage: the site header floats over it on desktop (see Layout.css) */}
      <header className="gcover stage on-navy">
        <div className="container">
          <div className="gcover__inner">
            <div>
              <h1>
                คู่มือก่อนซื้อ
                <br />
                <span className="tint">{tie('หุ่นยนต์ฮิวแมนนอยด์')}</span>
              </h1>
            </div>
            <div className="gcover__aside">
              <p className="gcover__lede">
                {tie(
                  'สิ่งที่ควรตรวจก่อนสั่งซื้อ การเตรียมพื้นที่และจุดชาร์จ ช่องทางซื้อในไทย ค่าไฟและค่าใช้จ่ายรายปี ราคาแต่ละรุ่น ตลอดจนมาตรการรัฐและกฎหมายที่เกี่ยวข้อง',
                )}
              </p>
              <p className="gcover__meta">
                ข้อมูล ณ <span className="nowrap">{formatMonthTh(market.asOf)}</span>
              </p>
            </div>
          </div>

          <dl className="gfigures">
            <div>
              <dt>เช็กลิสต์ก่อนซื้อ</dt>
              <dd>
                <CountUp value={checkTotal} /> <span className="gfigures__unit">ข้อ</span>
              </dd>
            </div>
            <div>
              <dt>ผู้จำหน่ายในไทย</dt>
              <dd>
                <CountUp value={market.sellers.length} /> <span className="gfigures__unit">ราย</span>
              </dd>
            </div>
            {cheapestCharge != null && (
              <div>
                <dt>ชาร์จเต็มหนึ่งครั้ง เริ่มต้น</dt>
                <dd>
                  {satang.format(cheapestCharge)} <span className="gfigures__unit">บาท</span>
                </dd>
              </div>
            )}
            <div>
              <dt>รุ่นดังที่ยังไม่วางจำหน่าย</dt>
              <dd>
                <CountUp value={market.notForSale.length} /> <span className="gfigures__unit">รุ่น</span>
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="container glayout">
        {/* In-page index: a card in its own column, pinned under the site header on wide screens.
            Having a column of its own, it can never sit over the text it indexes. */}
        <nav className="gtoc" aria-label="หัวข้อในหน้านี้">
          <p className="gtoc__title">ในหน้านี้</p>
          <ol>
            {SECTIONS.map(({ id, label }) => (
              <li key={id}>
                <button type="button" onClick={() => jump(id)} aria-current={current === id ? 'location' : undefined}>
                  <span className="gtoc__label">{label}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="gmain" ref={main}>
          {/* ---------- 01 Market ---------- */}
          <Section n={0} intro={tie(market.marketContext)} className="gsec--market">
            <div className="gtable rank">
              <table className="rank__table">
                <caption>
                  ยอดส่งมอบหุ่นยนต์ฮิวแมนนอยด์ทั่วโลก แยกตามผู้ผลิต
                  {periods.length === 1 && (
                    <>
                      {' '}
                      <span className="nowrap">{periods[0]}</span>
                    </>
                  )}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="rank__pos">
                      อันดับ
                    </th>
                    <th scope="col">ผู้ผลิต</th>
                    <th scope="col" className="rank__units-head">
                      ยอดส่งมอบ (ตัว)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r) => {
                    const aside = [periods.length > 1 ? r.period : '', r.note ?? ''].join(' ').trim()
                    return (
                      <tr key={r.brand}>
                        <td className="rank__pos">{r.rank}</td>
                        <th scope="row" className="rank__name">
                          <span lang={langOf(r.brand)}>{r.brand}</span>
                          {r.models.length > 0 && (
                            <>
                              {' '}
                              <span className="g-aside rank__models">
                                ในแค็ตตาล็อก: <ModelLinks list={r.models} />
                              </span>
                            </>
                          )}
                          {aside && (
                            <>
                              {' '}
                              <span className="g-aside">{tie(aside)}</span>
                            </>
                          )}
                        </th>
                        <td className="rank__units">
                          <span className="rank__cell">
                            <span className="rank__track" aria-hidden="true">
                              <span style={{ width: `${(r.units / topUnits) * 100}%` }} />
                            </span>
                            <span className="rank__fig">
                              {whole.format(r.units)}
                              {/* Phones hide the head row, so the figure names its unit */}
                              <span className="rank__unit" aria-hidden="true">
                                {' '}
                                ตัว
                              </span>
                            </span>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="gtable__foot">
                ที่มา: {tie(shipmentNotes.length > 0 ? shipmentNotes.join(' ') : 'ยอดส่งมอบที่ผู้ผลิตและบริษัทวิจัยตลาดเผยแพร่')}
                {sharedNote && <> {tie(sharedNote)}</>}
                {shipmentSources.length > 0 && (
                  <>
                    {' '}
                    เรียบเรียงจาก{' '}
                    {/* Thai lists run on with spaces and "และ" before the last (no space before a Thai name);
                        English publisher names get commas, or "PR Newswire Gasgoo" reads as one name */}
                    {shipmentSources.map((s, i) => (
                      <Fragment key={s}>
                        {i > 0 &&
                          (i === shipmentSources.length - 1
                            ? langOf(s)
                              ? ' และ '
                              : ' และ'
                            : langOf(s) && langOf(shipmentSources[i - 1])
                              ? ', '
                              : ' ')}
                        <span className="nowrap" lang={langOf(s)}>
                          {s}
                        </span>
                      </Fragment>
                    ))}
                  </>
                )}{' '}
                · <Link to="/sources">ดูแหล่งข้อมูลทั้งหมด</Link>
              </p>
            </div>
          </Section>

          {/* ---------- 02 Checklist ---------- */}
          <Section
            n={1}
            intro={tie(
              'ตรวจให้ครบก่อนสั่งซื้อและเมื่อรับมอบหุ่นยนต์ ติ๊กเก็บไว้ได้ระหว่างคุยกับผู้จำหน่าย รายการที่ติ๊กจะจำไว้ในเบราว์เซอร์นี้',
            )}
          >
            <div className="check-bar">
              <div className="check-bar__progress">
                <p aria-live="polite">
                  ตรวจแล้ว <strong>{checklist.count}</strong> จาก {checkTotal} ข้อ
                </p>
                <span className="check-bar__meter" aria-hidden="true">
                  <span style={{ width: `${(checklist.count / Math.max(1, checkTotal)) * 100}%` }} />
                </span>
              </div>
              {/* Disables itself once nothing is ticked, so focus moves on to the first item */}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={checklist.count === 0}
                onClick={() => {
                  checklist.reset()
                  focusSoon('.checklist input')
                }}
              >
                <RotateCcw size={14} aria-hidden />
                เริ่มใหม่
              </button>
            </div>
            <ul className="checklist">
              {market.buyerChecklist.map((c, i) => (
                <li key={c.title} data-reveal>
                  <label>
                    <input
                      type="checkbox"
                      checked={checklist.done.has(c.title)}
                      onChange={() => checklist.toggle(c.title)}
                      aria-describedby={`check-${i}-detail`}
                    />
                    <span className="checklist__title">{tie(c.title)}</span>
                  </label>
                  <p id={`check-${i}-detail`}>{tie(c.detail)}</p>
                </li>
              ))}
            </ul>
          </Section>

          {/* ---------- 03 Site preparation ---------- */}
          <Section
            n={2}
            intro={tie(
              'ขั้นตอนเตรียมพื้นที่ทำงาน จุดชาร์จ และระบบความปลอดภัยก่อนรับมอบหุ่นยนต์ พร้อมราคาอ้างอิงของอุปกรณ์ที่มักต้องจัดหาเพิ่ม',
            )}
          >
            <div className="gblock">
              <h3 className="gblock__title">ขั้นตอนการเตรียมพื้นที่</h3>
              <ol className="steps">
                {market.setup.steps.map((s, i) => (
                  <li key={s.title}>
                    <span className="steps__num" aria-hidden="true">
                      {nn(i)}
                    </span>
                    <div>
                      <h4 className="steps__title">{tie(s.title)}</h4>
                      <p>{tie(s.detail)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="gblock">
              <CostTable caption="ราคาอ้างอิง: อุปกรณ์และงานเตรียมพื้นที่" items={market.setup.costs} totals={[setupTotal]} />
              <p className="gnote tone-sky">
                <Info size={18} aria-hidden />
                <span>
                  {tie('ค่าใช้จ่ายครั้งแรกอื่นและค่าบำรุงรักษาแต่ละปี ดูยอดรวมโดยประมาณได้ที่หัวข้อ')}{' '}
                  <button type="button" className="gnote__link" onClick={() => jump('costs')}>
                    ค่าใช้จ่ายรายปี
                  </button>
                </span>
              </p>
            </div>
          </Section>

          {/* ---------- 04 Where to buy ---------- */}
          <Section
            n={3}
            intro={
              <>
                {routes.length > 0 && tie(`ในแค็ตตาล็อกนี้ ${thaiList(routes.map((r) => `${r.label} ${r.n} รุ่น`))} `)}
                {tie('ด้านล่างคือบริษัทในไทยที่จำหน่ายหรือสาธิตหุ่นยนต์ฮิวแมนนอยด์ และวิธีคิดราคาของรุ่นที่ต้องสั่งนำเข้า')}
              </>
            }
          >
            <div className="gblock">
              <h3 className="gblock__title">ผู้จำหน่ายและตัวแทนในไทย</h3>
              <ul className="sellers">
                {market.sellers.map((s) => {
                  const [name, aside] = splitAside(s.name)
                  return (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noreferrer">
                        <span className="sellers__name" lang={langOf(name)}>
                          {name}
                        </span>
                        {aside && (
                          <>
                            {' '}
                            <span className="g-aside" lang={langOf(aside)}>
                              {aside}
                            </span>
                          </>
                        )}
                        <span className="visually-hidden"> (เปิดในแท็บใหม่)</span>
                      </a>
                      <p>{tie(s.detail)}</p>
                      <span className="sellers__arrow" aria-hidden="true">
                        <ArrowUpRight size={18} />
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="gblock">
              <div className="fx tone-sky">
                <h3 className="fx__title">อัตราแลกเปลี่ยนที่ใช้แปลงราคา</h3>
                <dl className="fx__rates">
                  {fxRates.map(([c, rate]) => (
                    <div key={c}>
                      <dt>
                        <span lang="en">1 {c}</span> <span className="fx__currency">{CURRENCY_LABEL[c]}</span>
                      </dt>
                      <dd>
                        {rate.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}{' '}
                        <span className="fx__unit">บาท</span>
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="fx__text">
                  {tie(
                    `รุ่นที่ไม่มีตัวแทนจำหน่ายในไทยแสดงราคาผู้ผลิตที่แปลงเป็นเงินบาทด้วยอัตรานี้ ณ ${dayTh(market.fx.date)} จึงเป็นราคาโดยประมาณ และยังไม่รวมค่าขนส่ง อากรขาเข้า และภาษีมูลค่าเพิ่ม ราคาที่ชำระจริงขึ้นกับอัตราแลกเปลี่ยนในวันชำระเงินและเงื่อนไขของผู้นำเข้า`,
                  )}
                  {market.fx.note && <> {tie(market.fx.note)}</>}
                </p>
                <p className="fx__source">
                  ที่มาของอัตรา:{' '}
                  <a href={market.fx.source.url} target="_blank" rel="noreferrer" lang={langOf(market.fx.source.title)}>
                    {market.fx.source.title}
                    <span className="visually-hidden" lang="th">
                      {' '}
                      (เปิดในแท็บใหม่)
                    </span>
                  </a>
                </p>
              </div>
            </div>

            {market.notForSale.length > 0 && (
              <div className="gblock">
                <h3 className="gblock__title">รุ่นที่มีชื่อเสียงแต่ยังไม่วางจำหน่าย</h3>
                <ul className="unlisted">
                  {market.notForSale.map((u) => (
                    <li key={u.name}>
                      <p className="unlisted__name">
                        <span lang={langOf(u.name)}>{u.name}</span>
                        {!norm(u.name).includes(norm(u.brand)) && (
                          <>
                            {' '}
                            <span className="g-aside" lang={langOf(u.brand)}>
                              {u.brand}
                            </span>
                          </>
                        )}
                      </p>
                      <p className="unlisted__status">{tie(u.status)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>

          {/* ---------- 05 Energy cost per charge ---------- */}
          <Section
            n={4}
            intro={tie(
              `ค่าไฟฟ้าที่ใช้ชาร์จหุ่นยนต์แต่ละรุ่นจนเต็ม คำนวณจากความจุแบตเตอรี่ที่ผู้ผลิตระบุและอัตราค่าไฟฟ้า ณ ${formatMonthTh(market.asOf)}`,
            )}
          >
            <div className="gblock">
              <div className="gtable">
                <table className="rates">
                  {/* The unit is in the caption too, since phones hide the head row */}
                  <caption>
                    อัตราค่าไฟฟ้า
                    {rateUnits.length === 1 && (
                      <>
                        {' '}
                        <span className="nowrap">({rateUnits[0]})</span>
                      </>
                    )}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">ประเภท</th>
                      <th scope="col" className="rates__fig">
                        {rateUnits.length === 1 ? rateUnits[0] : 'อัตรา'}
                      </th>
                      <th scope="col">รายละเอียด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {market.electricity.map((e) => (
                      <tr key={e.label}>
                        <th scope="row">
                          <span className="rates__label">
                            <WithAside text={e.label} />
                          </span>
                        </th>
                        <td className="rates__fig">
                          {rateSpan(e.min, e.max)}
                          {rateUnits.length > 1 && <span className="g-aside">{e.unit}</span>}
                        </td>
                        <td className={e.note ? 'rates__note' : 'rates__note is-empty'}>{e.note ? tie(e.note) : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {CHARGES.length > 0 && dearestCharge != null && (
              <div className="gblock">
                <h3 className="gblock__title">ค่าไฟชาร์จเต็มหนึ่งครั้งของแต่ละรุ่น</h3>
                <ChargeTable rows={CHARGES} />
                <div className="callout tone-sage">
                  <span className="callout__icon" aria-hidden="true">
                    <BatteryCharging size={24} />
                  </span>
                  <p className="callout__figure">
                    <span className="callout__lead">ไม่เกิน</span>{' '}
                    <span className="callout__num">{whole.format(Math.ceil(dearestCharge))}</span> บาท
                  </p>
                  <p className="callout__text">
                    {tie(
                      `ชาร์จเต็มหนึ่งครั้งไม่เกิน ${whole.format(Math.ceil(dearestCharge))} บาท สำหรับทุกรุ่นในแค็ตตาล็อกที่ผู้ผลิตระบุความจุแบตเตอรี่ แม้คิดด้วยอัตราค่าไฟฟ้าสูงสุดในตาราง`,
                    )}
                    {hourSpan && <> {tie(`หรือราว ${rateSpan(hourSpan.min, hourSpan.max)} บาทต่อชั่วโมงทำงาน`)}</>}
                  </p>
                </div>
              </div>
            )}

            <div className="gblock">
              <h3 className="gblock__title gblock__title--sm">ที่มาของตัวเลข</h3>
              <dl className="basis">
                <div>
                  <dt>ชาร์จเต็มหนึ่งครั้ง</dt>
                  <dd>
                    {tie('ความจุแบตเตอรี่ (Wh) ÷ 1,000 × อัตราค่าไฟฟ้าต่อหน่วย')}
                    {lowTariff && highTariff && (
                      <>
                        {' '}
                        {tie(
                          `ปลายล่างคิดด้วยอัตราต่ำสุดของ${splitAside(lowTariff.label)[0]} ${satang.format(lowTariff.min)} ${lowTariff.unit} ปลายบนคิดด้วยอัตราสูงสุดของ${splitAside(highTariff.label)[0]} ${satang.format(highTariff.max)} ${highTariff.unit}`,
                        )}
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>ต่อชั่วโมงทำงาน</dt>
                  <dd>
                    {tie(
                      'ค่าไฟชาร์จเต็มหนึ่งครั้ง ÷ เวลาใช้งานต่อการชาร์จที่ผู้ผลิตระบุ รุ่นที่ไม่ระบุเวลาใช้งานจึงไม่มีตัวเลขนี้ เวลาใช้งานจริงขึ้นกับงานที่ทำ',
                    )}
                  </dd>
                </div>
                <div>
                  <dt>สิ่งที่ไม่ได้นับ</dt>
                  <dd>
                    {tie(
                      'พลังงานที่สูญเสียในเครื่องชาร์จและระหว่างการชาร์จ ค่าไฟที่จ่ายจริงจึงสูงกว่าตัวเลขนี้เล็กน้อย',
                    )}
                  </dd>
                </div>
                {noBattery.length > 0 && (
                  <div>
                    <dt>ไม่ระบุความจุแบตเตอรี่</dt>
                    <dd>
                      <ModelLinks list={noBattery} />
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </Section>

          {/* ---------- 06 Ownership costs ---------- */}
          <Section
            n={5}
            intro={
              <>
                ปีละประมาณ{' '}
                <strong className="nowrap">{bahtSpan(round100(yearEnvelope.min), round100(yearEnvelope.max))} บาท</strong>{' '}
                {tie('ไม่รวมราคาหุ่นยนต์')}
                {yearEnvelope.basis && <> {tie(yearEnvelope.basis)}</>}{' '}
                {tie('ตัวเลขจริงขึ้นกับรุ่น ความถี่ในการใช้งาน และเงื่อนไขบริการของผู้จำหน่าย')}
              </>
            }
          >
            <div className="cost-grid">
              <CostTable caption="ค่าใช้จ่ายรายปี" items={yearly.fixed} choice={yearly.choice} totals={yearly.totals} />
              <CostTable caption="ค่าใช้จ่ายครั้งแรก" items={market.ownershipCost.oneTime} totals={[oneTime]} />
            </div>
            <p className="cost-foot">
              {tie(
                [
                  'ยอดรวมปัดเป็นหลักร้อยบาท',
                  yearly.choice && 'ค่าไฟฟ้านับรวมครั้งละหนึ่งอัตรา เพราะผู้ใช้แต่ละรายใช้อัตราใดอัตราหนึ่งเท่านั้น',
                ]
                  .filter(Boolean)
                  .join(' '),
              )}
            </p>
          </Section>

          {/* ---------- 07 Prices ---------- */}
          <Section
            n={6}
            intro={tie(
              `ราคาของทุกรุ่นย่อย รุ่นที่มีตัวแทนในไทยใช้ราคาที่ตัวแทนประกาศ รุ่นอื่นแปลงจากราคาผู้ผลิตด้วยอัตราแลกเปลี่ยน ณ ${dayTh(market.fx.date)} จึงเป็นราคาโดยประมาณ รุ่นที่มีหลายรุ่นย่อยแสดงเป็นช่วงราคา`,
            )}
          >
            <PriceRangeChart models={models} fx={market.fx} />
            <div className="gblock">
              <h3 className="gblock__title">ปัจจัยที่ทำให้ราคาต่างกัน</h3>
              <ol className="factors">
                {market.priceFactors.map((f) => {
                  const [lead, body] = splitLead(f)
                  return (
                    <li key={f} data-reveal>
                      <p>
                        {lead && <strong>{tie(lead)} </strong>}
                        {tie(body)}
                      </p>
                    </li>
                  )
                })}
              </ol>
            </div>
          </Section>

          {/* ---------- 08 Incentives and law ---------- */}
          <Section
            n={7}
            intro={tie(`สิทธิประโยชน์จากภาครัฐและข้อกำหนดที่ผู้ซื้อหุ่นยนต์ควรทราบ ณ ${formatMonthTh(market.asOf)}`)}
          >
            <div className="law-grid">
              <div className="notes tone-sage">
                <h3 className="notes__title">มาตรการและสิทธิประโยชน์</h3>
                <ol>
                  {market.incentives.map((n) => (
                    <li key={n}>
                      <p>{tie(n)}</p>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="notes tone-sand">
                <h3 className="notes__title">ข้อกฎหมายที่ควรรู้</h3>
                <ol>
                  {market.legalNotes.map((n) => (
                    <li key={n}>
                      <p>{tie(n)}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* Back cover: the next step, running straight into the footer */}
      <section className="gend end-band on-navy" aria-labelledby="gend-title">
        <div className="container gend__inner">
          <div>
            <h2 id="gend-title">พร้อมเลือกรุ่นที่ใช่แล้ว</h2>
            <p className="gend__lede">
              {tie('ดูสเปกและราคาครบทุกรุ่นย่อย หรือเลือกได้สูงสุด 3 รุ่นเพื่อเปรียบเทียบกัน')}
            </p>
          </div>
          <div className="gend__actions">
            <Link to="/" className="btn btn-primary">
              ดูหุ่นยนต์ทั้งหมด
              <ArrowRight size={18} aria-hidden className="btn__arrow" />
            </Link>
            <Link to="/compare" className="btn btn-ghost">
              เปรียบเทียบรุ่น
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
