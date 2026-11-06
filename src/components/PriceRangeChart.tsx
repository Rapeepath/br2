import { Link } from 'react-router'
import { formatMonthTh, formatNumber } from '../lib/format'
import type { Currency, Market, Model, Trim } from '../lib/types'
import './PriceRangeChart.css'

/** Gridlines per decade: 1, 2.5 and 5 times each power of ten — the round prices people quote. */
const MANTISSAS = [1, 2.5, 5]
/** Most labelled gridlines a row can carry; past this only the decades and the two ends are named. */
const MAX_LABELS = 5

/** "5 หมื่น", "2.5 แสน", "1 ล้าน": round prices as Thai buyers say them, short enough for a phone axis. */
export function tickLabel(v: number): string {
  if (v >= 1_000_000) return `${formatNumber(v / 1_000_000)} ล้าน`
  if (v >= 100_000) return `${formatNumber(v / 100_000)} แสน`
  if (v >= 10_000) return `${formatNumber(v / 10_000)} หมื่น`
  return formatNumber(v)
}

export interface AxisTick {
  value: number
  label: string
  /** A power of ten (1 แสน, 1 ล้าน): a firmer gridline */
  major: boolean
  /** Whether the axis prints this tick's figure (every tick keeps its gridline) */
  labelled: boolean
}

/**
 * A logarithmic price axis on round figures just around the data. Robot prices run from tens of
 * thousands of baht to several million, and on a linear axis every cheap model would sit in one
 * corner; on a log axis equal steps are equal ratios (1 แสน → 1 ล้าน is as far as 1 ล้าน → 10 ล้าน).
 * `at` places a price on the axis as a share of its width, 0 to 1.
 */
export function logPriceAxis(lo: number, hi: number) {
  const low = Math.max(1, Math.min(lo, hi))
  const high = Math.max(low, lo, hi)
  const steps: number[] = []
  for (let e = Math.floor(Math.log10(low)) - 1; e <= Math.ceil(Math.log10(high)) + 1; e++) {
    for (const m of MANTISSAS) steps.push(e >= 0 ? Math.round(m * 10 ** e) : m * 10 ** e)
  }
  let min = Math.max(...steps.filter((s) => s <= low))
  let max = Math.min(...steps.filter((s) => s >= high))
  // A single price still gets an axis around it
  if (min === max) {
    min = steps[steps.indexOf(min) - 1]
    max = steps[steps.indexOf(max) + 1]
  }
  const span = Math.log(max / min)
  const at = (v: number) => Math.min(1, Math.max(0, Math.log(Math.max(v, min) / min) / span))
  const values = steps.filter((s) => s >= min && s <= max)
  const decade = (v: number) => Number.isInteger(Math.log10(v)) && 10 ** Math.round(Math.log10(v)) === v
  const ticks: AxisTick[] = values.map((value, i) => ({
    value,
    label: tickLabel(value),
    major: decade(value),
    labelled: values.length <= MAX_LABELS || decade(value) || i === 0 || i === values.length - 1,
  }))
  return { min, max, ticks, at }
}

const spanText = (lo: number, hi: number) => (lo === hi ? formatNumber(lo) : `${formatNumber(lo)}–${formatNumber(hi)}`)
/** Phones: millions with two places once a range reaches a million, so it keeps to one line. */
const million = (n: number) => (n / 1_000_000).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const spanBrief = (lo: number, hi: number) =>
  hi < 1_000_000 ? spanText(lo, hi) : lo === hi ? `${million(lo)} ล้าน` : `${million(lo)}–${million(hi)} ล้าน`
const unique = <T,>(xs: T[]) => [...new Set(xs)]

/** "2026-10-24" → "24 ตุลาคม 2569". */
const dayTh = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return d ? `${Number(d)} ${formatMonthTh(`${y}-${m}`)}` : formatMonthTh(iso)
}

type PricedTrim = Trim & { priceTHB: number }
type Priced = Model & { span: { price: [number, number] } }

/** Where a model's prices come from: a Thai dealer's own list, the maker's converted, or both. */
function basisOf(trims: PricedTrim[]) {
  const dealer = trims.some((t) => t.priceBasis !== 'converted')
  const converted = trims.filter((t) => t.priceBasis === 'converted' && t.listPrice != null)
  const currencies = unique(converted.map((t) => t.listPrice!.currency))
  const name = [dealer && 'ตัวแทนในไทย', currencies.length > 0 && `แปลงจาก ${currencies.join('/')}`]
    .filter(Boolean)
    .join(' และ')
  // The maker's own figures, in its currency: the currency is already named when there is only one
  const amounts = unique(converted.map((t) => t.listPrice!.amount)).sort((a, b) => a - b)
  const list =
    currencies.length === 1
      ? `ราคาผู้ผลิต ${spanText(amounts[0], amounts[amounts.length - 1])}`
      : currencies.length > 1
        ? `ราคาผู้ผลิต ${converted.map((t) => `${formatNumber(t.listPrice!.amount)} ${t.listPrice!.currency}`).join(', ')}`
        : null
  return { name, list, converted: converted.length > 0, currencies }
}

/**
 * Price ranges per model (cheapest to dearest trim) as floating bars on one shared logarithmic axis,
 * with a dot per trim: filled for a Thai dealer's price, hollow for the maker's price converted to
 * baht. It is a real table, so every figure is readable without the drawing; converted figures read
 * "ประมาณ" and name the maker's own price. Phones re-flow each row into name and price, the bar,
 * then where the price comes from, keeping the head row for screen readers.
 */
export function PriceRangeChart({ models, fx }: { models: Model[]; fx: Market['fx'] }) {
  const priced = models
    .filter((m): m is Priced => m.span.price != null)
    .sort((a, b) => a.span.price[0] - b.span.price[0] || a.span.price[1] - b.span.price[1])
  const unpriced = models.filter((m) => m.span.price == null)
  if (priced.length === 0) return null

  const rows = priced.map((m) => {
    const trims = m.trims.filter((t): t is PricedTrim => t.priceTHB != null)
    return { m, trims, basis: basisOf(trims) }
  })
  const anyDealer = rows.some((r) => r.trims.some((t) => t.priceBasis !== 'converted'))
  const usedCurrencies = unique(rows.flatMap((r) => r.basis.currencies)).filter(
    (c): c is Exclude<Currency, 'THB'> => c !== 'THB',
  )
  const rate = (c: Exclude<Currency, 'THB'>) => ({ USD: fx.usd, CNY: fx.cny, EUR: fx.eur })[c]

  const axis = logPriceAxis(
    Math.min(...priced.map((m) => m.span.price[0])),
    Math.max(...priced.map((m) => m.span.price[1])),
  )
  const pct = (v: number) => `${axis.at(v) * 100}%`

  const scale = (className: string) => (
    <div className={className} aria-hidden="true">
      {axis.ticks
        .filter((t) => t.labelled)
        .map((t) => (
          <span
            key={t.value}
            className={t.value === axis.min ? 'is-start' : t.value === axis.max ? 'is-end' : undefined}
            style={{ left: pct(t.value) }}
          >
            {t.label}
          </span>
        ))}
    </div>
  )

  return (
    <div className="prc">
      {/* Key to the drawing; the table carries every value for screen readers */}
      <div className="prc__legend" aria-hidden="true">
        <span className="prc__key">
          <span className="prc__swatch" />
          ช่วงราคาตามรุ่นย่อย
        </span>
        {anyDealer && (
          <span className="prc__key">
            <span className="prc__swatch prc__swatch--dealer" />
            ราคาตัวแทนในไทย
          </span>
        )}
        {usedCurrencies.length > 0 && (
          <span className="prc__key">
            <span className="prc__swatch prc__swatch--converted" />
            แปลงจากราคาผู้ผลิต (โดยประมาณ)
          </span>
        )}
        <span className="prc__key prc__key--unit">แกนลอการิทึม หน่วย: บาท</span>
      </div>

      {/* Phones hide the head row visually, so the axis is repeated once above the rows */}
      {scale('prc__scale')}

      <table className="prc__table">
        <caption className="visually-hidden">
          ช่วงราคาหุ่นยนต์แต่ละรุ่น รวมทุกรุ่นย่อย เรียงจากราคาเริ่มต้นต่ำไปสูง แสดงบนแกนลอการิทึม
        </caption>
        <thead>
          <tr>
            <th scope="col" className="prc__name-head">
              รุ่น
            </th>
            <th scope="col" className="prc__axis-head">
              <span className="visually-hidden">ช่วงราคาบนแกนเดียวกัน</span>
              {scale('prc__ticks')}
            </th>
            <th scope="col" className="prc__price">
              ราคา (บาท)
            </th>
            <th scope="col" className="prc__basis">
              ที่มาของราคา
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ m, trims, basis }) => {
            const [lo, hi] = m.span.price
            // One dot per distinct price and basis (two trims at one price share a dot)
            const dots = [...new Map(trims.map((t) => [`${t.priceTHB}-${t.priceBasis}`, t])).values()]
            return (
              <tr key={m.id}>
                <th scope="row" className="prc__name">
                  <Link to={`/models/${m.id}`} lang="en">
                    {m.nameEn}
                  </Link>
                </th>
                <td className="prc__plot-cell">
                  <div className="prc__plot" aria-hidden="true">
                    {axis.ticks.map((t) => (
                      <span
                        key={t.value}
                        className={t.major ? 'prc__grid prc__grid--major' : 'prc__grid'}
                        style={{ left: pct(t.value) }}
                      />
                    ))}
                    <span
                      className={lo === hi ? 'prc__bar prc__bar--point' : 'prc__bar'}
                      style={{ left: pct(lo), width: `${(axis.at(hi) - axis.at(lo)) * 100}%` }}
                    />
                    {dots.map((t) => (
                      <span
                        key={`${t.priceTHB}-${t.priceBasis}`}
                        className={t.priceBasis === 'converted' ? 'prc__dot prc__dot--converted' : 'prc__dot'}
                        style={{ left: pct(t.priceTHB) }}
                      />
                    ))}
                  </div>
                </td>
                <td className="prc__price">
                  {basis.converted && <span className="prc__approx">ประมาณ </span>}
                  {/* Phones show a range that reaches a million in millions; the exact baht stays
                      for screen readers (and every wider screen) */}
                  <span className="prc__full">{spanText(lo, hi)}</span>
                  <span className="prc__brief" aria-hidden="true">
                    {spanBrief(lo, hi)}
                  </span>
                  {trims.length > 1 && <span className="prc__aside">{trims.length} รุ่นย่อย</span>}
                </td>
                <td className="prc__basis">
                  <span className="prc__basis-name">{basis.name}</span>
                  {basis.list && <span className="prc__aside">{basis.list}</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="prc__foot">
        {usedCurrencies.length > 0 && (
          <p>
            ราคาที่ระบุว่า “ประมาณ” แปลงจากราคาผู้ผลิตด้วยอัตรา{' '}
            {usedCurrencies.map((c, i) => (
              <span key={c}>
                {i > 0 && (i === usedCurrencies.length - 1 ? ' และ ' : ' ')}
                <span className="nowrap">
                  1 <span lang="en">{c}</span> = {rate(c).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} บาท
                </span>
              </span>
            ))}{' '}
            ณ <span className="nowrap">{dayTh(fx.date)}</span> ยังไม่รวม<span className="nowrap">ค่าขนส่ง</span>{' '}
            <span className="nowrap">อากรขาเข้า</span> และ<span className="nowrap">ภาษีมูลค่าเพิ่ม</span>
          </p>
        )}
        <p>
          แกนราคาเป็นแบบลอการิทึม ระยะจาก <span className="nowrap">1 แสน</span>ถึง{' '}
          <span className="nowrap">1 ล้านบาท</span>เท่ากับระยะจาก <span className="nowrap">1 ล้าน</span>ถึง{' '}
          <span className="nowrap">10 ล้านบาท</span> รุ่นราคาไม่สูงจึงไม่ถูกบีบรวมกันที่ต้นแกน
        </p>
        {unpriced.length > 0 && (
          <p>
            ยังไม่ประกาศราคา:{' '}
            {unpriced.map((m, i) => (
              <span key={m.id}>
                {i > 0 && ', '}
                <Link to={`/models/${m.id}`} lang="en">
                  {m.nameEn}
                </Link>
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  )
}
