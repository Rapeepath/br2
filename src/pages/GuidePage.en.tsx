import { Fragment, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { ArrowRight, Info } from 'lucide-react'
import { CountUp } from '../components/CountUp'
import { market, models } from '../data'
import { localized, localizedMarket } from '../i18n/content'
import { useTitle } from '../lib/a11y'
import { dayText, monthText } from '../lib/bilingual'
import { formatNumber } from '../lib/format'
import { useReveal } from '../lib/motion'
import type { Model } from '../lib/types'
import './GuidePage.en.css'

/*
  The buyer's guide in English: a faithful summary of each of the Thai guide's eight sections, built from
  the same catalogue and market data (the English text comes from src/data/en.json). The interactive
  checklist and the charts stay on the full Thai page, which this page links to plainly.
*/

const SECTIONS = [
  { id: 'market', title: 'Market overview' },
  { id: 'checklist', title: 'Buyer’s checklist' },
  { id: 'setup', title: 'Preparing the space' },
  { id: 'buying', title: 'Where to buy in Thailand' },
  { id: 'energy', title: 'Electricity per charge' },
  { id: 'costs', title: 'Yearly running costs' },
  { id: 'prices', title: 'Prices by model' },
  { id: 'law', title: 'Incentives and the law' },
] as const

const baht = (n: number) => formatNumber(Math.round(n))
const span = (min: number, max: number) => (min === max ? baht(min) : `${baht(min)}–${baht(max)}`)
const satang = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const sum = (xs: { min: number; max: number }[]) => xs.reduce((a, x) => ({ min: a.min + x.min, max: a.max + x.max }), { min: 0, max: 0 })

/** Electricity tariffs priced per unit (kWh), the ones a charge is costed with */
const TARIFFS = market.electricity.filter((e) => /หน่วย|kWh/i.test(e.unit))

/** One full charge, and an hour of work, at the cheapest and dearest tariff: kWh × rate, charger losses left out */
function chargeCosts(list: Model[]) {
  if (TARIFFS.length === 0) return []
  const lo = Math.min(...TARIFFS.map((r) => r.min))
  const hi = Math.max(...TARIFFS.map((r) => r.max))
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
            ? { min: Math.min(...timed.map((t) => (kwh(t) * lo) / t.runtimeH!)), max: Math.max(...timed.map((t) => (kwh(t) * hi) / t.runtimeH!)) }
            : null,
        },
      ]
    })
    .sort((a, b) => a.charge.min - b.charge.min)
}

function Section({ id, intro, children }: { id: (typeof SECTIONS)[number]['id']; intro?: ReactNode; children: ReactNode }) {
  const s = SECTIONS.find((x) => x.id === id)!
  return (
    <section id={id} tabIndex={-1} aria-labelledby={`${id}-title`} className="gsec">
      <div className="gsec__head">
        <h2 id={`${id}-title`}>{s.title}</h2>
        {intro && <p className="gsec__intro">{intro}</p>}
      </div>
      {children}
    </section>
  )
}

/** A plain list of the guide's items, title and detail */
function Items({ items }: { items: { title: string; detail: string }[] }) {
  return (
    <ul className="gen-items">
      {items.map((x) => (
        <li key={x.title} data-reveal>
          <h3>{x.title}</h3>
          <p>{x.detail}</p>
        </li>
      ))}
    </ul>
  )
}

export function GuideEn() {
  useTitle('Humanoid robot buyer’s guide')
  const main = useRef<HTMLDivElement>(null)
  useReveal(main)
  const location = useLocation()
  const mk = useMemo(() => localizedMarket(market, 'en'), [])
  const list = useMemo(() => models.map((m) => localized(m, 'en')), [])

  const jump = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ block: 'start' })
    el.focus({ preventScroll: true })
  }, [])

  // Links from other pages name the section to open, as on the Thai guide
  useEffect(() => {
    const section = (location.state as { section?: unknown } | null)?.section
    if (typeof section !== 'string' || !SECTIONS.some((s) => s.id === section)) return
    const frame = requestAnimationFrame(() => jump(section))
    return () => cancelAnimationFrame(frame)
  }, [location.key, location.state, jump])

  // Yearly costs: the fixed items plus one electricity tariff (the Thai rows named "ค่าไฟฟ้า…" are alternatives)
  const yearly = mk.ownershipCost.yearly
  const isPower = (i: number) => market.ownershipCost.yearly[i]?.item.startsWith('ค่าไฟฟ้า')
  const power = yearly.filter((_, i) => isPower(i))
  const fixed = sum(yearly.filter((_, i) => !isPower(i)))
  const yearTotal =
    power.length > 1
      ? { min: fixed.min + Math.min(...power.map((p) => p.min)), max: fixed.max + Math.max(...power.map((p) => p.max)) }
      : sum(yearly)
  const oneTime = sum(mk.ownershipCost.oneTime)
  const setupTotal = sum(mk.setup.costs)
  const charges = chargeCosts(list)
  const cheapestCharge = charges.length ? Math.min(...charges.map((c) => c.charge.min)) : null
  const ranked = mk.shipments.map((r) => ({ ...r, rank: 1 + mk.shipments.filter((o) => o.units > r.units).length }))
  const ROUTE_PHRASE = { 'thai-dealer': 'sold by a Thai dealer', import: 'imported to order', preorder: 'on pre-order' } as const
  const routes = (['thai-dealer', 'import', 'preorder'] as const)
    .map((a) => ({ label: ROUTE_PHRASE[a], n: list.filter((m) => m.availability === a).length }))
    .filter((r) => r.n > 0)
  const rates = (
    [
      ['USD', market.fx.usd],
      ['CNY', market.fx.cny],
      ['EUR', market.fx.eur],
    ] as const
  ).filter(([c]) => list.some((m) => m.trims.some((t) => t.priceBasis === 'converted' && t.listPrice?.currency === c)))

  return (
    <>
      <header className="gcover stage on-navy">
        <div className="container">
          <div className="gcover__inner">
            <div>
              <h1>
                Humanoid robot
                <br />
                <span className="tint">buyer’s guide</span>
              </h1>
            </div>
            <div className="gcover__aside">
              <p className="gcover__lede">
                What to check before you order, preparing the space and charging, where to buy in Thailand, electricity
                and yearly costs, prices by model, and the incentives and laws that apply.
              </p>
              <p className="gcover__meta">
                Data as of <span className="nowrap">{monthText(market.asOf, 'en')}</span>
              </p>
            </div>
          </div>

          <dl className="gfigures">
            <div>
              <dt>Checklist items</dt>
              <dd>
                <CountUp value={mk.buyerChecklist.length} />
              </dd>
            </div>
            <div>
              <dt>Sellers in Thailand</dt>
              <dd>
                <CountUp value={mk.sellers.length} />
              </dd>
            </div>
            {cheapestCharge != null && (
              <div>
                <dt>A full charge, from</dt>
                <dd>
                  {satang.format(cheapestCharge)} <span className="gfigures__unit">baht</span>
                </dd>
              </div>
            )}
            <div>
              <dt>Famous robots not yet on sale</dt>
              <dd>
                <CountUp value={mk.notForSale.length} />
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <div className="container glayout">
        <nav className="gtoc" aria-label="On this page">
          <p className="gtoc__title">On this page</p>
          <ol>
            {SECTIONS.map(({ id, title }) => (
              <li key={id}>
                <button type="button" onClick={() => jump(id)}>
                  <span className="gtoc__label">{title}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="gmain" ref={main}>
          <p className="gnote tone-sky gen-thai">
            <Info size={18} aria-hidden />
            <span>
              This English page sums up each section of the guide. The Thai guide has the full detail, including the
              checklist you can tick off, the charge-cost chart and the price chart.{' '}
              <a href="/guide" hrefLang="th" className="gnote__link">
                Full detail in Thai
              </a>
            </span>
          </p>

          <Section id="market" intro={mk.marketContext}>
            <div className="gtable">
              <table>
                <caption>Humanoid robots shipped worldwide, by maker</caption>
                <thead>
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col">Maker</th>
                    <th scope="col">Units shipped</th>
                    <th scope="col">Period</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r) => (
                    <tr key={r.brand}>
                      <td>{r.rank}</td>
                      <th scope="row">
                        {r.brand}
                        {r.note && <span className="gen-sub">{r.note}</span>}
                      </th>
                      <td>{formatNumber(r.units)}</td>
                      <td>{r.period}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="checklist" intro={`${mk.buyerChecklist.length} things to check before you order, whichever model you choose.`}>
            <Items items={mk.buyerChecklist} />
          </Section>

          <Section id="setup" intro="The steps to get a robot working safely, and what the extras usually cost.">
            <ol className="gen-steps">
              {mk.setup.steps.map((s) => (
                <li key={s.title} data-reveal>
                  <h3>{s.title}</h3>
                  <p>{s.detail}</p>
                </li>
              ))}
            </ol>
            <div className="gtable">
              <table>
                <caption>Set-up costs (baht)</caption>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Baht</th>
                  </tr>
                </thead>
                <tbody>
                  {mk.setup.costs.map((c) => (
                    <tr key={c.item}>
                      <th scope="row">{c.item}</th>
                      <td className="nowrap">{span(c.min, c.max)}</td>
                    </tr>
                  ))}
                  <tr className="gen-total">
                    <th scope="row">Total</th>
                    <td className="nowrap">{span(setupTotal.min, setupTotal.max)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            id="buying"
            intro={
              <>
                Of the {list.length} models in the catalogue,{' '}
                {routes.map((r, i) => (
                  <span key={r.label}>
                    {i > 0 && (i === routes.length - 1 ? ' and ' : ', ')}
                    {r.n} {r.n === 1 ? 'is' : 'are'} {r.label}
                  </span>
                ))}
                .
              </>
            }
          >
            <ul className="gen-items">
              {mk.sellers.map((s) => (
                <li key={s.name} data-reveal>
                  <h3>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.name}
                      <span className="visually-hidden"> (opens in a new tab)</span>
                    </a>
                  </h3>
                  <p>{s.detail}</p>
                </li>
              ))}
            </ul>
            <h3 className="gen-subhead">Well-known humanoids you can’t order yet</h3>
            <ul className="gen-plain">
              {mk.notForSale.map((r) => (
                <li key={r.name}>
                  <strong>{r.name}</strong> ({r.brand}): {r.status}
                </li>
              ))}
            </ul>
          </Section>

          <Section id="energy" intro="What a full charge costs at Thai electricity rates, from the smallest battery at the cheapest rate to the largest at the dearest. Charger losses are left out.">
            <div className="gtable">
              <table>
                <caption>Electricity rates</caption>
                <thead>
                  <tr>
                    <th scope="col">Rate</th>
                    <th scope="col">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {mk.electricity.map((e) => (
                    <tr key={e.label}>
                      <th scope="row">
                        {e.label}
                        {e.note && <span className="gen-sub">{e.note}</span>}
                      </th>
                      <td className="nowrap">
                        {e.min === e.max ? satang.format(e.min) : `${satang.format(e.min)}–${satang.format(e.max)}`} {e.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="gtable">
              <table>
                <caption>Cost of one full charge (baht)</caption>
                <thead>
                  <tr>
                    <th scope="col">Model</th>
                    <th scope="col">Full charge</th>
                    <th scope="col">Per hour of work</th>
                  </tr>
                </thead>
                <tbody>
                  {charges.map((c) => (
                    <tr key={c.model.id}>
                      <th scope="row">
                        <Link to={`/models/${c.model.id}`}>{c.model.nameEn}</Link>
                      </th>
                      <td className="nowrap">
                        {satang.format(c.charge.min)}–{satang.format(c.charge.max)}
                      </td>
                      <td className="nowrap">{c.hour ? `${satang.format(c.hour.min)}–${satang.format(c.hour.max)}` : 'Not stated'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            id="costs"
            intro={
              <>
                About <strong className="nowrap">{span(yearTotal.min, yearTotal.max)} baht a year</strong> to keep a robot
                running, not counting the robot itself, plus <span className="nowrap">{span(oneTime.min, oneTime.max)} baht</span>{' '}
                of one-off costs when you import one yourself.
              </>
            }
          >
            <div className="gtable">
              <table>
                <caption>Yearly costs (baht)</caption>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Baht a year</th>
                  </tr>
                </thead>
                <tbody>
                  {yearly.map((c) => (
                    <tr key={c.item}>
                      <th scope="row">{c.item}</th>
                      <td className="nowrap">{span(c.min, c.max)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {power.length > 1 && <p className="gtable__foot">The electricity rows are alternatives; the yearly total counts one of them.</p>}
            </div>
            <div className="gtable">
              <table>
                <caption>One-off costs (baht)</caption>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">Baht</th>
                  </tr>
                </thead>
                <tbody>
                  {mk.ownershipCost.oneTime.map((c) => (
                    <tr key={c.item}>
                      <th scope="row">{c.item}</th>
                      <td className="nowrap">{span(c.min, c.max)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            id="prices"
            intro={
              rates.length > 0 ? (
                <>
                  Prices marked “about” are the maker’s list price converted at{' '}
                  {rates.map(([c, r], i) => (
                    <Fragment key={c}>
                      {i > 0 && (i === rates.length - 1 ? ' and ' : ', ')}
                      <span className="nowrap">
                        1 {c} = {formatNumber(r)} baht
                      </span>
                    </Fragment>
                  ))}{' '}
                  on {dayText(market.fx.date, 'en')}; they exclude shipping, import duty and VAT.
                </>
              ) : undefined
            }
          >
            <div className="gtable">
              <table>
                <caption>Price of every model (baht)</caption>
                <thead>
                  <tr>
                    <th scope="col">Model</th>
                    <th scope="col">Trims</th>
                    <th scope="col">Price</th>
                    <th scope="col">Basis</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((m) => {
                    const p = m.span.price
                    const converted = m.trims.some((t) => t.priceBasis === 'converted')
                    const dealer = m.trims.some((t) => t.priceBasis === 'dealer')
                    return (
                      <tr key={m.id}>
                        <th scope="row">
                          <Link to={`/models/${m.id}`}>{m.nameEn}</Link>
                        </th>
                        <td>{m.trims.length}</td>
                        <td>{p ? `${converted && !dealer ? 'about ' : ''}${span(p[0], p[1])}` : 'Not announced'}</td>
                        <td>{dealer && converted ? 'Thai dealer and converted' : dealer ? 'Thai dealer' : converted ? 'Converted' : '–'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {mk.fx.note && <p className="gtable__foot">{mk.fx.note}</p>}
            </div>
            {mk.priceFactors.length > 0 && (
              <>
                <h3 className="gen-subhead">What moves the price</h3>
                <ul className="gen-plain">
                  {mk.priceFactors.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </>
            )}
          </Section>

          <Section id="law" intro="Government incentives a buyer may use, and the rules that apply to owning and running a humanoid robot in Thailand.">
            <h3 className="gen-subhead">Incentives</h3>
            <ul className="gen-plain">
              {mk.incentives.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <h3 className="gen-subhead">Laws and rules</h3>
            <ul className="gen-plain">
              {mk.legalNotes.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </Section>
        </div>
      </div>

      <section className="gend end-band on-navy" aria-labelledby="gend-en-title">
        <div className="container gen-end">
          <h2 id="gend-en-title">Ready to pick the right model?</h2>
          <Link to="/" className="btn btn-primary">
            See all {models.length} robots
            <ArrowRight size={18} aria-hidden className="btn__arrow" />
          </Link>
        </div>
      </section>
    </>
  )
}
