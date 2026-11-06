import { useId, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { market, models } from '../../data'
import { useLang } from '../../i18n'
import { localizedMarket } from '../../i18n/content'
import { FINANCE_TERMS, RENT_FACTORS, finance, rent, sumRanges, type FinanceMode } from '../../lib/finance'
import { baht, num } from '../../lib/localeFormat'
import { PageStage, SimNote } from './PageStage'
import './finance.css'

type Mode = FinanceMode | 'rent'

const COPY = {
  th: {
    title: 'คำนวณค่างวดและค่าใช้จ่าย',
    sub: 'เช่าซื้อ ลีสซิ่ง หรือเช่ารายเดือน',
    lede: 'เลือกรุ่นหรือใส่ราคาเอง แล้วดูค่างวดต่อเดือน ยอดดาวน์ และค่าใช้จ่ายรายปีหลังซื้อ ตัวเลขทั้งหมดเป็นประมาณการ',
    price: 'ราคาเครื่อง',
    pickModel: 'เลือกรุ่นย่อย',
    custom: 'ใส่ราคาเอง',
    customLabel: 'ราคา (บาท รวม VAT)',
    mode: 'รูปแบบ',
    modes: { hire: 'เช่าซื้อ', lease: 'ลีสซิ่ง', rent: 'เช่ารายเดือน' } as Record<Mode, string>,
    modeHint: {
      hire: 'ผ่อนจนครบแล้วเป็นเจ้าของเครื่อง ดอกเบี้ยคงที่ต่อปี',
      lease: 'เช่าใช้ระยะยาวสำหรับนิติบุคคล ดาวน์ต่ำ ค่างวดหักเป็นค่าใช้จ่ายได้',
      rent: 'เช่ารวมบำรุงรักษา คืนเครื่องเมื่อครบสัญญา',
    } as Record<Mode, string>,
    down: 'เงินดาวน์',
    term: 'ระยะเวลา',
    months: '{n} เดือน',
    rate: 'ดอกเบี้ยคงที่ต่อปี',
    result: 'ค่างวดต่อเดือน',
    perMonth: 'ต่อเดือน',
    downPayment: 'เงินดาวน์',
    financed: 'ยอดจัด',
    interest: 'ดอกเบี้ยรวม',
    totalPayable: 'รวมที่จ่ายทั้งหมด',
    rentTotal: 'ค่าเช่ารวมตลอดสัญญา',
    rentNote: 'ค่าเช่าเท่ากับราคาเครื่อง × {pct}% ต่อเดือน รวมบำรุงรักษา คืนเครื่องเมื่อครบสัญญา (อัตราจำลองของโชว์รูม)',
    compareTitle: 'ค่างวดตามระยะเวลา',
    compareLede: 'ยิ่งผ่อนนาน ค่างวดยิ่งต่ำ แต่ดอกเบี้ยรวมสูงขึ้น',
    colTerm: 'ระยะเวลา',
    colMonthly: 'ค่างวดต่อเดือน',
    colTotal: 'รวมที่จ่าย',
    tcoTitle: 'ค่าใช้จ่ายรายปีหลังซื้อ',
    tcoLede: 'ช่วงต่ำสุดถึงสูงสุดจากข้อมูลตลาดในคู่มือก่อนซื้อ ขึ้นกับขนาดเครื่องและการใช้งาน',
    colItem: 'รายการ',
    colRange: 'ช่วงต่อปี',
    yearTotal: 'รวมต่อปี',
    oneTitle: 'ค่าใช้จ่ายครั้งเดียวที่ควรเผื่อ',
    colOne: 'ช่วงราคา',
    configure: 'ใส่ค่างวดนี้ในใบเสนอราคา',
    guide: 'อ่านคู่มือก่อนซื้อ',
    note: 'อัตราและเงื่อนไขเป็นประมาณการของโชว์รูมจำลอง การอนุมัติสินเชื่อ อัตราดอกเบี้ย และเงื่อนไขจริงขึ้นกับบริษัทลีสซิ่งหรือสถาบันการเงิน',
    selected: 'ที่เลือก',
    range: '{min}–{max}',
  },
  en: {
    title: 'Financing and running costs',
    sub: 'Hire purchase, leasing or monthly rental',
    lede: 'Pick a model or enter a price, then see the monthly payment, the down payment and the yearly costs after you buy. Every figure is an estimate.',
    price: 'Price',
    pickModel: 'Choose a trim',
    custom: 'Enter a price',
    customLabel: 'Price (THB incl. VAT)',
    mode: 'Type',
    modes: { hire: 'Hire purchase', lease: 'Leasing', rent: 'Monthly rental' } as Record<Mode, string>,
    modeHint: {
      hire: 'You own the robot once it is paid off; flat interest per year',
      lease: 'Long-term use for companies; low down payment, payments are a business expense',
      rent: 'Rental with maintenance included; the robot goes back at the end',
    } as Record<Mode, string>,
    down: 'Down payment',
    term: 'Term',
    months: '{n} months',
    rate: 'Flat interest per year',
    result: 'Monthly payment',
    perMonth: 'a month',
    downPayment: 'Down payment',
    financed: 'Amount financed',
    interest: 'Total interest',
    totalPayable: 'Total paid',
    rentTotal: 'Total rent over the term',
    rentNote: 'Rent is the price × {pct}% a month, maintenance included, robot returned at the end (the demo showroom’s simulated rate).',
    compareTitle: 'Payments by term',
    compareLede: 'The longer the term, the lower the payment, but the more interest in total.',
    colTerm: 'Term',
    colMonthly: 'Monthly',
    colTotal: 'Total paid',
    tcoTitle: 'Yearly costs after you buy',
    tcoLede: 'Low to high from the market data in the buyer’s guide; depends on the robot’s size and use.',
    colItem: 'Item',
    colRange: 'Per year',
    yearTotal: 'Total per year',
    oneTitle: 'One-off costs to allow for',
    colOne: 'Range',
    configure: 'Put this financing on a quotation',
    guide: 'Read the buyer’s guide',
    note: 'Rates and terms are the demo showroom’s estimates. Credit approval, rates and actual terms depend on the leasing company or bank.',
    selected: 'selected',
    range: '{min}–{max}',
  },
}

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''))

/** Every trim with a baht price, as {key, label, price, modelId} */
const TRIMS = models.flatMap((m) =>
  m.trims
    .filter((t) => t.priceTHB != null)
    .map((t) => ({
      key: `${m.id}::${t.name}`,
      modelId: m.id,
      label: t.name.toLowerCase().startsWith(m.brand.toLowerCase()) ? t.name : `${m.brand} ${t.name}`,
      price: t.priceTHB!,
    })),
)

export function FinancePage() {
  const lang = useLang()
  const c = COPY[lang]
  const [params] = useSearchParams()
  const qPrice = Number(params.get('price'))
  const qModel = params.get('model')
  const initial = TRIMS.find((t) => qModel && t.modelId === qModel && (!qPrice || t.price === qPrice)) ?? TRIMS.find((t) => t.price === qPrice)
  const [source, setSource] = useState<'model' | 'custom'>(qPrice && !initial ? 'custom' : 'model')
  const [trimKey, setTrimKey] = useState(initial?.key ?? TRIMS[0]?.key ?? '')
  const [custom, setCustom] = useState(qPrice && !initial ? String(qPrice) : '')
  const [mode, setMode] = useState<Mode>('hire')
  const [downPct, setDownPct] = useState<number>(FINANCE_TERMS.hire.downPct.default)
  const [months, setMonths] = useState<number>(60)
  const [rentMonths, setRentMonths] = useState(12)
  const ids = { mode: useId(), down: useId(), term: useId(), price: useId(), custom: useId() }

  const trim = TRIMS.find((t) => t.key === trimKey)
  const price = source === 'custom' ? Math.max(0, Math.round(Number(custom.replace(/[^\d.]/g, '')) || 0)) : (trim?.price ?? 0)

  const switchMode = (m: Mode) => {
    setMode(m)
    if (m === 'rent') return
    const t = FINANCE_TERMS[m]
    setDownPct(t.downPct.default)
    setMonths(t.months.at(-1)!)
  }

  const terms = mode === 'rent' ? null : FINANCE_TERMS[mode]
  const result = mode !== 'rent' && price > 0 ? finance(price, mode, downPct, months) : null
  const rented = mode === 'rent' && price > 0 ? rent(price, rentMonths) : null
  const byTerm = useMemo(
    () => (mode === 'rent' || price <= 0 ? [] : FINANCE_TERMS[mode].months.map((m) => finance(price, mode, downPct, m))),
    [mode, price, downPct],
  )
  const maxMonthly = Math.max(1, ...byTerm.map((r) => r.monthly))

  const mk = localizedMarket(market, lang)
  const yearly = mk.ownershipCost.yearly
  const yearTotal = sumRanges(yearly)
  const oneOff = [...mk.ownershipCost.oneTime, ...mk.setup.costs].filter((x) => x.max > 0)
  const maxYear = Math.max(1, ...yearly.map((x) => x.max))
  const quoteHref = trim ? `/configure/${trim.modelId}?finance=${mode === 'rent' ? 'hire' : mode}&down=${downPct}&months=${months}` : null

  return (
    <>
      <PageStage title={c.title} sub={c.sub} lede={c.lede} />
      <div className="container c-page finance">
        <div className="finance__calc">
          <form className="c-sheet finance__inputs" onSubmit={(e) => e.preventDefault()}>
            <fieldset className="fin-group">
              <legend className="field__label">{c.price}</legend>
              <div className="fin-seg" role="radiogroup" aria-label={c.price}>
                {(['model', 'custom'] as const).map((s) => (
                  <label key={s} className="fin-seg__opt">
                    <input type="radio" name="source" checked={source === s} onChange={() => setSource(s)} />
                    <span>{s === 'model' ? c.pickModel : c.custom}</span>
                  </label>
                ))}
              </div>
              {source === 'model' ? (
                <div className="field">
                  <label className="visually-hidden" htmlFor={ids.price}>
                    {c.pickModel}
                  </label>
                  <select id={ids.price} className="field__control field__select" value={trimKey} onChange={(e) => setTrimKey(e.target.value)}>
                    {TRIMS.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label} ({baht(t.price, lang)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="field">
                  <label className="field__label" htmlFor={ids.custom}>
                    {c.customLabel}
                  </label>
                  <input
                    id={ids.custom}
                    className="field__control"
                    inputMode="numeric"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    placeholder="1,500,000"
                  />
                </div>
              )}
            </fieldset>

            <fieldset className="fin-group">
              <legend className="field__label">{c.mode}</legend>
              <div className="fin-seg fin-seg--3" role="radiogroup" aria-label={c.mode}>
                {(['hire', 'lease', 'rent'] as Mode[]).map((m) => (
                  <label key={m} className="fin-seg__opt">
                    <input type="radio" name="mode" checked={mode === m} onChange={() => switchMode(m)} />
                    <span>{c.modes[m]}</span>
                  </label>
                ))}
              </div>
              <p className="field__hint">{c.modeHint[mode]}</p>
            </fieldset>

            {terms ? (
              <>
                <div className="field">
                  <label className="field__label" htmlFor={ids.down}>
                    {c.down} <output className="fin-out">{downPct}%</output>
                  </label>
                  <input
                    id={ids.down}
                    type="range"
                    className="fin-range"
                    min={terms.downPct.min}
                    max={terms.downPct.max}
                    step={5}
                    value={downPct}
                    onChange={(e) => setDownPct(Number(e.target.value))}
                    aria-valuetext={`${downPct}%`}
                  />
                  <p className="field__hint">
                    {terms.downPct.min}–{terms.downPct.max}%
                  </p>
                </div>
                <fieldset className="fin-group">
                  <legend className="field__label">{c.term}</legend>
                  <div className="fin-seg fin-seg--wrap" role="radiogroup" aria-label={c.term}>
                    {terms.months.map((m) => (
                      <label key={m} className="fin-seg__opt">
                        <input type="radio" name="months" checked={months === m} onChange={() => setMonths(m)} />
                        <span>{fill(c.months, { n: m })}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <p className="fin-rate">
                  {c.rate} <strong>{terms.ratePct}%</strong>
                </p>
              </>
            ) : (
              <fieldset className="fin-group">
                <legend className="field__label">{c.term}</legend>
                <div className="fin-seg" role="radiogroup" aria-label={c.term}>
                  {Object.keys(RENT_FACTORS).map((k) => (
                    <label key={k} className="fin-seg__opt">
                      <input type="radio" name="rentMonths" checked={rentMonths === Number(k)} onChange={() => setRentMonths(Number(k))} />
                      <span>{fill(c.months, { n: k })}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </form>

          <section className="c-sheet c-sheet--dark finance__result" aria-live="polite" aria-labelledby="fin-result">
            <h2 id="fin-result">{c.result}</h2>
            <p className="finance__monthly">
              <span className="figure-display">{baht(result?.monthly ?? rented?.monthly ?? 0, lang)}</span>{' '}
              <span className="finance__per">{c.perMonth}</span>
            </p>
            {result && (
              <dl className="c-dl">
                <div>
                  <dt>{c.price}</dt>
                  <dd>{baht(price, lang)}</dd>
                </div>
                <div>
                  <dt>{c.downPayment}</dt>
                  <dd>
                    {baht(result.downPayment, lang)} ({result.downPct}%)
                  </dd>
                </div>
                <div>
                  <dt>{c.financed}</dt>
                  <dd>{baht(result.financed, lang)}</dd>
                </div>
                <div>
                  <dt>{c.interest}</dt>
                  <dd>{baht(Math.max(0, result.interest), lang)}</dd>
                </div>
                <div>
                  <dt>{c.totalPayable}</dt>
                  <dd>{baht(result.totalPayable, lang)}</dd>
                </div>
              </dl>
            )}
            {rented && (
              <>
                <dl className="c-dl">
                  <div>
                    <dt>{c.price}</dt>
                    <dd>{baht(price, lang)}</dd>
                  </div>
                  <div>
                    <dt>{c.rentTotal}</dt>
                    <dd>{baht(rented.total, lang)}</dd>
                  </div>
                </dl>
                <p className="finance__rentnote">{fill(c.rentNote, { pct: num(rented.factor * 100, lang) })}</p>
              </>
            )}
            {quoteHref && mode !== 'rent' && (
              <Link to={quoteHref} className="btn btn-primary finance__cta">
                {c.configure}
              </Link>
            )}
          </section>
        </div>

        {byTerm.length > 0 && (
          <section className="c-section" aria-labelledby="fin-compare">
            <h2 id="fin-compare">{c.compareTitle}</h2>
            <p className="c-section__lede">{c.compareLede}</p>
            <div className="c-tablewrap">
              <table className="c-table fin-bars c-table--stack">
                <thead>
                  <tr>
                    <th scope="col">{c.colTerm}</th>
                    <th scope="col">{c.colMonthly}</th>
                    <th scope="col" className="num">
                      {c.colTotal}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {byTerm.map((r) => (
                    <tr key={r.months} data-selected={r.months === months ? '' : undefined}>
                      <th scope="row">
                        {fill(c.months, { n: r.months })}
                        {r.months === months && <span className="fin-bars__tag">{c.selected}</span>}
                      </th>
                      <td data-label={c.colMonthly}>
                        <span className="fin-bar">
                          <span className="fin-bar__track" aria-hidden="true">
                            <span className="fin-bar__fill" style={{ width: `${(r.monthly / maxMonthly) * 100}%` }} />
                          </span>
                          <span className="fin-bar__value">{baht(r.monthly, lang)}</span>
                        </span>
                      </td>
                      <td className="num" data-label={c.colTotal}>
                        {baht(r.totalPayable, lang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="c-section" aria-labelledby="fin-tco">
          <h2 id="fin-tco">{c.tcoTitle}</h2>
          <p className="c-section__lede">{c.tcoLede}</p>
          <div className="c-tablewrap">
            <table className="c-table fin-ranges c-table--stack">
              <thead>
                <tr>
                  <th scope="col">{c.colItem}</th>
                  <th scope="col">{c.colRange}</th>
                </tr>
              </thead>
              <tbody>
                {yearly.map((x) => (
                  <tr key={x.item}>
                    <th scope="row" className="fin-ranges__item">
                      {x.item}
                    </th>
                    <td data-label={c.colRange}>
                      <span className="fin-range-bar" aria-hidden="true">
                        <span
                          className="fin-range-bar__fill"
                          style={{ left: `${(x.min / maxYear) * 100}%`, width: `${Math.max(1, ((x.max - x.min) / maxYear) * 100)}%` }}
                        />
                      </span>
                      <span className="fin-ranges__value">{fill(c.range, { min: num(x.min, lang), max: baht(x.max, lang) })}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{c.yearTotal}</th>
                  <td data-label={c.colRange}>{fill(c.range, { min: num(yearTotal.min, lang), max: baht(yearTotal.max, lang) })}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <h3 className="fin-one__title">{c.oneTitle}</h3>
          <div className="c-tablewrap">
            <table className="c-table c-table--stack">
              <thead>
                <tr>
                  <th scope="col">{c.colItem}</th>
                  <th scope="col" className="num">
                    {c.colOne}
                  </th>
                </tr>
              </thead>
              <tbody>
                {oneOff.map((x) => (
                  <tr key={x.item}>
                    <th scope="row" className="fin-ranges__item">
                      {x.item}
                    </th>
                    <td data-label={c.colOne} className="num">
                      {x.min === x.max ? baht(x.max, lang) : fill(c.range, { min: num(x.min, lang), max: baht(x.max, lang) })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="c-actions">
            <Link to="/guide" className="link-arrow">
              {c.guide}
            </Link>
          </div>
        </section>
        <SimNote>{c.note}</SimNote>
      </div>
    </>
  )
}
