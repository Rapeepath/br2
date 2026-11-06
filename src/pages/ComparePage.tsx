import { Fragment, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Check, ChevronDown, Plus, SlidersHorizontal, TriangleAlert, X } from 'lucide-react'
import { getModel, market, models } from '../data'
import { useLang, type Lang } from '../i18n'
import { localized, localizedMarket } from '../i18n/content'
import { focusSoon, focusSoonQuietly, langOf, useTitle } from '../lib/a11y'
import { dayText, labels, listPriceText, monthText, pick, units } from '../lib/bilingual'
import { COMPARE_LIMIT, useCompare } from '../lib/compare'
import { formatNumber, msToKmh } from '../lib/format'
import type { Availability, Currency, Market, Model, Range, Trim } from '../lib/types'
import { useReveal } from '../lib/motion'
import { photoStyle } from '../lib/photo'
import { Picture } from '../components/Picture'
import './ComparePage.css'

type Tx = <T>(th: T, en: T) => T
const txFor = (lang: Lang): Tx => (th, en) => pick(lang, th, en)

/* ---------- Data helpers ---------- */

const spanOf = (xs: (number | null)[]): Range | null => {
  const known = xs.filter((x): x is number => x != null)
  return known.length ? [Math.min(...known), Math.max(...known)] : null
}
const trimSpan = (m: Model, pick: (t: Trim) => number | null) => spanOf(m.trims.map(pick))
const single = (n: number | null | undefined): Range | null => (n == null ? null : [n, n])
const unique = <T,>(xs: T[]) => [...new Set(xs)]

/** Baht per unit of each foreign currency a list price is converted at */
const FX: Record<Exclude<Currency, 'THB'>, number> = { USD: market.fx.usd, CNY: market.fx.cny, EUR: market.fx.eur }
const FX_ORDER = Object.keys(FX) as (keyof typeof FX)[]

/** The currencies a model's baht prices were converted from ("USD") */
const convertedFrom = (m: Model) =>
  unique(m.trims.flatMap((t) => (t.priceBasis === 'converted' && t.listPrice ? [t.listPrice.currency] : [])))

// Trims come cheapest first with unpriced ones last, so these are the trims behind the two price rows.
const firstPriced = (m: Model) => m.trims.find((t) => t.priceTHB != null)
const lastPriced = (m: Model) => m.trims.findLast((t) => t.priceTHB != null)

/**
 * A Thai dealer's price includes import costs and VAT; a converted list price does not, so starting
 * prices only compete when every model's comes from the same kind of source.
 */
const sameBasis = (ms: Model[]) => unique(ms.map((m) => firstPriced(m)?.priceBasis ?? null)).length === 1

// The row is already called "ช่องทางในไทย", and three phone columns are narrow.
const AVAILABILITY_BRIEF: Record<Lang, Record<Availability, string>> = {
  th: { 'thai-dealer': 'ตัวแทนในไทย', import: 'สั่งนำเข้า', preorder: 'เปิดจอง' },
  en: { 'thai-dealer': 'Thai dealer', import: 'Import', preorder: 'Pre-order' },
}

/**
 * "1 ปี" → 12 months, "18 เดือน" → 18 (or "8 months", "2 years" on the English page), so warranties
 * written either way can be ranked; anything after the duration ("(ชิ้นส่วนหลัก)", "หรือ 2,000 ชั่วโมง")
 * moves to a second line.
 */
function splitWarranty(text: string): { months: number; time: string; rest: string | null } | null {
  const th = /^(\d+(?:\.\d+)?)\s*(ปี|เดือน)\s*(.*)$/.exec(text.trim())
  if (th) return { months: Number(th[1]) * (th[2] === 'ปี' ? 12 : 1), time: `${th[1]} ${th[2]}`, rest: th[3] || null }
  const en = /^(\d+(?:\.\d+)?)[\s-]*(years?|months?)\b\s*(.*)$/i.exec(text.trim())
  if (en) return { months: Number(en[1]) * (/^y/i.test(en[2]) ? 12 : 1), time: `${en[1]} ${en[2]}`, rest: en[3] || null }
  return null
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/** The maker's line in the shipment table, matched on the brand as the data build ranks it ("Booster" for "Booster Robotics"). */
function shipmentOf(m: Model) {
  if (m.makerRank == null) return null
  const brand = norm(m.brand)
  return (
    market.shipments.find((r) => {
      const label = norm(r.brand)
      return label === brand || label.startsWith(brand) || brand.startsWith(label)
    }) ?? null
  )
}

/** Two makers that shipped the same number share a place */
const sharesRank = (units: number) => market.shipments.filter((r) => r.units === units).length > 1

type Better = 'high' | 'low'

/**
 * Which columns hold the row's best figure. Nothing is marked when a figure is missing (an unpublished
 * spec could be the best one) or when every column ties.
 */
function bestOf(values: (number | null)[], better: Better): Set<number> {
  if (values.length < 2 || values.some((v) => v == null)) return new Set()
  const nums = values as number[]
  const target = better === 'high' ? Math.max(...nums) : Math.min(...nums)
  if (nums.every((v) => v === target)) return new Set()
  return new Set(nums.flatMap((v, i) => (v === target ? [i] : [])))
}

/* ---------- Thai line breaking ---------- */

// Words that Chrome's Thai dictionary splits into pieces that read wrongly alone ("หุ่น / ยนต์",
// "ฮิว / แมน / นอยด์", "น้ำ / หนัก"), found by running this page's text through Intl.Segmenter('th').
// Longer words come first where one starts another.
const KEEP = new RegExp(
  '(' +
    [
      // Figure ranges ("4–8", "10–80%")
      '\\d[\\d,.]*–\\d[\\d,.]*%?',
      'ฮิวแมนนอยด์',
      'หุ่นยนต์',
      'องศาอิสระ',
      'มือหยิบจับ',
      'หยิบจับ',
      'น้ำหนัก',
      'ประมวลผล',
      'ไลดาร์',
      'ข้อต่อ',
      'ข้อมือ',
      'ข้อเท้า',
      'ข้อจำกัด',
      'แรงบิด',
      'แรงกระแทก',
      'นิวตันเมตร',
      'ความจุ',
      'ความลึก',
      'ความสามารถ',
      'ความปลอดภัย',
      'แบตเตอรี่',
      'การชาร์จ',
      'ใช้งาน',
      'ตรวจจับ',
      'ไร้สาย',
      'พื้นฐาน',
      'นักพัฒนา',
      'โอเพนซอร์ส',
      'อัลกอริทึม',
      'สมาร์ตโฟน',
      'ผู้จัดจำหน่าย',
      'ผู้ผลิต',
      'ผู้ใช้',
      'ผู้ช่วย',
      'สองขา',
      'ฐานล้อ',
      'ส่งมอบ',
      'สั่งซื้อ',
      'นำเข้า',
      'อากรขาเข้า',
      'ภาษีมูลค่าเพิ่ม',
      'ดอลลาร์สหรัฐ',
      'เดือนละ',
      'แลกเปลี่ยน',
      'เปรียบเทียบ',
      'ทีละ',
      'รับประกัน',
      'รุ่นย่อย',
    ].join('|') +
    ')',
)

const NBSP = String.fromCharCode(0xa0)

/**
 * Running text in the sheet: a number stays with its unit ("2 ชั่วโมง", "16GB"), a label or date with
 * its figure ("ปี 2569", "ต.ค. 2569", "ROS 2"), and the words above stay whole. Only no-break spaces
 * and nowrap spans are added, so the text reads and announces the same.
 */
function tie(text: string): ReactNode {
  const glued = text
    .replace(/(\d%?)\s+(?=\S)/g, `$1${NBSP}`)
    .replace(/([A-Za-z]|[ก-๙]{1,2}\.[ก-๙]{1,2}\.|ปี|รุ่น|อันดับ|ร้อยละ)\s+(?=\d)/g, `$1${NBSP}`)
  const parts = glued.split(KEEP)
  if (parts.length === 1) return glued
  return parts.map((p, i) =>
    i % 2 ? (
      <span key={i} className="nowrap">
        {p}
      </span>
    ) : (
      p
    ),
  )
}

/* ---------- Small presentational pieces ---------- */

/**
 * A unit printed after a figure. Phones move it up into the row label ("ความสูง (ซม.)"), so there it
 * stays for screen readers only.
 */
function Unit({ children }: { children: string }) {
  return (
    <span className="cmp-unit" lang={langOf(children)}>
      {' '}
      {children}
    </span>
  )
}

/** "864–2,160 Wh": each number stays whole; a narrow column may break only after the dash. */
function Fig({ span, unit }: { span: Range; unit?: string }) {
  const [lo, hi] = span
  return (
    <span className="cmp-fig">
      {lo === hi ? (
        <span className="nowrap">{formatNumber(lo)}</span>
      ) : (
        <>
          <span className="nowrap">{formatNumber(lo)}–</span>
          <wbr />
          <span className="nowrap">{formatNumber(hi)}</span>
        </>
      )}
      {unit && <Unit>{unit}</Unit>}
    </span>
  )
}

/**
 * Words that three phone columns can't hold on one line get a brief form there ("89,000 USD" for
 * "แปลงจาก 89,000 ดอลลาร์สหรัฐ"); the full wording stays for screen readers.
 */
function Brief({ full, brief }: { full: string; brief?: string }) {
  if (!brief || brief === full) return full
  return (
    <>
      <span className="cmp-full">{full}</span>
      <span className="cmp-brief" aria-hidden="true">
        {brief}
      </span>
    </>
  )
}

/** Unknown figures read as absent, in a quieter voice than real ones. */
function Missing({ text, brief }: { text: string; brief?: string }) {
  return (
    <span className="cmp-missing">
      <Brief full={text} brief={brief} />
    </span>
  )
}

/**
 * A label written with "|" where a narrow column may break it ("เวลาใช้งาน|ต่อการชาร์จ"), so it never
 * breaks inside a phrase ("การ / ชาร์จ"). The bars add nothing to what is read out.
 */
function Phrases({ text }: { text: string }) {
  return text.split('|').map((phrase, k) => (
    <Fragment key={k}>
      {k > 0 && <wbr />}
      <span className="nowrap">{phrase}</span>
    </Fragment>
  ))
}

/**
 * Model names wrap only at spaces, and a short last word ("S2", "Pro") stays with the word before it,
 * so "UBTech Walker S2" breaks as "UBTech / Walker S2", never leaving "S2" alone on a line.
 */
function Name({ text }: { text: string }) {
  const words = text.split(' ')
  if (words.length > 2 && words[words.length - 1].length <= 3) {
    const last = words.pop()!
    words[words.length - 1] += ` ${last}`
  }
  return words.map((w, k) => (
    <Fragment key={k}>
      {k > 0 && ' '}
      <span className="nowrap">{w}</span>
    </Fragment>
  ))
}

/** "พฤษภาคม 2567"; phones print "พ.ค. 2567" so it keeps to one line ("May 2024" / "May 2024" in English). */
function MonthText({ yyyyMm }: { yyyyMm: string }) {
  const lang = useLang()
  return <Brief full={monthText(yyyyMm, lang)} brief={monthText(yyyyMm, lang, true)} />
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="cmp-list">
      {items.map((x) => (
        <li key={x} lang={langOf(x)}>
          {tie(x)}
        </li>
      ))}
    </ul>
  )
}

/** Model names in running text: "Unitree G1 และ 1X NEO" */
function Names({ list }: { list: Model[] }) {
  const lang = useLang()
  return list.map((m, k) => (
    <Fragment key={m.id}>
      {k > 0 && pick(lang, ' และ ', ' and ')}
      <span className="nowrap" lang="en">
        {m.nameEn}
      </span>
    </Fragment>
  ))
}

/**
 * Under a converted price: an "ประมาณ" tag and the maker's own price it was converted from. Phones
 * keep only the figure and the currency code. A Thai dealer's price needs no second line.
 */
function approxNote(trim: Trim | undefined, lang: Lang): ReactNode {
  if (trim?.priceBasis !== 'converted' || !trim.listPrice) return null
  const tx = txFor(lang)
  return (
    <>
      <span className="cmp-approx">{tx('ประมาณ', 'approx.')}</span>{' '}
      <span className="nowrap">
        <Brief
          full={tx(`แปลงจาก ${listPriceText(trim.listPrice, lang)}`, `from ${listPriceText(trim.listPrice, lang)}`)}
          brief={listPriceText(trim.listPrice, lang, true)}
        />
      </span>
    </>
  )
}

/* ---------- Rows ---------- */

interface Cell {
  content: ReactNode
  best?: boolean
}

interface Row {
  id: string
  /** With "|" between the phrases a narrow column may break at (see Phrases) */
  label: string
  /** Phones print the label on its own line above the values; the unit moves up into it */
  unit?: string
  /** Free text that three ~90px phone columns would chop up: phones restack it, one named block per model */
  stack?: boolean
  cells: (ms: Model[]) => Cell[]
  /** A full-width note under the row (the price-source caution) */
  after?: (ms: Model[]) => ReactNode
}

interface Group {
  /** With "|" between the phrases a phone may break at (see Phrases) */
  title: string
  rows: Row[]
}

interface FigureRow {
  id: string
  label: string
  unit: string
  get: (m: Model) => Range | null
  /** Marks the best figure; `end` says which end of a trim span competes */
  rank?: { better: Better; end: 'lo' | 'hi'; text: string; when?: (ms: Model[]) => boolean }
  /** Draws a bar scaled to the largest figure in the comparison (dark to the low end, light to the high end) */
  bar?: boolean
  sub?: (m: Model) => ReactNode
  missing?: string
  missingBrief?: string
}

function figureRow(def: FigureRow, lang: Lang): Row {
  const tx = txFor(lang)
  return {
    id: def.id,
    label: def.label,
    unit: def.unit,
    cells: (ms) => {
      const spans = ms.map(def.get)
      const rank = def.rank && (def.rank.when?.(ms) ?? true) ? def.rank : null
      const best = rank ? bestOf(spans.map((s) => (s ? s[rank.end === 'lo' ? 0 : 1] : null)), rank.better) : new Set()
      const top = Math.max(...spans.map((s) => s?.[1] ?? 0))
      return ms.map((m, i) => {
        const s = spans[i]
        if (!s) return { content: <Missing text={def.missing ?? tx('ไม่ระบุ', 'Not stated')} brief={def.missingBrief} /> }
        const isBest = best.has(i)
        const sub = def.sub?.(m)
        const pct = (n: number) => `${((n / top) * 100).toFixed(1)}%`
        return {
          best: isBest,
          content: (
            <span className="cmp-val">
              <span className="cmp-val__main">
                {isBest && <span className="cmp-dot" aria-hidden="true" />}
                <Fig span={s} unit={def.unit} />
                {isBest && rank && (
                  <span className="visually-hidden">{tx(` (${rank.text}ในการเปรียบเทียบนี้)`, ` (${rank.text} in this comparison)`)}</span>
                )}
              </span>
              {sub != null && <span className="cmp-val__sub">{sub}</span>}
              {def.bar && top > 0 && (
                <span
                  className="cmp-bar"
                  aria-hidden="true"
                  style={{ '--lo': pct(s[0]), '--hi': pct(s[1]) } as CSSProperties}
                />
              )}
            </span>
          ),
        }
      })
    },
  }
}

/** A row of short words ("เดินสองขา", "สั่งนำเข้า") */
function textRow(id: string, label: string, render: (m: Model) => ReactNode): Row {
  return { id, label, cells: (ms) => ms.map((m) => ({ content: <span className="cmp-text">{render(m)}</span> })) }
}

/** A row of sentences or lists; phones restack it */
function stackRow(id: string, label: string, render: (m: Model) => ReactNode): Row {
  return { id, label, stack: true, cells: (ms) => ms.map((m) => ({ content: render(m) })) }
}

/** Each trim's price as a printed price list; a converted price says so and names the maker's own. */
function TrimList({ m }: { m: Model }) {
  const lang = useLang()
  const tx = txFor(lang)
  return (
    <div className="cmp-trims">
      <p className="cmp-trims__count">{tx(`${m.trims.length} รุ่นย่อย`, `${m.trims.length} ${m.trims.length === 1 ? 'trim' : 'trims'}`)}</p>
      <ul>
        {m.trims.map((t) => {
          const converted = t.priceBasis === 'converted' && t.listPrice
          return (
            <li key={t.name}>
              <span className="cmp-trims__name" lang="en">
                {t.name}
              </span>
              <span className="cmp-trims__price">
                {t.priceTHB != null ? (
                  <>
                    {converted && <span className="cmp-trims__approx">{tx('ประมาณ ', 'approx. ')}</span>}
                    <span className="nowrap">{formatNumber(t.priceTHB)}</span>
                    <span className="visually-hidden"> {units(lang).baht}</span>
                  </>
                ) : (
                  tx('ยังไม่ประกาศ', 'Not announced')
                )}
              </span>
              {converted && (
                <span className="cmp-trims__list">
                  {tx('ราคาผู้ผลิต', 'Maker’s price')} <span className="nowrap">{listPriceText(t.listPrice!, lang)}</span>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * A detail that can differ by trim (the hands, the computer): one line when every trim shares it,
 * otherwise a line per trim keyed by its name.
 */
function PerTrim({ m, pick: get }: { m: Model; pick: (t: Trim) => string | null }) {
  const tx = txFor(useLang())
  const values = m.trims.map(get)
  const known = unique(values.filter((v) => v != null))
  if (known.length === 0) return <Missing text={tx('ไม่ระบุ', 'Not stated')} />
  if (known.length === 1 && values.every((v) => v === known[0])) {
    return (
      <p className="cmp-prose" lang={langOf(known[0])}>
        {tie(known[0])}
      </p>
    )
  }
  return (
    <ul className="cmp-list cmp-list--keyed">
      {m.trims.map((t, i) => {
        const v = values[i]
        return (
          <li key={t.name}>
            <span className="cmp-key" lang="en">
              {t.name}
            </span>{' '}
            {v != null ? <span lang={langOf(v)}>{tie(v)}</span> : <span className="cmp-missing">{tx('ไม่ระบุ', 'Not stated')}</span>}
          </li>
        )
      })}
    </ul>
  )
}

/** "มือ Dex3-1 สามนิ้ว (7 องศาอิสระต่อข้าง)"; a hand whose name already gives its count keeps just the name. */
function handLine(t: Trim, lang: Lang): string | null {
  const dof = t.handDof != null ? pick(lang, `${formatNumber(t.handDof)} องศาอิสระต่อข้าง`, `${formatNumber(t.handDof)} DoF per hand`) : null
  if (!t.hand) return dof
  if (dof == null || new RegExp(`(^|\\D)${t.handDof}\\s*(องศาอิสระ|DOF|DoF)`, 'i').test(t.hand)) return t.hand
  return `${t.hand} (${dof})`
}

function priceCaution(ms: Model[], lang: Lang): ReactNode {
  const converted = ms.filter((m) => firstPriced(m)?.priceBasis === 'converted')
  const dealer = ms.filter((m) => firstPriced(m)?.priceBasis === 'dealer')
  if (converted.length === 0 || dealer.length === 0) return null
  return (
    <>
      <TriangleAlert size={16} aria-hidden className="cmp-caution__icon" />
      {lang === 'en' ? (
        <span>
          <strong>Prices come from different sources.</strong> The prices of <Names list={converted} /> are converted from
          the maker’s price and exclude shipping and import taxes, while those of <Names list={dealer} /> are Thai
          dealer prices with tax included. They shouldn’t be compared directly, so this table doesn’t mark the lowest
          starting price.
        </span>
      ) : (
        <span>
          <strong>ราคามาจากต่างแหล่งกัน</strong> ราคาของ <Names list={converted} /> แปลงจากราคาผู้ผลิต{' '}
          <span className="nowrap">ยังไม่รวม</span>ค่าขนส่งและภาษีนำเข้า ส่วนราคาของ <Names list={dealer} />{' '}
          เป็นราคาตัวแทนในไทยซึ่งรวมภาษีแล้ว จึงไม่ควรเทียบกันตรง ๆ และตารางนี้จะไม่ระบุรุ่นที่ราคาเริ่มต้นต่ำที่สุด
        </span>
      )}
    </>
  )
}

function groupsFor(lang: Lang, mk: Market): Group[] {
  const tx = txFor(lang)
  const u = units(lang)
  const L = labels(lang)
  const shipPeriod = mk.shipments[0]?.period ?? ''
  const notStated = tx('ไม่ระบุ', 'Not stated')
  const notDisclosed = tx('ไม่เปิดเผย', 'Not disclosed')
  const noPrice = tx('ยังไม่ประกาศราคา', 'Price not announced')
  return [
    {
      title: tx('ราคา', 'Price'),
      rows: [
        {
          ...figureRow(
            {
              id: 'price-start',
              label: tx('ราคาเริ่มต้น', 'Starting price'),
              unit: u.baht,
              get: (m) => single(m.span.price?.[0]),
              rank: { better: 'low', end: 'lo', text: tx('ราคาเริ่มต้นต่ำที่สุด', 'lowest starting price'), when: sameBasis },
              sub: (m) => approxNote(firstPriced(m), lang),
              missing: noPrice,
            },
            lang,
          ),
          after: (ms) => priceCaution(ms, lang),
        },
        figureRow(
          {
            id: 'price-top',
            label: tx('ราคารุ่นย่อย|สูงสุด', 'Top trim price'),
            unit: u.baht,
            get: (m) => single(m.span.price?.[1]),
            sub: (m) => approxNote(lastPriced(m), lang),
            missing: noPrice,
          },
          lang,
        ),
        stackRow('trims', tx('รุ่นย่อย|และราคา', 'Trims and prices'), (m) => <TrimList m={m} />),
        textRow('price-basis', tx('ที่มา|ของราคา', 'Price basis'), (m) => {
          const bases = unique(m.trims.map((t) => t.priceBasis).filter((b) => b != null))
          if (bases.length === 0) return <Missing text={noPrice} brief={tx('ไม่มี', 'None')} />
          const currencies = FX_ORDER.filter((c) => convertedFrom(m).includes(c))
          return (
            <>
              {bases.includes('dealer') && <span className="nowrap">{tx('ตัวแทนในไทย', 'Thai dealer')}</span>}
              {bases.length > 1 && ' / '}
              {bases.includes('converted') && (
                <span className="nowrap">
                  {tx('แปลงจาก', 'Converted from')} <span lang="en">{currencies.join(' / ')}</span>
                </span>
              )}
              {currencies.map((c) => (
                <span key={c} className="cmp-val__sub">
                  <span className="nowrap">
                    <span lang="en">1 {c}</span> =
                  </span>{' '}
                  <span className="nowrap">
                    {formatNumber(FX[c])} {u.baht}
                  </span>
                </span>
              ))}
            </>
          )
        }),
        stackRow('price-note', tx('เงื่อนไข|ราคา', 'Price terms'), (m) =>
          m.priceNote ? <p className="cmp-prose cmp-prose--small">{tie(m.priceNote)}</p> : <Missing text={notStated} />,
        ),
      ],
    },
    {
      title: tx('ขนาด|และการเคลื่อนที่', 'Size and movement'),
      rows: [
        figureRow({ id: 'height', label: tx('ความสูง', 'Height'), unit: u.cm, get: (m) => single(m.heightCm), bar: true }, lang),
        figureRow({ id: 'weight', label: tx('น้ำหนัก', 'Weight'), unit: u.kg, get: (m) => m.weightKg }, lang),
        textRow('locomotion', tx('การ|เคลื่อนที่', 'Locomotion'), (m) => L.locomotion[m.locomotion]),
        textRow('category', tx('ประเภท|การใช้งาน', 'Main use'), (m) => (
          <Brief full={L.category[m.category]} brief={L.categoryBrief[m.category]} />
        )),
        stackRow('segment', tx('กลุ่ม|หุ่นยนต์', 'Segment'), (m) => <p className="cmp-prose">{tie(m.segment)}</p>),
      ],
    },
    {
      title: tx('การเคลื่อนไหว', 'Motion'),
      rows: [
        figureRow(
          {
            id: 'dof',
            label: tx('องศา|อิสระ', 'Degrees of freedom'),
            unit: 'DOF',
            get: (m) => m.span.dof,
            rank: { better: 'high', end: 'hi', text: tx('มีองศาอิสระมากที่สุด', 'most degrees of freedom') },
            bar: true,
          },
          lang,
        ),
        stackRow('hands', tx('มือ|หยิบจับ', 'Hands'), (m) => <PerTrim m={m} pick={(t) => handLine(t, lang)} />),
        figureRow(
          {
            id: 'speed',
            label: tx('ความเร็ว|สูงสุด', 'Top speed'),
            unit: u.kmh,
            get: (m) => (m.span.speedMs ? [msToKmh(m.span.speedMs[0]), msToKmh(m.span.speedMs[1])] : null),
            rank: { better: 'high', end: 'hi', text: tx('เคลื่อนที่ได้เร็วที่สุด', 'fastest') },
            // The maker's own figure, in metres per second
            sub: (m) => {
              const s = m.span.speedMs
              if (!s) return null
              return (
                <span className="nowrap" lang="en">
                  {s[0] === s[1] ? formatNumber(s[1]) : `${formatNumber(s[0])}–${formatNumber(s[1])}`} m/s
                </span>
              )
            },
          },
          lang,
        ),
        figureRow(
          {
            id: 'torque',
            label: tx('แรงบิดข้อต่อ|สูงสุด', 'Peak joint torque'),
            unit: 'N·m',
            get: (m) => trimSpan(m, (t) => t.jointTorqueNm),
            missing: notDisclosed,
          },
          lang,
        ),
      ],
    },
    {
      title: tx('พลังงาน', 'Power'),
      rows: [
        figureRow(
          {
            id: 'battery',
            label: tx('ความจุ|แบตเตอรี่', 'Battery capacity'),
            unit: 'Wh',
            get: (m) => m.span.batteryWh,
            bar: true,
            missing: notDisclosed,
          },
          lang,
        ),
        figureRow(
          {
            id: 'runtime',
            label: tx('เวลาใช้งาน|ต่อการชาร์จ', 'Runtime per charge'),
            unit: u.h,
            get: (m) => m.span.runtimeH,
            rank: { better: 'high', end: 'hi', text: tx('ใช้งานต่อการชาร์จได้นานที่สุด', 'longest runtime per charge') },
          },
          lang,
        ),
        figureRow(
          {
            id: 'charge',
            label: tx('เวลาชาร์จ', 'Charging time'),
            unit: u.h,
            get: (m) => single(m.charging.timeH),
            rank: { better: 'low', end: 'lo', text: tx('ชาร์จเสร็จเร็วที่สุด', 'quickest to charge') },
          },
          lang,
        ),
        textRow('swap', tx('แบตเตอรี่|ถอดเปลี่ยนได้', 'Swappable battery'), (m) =>
          m.charging.swappable ? tx('ได้', 'Yes') : tx('ไม่ได้', 'No'),
        ),
      ],
    },
    {
      title: tx('ความสามารถ', 'Abilities'),
      rows: [
        figureRow(
          {
            id: 'payload',
            label: tx('น้ำหนัก|บรรทุก', 'Payload'),
            unit: u.kg,
            get: (m) => m.span.payloadKg,
            rank: { better: 'high', end: 'hi', text: tx('รับน้ำหนักบรรทุกได้มากที่สุด', 'highest payload') },
            bar: true,
          },
          lang,
        ),
        stackRow('compute', tx('ระบบ|ประมวลผล', 'Onboard computer'), (m) => <PerTrim m={m} pick={(t) => t.compute} />),
        stackRow('sensors', tx('เซนเซอร์', 'Sensors'), (m) =>
          m.sensors.length ? <List items={m.sensors} /> : <Missing text={notStated} />,
        ),
        stackRow('software', tx('ซอฟต์แวร์|และ SDK', 'Software and SDK'), (m) => {
          const items = [m.software.sdk, m.software.ai].filter((x) => x != null)
          return items.length ? <List items={items} /> : <Missing text={notStated} />
        }),
      ],
    },
    {
      title: tx('ความปลอดภัย|และการรับประกัน', 'Safety and warranty'),
      rows: [
        stackRow('safety', tx('ระบบ|ความปลอดภัย', 'Safety systems'), (m) =>
          m.safety.features.length ? <List items={m.safety.features} /> : <Missing text={notStated} />,
        ),
        textRow('certs', tx('มาตรฐาน|ที่ได้รับรอง', 'Certifications'), (m) =>
          m.safety.certifications.length ? (
            m.safety.certifications.map((c) => (
              <span key={c} className="cmp-line" lang={langOf(c)}>
                {tie(c)}
              </span>
            ))
          ) : (
            <Missing text={notStated} />
          ),
        ),
        {
          id: 'warranty',
          label: tx('รับประกัน|ตัวหุ่นยนต์', 'Robot warranty'),
          cells: (ms) => {
            const parsed = ms.map((m) => splitWarranty(m.warranty.robot))
            const best = bestOf(
              parsed.map((p) => p?.months ?? null),
              'high',
            )
            return ms.map((m, i) => {
              const p = parsed[i]
              if (!p) return { content: <span className="cmp-text">{tie(m.warranty.robot)}</span> }
              const isBest = best.has(i)
              return {
                best: isBest,
                content: (
                  <span className="cmp-val">
                    <span className="cmp-val__main">
                      {isBest && <span className="cmp-dot" aria-hidden="true" />}
                      <span className="cmp-fig nowrap">{p.time}</span>
                      {isBest && (
                        <span className="visually-hidden">
                          {tx(' (รับประกันนานที่สุดในการเปรียบเทียบนี้)', ' (longest warranty in this comparison)')}
                        </span>
                      )}
                    </span>
                    {p.rest && <span className="cmp-val__sub">{tie(p.rest)}</span>}
                  </span>
                ),
              }
            })
          },
        },
        stackRow('battery-warranty', tx('รับประกัน|แบตเตอรี่', 'Battery warranty'), (m) => (
          <>
            {m.warranty.battery ? <p className="cmp-prose">{tie(m.warranty.battery)}</p> : <Missing text={notStated} />}
            {m.warranty.note && <p className="cmp-prose cmp-prose--small cmp-prose--note">{tie(m.warranty.note)}</p>}
          </>
        )),
      ],
    },
    {
      title: tx('การจำหน่าย', 'Availability'),
      rows: [
        textRow('availability', tx('ช่องทาง|ในไทย', 'Buying in Thailand'), (m) => (
          <Brief full={L.availability[m.availability]} brief={AVAILABILITY_BRIEF[lang][m.availability]} />
        )),
        stackRow('distributor', tx('ผู้จัด|จำหน่าย', 'Distributor'), (m) => (
          <>
            <p className="cmp-prose">{tie(m.distributor)}</p>
            <p className="cmp-prose cmp-prose--small cmp-prose--note">{tie(m.availabilityNote)}</p>
          </>
        )),
        {
          id: 'maker-rank',
          label:
            lang === 'en'
              ? `Maker ranking by shipments${shipPeriod ? ` (${shipPeriod})` : ''}`
              : shipPeriod
                ? `อันดับผู้ผลิต|ตามยอดส่งมอบ |${shipPeriod}`
                : 'อันดับผู้ผลิต|ตามยอดส่งมอบ',
          cells: (ms) => {
            const best = bestOf(
              ms.map((m) => m.makerRank),
              'low',
            )
            return ms.map((m, i) => {
              if (m.makerRank == null) return { content: <Missing text={tx('ไม่อยู่ในอันดับ', 'Not ranked')} /> }
              const entry = shipmentOf(m)
              const isBest = best.has(i)
              return {
                best: isBest,
                content: (
                  <span className="cmp-val">
                    <span className="cmp-val__main">
                      {isBest && <span className="cmp-dot" aria-hidden="true" />}
                      <span className="cmp-fig nowrap">{tx(`อันดับ ${m.makerRank}`, `No. ${m.makerRank}`)}</span>
                      {isBest && (
                        <span className="visually-hidden">
                          {tx(' (ผู้ผลิตที่ส่งมอบได้มากที่สุดในการเปรียบเทียบนี้)', ' (the maker that shipped the most in this comparison)')}
                        </span>
                      )}
                    </span>
                    {entry && sharesRank(entry.units) && <span className="cmp-val__sub">{tx('อันดับร่วม', 'Joint rank')}</span>}
                    {entry && (
                      <span className="cmp-val__sub">
                        <span className="nowrap">
                          {formatNumber(entry.units)} {u.robots}
                        </span>
                      </span>
                    )}
                  </span>
                ),
              }
            })
          },
        },
        textRow('origin', tx('สัญชาติ|แบรนด์', 'Brand origin'), (m) => m.originCountry),
        textRow('launch', tx('เริ่ม|วางจำหน่าย', 'On sale since'), (m) => <MonthText yyyyMm={m.launched} />),
      ],
    },
    {
      title: tx('ข้อดี|และข้อควรพิจารณา', 'Strengths and trade-offs'),
      rows: [
        stackRow('pros', tx('ข้อดี', 'Strengths'), (m) => <List items={m.pros} />),
        stackRow('cons', tx('ข้อจำกัด', 'Limitations'), (m) => <List items={m.cons} />),
        stackRow('ideal', tx('เหมาะกับ', 'Best for'), (m) => <List items={m.idealFor} />),
      ],
    },
  ]
}

/* ---------- Controls ---------- */

/** A select plus an explicit button: browsing the options with arrow keys must not add anything. */
function AddModel({ exclude, onAdd, full }: { exclude: string[]; onAdd: (id: string) => void; full: boolean }) {
  const tx = txFor(useLang())
  const id = useId()
  const [choice, setChoice] = useState('')
  const options = models.filter((m) => !exclude.includes(m.id))
  const value = options.some((m) => m.id === choice) ? choice : ''
  return (
    <div className="cmp-add">
      <div className="cmp-add__field">
        <label htmlFor={id}>{tx('เพิ่มรุ่น', 'Add a model')}</label>
        <span className="cmp-add__select">
          <select id={id} value={value} disabled={full} onChange={(e) => setChoice(e.target.value)} data-cmp-add>
            <option value="">{full ? tx(`ครบ ${COMPARE_LIMIT} รุ่นแล้ว`, `${COMPARE_LIMIT} models chosen`) : tx('เลือกรุ่น', 'Choose a model')}</option>
            {options.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nameEn}
              </option>
            ))}
          </select>
          <ChevronDown size={16} aria-hidden />
        </span>
      </div>
      <button
        type="button"
        className="btn btn-primary cmp-add__btn"
        disabled={full || !value}
        onClick={() => {
          onAdd(value)
          setChoice('')
          // This button disables itself; continue at the newly added column.
          focusSoon(() => [...document.querySelectorAll<HTMLElement>('.cmp-model__name')].at(-1), '[data-cmp-add]')
        }}
      >
        <Plus size={18} aria-hidden />
        {tx('เพิ่ม', 'Add')}
      </button>
    </div>
  )
}

/** Shown until two models are chosen — a comparison needs at least two columns. */
function StartPicker({ ids, toggle }: { ids: string[]; toggle: (id: string) => void }) {
  const lang = useLang()
  const tx = txFor(lang)
  const uid = useId()
  const root = useRef<HTMLElement>(null)
  useReveal(root)
  return (
    <section className="cmp-start" aria-labelledby={`${uid}-title`} ref={root}>
      <div className="cmp-start__head">
        <h2 id={`${uid}-title`} className="cmp-start__title">
          {ids.length === 0 ? (
            lang === 'en' ? (
              'Choose at least two models to compare'
            ) : (
              <>
                <span className="nowrap">เลือกอย่างน้อย 2 รุ่น</span> <span className="nowrap">เพื่อเริ่มเปรียบเทียบ</span>
              </>
            )
          ) : (
            tx('เลือกอีกอย่างน้อย 1 รุ่น', 'Choose at least one more model')
          )}
        </h2>
        {lang === 'en' ? (
          <p className="cmp-start__hint">
            Press a model to choose it or take it off, up to {COMPARE_LIMIT}, or use “Add to compare” on the{' '}
            <Link to="/">robots</Link> page.
          </p>
        ) : (
          <p className="cmp-start__hint">
            กดที่รุ่นเพื่อเลือกหรือยกเลิก ได้สูงสุด {COMPARE_LIMIT} รุ่น หรือใช้ปุ่ม{' '}
            <span className="nowrap">“เพิ่มเพื่อเปรียบเทียบ”</span> ในหน้า<Link to="/">หุ่นยนต์</Link>
          </p>
        )}
      </div>
      <ul className="cmp-picks">
        {models.map((m, i) => {
          const on = ids.includes(m.id)
          const cheapest = firstPriced(m)
          const price = cheapest?.priceTHB ?? null
          return (
            <li key={m.id} data-reveal>
              <button
                type="button"
                className="cmp-pick"
                aria-pressed={on}
                aria-describedby={price != null ? `${uid}-price-${i}` : undefined}
                data-pick={i}
                data-pick-id={m.id}
                onClick={() => {
                  toggle(m.id)
                  // The grid may give way to the table; keep focus on something real.
                  focusSoon(`[data-pick-id="${m.id}"]`, '[data-cmp-add]', '#main h1')
                }}
              >
                <span className="cmp-pick__stage">
                  <Picture
                    src={m.image.srcSmall}
                    alt=""
                    sizes="56px"
                    width={56}
                    height={56}
                    style={photoStyle(m.image)}
                  />
                </span>
                <span className="cmp-pick__text">
                  <span className="cmp-pick__brand" lang="en" aria-hidden="true">
                    {m.brand}
                  </span>
                  <span className="cmp-pick__name" lang="en">
                    <Name text={m.nameEn} />
                  </span>
                  {price != null && (
                    <span className="cmp-pick__price" id={`${uid}-price-${i}`} aria-hidden="true">
                      <span className="cmp-pick__from">{tx('เริ่มต้น ', 'From ')}</span>
                      {cheapest?.priceBasis === 'converted' && tx('ประมาณ ', 'about ')}
                      <span className="nowrap">{formatNumber(price)}</span>
                      <span className="visually-hidden"> {units(lang).baht}</span>
                    </span>
                  )}
                </span>
                <span className="cmp-pick__mark" aria-hidden="true">
                  {on ? <Check size={16} strokeWidth={2.5} /> : <Plus size={16} />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ---------- Page ---------- */

export function ComparePage() {
  const lang = useLang()
  const tx = txFor(lang)
  const u = units(lang)
  const mk = useMemo(() => localizedMarket(market, lang), [lang])
  const groups = useMemo(() => groupsFor(lang, mk), [lang, mk])
  const { ids, toggle, remove, clear, isFull } = useCompare()
  useTitle(tx('เปรียบเทียบรุ่น', 'Compare models'))
  const selected = ids
    .map(getModel)
    .filter((m) => m != null)
    .map((m) => localized(m, lang))
  const cols = selected.length
  // The rates the notes explain: only the currencies this comparison's prices were converted from
  const rates = FX_ORDER.filter((c) => selected.some((m) => convertedFrom(m).includes(c)))
  const shipments = mk.shipments[0]
  const dataMonth = monthText(market.asOf, lang, true)

  const removeAt = (index: number, id: string) => {
    remove(id)
    focusSoon(
      () => document.querySelectorAll<HTMLElement>('.cmp-model__remove')[index] ?? null,
      () => document.querySelectorAll<HTMLElement>('.cmp-model__remove')[index - 1] ?? null,
      // Down to one model: the picker returns, so land on the model just removed to undo easily.
      `[data-pick-id="${id}"]`,
      '#main h1',
    )
  }

  const clearAll = () => {
    clear()
    focusSoonQuietly('[data-pick="0"]', '#main h1')
  }

  // On phones each row's label sits on a line of its own above the values (CSS hides it on wider
  // screens); the row header stays in the table for screen readers.
  const labelRow = (r: Row, first: boolean) => (
    <tr className={first ? 'cmp-rowlabel is-first' : 'cmp-rowlabel'} aria-hidden="true">
      <td colSpan={cols + 1}>
        <Phrases text={r.label} />
        {r.unit && ` (${r.unit})`}
      </td>
    </tr>
  )

  // The first row of a group has no hairline above it: the grey panel starts there.
  const renderRow = (r: Row, first: boolean) => {
    const cells = r.cells(selected)
    const note = r.after?.(selected)
    const rowClass = (extra?: string) => ['cmp-row', extra, first && 'is-first'].filter(Boolean).join(' ')
    return (
      <Fragment key={r.id}>
        {labelRow(r, first)}
        {r.stack ? (
          <>
            {/* Phones swap the columns, which chop Thai sentences apart, for one cell spanning every
                column that holds a block per model. CSS shows only one of the two rows. */}
            <tr className={rowClass('cmp-row--stack')}>
              <th scope="row">
                <Phrases text={r.label} />
              </th>
              <td colSpan={cols}>
                <dl className="cmp-stack">
                  {selected.map((m, i) => (
                    <div key={m.id}>
                      <dt>
                        <Picture src={m.image.srcSmall} alt="" sizes="28px" width={28} height={28} style={photoStyle(m.image)} />
                        <span lang="en">
                          <Name text={m.nameEn} />
                        </span>
                      </dt>
                      <dd>{cells[i].content}</dd>
                    </div>
                  ))}
                </dl>
              </td>
            </tr>
            <tr className={rowClass('cmp-row--cols')}>
              <th scope="row">
                <Phrases text={r.label} />
              </th>
              {selected.map((m, i) => (
                <td key={m.id}>{cells[i].content}</td>
              ))}
            </tr>
          </>
        ) : (
          <tr className={rowClass()}>
            <th scope="row">
              <Phrases text={r.label} />
            </th>
            {selected.map((m, i) => (
              <td key={m.id} className={cells[i].best ? 'is-best' : undefined}>
                {cells[i].content}
              </td>
            ))}
          </tr>
        )}
        {note && (
          <tr className="cmp-caution">
            <td colSpan={cols + 1}>
              <p>{note}</p>
            </td>
          </tr>
        )}
      </Fragment>
    )
  }

  return (
    <>
      {/* A short dark stage: the site header floats over it on desktop (see Layout.css) */}
      <header className="cmp-cover stage on-navy">
        <div className="container cmp-cover__inner">
          <div>
            <h1>
              {tx('เปรียบเทียบ', 'Compare')}
              <br />
              <span className="tint">{tx('รุ่นต่อรุ่น', 'model by model')}</span>
            </h1>
          </div>
          <div className="cmp-cover__aside">
            <p className="cmp-cover__lede">
              {lang === 'en' ? (
                <>
                  Price, movement, power, abilities and warranty, side by side, row by row. Choose up to{' '}
                  {COMPARE_LIMIT} models.
                </>
              ) : (
                <>
                  {tie('วางราคา การเคลื่อนไหว พลังงาน ความสามารถ และการรับประกันเทียบกันทีละแถว')}{' '}
                  <span className="nowrap">เลือกได้สูงสุด {COMPARE_LIMIT} รุ่น</span>
                </>
              )}
            </p>
            <div className="cmp-cover__actions">
              <p className="cmp-cover__meta">
                {tx('ข้อมูล ณ', 'Data as of')} <span className="nowrap">{monthText(market.asOf, lang)}</span>
              </p>
              {cols > 0 && (
                <button type="button" className="btn btn-ghost btn-sm cmp-cover__clear" onClick={clearAll}>
                  <X size={16} aria-hidden />
                  {tx('ล้างรายการ', 'Clear list')}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container cmp-body">
        {cols < 2 ? (
          <StartPicker ids={ids} toggle={toggle} />
        ) : (
          <>
            <div className="cmp-tools">
              <AddModel exclude={ids} onAdd={toggle} full={isFull} />
              <p className="cmp-legend">
                <span className="cmp-dot" aria-hidden="true" />
                {tx('ค่าที่เด่นที่สุดของแถวในการเปรียบเทียบนี้', 'Best figure in the row for this comparison')}
              </p>
            </div>

            <div className="cmp-sheet">
              <table className="cmp-table" style={{ '--cols': cols } as CSSProperties}>
                <caption className="visually-hidden">
                  {tx('เปรียบเทียบสเปกและราคา', 'Specs and prices compared:')} {selected.map((m) => m.nameEn).join(', ')}
                </caption>
                <thead>
                  <tr>
                    <td className="cmp-corner">
                      <div className="cmp-corner__inner" aria-hidden="true">
                        <span className="cmp-corner__count">{tx(`เทียบ ${cols} รุ่น`, `${cols} models`)}</span>
                        <span className="cmp-corner__date">
                          {tx('ข้อมูล ณ', 'Data as of')} <span className="nowrap">{dataMonth}</span>
                        </span>
                      </div>
                    </td>
                    {selected.map((m, i) => (
                      // aria-label keeps the column header to the model name, not the buttons' text
                      <th key={m.id} scope="col" aria-label={m.nameEn}>
                        <div className="cmp-model">
                          <span className="cmp-model__stage">
                            <Picture src={m.image.srcSmall} alt="" sizes="(max-width: 720px) 33vw, 240px" style={photoStyle(m.image)} />
                          </span>
                          <button
                            type="button"
                            className="cmp-model__remove"
                            onClick={() => removeAt(i, m.id)}
                            aria-label={tx(`นำ ${m.nameEn} ออกจากรายการเปรียบเทียบ`, `Remove ${m.nameEn} from the comparison`)}
                          >
                            <X size={16} aria-hidden />
                          </button>
                          <span className="cmp-model__brand" lang="en">
                            {m.brand}
                          </span>
                          <Link to={`/models/${m.id}`} className="cmp-model__name" lang="en">
                            <Name text={m.nameEn} />
                          </Link>
                          <Link to={`/configure/${m.id}`} className="cmp-model__configure">
                            <SlidersHorizontal size={14} aria-hidden />
                            <span>{tx('จัดสเปกและขอใบเสนอราคา', 'Configure and get a quote')}</span>
                            <span className="visually-hidden"> {m.nameEn}</span>
                          </Link>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                {groups.map((g) => (
                  <tbody key={g.title}>
                    <tr className="cmp-group">
                      <th scope="rowgroup" colSpan={cols + 1}>
                        <Phrases text={g.title} />
                      </th>
                    </tr>
                    {g.rows.map((r, ri) => renderRow(r, ri === 0))}
                  </tbody>
                ))}
              </table>
            </div>

            <section className="cmp-notes" aria-labelledby="cmp-notes-title">
              <h2 id="cmp-notes-title" className="cmp-notes__title">
                {tx('หมายเหตุ', 'Notes')}
              </h2>
              {lang === 'en' ? (
                <ol>
                  <li>
                    Thai dealer prices are those Thai distributors publish; ask whether VAT is included.
                    {rates.length > 0 && (
                      <>
                        {' '}
                        Prices marked “approx.” are converted from the maker’s price at{' '}
                        {rates.map((c, k) => (
                          <Fragment key={c}>
                            {k > 0 && (k === rates.length - 1 ? ' and ' : ', ')}
                            <span className="nowrap">
                              {formatNumber(FX[c])} {u.baht}
                            </span>{' '}
                            per {c}
                          </Fragment>
                        ))}{' '}
                        on <span className="nowrap">{dayText(market.fx.date, lang)}</span>, and exclude shipping and import
                        taxes.
                      </>
                    )}
                  </li>
                  <li>
                    Every spec is the maker’s published figure, and makers measure in different ways and conditions:
                    runtime per charge depends on the job, and payload may be measured on one arm or two. Use them as a
                    guide only. Speeds are converted from metres per second (m/s) to kilometres per hour.
                  </li>
                  <li>
                    <span className="cmp-dot cmp-dot--inline" aria-hidden="true" />
                    The dark square before a figure marks the best one in its row. It isn’t shown when a model doesn’t
                    publish the figure, when every model ties, or when prices come from different sources. The dark part of
                    a bar is the lowest trim’s figure; the light part runs on to the highest trim.
                  </li>
                  {shipments && (
                    <li>
                      Makers are ranked by the number of humanoid robots each brand shipped worldwide in {shipments.period}.
                      {shipments.note && ` ${shipments.note}`} See the <Link to="/sources">sources</Link> page for details.
                    </li>
                  )}
                </ol>
              ) : (
                <ol>
                  <li>
                    ราคาตัวแทนในไทยเป็นราคาที่ผู้จัดจำหน่ายในไทยประกาศ ควรสอบถามว่ารวมภาษีมูลค่าเพิ่มแล้วหรือไม่
                    {rates.length > 0 && (
                      <>
                        {' '}
                        ส่วนราคาที่ระบุว่า “ประมาณ” แปลงจากราคาของผู้ผลิตที่อัตรา{' '}
                        {rates.map((c, k) => (
                          <Fragment key={c}>
                            {k > 0 && (k === rates.length - 1 ? ' และ ' : ' ')}
                            <span className="nowrap">{formatNumber(FX[c])} บาท</span>ต่อ{labels(lang).currency[c]}
                          </Fragment>
                        ))}{' '}
                        ณ วันที่ <span className="nowrap">{dayText(market.fx.date, lang)}</span>{' '}
                        ซึ่งยังไม่รวมค่าขนส่งและภาษีนำเข้า
                      </>
                    )}
                  </li>
                  <li>
                    สเปกทุกค่าเป็นตัวเลขที่ผู้ผลิตประกาศ ซึ่งแต่ละรายวัดด้วยวิธีและเงื่อนไขต่างกัน เช่น
                    เวลาใช้งานต่อการชาร์จขึ้นกับงานที่หุ่นยนต์ทำ และน้ำหนักบรรทุกอาจวัดที่แขนข้างเดียวหรือสองข้าง
                    จึงควรใช้เทียบกันเป็นแนวทางเท่านั้น ส่วนความเร็วแปลงจากเมตรต่อวินาที (<span lang="en">m/s</span>)
                    เป็นกิโลเมตรต่อชั่วโมง
                  </li>
                  <li>
                    <span className="cmp-dot cmp-dot--inline" aria-hidden="true" />
                    สี่เหลี่ยมสีเข้มหน้าตัวเลขระบุค่าที่เด่นที่สุดของแถว จะไม่แสดงเมื่อมีรุ่นที่ไม่เปิดเผยข้อมูล ทุกรุ่นเท่ากัน
                    หรือราคามาจากต่างแหล่งกัน แถบสีเข้มแสดงค่าของรุ่นย่อยต่ำสุด ส่วนสีอ่อนต่อไปถึงรุ่นย่อยสูงสุด
                  </li>
                  {shipments && (
                    <li>
                      อันดับผู้ผลิตเรียงตามจำนวนหุ่นยนต์ฮิวแมนนอยด์ที่แต่ละแบรนด์ส่งมอบทั่วโลก{' '}
                      {shipments.period}
                      {shipments.note && ` ${shipments.note}`} ดูรายละเอียดได้ที่หน้า
                      <Link to="/sources">แหล่งข้อมูล</Link>
                    </li>
                  )}
                </ol>
              )}
            </section>
          </>
        )}
      </div>
    </>
  )
}
