import { Fragment, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  Check,
  ChevronRight,
  CircleAlert,
  Lightbulb,
  Plus,
  ThumbsUp,
  Trophy,
} from 'lucide-react'
import { CountUp } from '../components/CountUp'
import { Gallery, type Slide } from '../components/Gallery'
import { Picture } from '../components/Picture'
import { Reviews } from '../components/Reviews'
import { Tabs, type TabItem } from '../components/Tabs'
import { getModel, market, models, type ModelWithGallery } from '../data'
import { useLang, type Lang } from '../i18n'
import { localized, localizedMarket } from '../i18n/content'
import { langOf, useTitle } from '../lib/a11y'
import { dayText, labels, langFor, monthText, pick, units } from '../lib/bilingual'
import { COMPARE_LIMIT, useCompare } from '../lib/compare'
import { formatNumber, msToKmh } from '../lib/format'
import type { Availability, Currency, Market, Model, Range, Trim } from '../lib/types'
import { useInView } from '../lib/motion'
import { photoStyle } from '../lib/photo'
import { ModelExtras, TrimStock } from './ModelPage.extras'
import { NotFoundPage } from './NotFoundPage'
import './ModelPage.css'

/* ---------------------------------------------------------------------------------------------
   Figures. A spec sheet quotes the maker's numbers as published (0.75 m/s, 2.5 ชั่วโมง); speeds are
   given in km/h, the figure Thai readers picture, with the maker's m/s beside them. Every piece of copy
   comes in Thai and English (`tx(thai, english)`); the English page reads the English catalogue text.
--------------------------------------------------------------------------------------------- */

type Tx = <T>(th: T, en: T) => T
const txFor = (lang: Lang): Tx => (th, en) => pick(lang, th, en)

/** "23–43", or "35" when both ends match. */
const spanText = ([min, max]: Range) => (min === max ? formatNumber(min) : `${formatNumber(min)}–${formatNumber(max)}`)

const kmh = ([min, max]: Range): Range => [msToKmh(min), msToKmh(max)]

/** The adult every robot stands beside in the height diagram, cm. */
const ADULT_CM = 170

const NBSP = String.fromCharCode(0xa0)
// Zero-width word joiner: forbids a line break where it sits, invisible and silent
const WJ = String.fromCharCode(0x2060)

// Units (and month names) a figure must never be parted from at a line end ("2 / ชั่วโมง" or
// "4–8 / สัปดาห์" reads as a typo in Thai)
const UNIT_AFTER =
  /(\d) (?=ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|ปี|เดือน|สัปดาห์|วัน|ชั่วโมง|ชม\.|นาที|วินาที|ซม\.|มม\.|เมตร|กม\.|กก\.|กิโลกรัม|kWh|Wh|วัตต์|โวลต์|N·m|Nm|m\/s|องศาอิสระ|องศา|DOF|ข้อต่อ|ข้าง|นิ้ว|ตัว|ชิ้น|คอร์|TOPS|GB|บาท|ดอลลาร์|หยวน|ยูโร|แสน|ล้าน|ครั้ง|รุ่น|ภาษา|cm|kg|km\/h|hours?|minutes?|months?|years?|kW|V\b|W\b)/g

/**
 * Prose from the research notes, with a no-break space between each figure and its unit and
 * before a Buddhist-era year ("ตุลาคม 2569"), and figure ranges ("4–8", "90,000–120,000") held
 * together, so no line ends on a bare number or a dangling dash.
 */
const tidy = (text: string) =>
  text
    .replace(UNIT_AFTER, `$1${NBSP}`)
    .replace(/ (25\d\d)(?!\d)/g, `${NBSP}$1`)
    .replace(/(\d)–(\d)/g, `$1${WJ}–${WJ}$2`)

const unique = <T,>(xs: (T | null)[]) => [...new Set(xs.filter((x): x is T => x != null))]

/** Min–max of one trim figure, skipping trims that don't publish it. */
function spanOf(trims: Trim[], pick: (t: Trim) => number | null): Range | null {
  const xs = trims.map(pick).filter((x): x is number => x != null)
  return xs.length ? [Math.min(...xs), Math.max(...xs)] : null
}

/** A figure with its unit set smaller, as on a price tag; the figure itself never breaks. */
function Figure({ value, unit }: { value: string; unit: string }) {
  return (
    <>
      <span className="nowrap">{value}</span> <span className="mp-unit">{unit}</span>
    </>
  )
}

function Baht({ n }: { n: number }) {
  return <Figure value={formatNumber(n)} unit={units(useLang()).baht} />
}

/**
 * A key-figure readout: the figure (or both ends of a range) counts up once the band is in view, like
 * an instrument settling. Reads the same as <Figure> for screen readers and with motion off.
 */
function Readout({ range: [min, max], unit, play }: { range: Range; unit?: string; play: boolean }) {
  return (
    <>
      <span className="nowrap">
        <CountUp value={min} play={play} />
        {min !== max && (
          <>
            –<CountUp value={max} play={play} />
          </>
        )}
      </span>
      {unit && (
        <>
          {' '}
          <span className="mp-unit">{unit}</span>
        </>
      )}
    </>
  )
}

/**
 * Spec labels break only between their phrases, never inside a Thai word, which Chrome's line
 * breaker would otherwise do in a narrow label column. A space is a break that keeps its space
 * ("ราคา (บาท)"); "|" is one without, as Thai is set ("เวลาใช้งาน|ต่อการชาร์จ").
 */
function Words({ text }: { text: string }) {
  return (
    <>
      {/* The space stays outside the no-wrap span, or it would not be a break opportunity */}
      {text.split(' ').map((word, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          {word.split('|').map((phrase, k) => (
            <Fragment key={k}>
              {k > 0 && <wbr />}
              <span className="nowrap">{phrase}</span>
            </Fragment>
          ))}
        </Fragment>
      ))}
    </>
  )
}

/** A label as it reads aloud and as a React key: the "|" break marks removed. */
const plainLabel = (label: string) => label.replaceAll('|', '')

/**
 * "H1 (รุ่นวิจัย)": the bracketed part never breaks, so a narrow header wraps before it
 * ("H1 / (รุ่นวิจัย)") rather than inside it ("(รุ่น / วิจัย)").
 */
function TrimName({ name }: { name: string }) {
  const m = name.match(/^(.*\S)\s+(\([^()]+\))$/)
  if (!m) return <>{name}</>
  return (
    <>
      {m[1]} <span className="mp-trimname-note">{m[2]}</span>
    </>
  )
}

/** Anything the maker's spec sheet leaves out. */
function Missing({ text }: { text?: string }) {
  const lang = useLang()
  return <span className="mp-missing">{text ?? pick(lang, 'ไม่ระบุ', 'Not stated')}</span>
}

/* ---------------------------------------------------------------------------------------------
   Prices. A baht figure is either a Thai dealer's own price or the maker's list price converted at
   the catalogue's rate; a conversion always reads "ประมาณ" and keeps the maker's price beside it.
--------------------------------------------------------------------------------------------- */

/** Baht per unit of each currency a maker may quote in. */
const FX: Record<Currency, number> = { THB: 1, USD: market.fx.usd, CNY: market.fx.cny, EUR: market.fx.eur }

/** "1 ดอลลาร์สหรัฐ = 32.74 บาท", breaking only at the equals sign. */
function Rate({ currency }: { currency: Currency }) {
  const lang = useLang()
  return (
    <>
      <span className="nowrap">1 {labels(lang).currency[currency].replace(/s$/, lang === 'en' ? '' : 's')}</span>{' '}
      <span className="nowrap">
        = {formatNumber(FX[currency])} {units(lang).baht}
      </span>
    </>
  )
}

/** The exchange rates a model's conversions use, joined: "1 ดอลลาร์สหรัฐ = 32.74 บาท และ …". */
function Rates({ currencies }: { currencies: Currency[] }) {
  const lang = useLang()
  return (
    <>
      {currencies.map((c, i) => (
        <Fragment key={c}>
          {i > 0 && pick(lang, ' และ ', ' and ')}
          <Rate currency={c} />
        </Fragment>
      ))}
    </>
  )
}

/** How a model's prices are quoted: which trims are Thai dealer prices and which are conversions. */
function pricingOf(m: Model) {
  const priced = m.trims.filter((t) => t.priceTHB != null).sort((a, b) => a.priceTHB! - b.priceTHB!)
  const converted = priced.filter((t) => t.priceBasis === 'converted' && t.listPrice != null)
  return {
    priced,
    converted,
    dealer: priced.filter((t) => t.priceBasis === 'dealer'),
    // Each end of the price span says for itself whether it is approximate
    lowApprox: priced[0]?.priceBasis === 'converted',
    highApprox: priced[priced.length - 1]?.priceBasis === 'converted',
    currencies: unique(converted.map((t) => t.listPrice?.currency ?? null)).filter((c) => c !== 'THB'),
  }
}

/** True when a model's starting price is a conversion (the pager and the price tag say "ประมาณ"). */
const startsApprox = (m: Model) => pricingOf(m).lowApprox

/** A trim's baht price, without the unit (the row label carries it). */
function TrimPrice({ t }: { t: Trim }) {
  const tx = txFor(useLang())
  if (t.priceTHB == null) return <Missing text={tx('ยังไม่ประกาศ', 'Not announced')} />
  return (
    <>
      {t.priceBasis === 'converted' && <span className="mp-approx">{tx('ประมาณ ', 'about ')}</span>}
      <span className="nowrap">{formatNumber(t.priceTHB)}</span>
    </>
  )
}

/* ---------------------------------------------------------------------------------------------
   The maker's rank
--------------------------------------------------------------------------------------------- */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/**
 * The maker's line in the global shipment ranking, matched the way the data build ranks it (on the
 * brand, with any suffix allowed: "Booster" for "Booster Robotics"). The figure covers every model
 * the brand ships, not this one alone. The period reads in the page's language.
 */
function rankOf(m: Model, mk: Market) {
  if (m.makerRank == null) return null
  const brand = norm(m.brand)
  const entry = brand
    ? mk.shipments.find((r) => {
        const label = norm(r.brand)
        return label === brand || label.startsWith(brand) || brand.startsWith(label)
      })
    : undefined
  return {
    rank: m.makerRank,
    tied: entry ? mk.shipments.filter((r) => r.units === entry.units).length > 1 : false,
    units: entry?.units ?? null,
    period: entry?.period ?? mk.shipments[0]?.period ?? null,
  }
}

/* ---------------------------------------------------------------------------------------------
   Height diagram: the robot beside an adult, both drawn to scale on one floor line
--------------------------------------------------------------------------------------------- */

/** An adult, drawn 100 units tall on a 40-unit sheet; the diagram scales it to 170 cm. */
function AdultShape() {
  return (
    <svg viewBox="0 0 40 100" preserveAspectRatio="xMidYMax meet">
      <circle cx="20" cy="7" r="6.5" />
      <rect x="17.6" y="12" width="4.8" height="5" />
      <path d="M11.5 16h17q2.5 0 2.5 2.5L28.5 50h-17L9 18.5q0-2.5 2.5-2.5z" />
      <path d="M9.6 19 6.6 58M30.4 19l3 39" fill="none" stroke="currentColor" strokeWidth="4.4" strokeLinecap="round" />
      <path d="M11.6 48.5h7.9l-.9 48.5h-5.2zM20.5 48.5h7.9L26.6 97h-5.2z" />
      <rect x="12" y="96" width="7.6" height="4" rx="1.6" />
      <rect x="20.4" y="96" width="7.6" height="4" rx="1.6" />
    </svg>
  )
}

/** A humanoid robot on the same sheet: a visored head, jointed limbs, and legs or a wheeled base. */
function RobotShape({ wheels }: { wheels: boolean }) {
  return (
    <svg viewBox="0 0 40 100" preserveAspectRatio="xMidYMax meet">
      <rect x="14" y="0.5" width="12" height="12" rx="3.5" />
      <rect className="mp-height__visor" x="15.8" y="4.2" width="8.4" height="3.8" rx="1.9" />
      <rect x="18.2" y="12" width="3.6" height="4" />
      <path d="M11 15.5h18l1.6 9.5-3.1 21h-15L10 25z" />
      <rect x="13" y="46" width="14" height="7" rx="1.5" />
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path d="M9.4 18.5 7.8 37M30.6 18.5l1.6 18.5" strokeWidth="4.4" />
        <path d="M7.8 38 7.4 55M32.2 38l.4 17" strokeWidth="3.6" />
      </g>
      <circle cx="7.8" cy="37.5" r="2.6" />
      <circle cx="32.2" cy="37.5" r="2.6" />
      <circle cx="7.3" cy="57" r="2.4" />
      <circle cx="32.7" cy="57" r="2.4" />
      {wheels ? (
        <>
          <rect x="16.5" y="52" width="7" height="26" rx="1.5" />
          <rect x="6" y="76" width="28" height="15" rx="4" />
          <circle cx="11.5" cy="93.5" r="6.5" />
          <circle cx="28.5" cy="93.5" r="6.5" />
        </>
      ) : (
        <>
          <g fill="none" stroke="currentColor">
            <path d="M16.2 52v22M23.8 52v22" strokeWidth="5.4" />
            <path d="M16.2 77v19M23.8 77v19" strokeWidth="4.4" />
          </g>
          <circle cx="16.2" cy="75.5" r="3" />
          <circle cx="23.8" cy="75.5" r="3" />
          <rect x="12" y="95" width="7.6" height="5" rx="1.4" />
          <rect x="20.4" y="95" width="7.6" height="5" rx="1.4" />
        </>
      )}
    </svg>
  )
}

/**
 * The robot and a 170 cm adult side by side, to scale, with a rule every 50 cm. The drawing is
 * decoration; the caption under it says the same in words.
 */
function HeightScale({ m }: { m: Model }) {
  const lang = useLang()
  const tx = txFor(lang)
  const u = units(lang)
  const tallest = Math.max(m.heightCm, ADULT_CM)
  const top = Math.max(200, Math.ceil((tallest + 15) / 50) * 50)
  const steps = Array.from({ length: top / 50 + 1 }, (_, i) => i * 50)
  const diff = Math.round(m.heightCm - ADULT_CM)
  const pose = m.locomotion === 'wheels' ? tx('ในท่าทำงานปกติ ', ' in its normal working pose') : ''
  const caption =
    lang === 'en'
      ? `is ${formatNumber(m.heightCm)} cm tall${pose}, ${
          diff === 0
            ? `the same as a ${ADULT_CM} cm adult`
            : `${formatNumber(Math.abs(diff))} cm ${diff < 0 ? 'shorter' : 'taller'} than a ${ADULT_CM} cm adult`
        }.`
      : `สูง ${formatNumber(m.heightCm)} ซม. ${pose}${
          diff === 0
            ? `เท่ากับผู้ใหญ่ที่สูง ${ADULT_CM} ซม.`
            : `${diff < 0 ? 'เตี้ยกว่า' : 'สูงกว่า'}ผู้ใหญ่ที่สูง ${ADULT_CM} ซม. อยู่ ${formatNumber(Math.abs(diff))} ซม.`
        }`

  return (
    <figure className="mp-height">
      <div className="mp-height__chart" aria-hidden="true">
        {steps.map((s) => (
          <span key={s} className="mp-height__step" style={{ ['--at' as string]: s / top }}>
            <span>{formatNumber(s)}</span>
          </span>
        ))}
        <div className="mp-height__figure mp-height__figure--robot" style={{ ['--h' as string]: m.heightCm / top }}>
          <span className="mp-height__label">
            {formatNumber(m.heightCm)} {u.cm}
          </span>
          <RobotShape wheels={m.locomotion === 'wheels'} />
          <span className="mp-height__name" lang={langOf(m.nameEn)}>
            {m.nameEn}
          </span>
        </div>
        <div className="mp-height__figure mp-height__figure--adult" style={{ ['--h' as string]: ADULT_CM / top }}>
          <span className="mp-height__label">
            {ADULT_CM} {u.cm}
          </span>
          <AdultShape />
          <span className="mp-height__name">{tx('ผู้ใหญ่', 'Adult')}</span>
        </div>
      </div>
      <figcaption>
        <span lang={langOf(m.nameEn)}>{m.nameEn}</span> {tidy(caption)}
      </figcaption>
    </figure>
  )
}

/* ---------------------------------------------------------------------------------------------
   Tab panels
--------------------------------------------------------------------------------------------- */

function Overview({ m }: { m: Model }) {
  const tx = txFor(useLang())
  return (
    <div className="mp-overview">
      <section className="mp-card mp-story" aria-labelledby="mp-story-title">
        <h3 id="mp-story-title" className="mp-subhead">
          {tx('ความเป็นมา', 'Background')}
        </h3>
        <p>{tidy(m.background)}</p>
        {m.funFact && (
          <div className="mp-fact" role="note">
            <span className="mp-fact__icon" aria-hidden="true">
              <Lightbulb size={20} />
            </span>
            <p>
              <strong>{tx('รู้หรือไม่', 'Did you know?')}</strong> <span className="mp-fact__text">{tidy(m.funFact)}</span>
            </p>
          </div>
        )}
      </section>
      <section className="mp-card mp-highlights" aria-labelledby="mp-highlights-title">
        <h3 id="mp-highlights-title" className="mp-subhead">
          {tx('จุดเด่น', 'Highlights')}
        </h3>
        <ul className="mp-numlist">
          {m.highlights.map((h) => (
            <li key={h}>{tidy(h)}</li>
          ))}
        </ul>
      </section>
      <section className="mp-card mp-uses" aria-labelledby="mp-uses-title">
        <div className="mp-card__head">
          <h3 id="mp-uses-title" className="mp-subhead">
            {tx('งานที่ใช้', 'Uses')}
          </h3>
          <p className="mp-card__meta">{tx('งานที่ผู้ผลิตจำหน่ายหรือสาธิต', 'What the maker sells or demonstrates it for')}</p>
        </div>
        <ul className="mp-ticks mp-ticks--grid">
          {m.useCases.map((u) => (
            <li key={u}>{tidy(u)}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}

interface TrimRow {
  /** "|" marks where a Thai label may break without a space */
  label: string
  render: (t: Trim) => ReactNode
  /** Free text that needs the card's full width on phones */
  wide?: boolean
}

function trimGroups(lang: Lang): { title: string; rows: TrimRow[] }[] {
  const tx = txFor(lang)
  const u = units(lang)
  const L = labels(lang)
  return [
    {
      title: tx('ราคา', 'Price'),
      rows: [
        { label: tx('ราคา (บาท)', 'Price (baht)'), render: (t) => <TrimPrice t={t} /> },
        {
          label: tx('ราคาผู้ผลิต', 'Maker’s price'),
          render: (t) =>
            t.listPrice ? (
              <Figure value={formatNumber(t.listPrice.amount)} unit={L.currency[t.listPrice.currency]} />
            ) : (
              <Missing text="–" />
            ),
        },
      ],
    },
    {
      title: tx('การเคลื่อนไหว', 'Movement'),
      rows: [
        {
          label: tx('องศาอิสระ (DOF)', 'Degrees of freedom (DoF)'),
          render: (t) => (t.dof != null ? <span className="nowrap">{formatNumber(t.dof)}</span> : <Missing />),
        },
        {
          label: tx('มือหยิบจับ', 'Hands'),
          render: (t) =>
            t.hand == null && t.handDof == null ? (
              <Missing />
            ) : (
              <>
                {t.hand && tidy(t.hand)}
                {t.handDof != null && (
                  <span className="mp-aside nowrap">
                    {t.hand ? ' ' : ''}
                    {tx(`(ข้างละ ${formatNumber(t.handDof)} DOF)`, `(${formatNumber(t.handDof)} DoF each)`)}
                  </span>
                )}
              </>
            ),
        },
        {
          label: tx('ความเร็วสูงสุด', 'Top speed'),
          render: (t) =>
            t.speedMs != null ? (
              <>
                <Figure value={formatNumber(msToKmh(t.speedMs))} unit={u.kmh} />
                <span className="mp-aside nowrap"> ({formatNumber(t.speedMs)} m/s)</span>
              </>
            ) : (
              <Missing />
            ),
        },
      ],
    },
    {
      title: tx('สมรรถนะ', 'Performance'),
      rows: [
        {
          label: tx('น้ำหนักบรรทุก', 'Payload'),
          render: (t) => (t.payloadKg != null ? <Figure value={formatNumber(t.payloadKg)} unit={u.kg} /> : <Missing />),
        },
        {
          label: tx('แรงบิดข้อต่อ|สูงสุด', 'Peak joint torque'),
          render: (t) =>
            t.jointTorqueNm != null ? <Figure value={formatNumber(t.jointTorqueNm)} unit="N·m" /> : <Missing />,
        },
      ],
    },
    {
      title: tx('พลังงานและการประมวลผล', 'Power and computing'),
      rows: [
        {
          label: tx('ความจุแบตเตอรี่', 'Battery capacity'),
          render: (t) => (t.batteryWh != null ? <Figure value={formatNumber(t.batteryWh)} unit="Wh" /> : <Missing />),
        },
        {
          label: tx('เวลาใช้งาน|ต่อการชาร์จ', 'Runtime per charge'),
          render: (t) => (t.runtimeH != null ? <Figure value={formatNumber(t.runtimeH)} unit={u.h} /> : <Missing />),
        },
        {
          label: tx('ระบบประมวลผล', 'Onboard computer'),
          render: (t) => (t.compute ? <span lang={langOf(t.compute)}>{t.compute}</span> : <Missing />),
          wide: true,
        },
      ],
    },
  ]
}

function Trims({ m, mk }: { m: Model; mk: Market }) {
  const lang = useLang()
  const tx = txFor(lang)
  const id = useId()
  const n = m.trims.length
  const groups = trimGroups(lang)
  const { converted, dealer, currencies } = pricingOf(m)
  const fxDate = dayText(market.fx.date, lang)
  const unstated = tx('ไม่ระบุ', 'Not stated')
  return (
    <div className="mp-trims">
      {/* Wider screens: the brochure's spec table, one column per trim. Phones get one card per trim
          (below); CSS shows one or the other, so only one is ever exposed. */}
      <div className="mp-trims__scroll" role="region" aria-labelledby={`${id}-cap`} tabIndex={0}>
        <table className="mp-table" style={{ ['--trims' as string]: n }}>
          <caption id={`${id}-cap`} className="visually-hidden">
            {tx(`ราคาและสเปกทุกรุ่นย่อยของ ${m.nameEn}`, `Prices and specs of every ${m.nameEn} trim`)}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="mp-table__corner">
                {tx('รุ่นย่อย', 'Trim')}
              </th>
              {m.trims.map((t) => (
                <th key={t.name} scope="col" lang={langOf(t.name)}>
                  <TrimName name={t.name} />
                  <TrimStock model={m} trim={t} />
                </th>
              ))}
            </tr>
          </thead>
          {groups.map((g) => (
            <tbody key={g.title}>
              <tr className="mp-table__group">
                <th scope="rowgroup" colSpan={n + 1}>
                  {g.title}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">
                    <Words text={r.label} />
                  </th>
                  {m.trims.map((t) => (
                    <td key={t.name}>{r.render(t)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <ul className="mp-trimcards" aria-label={tx(`รุ่นย่อยของ ${m.nameEn}`, `${m.nameEn} trims`)}>
        {m.trims.map((t, i) => (
          <li key={t.name} className="mp-trimcard">
            <div className="mp-trimcard__head">
              <p className="mp-trimcard__num" aria-hidden="true">
                {tx('รุ่นย่อย', 'Trim')} {i + 1}/{n}
              </p>
              <h3 lang={langOf(t.name)}>
                <TrimName name={t.name} />
              </h3>
              <TrimStock model={m} trim={t} />
            </div>
            <dl className="mp-sheet mp-sheet--trim">
              {groups
                .flatMap((g) => g.rows)
                .map((r) => (
                  <div key={plainLabel(r.label)} className={r.wide ? 'mp-sheet__wide' : undefined}>
                    <dt>
                      <Words text={r.label} />
                    </dt>
                    <dd>{r.render(t)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>

      <div className="mp-notes">
        {converted.length > 0 && (
          <p>
            <span className="mp-notes__title">{tx('ราคาประมาณ', 'Approximate prices')}</span>{' '}
            {tx('แปลงจากราคาผู้ผลิตเป็นเงินบาทที่อัตรา', 'converted from the maker’s price into baht at')}{' '}
            <Rates currencies={currencies} />{' '}
            <span className="nowrap">
              {tx('ณ วันที่', 'on')} {fxDate}
            </span>
            {mk.fx.note && <> {tidy(mk.fx.note)}</>}
          </p>
        )}
        {dealer.length > 0 && (
          <p>
            <span className="mp-notes__title">{tx('ราคาตัวแทนจำหน่าย', 'Thai dealer prices')}</span>{' '}
            {tx(
              'ราคาที่ตัวแทนจำหน่ายในไทยประกาศ ควรสอบถามว่ารวมภาษีมูลค่าเพิ่ม การติดตั้ง และการอบรมแล้วหรือไม่',
              'are the prices Thai dealers publish. Ask whether they include VAT, installation and training.',
            )}
          </p>
        )}
        {m.priceNote && (
          <p>
            <span className="mp-notes__title">{tx('เงื่อนไขราคา', 'Price terms')}</span> {tidy(m.priceNote)}
          </p>
        )}
        <p>
          <span className="mp-notes__title">{tx('สเปก', 'Specs')}</span>{' '}
          {tx(
            `ตัวเลขตามที่ผู้ผลิตประกาศ ช่องที่ระบุว่า “${unstated}” คือผู้ผลิตยังไม่ได้เผยแพร่ตัวเลขนั้น`,
            `are the maker’s published figures. “${unstated}” means the maker hasn’t published that figure.`,
          )}
        </p>
      </div>
    </div>
  )
}

/** Size beside an adult, then what the robot senses and runs, and how it charges. */
function Systems({ m }: { m: Model }) {
  const lang = useLang()
  const tx = txFor(lang)
  const u = units(lang)
  const runtime = m.span.runtimeH
  const computes = unique(m.trims.map((t) => t.compute))
  // One computer for every trim reads as a plain line; differing ones name their trims
  const computeLines =
    computes.length <= 1 ? computes : m.trims.filter((t) => t.compute).map((t) => `${t.name}: ${t.compute}`)

  return (
    <div className="mp-dims">
      <section className="mp-card mp-dims__size" aria-labelledby="mp-size-title">
        <div className="mp-card__head">
          <h3 id="mp-size-title" className="mp-subhead">
            {tx('ขนาดและน้ำหนัก', 'Size and weight')}
          </h3>
          <p className="mp-card__meta">{tx(`เทียบกับผู้ใหญ่สูง ${ADULT_CM} ซม.`, `Beside a ${ADULT_CM} cm adult`)}</p>
        </div>
        <HeightScale m={m} />
        <dl className="mp-tiles">
          <div>
            <dt>{tx('น้ำหนักตัว', 'Weight')}</dt>
            <dd>{m.weightKg ? <Figure value={spanText(m.weightKg)} unit={u.kg} /> : <Missing />}</dd>
          </div>
          <div>
            <dt>{tx('น้ำหนักบรรทุก', 'Payload')}</dt>
            <dd>{m.span.payloadKg ? <Figure value={spanText(m.span.payloadKg)} unit={u.kg} /> : <Missing />}</dd>
          </div>
        </dl>
      </section>

      <section className="mp-card mp-dims__sensors" aria-labelledby="mp-sensors-title">
        <div className="mp-card__head">
          <h3 id="mp-sensors-title" className="mp-subhead">
            {tx('เซนเซอร์', 'Sensors')}
          </h3>
          <p className="mp-card__meta">
            {m.sensors.length} {u.items}
          </p>
        </div>
        <ul className="mp-ticks">
          {m.sensors.map((s) => (
            <li key={s}>{tidy(s)}</li>
          ))}
        </ul>
      </section>

      <section className="mp-card mp-dims__software" aria-labelledby="mp-software-title">
        <h3 id="mp-software-title" className="mp-subhead">
          {/* One flex item, so the heading's gap stays beside the bar and not inside the title */}
          <span>
            {lang === 'en' ? (
              'Software and SDK'
            ) : (
              <>
                ซอฟต์แวร์และ <span lang="en">SDK</span>
              </>
            )}
          </span>
        </h3>
        <dl className="mp-sheet">
          <div>
            <dt>
              {lang === 'en' ? (
                'Software development kit (SDK)'
              ) : (
                <>
                  ชุดพัฒนาซอฟต์แวร์ <span lang="en">(SDK)</span>
                </>
              )}
            </dt>
            <dd>{m.software.sdk ? tidy(m.software.sdk) : <Missing />}</dd>
          </div>
          <div>
            <dt>
              {lang === 'en' ? (
                'AI and skill training'
              ) : (
                <>
                  <span lang="en">AI</span> และการฝึกทักษะ
                </>
              )}
            </dt>
            <dd>{m.software.ai ? tidy(m.software.ai) : <Missing />}</dd>
          </div>
          <div>
            <dt>{tx('ระบบประมวลผล', 'Onboard computer')}</dt>
            <dd>
              {computeLines.length > 0 ? (
                computeLines.map((c) => (
                  <span key={c} className="mp-sheet__line" lang={langOf(c)}>
                    {c}
                  </span>
                ))
              ) : (
                <Missing />
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mp-card mp-dims__charge" aria-labelledby="mp-charge-title">
        <h3 id="mp-charge-title" className="mp-subhead">
          {tx('แบตเตอรี่และการชาร์จ', 'Battery and charging')}
        </h3>
        <dl className="mp-tiles mp-tiles--three">
          <div>
            <dt>{tx('ความจุแบตเตอรี่', 'Battery capacity')}</dt>
            <dd>{m.span.batteryWh ? <Figure value={spanText(m.span.batteryWh)} unit="Wh" /> : <Missing />}</dd>
            {runtime && (
              <dd className="mp-tiles__sub">
                {lang === 'en' ? (
                  <>
                    About <span className="nowrap">{spanText(runtime)} h</span> of work per charge
                  </>
                ) : (
                  <>
                    ใช้งานได้ราว <span className="nowrap">{spanText(runtime)} ชม.</span> ต่อการชาร์จ
                  </>
                )}
              </dd>
            )}
          </div>
          <div>
            <dt>{tx('เวลาชาร์จจนเต็ม', 'Time to full charge')}</dt>
            <dd>{m.charging.timeH != null ? <Figure value={formatNumber(m.charging.timeH)} unit={u.h} /> : <Missing />}</dd>
          </div>
          <div>
            <dt>{tx('เปลี่ยนแบตเตอรี่', 'Battery swap')}</dt>
            <dd>{m.charging.swappable ? tx('ถอดเปลี่ยนได้', 'Swappable') : tx('ถอดเปลี่ยนเองไม่ได้', 'Not user-swappable')}</dd>
            <dd className="mp-tiles__sub">
              {m.charging.swappable
                ? tx('สลับก้อนสำรองแล้วใช้งานต่อได้', 'Swap in a spare and keep working')
                : tx('ชาร์จแบตเตอรี่ในตัวหุ่นยนต์', 'The battery charges inside the robot')}
            </dd>
          </div>
        </dl>
        {m.charging.note && <p className="mp-card__note">{tidy(m.charging.note)}</p>}
        <Link to="/guide" state={{ section: 'energy' }} className="link-arrow mp-card__link">
          {lang === 'en' ? (
            <span>Electricity cost per charge in the buyer’s guide</span>
          ) : (
            <span>
              <span className="nowrap">ค่าไฟต่อการชาร์จ</span>
              <wbr />
              <span className="nowrap">ในคู่มือก่อนซื้อ</span>
            </span>
          )}
          <ArrowUpRight size={18} aria-hidden />
        </Link>
      </section>
    </div>
  )
}

function Safety({ m }: { m: Model }) {
  const lang = useLang()
  const tx = txFor(lang)
  const { features, certifications } = m.safety
  return (
    <div className="mp-safety">
      <section className="mp-card mp-safety__features" aria-labelledby="mp-features-title">
        <div className="mp-card__head">
          <h3 id="mp-features-title" className="mp-subhead">
            {tx('ระบบความปลอดภัย', 'Safety systems')}
          </h3>
          {features.length > 0 && (
            <p className="mp-card__meta">
              {features.length} {units(lang).items}
            </p>
          )}
        </div>
        {features.length > 0 ? (
          <ul className="mp-ticks">
            {features.map((f) => (
              <li key={f}>{tidy(f)}</li>
            ))}
          </ul>
        ) : (
          <p className="mp-card__empty">
            {tx('ผู้ผลิตยังไม่ได้เผยแพร่รายละเอียดระบบความปลอดภัย', 'The maker hasn’t published details of its safety systems.')}
          </p>
        )}
      </section>

      <section className="mp-certs tone-gold" aria-labelledby="mp-certs-title">
        <h3 id="mp-certs-title" className="mp-certs__title">
          <Award size={18} aria-hidden />
          {tx('มาตรฐานและการรับรอง', 'Standards and certification')}
        </h3>
        {certifications.length > 0 ? (
          <ul className="mp-certs__list">
            {certifications.map((c) => (
              <li key={c} className="chip" lang={langOf(c)}>
                {c}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mp-certs__none">{tx('ไม่ได้ระบุการรับรอง', 'No certification stated')}</p>
        )}
      </section>

      <section className="mp-warranty on-navy" aria-labelledby="mp-warranty-title">
        <h3 id="mp-warranty-title" className="mp-warranty__title">
          {tx('การรับประกัน', 'Warranty')}
        </h3>
        <dl className="mp-warranty__list">
          <div>
            <dt>{tx('ตัวหุ่นยนต์', 'Robot')}</dt>
            <dd>{tidy(m.warranty.robot)}</dd>
          </div>
          <div>
            <dt>{tx('แบตเตอรี่', 'Battery')}</dt>
            <dd>{m.warranty.battery ? tidy(m.warranty.battery) : <Missing />}</dd>
          </div>
        </dl>
        {m.warranty.note && <p className="mp-warranty__note">{tidy(m.warranty.note)}</p>}
      </section>
    </div>
  )
}

function Decide({ m, mk }: { m: Model; mk: Market }) {
  const lang = useLang()
  const tx = txFor(lang)
  const rank = rankOf(m, mk)
  return (
    <div className="mp-decide">
      <div className="mp-decide__pair">
        <section className="mp-verdict tone-sage" aria-labelledby="mp-pros-title">
          <h3 id="mp-pros-title" className="mp-verdict__title">
            <span className="mp-verdict__icon" aria-hidden="true">
              <ThumbsUp size={18} />
            </span>
            {tx('ข้อดี', 'Strengths')}
          </h3>
          <ul className="mp-ticks mp-ticks--plus">
            {m.pros.map((x) => (
              <li key={x}>{tidy(x)}</li>
            ))}
          </ul>
        </section>
        <section className="mp-verdict tone-sand" aria-labelledby="mp-cons-title">
          <h3 id="mp-cons-title" className="mp-verdict__title">
            <span className="mp-verdict__icon" aria-hidden="true">
              <CircleAlert size={18} />
            </span>
            {tx('ข้อจำกัด', 'Limitations')}
          </h3>
          <ul className="mp-ticks mp-ticks--minus">
            {m.cons.map((x) => (
              <li key={x}>{tidy(x)}</li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mp-decide__pair">
        <section className="mp-card" aria-labelledby="mp-ideal-title">
          <h3 id="mp-ideal-title" className="mp-subhead">
            {tx('เหมาะกับ', 'Best for')}
          </h3>
          <ul className="mp-ticks">
            {m.idealFor.map((x) => (
              <li key={x}>{tidy(x)}</li>
            ))}
          </ul>
        </section>
        <section className="mp-card" aria-labelledby="mp-consider-title">
          <h3 id="mp-consider-title" className="mp-subhead">
            {tx('ควรพิจารณาก่อนซื้อ', 'Think about before buying')}
          </h3>
          <ul className="mp-ticks mp-ticks--caution">
            {m.considerations.map((x) => (
              <li key={x}>{tidy(x)}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mp-card mp-dealer" aria-labelledby="mp-dealer-title">
        <h3 id="mp-dealer-title" className="mp-subhead">
          {tx('การจำหน่ายในไทย', 'Buying in Thailand')}
        </h3>
        <dl className="mp-sheet">
          <div>
            <dt>{tx('ผู้จัดจำหน่าย', 'Distributor')}</dt>
            <dd lang={langOf(m.distributor)}>{tidy(m.distributor)}</dd>
          </div>
          <div>
            <dt>{tx('ช่องทางการซื้อ', 'How to buy')}</dt>
            <dd>
              <span className="mp-sheet__lead">{labels(lang).availability[m.availability]}</span>
              <span className="mp-sheet__line">{tidy(m.availabilityNote)}</span>
            </dd>
          </div>
          <div>
            <dt>{tx('เริ่มวางจำหน่าย', 'On sale since')}</dt>
            <dd>{monthText(m.launched, lang)}</dd>
          </div>
          <div>
            <dt>{tx('สัญชาติแบรนด์', 'Brand origin')}</dt>
            <dd>{m.originCountry}</dd>
          </div>
          {rank && (
            <div>
              <dt>{tx('อันดับผู้ผลิต', 'Maker ranking')}</dt>
              <dd>
                <span className="mp-sheet__lead">
                  {tx(`ยอดส่งมอบอันดับ ${rank.rank} ของโลก`, `No. ${rank.rank} worldwide by shipments`)}
                  {rank.tied && tx(' (ร่วม)', ' (joint)')}
                </span>
                {rank.units != null && (
                  <>
                    {tx(' รวม ', ', ')}
                    <span className="nowrap">
                      {formatNumber(rank.units)} {units(lang).robots}
                    </span>
                  </>
                )}
                {rank.period && (
                  <>
                    {' '}
                    <span className="nowrap">({rank.period})</span>
                  </>
                )}
              </dd>
            </div>
          )}
        </dl>
        <div className="mp-card__links">
          <Link to="/guide" state={{ section: 'checklist' }} className="link-arrow">
            {lang === 'en' ? (
              <span>Buyer’s checklist</span>
            ) : (
              <span>
                <span className="nowrap">เช็กลิสต์</span>
                <wbr />
                <span className="nowrap">ก่อนสั่งซื้อ</span>
              </span>
            )}
            <ArrowUpRight size={18} aria-hidden />
          </Link>
          <Link to="/guide" state={{ section: 'buying' }} className="link-arrow">
            {lang === 'en' ? (
              <span>Ordering and importing</span>
            ) : (
              <span>
                <span className="nowrap">ขั้นตอนการสั่งซื้อ</span>
                <wbr />
                <span className="nowrap">และนำเข้า</span>
              </span>
            )}
            <ArrowUpRight size={18} aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  )
}

/* ---------------------------------------------------------------------------------------------
   Page
--------------------------------------------------------------------------------------------- */

export function ModelPage() {
  const { id } = useParams()
  const lang = useLang()
  const base = getModel(id)
  if (!base) return <NotFoundPage />
  // Keyed so the tab resets when the pager moves to another model.
  return <ModelDetail key={base.id} model={localized(base, lang)} />
}

const COMPARE_LABEL = {
  th: {
    add: 'เพิ่มเพื่อเปรียบเทียบ',
    selected: 'อยู่ในรายการเปรียบเทียบ',
    blocked: `เลือกครบ ${COMPARE_LIMIT} รุ่นแล้ว`,
  },
  en: {
    add: 'Add to compare',
    selected: 'In your comparison',
    blocked: `${COMPARE_LIMIT} models already chosen`,
  },
}

// A Thai dealer reads as reassurance (sage), a pre-order as a caution (sand); importing is the norm
const AVAILABILITY_CHIP: Record<Availability, string> = {
  'thai-dealer': 'chip tone-sage',
  preorder: 'chip tone-sand',
  import: 'chip',
}

/** The main photo first, then the gallery's extra photos and clips. */
function slidesOf(m: ModelWithGallery, lang: Lang): Slide[] {
  const main: Slide = {
    kind: 'image',
    src: m.image.src,
    srcSmall: m.image.srcSmall,
    alt: pick(lang, `หุ่นยนต์ ${m.nameEn}`, `The ${m.nameEn} humanoid robot`),
    author: m.image.author,
    license: m.image.license,
    page: m.image.page,
    focus: m.image.focus,
    zoom: m.image.zoom,
  }
  return [main, ...(m.gallery ?? []).map((g) => ({ ...g }))]
}

function ModelDetail({ model: m }: { model: ModelWithGallery }) {
  const lang = useLang()
  const tx = txFor(lang)
  const u = units(lang)
  const L = labels(lang)
  const mk = localizedMarket(market, lang)
  const [tab, setTab] = useState('overview')
  const { has, toggle, isFull } = useCompare()
  const location = useLocation()
  useTitle(m.nameEn)
  // Return to the lineup exactly as the visitor left it (the filters live in the query string).
  const from = (location.state as { from?: string } | null)?.from ?? ''

  const selected = has(m.id)
  const blocked = !selected && isFull
  const index = models.findIndex((x) => x.id === m.id)
  const prev = localized(models[(index - 1 + models.length) % models.length], lang)
  const next = localized(models[(index + 1) % models.length], lang)
  const rank = rankOf(m, mk)

  const price = m.span.price
  const { priced, converted, dealer, lowApprox, highApprox, currencies } = pricingOf(m)
  // The maker's price behind the cheapest conversion; "เฉพาะรุ่น …" when other trims are dealer prices
  const list = converted[0]?.listPrice ?? null
  const partly = converted.length > 0 && converted.length < priced.length
  const fxDate = dayText(market.fx.date, lang)

  const handDof = spanOf(m.trims, (t) => t.handDof)
  const hands = unique(m.trims.map((t) => t.hand))
  const torque = spanOf(m.trims, (t) => t.jointTorqueNm)
  const speed = m.span.speedMs

  // The key-figure readouts count up the first time the band scrolls into view
  const specsRef = useRef<HTMLDListElement>(null)
  const specsIn = useInView(specsRef)

  const keySpecs: { label: ReactNode; key: string; value: ReactNode; sub?: ReactNode }[] = [
    {
      key: 'height',
      label: tx('ความสูง', 'Height'),
      value: <Readout range={[m.heightCm, m.heightCm]} unit={u.cm} play={specsIn} />,
      sub: m.weightKg && (
        <>
          {tx('น้ำหนัก', 'Weight')}{' '}
          <span className="nowrap">
            {spanText(m.weightKg)} {u.kg}
          </span>
        </>
      ),
    },
    {
      key: 'dof',
      label:
        lang === 'en' ? (
          'Degrees of freedom (DoF)'
        ) : (
          <>
            องศาอิสระ <span lang="en">(DOF)</span>
          </>
        ),
      value: m.span.dof ? <Readout range={m.span.dof} play={specsIn} /> : <Missing />,
      sub: handDof ? (
        <>
          {lang === 'en' ? (
            <>
              Hands <span className="nowrap">{spanText(handDof)} DoF each</span>
            </>
          ) : (
            <>
              มือหยิบจับข้างละ <span className="nowrap">{spanText(handDof)} DOF</span>
            </>
          )}
          {m.trims.some((t) => t.handDof == null) && <span className="nowrap">{tx(' (บางรุ่นย่อย)', ' (some trims)')}</span>}
        </>
      ) : (
        hands.length === 1 && tidy(hands[0])
      ),
    },
    {
      key: 'speed',
      label: tx('ความเร็วสูงสุด', 'Top speed'),
      value: speed ? <Readout range={kmh(speed)} unit={u.kmh} play={specsIn} /> : <Missing />,
      sub: speed && <span className="nowrap">{spanText(speed)} m/s</span>,
    },
    {
      key: 'payload',
      label: tx('น้ำหนักบรรทุก', 'Payload'),
      value: m.span.payloadKg ? <Readout range={m.span.payloadKg} unit={u.kg} play={specsIn} /> : <Missing />,
      sub: torque && (
        <>
          {tx('แรงบิดข้อต่อสูงสุด', 'Peak joint torque')} <span className="nowrap">{spanText(torque)} N·m</span>
        </>
      ),
    },
    {
      key: 'runtime',
      label: tx('เวลาใช้งานต่อการชาร์จ', 'Runtime per charge'),
      value: m.span.runtimeH ? <Readout range={m.span.runtimeH} unit={u.h} play={specsIn} /> : <Missing />,
      sub: m.span.batteryWh && (
        <>
          {tx('แบตเตอรี่', 'Battery')} <span className="nowrap">{spanText(m.span.batteryWh)} Wh</span>
        </>
      ),
    },
  ]

  const tabs: TabItem[] = [
    { id: 'overview', label: tx('ภาพรวม', 'Overview'), content: <Overview m={m} /> },
    {
      id: 'trims',
      label: tx('รุ่นย่อยและราคา', 'Trims and prices'),
      shortLabel: tx('รุ่นย่อย', 'Trims'),
      content: <Trims m={m} mk={mk} />,
    },
    { id: 'systems', label: tx('ขนาดและระบบ', 'Size and systems'), shortLabel: tx('ขนาด', 'Size'), content: <Systems m={m} /> },
    {
      id: 'safety',
      label: tx('ความปลอดภัยและการรับประกัน', 'Safety and warranty'),
      shortLabel: tx('ความปลอดภัย', 'Safety'),
      content: <Safety m={m} />,
    },
    { id: 'decide', label: tx('ก่อนตัดสินใจ', 'Before you buy'), content: <Decide m={m} mk={mk} /> },
  ]

  // "ดูราคาทุกรุ่นย่อย" (in the price panel): open the trims tab and bring the tab bar into view, focus on the tab
  const showTrims = () => {
    setTab('trims')
    requestAnimationFrame(() => {
      const bar = document.getElementById('model-tabs')
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      bar?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
      bar?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus({ preventScroll: true })
    })
  }

  // Robot photos are often tall: the stage keeps the head and torso in frame (CSS), or the
  // per-photo focus point when the data sets one
  const focus = (x: Model) => photoStyle(x.image)
  const compareLabel = COMPARE_LABEL[lang][selected ? 'selected' : blocked ? 'blocked' : 'add']

  return (
    <>
      {/* The showroom stage: first in <main>, so the header floats over it on desktop (Layout) */}
      <section className="stage on-navy mstage" aria-labelledby="mp-title">
        <div className="container">
          <nav className="mp-crumbs" aria-label={tx('เส้นทาง', 'Breadcrumb')}>
            <Link to={{ pathname: '/', search: from }} state={{ scrollTo: 'models' }}>
              <ArrowLeft size={16} aria-hidden />
              {tx('หุ่นยนต์ทั้งหมด', 'All robots')}
            </Link>
            <ChevronRight size={14} aria-hidden />
            <span aria-current="page" lang={langOf(m.nameEn)}>
              {m.nameEn}
            </span>
          </nav>
        </div>

        <div className="mstage__hero">
          <div className="mstage__photo">
            <Picture
              className="mstage__img"
              src={m.image.src}
              alt={tx(`หุ่นยนต์ ${m.nameEn}`, `The ${m.nameEn} humanoid robot`)}
              sizes="(max-width: 960px) 100vw, 66vw"
              priority
              style={focus(m)}
            />
            <span className="mstage__scan" aria-hidden="true" />
          </div>

          <div className="container mstage__inner">
            <div className="mstage__copy">
              <p className="mp-brand" lang={langOf(m.brand)}>
                {m.brand}
              </p>
              {/* As large as the column allows for this name's length */}
              <h1
                id="mp-title"
                className="mstage__name"
                lang={langOf(m.nameEn)}
                style={{ '--chars': Math.max(6, m.nameEn.length) } as CSSProperties}
              >
                {m.nameEn}
              </h1>
              {lang === 'th' && <p className="mp-nameth">{m.nameTh}</p>}

              <ul className="mp-chips" aria-label={tx('ประเภทหุ่นยนต์', 'Robot type')}>
                <li className="chip">{L.category[m.category]}</li>
                <li className={AVAILABILITY_CHIP[m.availability]}>{L.availability[m.availability]}</li>
              </ul>

              {/* A display line: it breaks only between its phrases */}
              <p className="mp-tagline">
                <Words text={tidy(m.tagline)} />
              </p>

              <p className="mstage__price">
                <span className="mstage__price-label">
                  {lang === 'en'
                    ? `${m.trims.length > 1 ? 'From' : 'Price'}${lowApprox ? ' about' : ''}`
                    : `${m.trims.length > 1 ? 'เริ่มต้น' : 'ราคา'}${lowApprox ? 'ประมาณ' : ''}`}
                </span>
                {price ? (
                  <span className="mstage__price-figure figure-display">
                    {formatNumber(price[0])} <span className="mstage__price-unit">{u.baht}</span>
                  </span>
                ) : (
                  <span className="mstage__price-figure">{tx('ยังไม่ประกาศราคา', 'Price not announced')}</span>
                )}
              </p>

              <div className="mp-actions">
                <button
                  type="button"
                  className={selected || blocked ? 'btn mp-compare' : 'btn btn-primary mp-compare'}
                  data-selected={selected || undefined}
                  aria-disabled={blocked || undefined}
                  aria-describedby={blocked ? 'mp-compare-hint' : undefined}
                  onClick={() => !blocked && toggle(m.id)}
                >
                  {selected ? <Check size={18} aria-hidden /> : <Plus size={18} aria-hidden />}
                  {compareLabel}
                </button>
                {blocked && (
                  <p className="mp-actions__hint" id="mp-compare-hint">
                    {lang === 'en' ? (
                      `Remove another model first (up to ${COMPARE_LIMIT})`
                    ) : (
                      <>
                        นำรุ่นอื่นออกจากรายการก่อน <span className="nowrap">(สูงสุด {COMPARE_LIMIT} รุ่น)</span>
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="container">
          <section className="mp-keyspecs" aria-labelledby="mp-keyspecs-title">
            <h2 id="mp-keyspecs-title" className="visually-hidden">
              {tx('สเปกหลัก', 'Key specs')}
            </h2>
            <dl className="mp-keyspecs__list" ref={specsRef}>
              {keySpecs.map((s) => (
                <div key={s.key}>
                  <dt>{s.label}</dt>
                  <dd className="mp-keyspecs__value">{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <p className="mstage__credit">
            {tx('ภาพ:', 'Photo:')} <span lang={langOf(m.image.author)}>{m.image.author}</span> (
            <a href={m.image.page} target="_blank" rel="noreferrer" lang="en">
              {m.image.license}
            </a>
            )
          </p>
        </div>
      </section>

      <div className="mp">
        {/* What the robot is, beside what it costs and what that price is based on */}
        <section className="container mp-intro" aria-labelledby="mp-intro-title">
          <div className="mp-intro__story">
            <h2 id="mp-intro-title" className="mp-intro__title">
              {tx('รู้จัก', 'About the')} <span lang={langOf(m.nameEn)}>{m.nameEn}</span>
            </h2>
            <p className="mp-lede">{tidy(m.summary)}</p>
            {rank && (
              <p className="mp-rank">
                <span className="mp-rank__icon" aria-hidden="true">
                  <Trophy size={18} />
                </span>
                <span className="mp-rank__text">
                  <strong>
                    {lang === 'en' ? (
                      `No. ${rank.rank} maker worldwide by shipments`
                    ) : (
                      <>
                        ผู้ผลิตยอดส่งมอบ<span className="nowrap">อันดับ {rank.rank} ของโลก</span>
                      </>
                    )}
                    {rank.tied && tx(' (ร่วม)', ' (joint)')}
                  </strong>{' '}
                  <span className="mp-rank__meta">
                    {rank.period && (
                      <span className="nowrap">
                        {tx('ยอดส่งมอบ', 'Shipments')} {rank.period}
                      </span>
                    )}
                    {rank.period && rank.units != null && tx(' รวม ', ': ')}
                    {rank.units != null && (
                      <span className="nowrap">
                        {formatNumber(rank.units)} {u.robots}
                      </span>
                    )}{' '}
                    <span className="nowrap">{tx('(ทุกรุ่นของแบรนด์)', '(all of the brand’s models)')}</span>
                  </span>
                </span>
              </p>
            )}
          </div>

          <div className="mp-price">
            <div className="mp-price__main">
              <dl>
                <dt>{m.trims.length > 1 ? tx('ราคาเริ่มต้น', 'Starting price') : tx('ราคา', 'Price')}</dt>
                <dd className="mp-price__figure">
                  {price ? (
                    <>
                      {lowApprox && <span className="mp-price__approx">{tx('ประมาณ ', 'about ')}</span>}
                      <Baht n={price[0]} />
                    </>
                  ) : (
                    tx('ยังไม่ประกาศราคา', 'Price not announced')
                  )}
                </dd>
              </dl>
              {price && m.trims.length > 1 && (
                <p className="mp-price__meta">
                  {lang === 'en' ? (
                    <>
                      {m.trims.length} trims,{' '}
                      <span className="nowrap">
                        up to{highApprox && ' about'} {formatNumber(price[1])} baht
                      </span>
                    </>
                  ) : (
                    <>
                      {m.trims.length} รุ่นย่อย{' '}
                      <span className="nowrap">
                        สูงสุด{highApprox && 'ประมาณ'} {formatNumber(price[1])} บาท
                      </span>
                    </>
                  )}
                </p>
              )}
              {m.trims.length > 1 && (
                <button type="button" className="link-arrow mp-price__trims" onClick={showTrims}>
                  {tx('ดูราคาทุกรุ่นย่อย', 'See every trim’s price')}
                  <ArrowRight size={16} aria-hidden />
                </button>
              )}
            </div>
            {/* Where the figure comes from, folded away: the maker's own price, the exchange rate and the small print */}
            {(priced.length > 0 || m.priceNote) && (
              <details className="mp-price__basis">
                <summary className="mp-price__more">{tx('ที่มาของราคา', 'How this price is worked out')}</summary>
                {list ? (
                  <dl>
                    <dt>{tx('ราคาผู้ผลิต', 'Maker’s price')}</dt>
                    <dd className="mp-price__list">
                      {converted.length > 1 && tx('เริ่มต้น ', 'from ')}
                      <Figure value={formatNumber(list.amount)} unit={L.currency[list.currency]} />
                      {partly && (
                        <span className="mp-price__scope">
                          {' '}
                          {tx('เฉพาะรุ่น', 'for')}{' '}
                          <span lang={langOf(converted.map((t) => t.name).join(''))}>
                            {converted.map((t) => t.name).join(', ')}
                          </span>
                        </span>
                      )}
                    </dd>
                    <dd className="mp-price__rate">
                      {tx('คิดเป็นเงินบาทที่อัตรา', 'Converted to baht at')} <Rates currencies={currencies} />{' '}
                      <span className="nowrap">
                        {tx('ณ วันที่', 'on')} {fxDate}
                      </span>
                      {partly &&
                        dealer.length > 0 &&
                        tx(' รุ่นย่อยอื่นเป็นราคาจากตัวแทนจำหน่ายในไทย', '. The other trims are Thai dealer prices.')}
                    </dd>
                  </dl>
                ) : (
                  dealer.length > 0 && (
                    <p className="mp-price__basis-title">{tx('ราคาจากตัวแทนจำหน่ายในไทย', 'Prices from a Thai dealer')}</p>
                  )
                )}
                {m.priceNote && <p className="mp-price__note">{tidy(m.priceNote)}</p>}
              </details>
            )}
          </div>
        </section>

        <div className="container">
          {/* Live stock, financing and the next steps (configure, book a demo, contact), when those parts exist */}
          <ModelExtras model={m} />

          <Gallery name={m.nameEn} slides={slidesOf(m, lang)} />

          <div className="mp-details">
            <Tabs id="model-tabs" items={tabs} active={tab} onChange={setTab} label={tx(`ข้อมูล ${m.nameEn}`, `${m.nameEn} details`)} />
          </div>

          <details className="mp-sources">
            <summary>
              <span>
                {tx('แหล่งอ้างอิงของหน้านี้', 'Sources for this page')}{' '}
                <span className="nowrap">
                  ({m.sources.length} {u.items})
                </span>
              </span>
              <span className="mp-sources__mark" aria-hidden="true">
                <Plus size={20} />
              </span>
            </summary>
            <ol>
              {m.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer" lang={langFor(s.title, lang)}>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </details>

          <Reviews refId={m.id} name={m.nameEn} />

          <div className="mp-more">
            <h2 className="mp-more__title">{tx('ดูรุ่นอื่นในโชว์รูม', 'More robots in the showroom')}</h2>
            <nav className="mp-pager" aria-label={tx('รุ่นอื่นในแค็ตตาล็อก', 'Other models in the catalogue')}>
              {[
                { dir: 'prev' as const, x: prev, label: tx('ก่อนหน้า', 'Previous'), Icon: ArrowLeft },
                { dir: 'next' as const, x: next, label: tx('ถัดไป', 'Next'), Icon: ArrowRight },
              ].map(({ dir, x, label, Icon }) => (
                <Link key={dir} to={`/models/${x.id}`} state={{ from }} className={`mp-pager__link mp-pager__link--${dir}`}>
                  <span className="mp-pager__thumb">
                    <Picture src={x.image.srcSmall} alt="" sizes="200px" style={focus(x)} />
                  </span>
                  <span className="mp-pager__text">
                    <span className="mp-pager__dir">
                      <span className="mp-pager__arrow" aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      {label}
                    </span>{' '}
                    <span className="mp-pager__name" lang={langOf(x.nameEn)}>
                      {x.nameEn}
                    </span>{' '}
                    {x.span.price && (
                      <span className="mp-pager__price">
                        {lang === 'en' ? `From${startsApprox(x) ? ' about' : ''}` : `เริ่มต้น${startsApprox(x) ? 'ประมาณ' : ''}`}{' '}
                        <span className="nowrap">
                          {formatNumber(x.span.price[0])} {u.baht}
                        </span>
                      </span>
                    )}
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </>
  )
}
