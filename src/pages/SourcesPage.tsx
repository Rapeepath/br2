import { Fragment, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Minus, Plus } from 'lucide-react'
import { CountUp } from '../components/CountUp'
import { market, models } from '../data'
import { langOf, useTitle } from '../lib/a11y'
import { CURRENCY_LABEL, formatMonthTh, formatNumber } from '../lib/format'
import type { Model, Source } from '../lib/types'
import { useReveal } from '../lib/motion'
import { photoStyle } from '../lib/photo'
import { Picture } from '../components/Picture'
import { useLang } from '../i18n'
import { licenceUrl } from './SourcesPage.credits'
import { SourcesEn } from './SourcesPage.en'
import './SourcesPage.css'

// ---------- Helpers (exported for the unit tests) ----------

/** "01", "02"… for numbered rows; decorative, the list itself carries the number for assistive tech. */
const nn = (n: number) => String(n).padStart(2, '0')

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Runs kept on one line inside data text (titles, notes, price terms): dates and month spans
 * ("24 ตุลาคม 2569", "มกราคม–มิถุนายน 2569", "ปี 2568"), figures with their unit, rank labels, and
 * compounds the browser's Thai breaker splits into halves that read wrongly alone ("หุ่น / ยนต์",
 * "อากรขา / เข้า", "ความรับ / ผิด"). Every run is short enough for the narrowest reference column on a
 * 320px phone.
 */
const MONTH = String.raw`(?:มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|[ก-๙]{1,3}\.[ก-๙]{1,3}\.)`
// Units a figure keeps beside it ("5,500 ตัว", "16,000 ดอลลาร์สหรัฐ"); longer words first ("รายการ" before "ราย")
const UNIT = String.raw`(?:ตัว|บาท|รุ่น|รายการ|ราย|ดอลลาร์สหรัฐ|ดอลลาร์|หยวน|ยูโร|ชั่วโมง|นาที|เดือน|ปี|วัน|กก\.|ซม\.|USD|CNY|EUR)`
// Robot and maker names never split ("Unitree / G1"); longest first so "Unitree G1" wins over "Unitree"
const NAMES = [...new Set([...models.map((m) => m.nameEn), ...market.shipments.map((r) => r.brand)])]
  .sort((a, b) => b.length - a.length)
  .map((n) => escape(n).replace(/ /g, String.raw`\s`))
const KEEP = new RegExp(
  '(' +
    [
      ...NAMES,
      // A short aside in brackets reads as one unit: "(ราคาผู้ผลิต)", "(ปี 2568)", "(ต.ค. 2569)"
      String.raw`\([^()]{1,16}\)`,
      String.raw`(?:\d{1,2}(?:–\d{1,2})?\s)?${MONTH}(?:–${MONTH})?(?:\s\d{2,4})?`,
      String.raw`ปี\s?\d{4}`,
      String.raw`\d[\d,.]*%?\s${UNIT}`,
      String.raw`\d[\d,.]*\s?–\s?\d[\d,.]*(?:\s${UNIT})?`,
      String.raw`อันดับ\s?\d+(?:\s?ร่วม)?`,
      'ผู้(?:ซื้อ|ใช้|ผลิต|จำหน่าย|จัดจำหน่าย|นำเข้า)',
      'ค่า(?:ขนส่ง|ไฟฟ้า|ไฟ|บริการ|ธรรมเนียม|ใช้จ่าย|ติดตั้ง)',
      'ความ(?:ปลอดภัย|รับผิด|เสี่ยง)',
      'การไฟฟ้า(?:นครหลวง|ส่วนภูมิภาค)?',
      'อย่างเป็นทางการ',
      'หุ่นยนต์',
      'ฮิวแมนนอยด์',
      'แค็ตตาล็อก',
      'ตัวแทนจำหน่าย',
      'จัดจำหน่าย',
      'ภาษีมูลค่าเพิ่ม',
      'ภาษีเงินได้',
      'อากรขาเข้า',
      'นำเข้า',
      'กรมศุลกากร',
      'พิกัดอัตรา',
      'เขตการค้าเสรี',
      'อัตราแลกเปลี่ยน',
      'ธนาคารแห่งประเทศไทย',
      'ดอลลาร์สหรัฐ',
      'สกุลเงิน',
      'ต่างประเทศ',
      'ประเทศไทย',
      'ส่งมอบ',
      'จัดส่ง',
      'ส่วนแบ่ง',
      'ทั่วโลก',
      'คาดการณ์',
      'ประมาณการ',
      'ข้อมูลจำเพาะ',
      'องศาอิสระ',
      'หยิบจับ',
      'น้ำหนัก',
      'ข้อต่อ',
      'ฐานล้อ',
      'สองขา',
      'ปัญญาประดิษฐ์',
      'แบตเตอรี่',
      'รับประกัน',
      'บำรุงรักษา',
      'สั่งจอง',
      'ล่วงหน้า',
      'รายเดือน',
      'สมัครสมาชิก',
      'เงื่อนไข',
      'ตรวจสอบ',
      'เรียบเรียง',
      'ข้อมูลส่วนบุคคล',
      'พระราชบัญญัติ',
      'ราชกิจจานุเบกษา',
      'ใบอนุญาต',
      'คลื่นความถี่',
      'วิทยุคมนาคม',
      'คณะกรรมการ',
      'ส่งเสริมการลงทุน',
      'สิทธิประโยชน์',
      'ลดหย่อน',
      'อุตสาหกรรม',
    ].join('|') +
    ')',
)

export function keep(text: string): ReactNode {
  const parts = text.split(KEEP)
  if (parts.length === 1) return text
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <span key={i} className="nowrap">
        {p}
      </span>
    ) : (
      p
    ),
  )
}

/**
 * Every source title ends in " – Publisher". The appendix sets the publisher on its own quieter line,
 * so a reader can scan down the publishers (makers, official bodies, media) without reading every title.
 */
export function splitSource(title: string): { title: string; publisher: string | null } {
  const at = title.lastIndexOf(' – ')
  if (at <= 0) return { title, publisher: null }
  return { title: title.slice(0, at).trim(), publisher: title.slice(at + 3).trim() || null }
}

export { licenceUrl } from './SourcesPage.credits'

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/**
 * Whether a shipment row names a maker: brands compare without case or punctuation, and either may carry
 * a suffix ("Booster" for "Booster Robotics"), the same test build-data uses to set makerRank.
 */
export function sameMaker(label: string, brand: string): boolean {
  const a = norm(label)
  const b = norm(brand)
  return a !== '' && b !== '' && (a === b || a.startsWith(b) || b.startsWith(a))
}

/** The shipment row a robot's maker sits on (the first row that names it, as in build-data), or -1. */
const rowOf = (m: Model) => market.shipments.findIndex((r) => sameMaker(r.brand, m.brand))

/**
 * A row note worth printing. One that only restates the position ("อันดับ 3") adds nothing beside the
 * rank column, and one that names the source ("ที่มา: …") is cited once, under the table.
 */
function rowNote(note: string | null): string | null {
  const rest = note?.replace(/^อันดับ\s*\d+\s*/, '').trim()
  return rest && !/^ที่มา/.test(rest) ? rest : null
}

/**
 * Shipment positions with ties sharing a rank: two makers on equal shipments are both 4th, and 5th is
 * skipped. Each row carries the catalogue's robots from that maker.
 */
export const ranked = market.shipments.map((r, i) => ({
  brand: r.brand,
  units: r.units,
  period: r.period,
  rank: 1 + market.shipments.filter((o) => o.units > r.units).length,
  tied: market.shipments.some((o) => o !== r && o.units === r.units),
  note: rowNote(r.note),
  models: models.filter((m) => rowOf(m) === i),
}))

/** Titles and links about shipments or market share */
const SHIPMENTS = /shipment|ส่งมอบ|ยอดจัดส่ง|market share|ส่วนแบ่ง/i

/**
 * The analyst source behind the shipment table. The first row's note names it ("ที่มา: Omdia"), so a
 * source whose publisher appears in that note wins, preferring one about shipments; failing that, a
 * shipments source whose title carries a name from the note (a newspaper reporting Omdia's figures),
 * then any shipments source. Makers are never the analyst: a note that names one ("AgiBot มีส่วนแบ่ง…")
 * must not pick that maker's own press page. Null when nothing fits, and the foot quotes the note itself.
 */
export function shipmentSource(
  note: string | null,
  sources: Source[],
  makers: string[] = market.shipments.map((r) => r.brand),
): Source | null {
  const text = (note ?? '').toLowerCase()
  const maker = (w: string) => makers.some((m) => w.toLowerCase().includes(m.toLowerCase()))
  const words = ((note ?? '').match(/[A-Za-z][\w&.-]{2,}/g) ?? []).filter((w) => !maker(w))
  const about = sources.filter((s) => SHIPMENTS.test(`${s.title} ${s.url}`))
  const named = (s: Source) => {
    const pub = splitSource(s.title).publisher?.toLowerCase()
    return !!pub && !maker(pub) && text.includes(pub)
  }
  const mentions = (s: Source) => words.some((w) => s.title.toLowerCase().includes(w.toLowerCase()))
  return about.find(named) ?? sources.find(named) ?? about.find(mentions) ?? about[0] ?? null
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/** Alternatives from data (seller sites, robot names) as one case-blind pattern; never matches when empty. */
const anyOf = (words: (string | null)[]) => {
  const list = [...new Set(words.filter((w): w is string => !!w && w.length >= 3))].map(escape)
  return new RegExp(list.length ? list.join('|') : '(?!)', 'i')
}

/** Famous robots not on sale, by full name and by the model name alone ("Optimus" for "Tesla Optimus") */
const upcoming = anyOf(
  market.notForSale.flatMap((r) => [
    r.name,
    r.name.toLowerCase().startsWith(`${r.brand.toLowerCase()} `) ? r.name.slice(r.brand.length + 1) : null,
  ]),
)

/**
 * Market and guide sources grouped by topic, so a long list reads as a short index. Rules are tried in
 * order and the first match wins, which settles the overlaps: an analyst's shipment report is market data
 * even when it quotes prices, an electricity tariff "รวมภาษีมูลค่าเพิ่ม" is electricity, a BOI tax break is
 * an incentive rather than import tax, and a page about a robot not yet on sale sits with those robots
 * even when it names a price. Thai sellers are also known by their own websites. Anything no rule
 * recognises lands in "อื่น ๆ" rather than disappearing.
 */
const RULES: { id: string; test: RegExp }[] = [
  {
    id: 'market',
    test: /shipment|ส่งมอบ|ยอดจัดส่ง|ยอดขาย|\bidc\b|omdia|trendforce|counterpoint|\bggii\b|market (?:size|share|report|forecast)|ขนาดตลาด|มูลค่าตลาด|ส่วนแบ่ง|ตลาดหุ่นยนต์|ifr\.org|world robotics|goldman sachs|morgan stanley/i,
  },
  { id: 'power', test: /ค่าไฟ|การไฟฟ้า|ค่า\s?ft\b|\bmea\b|\bpea\b|electricity/i },
  {
    id: 'incentive',
    test: /\bboi\b|บีโอไอ|ส่งเสริมการลงทุน|สิทธิประโยชน์|ลดหย่อน|หักรายจ่าย|หักค่าใช้จ่าย|deduction|incentive|มาตรการส่งเสริม|เงินอุดหนุน|\bdepa\b|ดีป้า|subsid/i,
  },
  {
    id: 'tax',
    test: /ศุลกากร|customs|อากร|พิกัด|\bhs\s?code|เขตการค้าเสรี|\bfta\b|acfta|\btariffs?\b|(?<!ผู้)นำเข้า|\bimport(?:s|ed|ing|ation)?\b|ภาษี|\bvat\b|สรรพากร|rd\.go\.th/i,
  },
  {
    id: 'law',
    test: /กสทช|\bnbtc\b|pdpa|ข้อมูลส่วนบุคคล|สมอ\.|\btisi\b|มอก\.|ความรับผิด|liability|ความปลอดภัย|\bsafety\b|\biso\s?\d|มาตรฐาน|พ\.ร\.บ|พระราชบัญญัติ|กฎหมาย|ราชกิจจา|ratchakitcha|ใบอนุญาต|คลื่นความถี่|วิทยุคมนาคม|ce marking/i,
  },
  { id: 'upcoming', test: upcoming },
  {
    id: 'price',
    test: /อัตราแลกเปลี่ยน|exchange rate|bot\.or\.th|ธนาคารแห่งประเทศไทย|ธปท|ราคา|\bprices?\b|pricing/i,
  },
  {
    id: 'seller',
    test: new RegExp(
      [
        /ตัวแทนจำหน่าย|ผู้จำหน่าย|จัดจำหน่าย|distributor|dealer|reseller|โชว์รูม|showroom/.source,
        anyOf(market.sellers.map((s) => hostOf(s.url))).source,
      ].join('|'),
      'i',
    ),
  },
  {
    id: 'upkeep',
    test: /บำรุงรักษา|ซ่อม|อะไหล่|ประกันภัย|insurance|maintenance|repair|spare part|เช่า|rental|leasing|สินเชื่อ|ค่าใช้จ่าย/i,
  },
]

/** Display order: the market first, then what a buyer meets on the way to owning one, as the guide runs */
const GROUP_TITLES: [string, string][] = [
  ['market', 'ตลาดและยอดส่งมอบ'],
  ['price', 'อัตราแลกเปลี่ยนและราคา'],
  ['seller', 'ผู้จำหน่ายในไทย'],
  ['tax', 'ภาษีและการนำเข้า'],
  ['law', 'กฎหมายและมาตรฐาน'],
  ['incentive', 'มาตรการส่งเสริม'],
  ['power', 'ค่าไฟฟ้า'],
  ['upkeep', 'การดูแลรักษาและค่าใช้จ่าย'],
  ['upcoming', 'หุ่นยนต์ที่ยังไม่เปิดขาย'],
  ['other', 'อื่น ๆ'],
]

export function groupSources(sources: Source[]) {
  const buckets = new Map<string, Source[]>()
  for (const s of sources) {
    const id = RULES.find((r) => r.test.test(`${s.title} ${s.url}`))?.id ?? 'other'
    buckets.set(id, [...(buckets.get(id) ?? []), s])
  }
  // Numbers run on across the groups (01–24), so each source keeps one number on the page
  let n = 0
  return GROUP_TITLES.filter(([id]) => buckets.has(id)).map(([id, title]) => ({
    id,
    title,
    items: buckets.get(id)!.map((s) => ({ ...s, n: ++n })),
  }))
}

// ---------- Figures ----------

const periods = [...new Set(market.shipments.map((r) => r.period))]
const period = periods.length === 1 ? periods[0] : null
const makersIn = ranked.filter((r) => r.models.length > 0)
const makersOut = ranked.filter((r) => r.models.length === 0)
const tiedRanks = [...new Set(makersIn.filter((r) => r.tied).map((r) => r.rank))]
/** Catalogue robots whose maker isn't in the shipment table; build-data sorts them to the end */
const unranked = models.filter((m) => rowOf(m) < 0)
const modelRefs = models.reduce((n, m) => n + m.sources.length, 0)
const groups = groupSources(market.sources)
const asOf = formatMonthTh(market.asOf)
const analyst = shipmentSource(market.shipments[0]?.note ?? null, market.sources)
const analystPub = analyst ? splitSource(analyst.title).publisher : null

/** "2026-10-24" → "24 ตุลาคม 2569" */
function formatDayTh(iso: string): string {
  const m = /^(\d{4}-\d{2})-(\d{2})$/.exec(iso)
  return m ? `${Number(m[2])} ${formatMonthTh(m[1])}` : formatMonthTh(iso)
}

const legs = models.filter((m) => m.locomotion === 'legs').length
const wheels = models.filter((m) => m.locomotion === 'wheels').length

/** Each robot's price basis over its priced trims: a Thai dealer's own price, a conversion, or both. */
const bases = models.map((m) => new Set(m.trims.flatMap((t) => (t.priceBasis ? [t.priceBasis] : []))))
const dealerOnly = bases.filter((b) => b.size === 1 && b.has('dealer')).length
const convertedOnly = bases.filter((b) => b.size === 1 && b.has('converted')).length
const mixedBasis = bases.filter((b) => b.size === 2).length
const anyConverted = convertedOnly + mixedBasis > 0

/** Only the rates a converted price actually used, in a fixed order */
const FX = [
  ['USD', market.fx.usd],
  ['CNY', market.fx.cny],
  ['EUR', market.fx.eur],
] as const
const ratesUsed = FX.filter(([c]) =>
  models.some((m) => m.trims.some((t) => t.priceBasis === 'converted' && t.listPrice?.currency === c)),
)
const fxPub = splitSource(market.fx.source.title).publisher ?? splitSource(market.fx.source.title).title

/** The spec most often left unpublished, so the method can point at a real case */
const SPEC_LABEL = {
  runtimeH: 'เวลาทำงานต่อการชาร์จ',
  payloadKg: 'น้ำหนักบรรทุก',
  speedMs: 'ความเร็วสูงสุด',
  batteryWh: 'ความจุแบตเตอรี่',
  dof: 'จำนวนองศาอิสระ',
} as const
const mostMissing = (Object.keys(SPEC_LABEL) as (keyof typeof SPEC_LABEL)[])
  .map((k) => ({ label: SPEC_LABEL[k], n: models.filter((m) => m.span[k] == null).length }))
  .sort((a, b) => b.n - a.n)[0]

// ---------- Pieces ----------

/** A link that leaves the site: always a new tab, and screen readers are told so. */
function OutLink({ href, lang, className, children }: { href: string; lang?: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      <span lang={lang}>{children}</span>
      <span className="visually-hidden"> (เปิดในแท็บใหม่)</span>
    </a>
  )
}

/** One numbered reference: the title is the link, its publisher sits on a quieter line below. */
function SourceItem({ source, n }: { source: Source; n: number }) {
  const { title, publisher } = splitSource(source.title)
  return (
    <li>
      <span className="sref__num" aria-hidden="true">
        {nn(n)}
      </span>
      <span className="sref__body">
        <OutLink href={source.url} lang={langOf(title)} className="sref__link">
          {keep(title)}
        </OutLink>
        {publisher && (
          <span className="sref__pub" lang={langOf(publisher)}>
            {publisher}
          </span>
        )}
      </span>
    </li>
  )
}

/** Robot photos are mostly portrait; the plates crop from the top so the head and torso stay in frame. */
function Photo({ model, className }: { model: Model; className: string }) {
  return (
    <span className={className}>
      <Picture src={model.image.srcSmall} alt="" sizes="120px" style={photoStyle(model.image)} />
    </span>
  )
}

/**
 * A robot's model name under its maker's row ("G1" under "Unitree"), with the brand kept for screen
 * readers so the link still names the whole robot.
 */
function ModelName({ model }: { model: Model }) {
  const prefix = `${model.brand} `
  if (!model.nameEn.toLowerCase().startsWith(prefix.toLowerCase())) return <>{model.nameEn}</>
  // The space sits outside the hidden brand, so the name reads "Unitree G1" and the visible "G1" starts flush
  return (
    <>
      <span className="visually-hidden">{model.nameEn.slice(0, prefix.length - 1)}</span>{' '}
      {model.nameEn.slice(prefix.length)}
    </>
  )
}

/** "ในปี 2568" for a year, "ช่วง ม.ค.–มิ.ย. 2569" for a span; the period itself never splits. */
function During({ period }: { period: string }) {
  return /^ปี/.test(period) ? (
    <>
      ใน<span className="nowrap">{period}</span>
    </>
  ) : (
    <>
      ช่วง <span className="nowrap">{period}</span>
    </>
  )
}

/** "เดินสองขา 10 รุ่น และฐานล้อ 2 รุ่น", naming only the kinds the catalogue has. */
function locomotionCounts(): ReactNode {
  const parts = [
    { label: 'เดินสองขา', n: legs },
    { label: 'ฐานล้อ', n: wheels },
  ].filter((p) => p.n > 0)
  return parts.map((p, i) => (
    <Fragment key={p.label}>
      {i > 0 && ' และ'}
      <span className="nowrap">
        {p.label} {p.n} รุ่น
      </span>
    </Fragment>
  ))
}

/** The methodology, each point stated only as far as the data bears it out. */
function methods(): { title: string; body: ReactNode }[] {
  return [
    {
      title: 'การคัดเลือกรุ่น',
      body: (
        <>
          <span className="nowrap">หุ่นยนต์</span><span className="nowrap">ฮิวแมนนอยด์</span>ทั้งแบบ
          <span className="nowrap">เดินสองขา</span>และแบบ<span className="nowrap">ลำตัวคน</span>บน<span className="nowrap">ฐานล้อ</span>{' '}
          ที่<span className="nowrap">ผู้ซื้อ</span>ในไทยสั่งซื้อหรือ<span className="nowrap">สั่งจอง</span>ได้{' '}
          <span className="nowrap">ณ {asOf}</span> และมีราคาประกาศ คัดจาก<span className="nowrap">ผู้ผลิต</span>ตามอันดับ
          <span className="nowrap">ยอดส่งมอบ</span>
          <span className="nowrap">ทั่วโลก</span>
          {unranked.length > 0 && 'เป็นหลัก'} รวม <span className="nowrap">{models.length} รุ่น</span> ({locomotionCounts()}){' '}
          <span className="nowrap">หุ่นยนต์</span>ที่มีชื่อเสียงแต่ยังไม่เปิดขาย ไม่นำมารวม
          {market.notForSale.length > 0 && (
            <>
              {' '}
              ดูรายชื่อ <span className="nowrap">{market.notForSale.length} รุ่น</span>ได้ใน<Link to="/guide">คู่มือก่อนซื้อ</Link>
            </>
          )}
        </>
      ),
    },
    {
      title: 'ราคา',
      body: (
        <>
          {dealerOnly > 0 && (
            <>
              ราคาที่<span className="nowrap">ตัวแทนจำหน่าย</span>ในไทยประกาศ ใช้กับรุ่นที่ตัวแทนประกาศราคา <span className="nowrap">({dealerOnly} รุ่น)</span>{' '}
            </>
          )}
          {convertedOnly > 0 && (
            <>
              {dealerOnly > 0 && 'ส่วน'}รุ่นที่ไม่มีราคา<span className="nowrap">ในไทย</span> ใช้ราคาของ<span className="nowrap">ผู้ผลิต</span>แปลงเป็นบาท{' '}
              <span className="nowrap">({convertedOnly} รุ่น)</span>{' '}
            </>
          )}
          {mixedBasis > 0 && (
            <>
              อีก <span className="nowrap">{mixedBasis} รุ่น</span>มีราคาทั้งสองแบบตาม<span className="nowrap">รุ่นย่อย</span>{' '}
            </>
          )}
          {anyConverted && (
            <>
              อัตราที่ใช้คือ{' '}
              {ratesUsed.map(([c, rate], i) => (
                <Fragment key={c}>
                  {i > 0 && (i === ratesUsed.length - 1 ? ' และ ' : ', ')}
                  <span className="nowrap">
                    1 {CURRENCY_LABEL[c]} = {formatNumber(rate)} บาท
                  </span>
                </Fragment>
              ))}{' '}
              <span className="nowrap">ณ {formatDayTh(market.fx.date)}</span> จาก{langOf(fxPub) && ' '}
              <OutLink href={market.fx.source.url} lang={langOf(fxPub)}>
                {keep(fxPub)}
              </OutLink>{' '}
              ราคาที่แปลงยังไม่รวม<span className="nowrap">ค่าขนส่ง</span> <span className="nowrap">อากรขาเข้า</span>{' '}
              และ<span className="nowrap">ภาษีมูลค่าเพิ่ม</span>
            </>
          )}
        </>
      ),
    },
    {
      title: 'ข้อมูลจำเพาะ',
      body: (
        <>
          อ้างอิงเอกสาร<span className="nowrap">ข้อมูลจำเพาะ</span>และหน้าสินค้าของ<span className="nowrap">ผู้ผลิต</span>
          <span className="nowrap">เป็นอันดับแรก</span> รายการที่<span className="nowrap">ผู้ผลิต</span>ไม่ระบุ จึงใช้ข้อมูลจากสื่อด้านเทคโนโลยี{' '}
          <span className="nowrap">ผู้ผลิต</span>แต่ละรายวัดเวลาทำงานต่อการชาร์จ <span className="nowrap">น้ำหนัก</span>บรรทุก
          และความเร็วภายใต้<span className="nowrap">เงื่อนไข</span>ต่างกัน จึงควรเทียบกันอย่างระมัดระวัง
        </>
      ),
    },
    {
      title: 'ตัวเลขที่ไม่เปิดเผย',
      body: (
        <>
          รายการที่<span className="nowrap">ผู้ผลิต</span>
          <span className="nowrap">ไม่เปิดเผย</span> หรือแหล่งข้อมูลขัดแย้งกันจนยืนยันไม่ได้ ระบุว่า{' '}
          <span className="nowrap">“ไม่ระบุ”</span> <span className="nowrap">โดยไม่ประมาณค่าขึ้นเอง</span>
          {mostMissing && mostMissing.n > 0 && (
            <>
              {' '}
              เช่น {mostMissing.label}ไม่ระบุใน <span className="nowrap">{mostMissing.n} รุ่น</span>
            </>
          )}
        </>
      ),
    },
    {
      title: 'ลำดับในแค็ตตาล็อก',
      body: (
        <>
          เรียงตามอันดับ<span className="nowrap">ยอดส่งมอบ</span>ของ<span className="nowrap">ผู้ผลิต</span> และใน
          <span className="nowrap">ผู้ผลิต</span>เดียวกันเรียงตามราคาเริ่มต้น
          <span className="nowrap">จากต่ำไปสูง</span>
          {unranked.length > 0 && (
            <>
              {' '}
              รุ่นจาก<span className="nowrap">ผู้ผลิต</span>ที่ไม่อยู่ในอันดับ{' '}
              <span className="nowrap">({unranked.length} รุ่น)</span> อยู่ท้ายสุด
            </>
          )}
        </>
      ),
    },
    {
      title: 'วันที่ของข้อมูล',
      body: (
        <>
          ข้อมูลทั้งหมด <span className="nowrap">ณ {asOf}</span>
          {anyConverted && (
            <>
              {' '}
              <span className="nowrap">อัตราแลกเปลี่ยน</span> <span className="nowrap">ณ {formatDayTh(market.fx.date)}</span>
            </>
          )}{' '}
          ราคา สเปก และ<span className="nowrap">เงื่อนไข</span>การจำหน่ายอาจเปลี่ยนแปลงได้ โปรด
          <span className="nowrap">ตรวจสอบ</span>กับ<span className="nowrap">ผู้จำหน่าย</span>ก่อนตัดสินใจ
        </>
      ),
    },
  ]
}

// ---------- Page ----------

/** The extra photos and clips each model page shows, in catalogue order */
const galleryCredits = models.flatMap((model) => (model.gallery ?? []).map((item, i) => ({ model, item, key: `${model.id}-${i}` })))

/** Thai readers get the full appendix; the English page covers each part in brief (SourcesPage.en.tsx). */
export function SourcesPage() {
  return useLang() === 'en' ? <SourcesEn /> : <SourcesTh />
}

function SourcesTh() {
  useTitle('แหล่งข้อมูล')
  const method = useRef<HTMLElement>(null)
  useReveal(method)

  return (
    <>
      {/* ---------- Cover ---------- */}
      {/* A dark stage: the site header floats over it on desktop (see Layout.css) */}
      <header className="scover stage on-navy">
        <div className="container scover__inner">
          <div>
            <h1>
              แหล่งข้อมูล
              <br />
              <span className="tint">และเครดิตภาพ</span>
            </h1>
          </div>
          <div>
            <p className="scover__lede">
              ภาคผนวกของ<span className="nowrap">แค็ตตาล็อก</span> รวบรวมวิธีการ<span className="nowrap">เรียบเรียง</span>ข้อมูล
              ที่มาของลำดับ<span className="nowrap">ผู้ผลิต</span> <span className="nowrap">แหล่งอ้างอิง</span>ของ<span className="nowrap">หุ่นยนต์</span>ทั้ง{' '}
              <span className="nowrap">{models.length} รุ่น</span> <span className="nowrap">แหล่งข้อมูล</span>ด้านตลาด ภาษีและกฎหมาย และเครดิตภาพถ่าย
            </p>
            <p className="scover__meta">
              <span>
                ข้อมูล <span className="nowrap">ณ {asOf}</span>
              </span>
              <span>ลิงก์ภายนอกเปิดในแท็บใหม่</span>
            </p>
          </div>
        </div>
        <div className="container">
          <dl className="sfigures">
            <div>
              <dt>รุ่นในแค็ตตาล็อก</dt>
              <dd>
                <CountUp value={models.length} />
              </dd>
            </div>
            <div>
              <dt>อ้างอิงรายรุ่น</dt>
              <dd>
                <CountUp value={modelRefs} />
              </dd>
            </div>
            <div>
              <dt>ข้อมูลตลาดและคู่มือ</dt>
              <dd>
                <CountUp value={market.sources.length} />
              </dd>
            </div>
            <div>
              <dt>ภาพถ่ายพร้อมเครดิต</dt>
              <dd>
                <CountUp value={models.length} />
              </dd>
            </div>
          </dl>
        </div>
      </header>

      {/* ---------- 01 Methodology ---------- */}
      <section className="section ssec" aria-labelledby="src-method" ref={method}>
        <div className="container">
          <div className="section-head">
            <div>
              <h2 id="src-method">วิธีการรวบรวมข้อมูล</h2>
            </div>
            <p>
              หลักเกณฑ์ที่ใช้คัดเลือกรุ่นและ<span className="nowrap">เรียบเรียง</span>ตัวเลขในทุกหน้า
            </p>
          </div>
          <ol className="smethod">
            {methods().map((m) => (
              <li key={m.title} data-reveal>
                <h3>{m.title}</h3>
                <p>{m.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- 02 Shipment ranking: why these makers, in this order ---------- */}
      <section className="section section--band ssec" aria-labelledby="src-rank">
        <div className="container ssplit">
          <div className="ssplit__head ssplit__head--sticky">
            <h2 id="src-rank">
              ที่มาของ
              <br />
              <span className="tint">ลำดับผู้ผลิต</span>
            </h2>
            <p className="ssplit__text">
              <span className="nowrap">แค็ตตาล็อก</span>เรียงรุ่นตาม<span className="nowrap">ยอดส่งมอบ</span>
              <span className="nowrap">หุ่นยนต์</span><span className="nowrap">ฮิวแมนนอยด์</span>
              <span className="nowrap">ทั่วโลก</span>ของ<span className="nowrap">ผู้ผลิต</span>
              <span className="nowrap">แต่ละราย</span>
              {period && <During period={period} />}{' '}
              <span className="nowrap">หุ่นยนต์</span> <span className="nowrap">{models.length - unranked.length} รุ่น</span>
              มาจาก<span className="nowrap">ผู้ผลิต</span> <span className="nowrap">{makersIn.length} ราย</span>ในอันดับนี้
              {tiedRanks.length === 1 && (
                <>
                  {' '}
                  โดย<span className="nowrap">อันดับ {tiedRanks[0]}</span> มี<span className="nowrap">ผู้ผลิต</span>{' '}
                  <span className="nowrap">{ranked.filter((o) => o.rank === tiedRanks[0]).length} ราย</span>ที่ยอดเท่ากัน
                </>
              )}
              {tiedRanks.length > 1 && (
                <>
                  {' '}
                  โดย
                  {tiedRanks.map((r, i) => (
                    <Fragment key={r}>
                      {i > 0 && (i === tiedRanks.length - 1 ? ' และ' : ' ')}
                      <span className="nowrap">อันดับ {r}</span>
                    </Fragment>
                  ))}{' '}
                  มี<span className="nowrap">ผู้ผลิต</span>ที่ยอดเท่ากัน
                </>
              )}{' '}
              ยอดของ<span className="nowrap">แต่ละราย</span>นับรวม<span className="nowrap">หุ่นยนต์</span>ทุกรุ่นของ
              <span className="nowrap">ผู้ผลิต</span>นั้น ไม่เฉพาะรุ่นที่จำหน่ายในไทย
            </p>
          </div>

          <div className="srank">
            <table className={period ? 'srank__table srank__table--one-period' : 'srank__table'}>
              <caption>
                อันดับยอดส่งมอบ<span className="nowrap">หุ่นยนต์</span><span className="nowrap">ฮิวแมนนอยด์</span>ทั่วโลก
                {period && (
                  <>
                    {' '}
                    <span className="nowrap">{period}</span>
                  </>
                )}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="srank__pos">
                    อันดับ
                  </th>
                  <th scope="col">ผู้ผลิต</th>
                  <th scope="col" className="srank__units">
                    ยอดส่งมอบ (ตัว)
                  </th>
                  <th scope="col" className="srank__period">
                    ช่วงเวลา
                  </th>
                </tr>
              </thead>
              {[
                { key: 'in', title: `ผู้ผลิตในแค็ตตาล็อก ${makersIn.length} ราย`, rows: makersIn },
                { key: 'out', title: 'ผู้ผลิตอื่นในอันดับ', rows: makersOut },
              ]
                .filter((g) => g.rows.length > 0)
                .map((g) => (
                  <tbody key={g.key} className={`srank__group srank__group--${g.key}`}>
                    <tr className="srank__divider">
                      <th scope="rowgroup" colSpan={4}>
                        {g.title}
                      </th>
                    </tr>
                    {g.rows.map((r) => (
                      <tr key={r.brand}>
                        <td className="srank__pos">
                          <span className="srank__badge">{r.rank}</span>
                          {r.tied && <span className="srank__tie">ร่วม</span>}
                        </td>
                        <th scope="row" className="srank__name">
                          <span className="srank__brand" lang={langOf(r.brand)}>
                            {r.brand}
                          </span>
                          {r.models.length > 0 && (
                            <span className="srank__models">
                              {r.models.map((m) => (
                                <Link key={m.id} to={`/models/${m.id}`} lang="en">
                                  <ModelName model={m} />
                                </Link>
                              ))}
                            </span>
                          )}
                          {r.note && <span className="srank__note">{keep(r.note)}</span>}
                        </th>
                        <td className="srank__units">{formatNumber(r.units)}</td>
                        <td className="srank__period">{r.period}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
            </table>
            {unranked.length > 0 && (
              <p className="srank__extra">
                <span className="srank__extra-label">นอกอันดับ</span>
                <span>
                  {unranked.map((m, i) => (
                    <Fragment key={m.id}>
                      {i > 0 && (i === unranked.length - 1 ? ' และ ' : ', ')}
                      <Link to={`/models/${m.id}`} lang="en" className="nowrap">
                        {m.nameEn}
                      </Link>
                    </Fragment>
                  ))}{' '}
                  มาจาก<span className="nowrap">ผู้ผลิต</span>ที่ไม่อยู่ในอันดับนี้
                  จึงเรียงไว้ท้าย<span className="nowrap">แค็ตตาล็อก</span>
                </span>
              </p>
            )}
            {/* Publisher first, so a long title never leaves it stranded on a line of its own */}
            <p className="srank__foot">
              ที่มา:{' '}
              {analyst ? (
                <>
                  {analystPub && (
                    <>
                      <span lang={langOf(analystPub)}>{analystPub}</span>,{' '}
                    </>
                  )}
                  <OutLink href={analyst.url}>{keep(splitSource(analyst.title).title)}</OutLink>
                </>
              ) : market.shipments[0]?.note ? (
                keep(market.shipments[0].note.replace(/^ที่มา\s*:?\s*/, ''))
              ) : (
                <>
                  รายงานของบริษัทวิจัยตลาด ดูหมวด<span className="nowrap">“ตลาดและยอดส่งมอบ”</span>ในหัวข้อที่ 4
                </>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* ---------- 03 Per-model references ---------- */}
      <section className="section ssec" aria-labelledby="src-models">
        <div className="container ssplit">
          <div className="ssplit__head ssplit__head--sticky">
            <h2 id="src-models">แหล่งอ้างอิงรายรุ่น</h2>
            <p className="ssplit__text">
              หน้าสินค้าและเอกสาร<span className="nowrap">ข้อมูลจำเพาะ</span>ของ<span className="nowrap">ผู้ผลิต</span>{' '}
              <span className="nowrap">หน้าราคา</span>ของ<span className="nowrap">ผู้จำหน่าย</span> และบทความจากสื่อด้านเทคโนโลยีที่ใช้<span className="nowrap">เรียบเรียง</span>ข้อมูลของแต่ละรุ่น
            </p>
            <p className="smeta">
              {models.length} รุ่น รวม {formatNumber(modelRefs)} รายการ
            </p>
          </div>

          <div className="sacc">
            {models.map((m) => (
              <details key={m.id}>
                <summary>
                  <Photo model={m} className="sacc__thumb" />
                  <span className="sacc__name">
                    <span className="sacc__en" lang="en">
                      {m.nameEn}
                    </span>
                    <span className="sacc__th">{m.nameTh}</span>
                  </span>
                  <span className="chip sacc__count">{m.sources.length} รายการ</span>
                  <span className="sacc__icon" aria-hidden="true">
                    <Plus size={16} className="sacc__plus" />
                    <Minus size={16} className="sacc__minus" />
                  </span>
                </summary>
                <div className="sacc__panel">
                  <ol className="sref">
                    {m.sources.map((s, i) => (
                      <SourceItem key={s.url} source={s} n={i + 1} />
                    ))}
                  </ol>
                  {m.priceNote && (
                    <div className="sacc__terms tone-sand">
                      <p className="sacc__terms-title">
                        <span className="nowrap">เงื่อนไข</span>ราคา
                      </p>
                      <p>{keep(m.priceNote)}</p>
                    </div>
                  )}
                  <Link to={`/models/${m.id}`} className="link-arrow sacc__go">
                    <span>
                      ดูหน้ารุ่น <span lang="en">{m.nameEn}</span>
                    </span>
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- 04 Market & guide sources ---------- */}
      <section className="section section--band ssec" aria-labelledby="src-market">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 id="src-market">แหล่งข้อมูลตลาดและคู่มือ</h2>
            </div>
            <p>
              <span className="nowrap">ยอดส่งมอบ</span> <span className="nowrap">อัตราแลกเปลี่ยน</span> <span className="nowrap">ผู้จำหน่าย</span>ในไทย
              ภาษี<span className="nowrap">นำเข้า</span> กฎหมาย และค่าใช้จ่ายที่ใช้ในหน้าคู่มือก่อนซื้อ{' '}
              <span className="nowrap">
                {groups.length} หมวด {market.sources.length} รายการ
              </span>
            </p>
          </div>
          <div className="sgroups">
            {groups.map((g) => (
              <section key={g.id} className="sgroup" aria-labelledby={`src-g-${g.id}`}>
                <h3 id={`src-g-${g.id}`} className="sgroup__title">
                  <span>{g.title}</span>
                  <span className="sgroup__count">{g.items.length} รายการ</span>
                </h3>
                <ol className="sref" start={g.items[0].n}>
                  {g.items.map((s) => (
                    <SourceItem key={s.url} source={s} n={s.n} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- 05 Photo credits ---------- */}
      <section className="section ssec" aria-labelledby="src-photos">
        <div className="container">
          <div className="section-head">
            <div>
              <h2 id="src-photos">เครดิตภาพถ่าย</h2>
            </div>
            <p>
              ภาพ<span className="nowrap">หุ่นยนต์</span>ทุกตัวจาก <span lang="en">Wikimedia Commons</span>{' '}
              ใช้ตามสัญญาอนุญาตของผู้ถ่าย<span className="nowrap">แต่ละราย</span> ภาพอาจถูก<span className="nowrap">ครอป</span>หรือ
              <span className="nowrap">ย่อขนาด</span>
              <span className="nowrap">เพื่อการจัดวาง</span>
            </p>
          </div>
          <ul className="scredits">
            {models.map((m) => {
              const deed = licenceUrl(m.image.license)
              return (
                <li key={m.id}>
                  <Photo model={m} className="scredits__media" />
                  <p className="scredits__name" lang="en">
                    {m.nameEn}
                  </p>
                  <dl className="scredits__spec">
                    <div>
                      <dt>ผู้ถ่าย</dt>
                      <dd lang={langOf(m.image.author)}>{m.image.author}</dd>
                    </div>
                    <div>
                      <dt>สัญญาอนุญาต</dt>
                      <dd>
                        {deed ? (
                          <OutLink href={deed} lang="en" className="scredits__licence">
                            {m.image.license}
                          </OutLink>
                        ) : (
                          <span lang={langOf(m.image.license)}>{m.image.license}</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>ต้นฉบับ</dt>
                      <dd>
                        <OutLink href={m.image.page} lang="en">
                          Wikimedia Commons
                        </OutLink>
                      </dd>
                    </div>
                  </dl>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* ---------- 06 Gallery credits: the extra photos and clips on the model pages ---------- */}
      {galleryCredits.length > 0 && (
        <section className="section section--band ssec" aria-labelledby="src-gallery">
          <div className="container">
            <div className="section-head">
              <div>
                <h2 id="src-gallery">เครดิตภาพและวิดีโอในแกลเลอรี</h2>
              </div>
              <p>
                ภาพเพิ่มเติมและคลิปวิดีโอในหน้ารุ่น <span className="nowrap">{galleryCredits.length} รายการ</span>{' '}
                จาก <span lang="en">Wikimedia Commons</span> ใช้ตามสัญญาอนุญาตของ<span className="nowrap">เจ้าของผลงาน</span>
                <span className="nowrap">แต่ละราย</span> คลิปข่าวบางคลิปมีคำบรรยายภาษาจีนและลายน้ำของ
                <span className="nowrap">สำนักข่าว</span>
              </p>
            </div>
            <ul className="scredits scredits--gallery">
              {galleryCredits.map(({ model: m, item: g, key }) => {
                const deed = licenceUrl(g.license)
                return (
                  <li key={key}>
                    <span className="scredits__media">
                      <Picture src={g.srcSmall} alt="" sizes="120px" style={photoStyle({ focus: g.focus, zoom: g.zoom } as Model['image'])} />
                    </span>
                    <p className="scredits__name">
                      <span lang="en">{m.nameEn}</span>
                      <span className="scredits__kind">{g.kind === 'video' ? 'วิดีโอ' : 'ภาพ'}</span>
                    </p>
                    <p className="scredits__alt">{keep(g.alt)}</p>
                    <dl className="scredits__spec">
                      <div>
                        <dt>{g.kind === 'video' ? 'ผู้ถ่ายทำ' : 'ผู้ถ่าย'}</dt>
                        <dd lang={langOf(g.author)}>{g.author}</dd>
                      </div>
                      <div>
                        <dt>สัญญาอนุญาต</dt>
                        <dd>
                          {deed ? (
                            <OutLink href={deed} lang="en" className="scredits__licence">
                              {g.license}
                            </OutLink>
                          ) : (
                            <span lang={langOf(g.license)}>{g.license}</span>
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>ต้นฉบับ</dt>
                        <dd>
                          <OutLink href={g.page} lang="en">
                            Wikimedia Commons
                          </OutLink>
                        </dd>
                      </div>
                    </dl>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      )}

      {/* ---------- Notice: the back matter, on the navy band ---------- */}
      <section className="snotice end-band on-navy" aria-labelledby="src-notice">
        <div className="container snotice__inner">
          <div>
            <h2 id="src-notice">
              เครื่องหมายการค้า
              <br />
              <span className="tint">และข้อจำกัดของข้อมูล</span>
            </h2>
          </div>
          <div className="snotice__body">
            <p>
              ชื่อรุ่น ตราสัญลักษณ์ และเครื่องหมายการค้าทั้งหมดเป็นของเจ้าของแต่ละราย
              เว็บไซต์นี้จัดทำขึ้นเพื่อให้ข้อมูลประกอบการตัดสินใจ และไม่มีความเกี่ยวข้องกับ<span className="nowrap">ผู้ผลิต</span>หรือ
              <span className="nowrap">ผู้จัดจำหน่ายรายใด</span>
            </p>
            <p>
              ข้อมูล <span className="nowrap">ณ {asOf}</span> ราคา ข้อมูลจำเพาะ และ<span className="nowrap">เงื่อนไข</span>
              การจำหน่ายอาจเปลี่ยนแปลงโดยไม่แจ้ง<span className="nowrap">ล่วงหน้า</span>
              {anyConverted && (
                <>
                  {' '}
                  ราคาที่แปลงจากสกุลเงิน<span className="nowrap">ต่างประเทศ</span>เป็นราคาโดยประมาณ และยังไม่รวม
                  <span className="nowrap">ค่าขนส่ง</span> <span className="nowrap">อากรขาเข้า</span> และ
                  <span className="nowrap">ภาษีมูลค่าเพิ่ม</span>
                </>
              )}{' '}
              โปรด<span className="nowrap">ตรวจสอบ</span>กับ<span className="nowrap">ผู้จำหน่าย</span>ก่อนตัดสินใจ
            </p>
            <Link to="/" className="link-arrow snotice__cta">
              กลับไปดู<span className="nowrap">หุ่นยนต์</span>ทั้งหมด
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
