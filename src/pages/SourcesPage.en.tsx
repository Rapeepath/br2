import { useMemo, useRef } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Info } from 'lucide-react'
import { CountUp } from '../components/CountUp'
import { Picture } from '../components/Picture'
import { market, models } from '../data'
import { localized, localizedMarket } from '../i18n/content'
import { useTitle } from '../lib/a11y'
import { dayText, langFor, monthText } from '../lib/bilingual'
import { formatNumber } from '../lib/format'
import { useReveal } from '../lib/motion'
import { photoStyle } from '../lib/photo'
import type { ModelImage } from '../lib/types'
import { licenceUrl } from './SourcesPage.credits'
import { groupSources, sameMaker, splitSource } from './SourcesPage'
import './SourcesPage.en.css'

/*
  The sources appendix in English: the method, the shipment ranking, every reference by model and by
  topic, and the photo credits (main photos and the gallery), from the same data as the Thai page. Source
  titles stay as published. The Thai page keeps the full wording and is linked plainly.
*/

const GROUP_EN: Record<string, string> = {
  market: 'Market and shipments',
  price: 'Exchange rates and prices',
  seller: 'Sellers in Thailand',
  tax: 'Tax and importing',
  law: 'Law and standards',
  incentive: 'Incentives',
  power: 'Electricity',
  upkeep: 'Upkeep and running costs',
  upcoming: 'Robots not yet on sale',
  other: 'Other',
}

function OutLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" lang={langFor(children, 'en')}>
      {children}
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  )
}

export function SourcesEn() {
  useTitle('Sources')
  const method = useRef<HTMLElement>(null)
  useReveal(method)
  const mk = useMemo(() => localizedMarket(market, 'en'), [])
  const list = useMemo(() => models.map((m) => localized(m, 'en')), [])
  const groups = useMemo(() => groupSources(market.sources), [])
  const asOf = monthText(market.asOf, 'en')
  const modelRefs = list.reduce((n, m) => n + m.sources.length, 0)
  const galleryCount = list.reduce((n, m) => n + (m.gallery?.length ?? 0), 0)
  const ranked = mk.shipments.map((r) => ({ ...r, rank: 1 + mk.shipments.filter((o) => o.units > r.units).length }))
  const legs = list.filter((m) => m.locomotion === 'legs').length
  const wheels = list.filter((m) => m.locomotion === 'wheels').length
  const dealerOnly = list.filter((m) => m.trims.every((t) => t.priceBasis !== 'converted') && m.trims.some((t) => t.priceBasis === 'dealer')).length
  const convertedOnly = list.filter((m) => m.trims.every((t) => t.priceBasis !== 'dealer') && m.trims.some((t) => t.priceBasis === 'converted')).length
  const mixed = list.length - dealerOnly - convertedOnly
  const rates = (
    [
      ['USD', market.fx.usd],
      ['CNY', market.fx.cny],
      ['EUR', market.fx.eur],
    ] as const
  ).filter(([c]) => list.some((m) => m.trims.some((t) => t.priceBasis === 'converted' && t.listPrice?.currency === c)))

  const methods = [
    {
      title: 'Choosing the models',
      body: `Humanoid robots, on two legs or a human torso on a wheeled base, that a buyer in Thailand can order or pre-order as of ${asOf} and that have a published price, chosen mainly from the makers in the global shipment ranking: ${list.length} models in all (${legs} on two legs${wheels ? ` and ${wheels} on a wheeled base` : ''}). Famous robots that are not on sale yet are left out; the buyer’s guide lists ${mk.notForSale.length} of them.`,
    },
    {
      title: 'Prices',
      body: `${dealerOnly ? `Prices published by Thai dealers are used where a dealer publishes one (${dealerOnly} models). ` : ''}${convertedOnly ? `Models without a Thai price use the maker’s price converted into baht (${convertedOnly} models). ` : ''}${mixed > 0 ? `${mixed} more have both kinds, depending on the trim. ` : ''}${rates.length ? `The rates are ${rates.map(([c, r]) => `1 ${c} = ${formatNumber(r)} baht`).join(', ')} on ${dayText(market.fx.date, 'en')}, from the Bank of Thailand. Converted prices exclude shipping, import duty and VAT.` : ''}`,
    },
    {
      title: 'Specifications',
      body: 'The maker’s spec sheets and product pages come first; where a maker states nothing, figures come from the technology press. Makers measure runtime per charge, payload and speed under different conditions, so compare them with care.',
    },
    {
      title: 'Figures not disclosed',
      body: 'Where a maker doesn’t disclose a figure, or sources disagree so it can’t be confirmed, the page says “Not stated” rather than estimating one.',
    },
    {
      title: 'Order in the catalogue',
      body: 'Models follow their maker’s place in the shipment ranking, and within one maker run from the lowest starting price up.',
    },
    {
      title: 'Date of the data',
      body: `All data is as of ${asOf}${rates.length ? `, with exchange rates on ${dayText(market.fx.date, 'en')}` : ''}. Prices, specs and terms of sale may change; check with the seller before you decide.`,
    },
  ]

  return (
    <>
      <header className="scover stage on-navy">
        <div className="container scover__inner">
          <div>
            <h1>
              Sources
              <br />
              <span className="tint">and photo credits</span>
            </h1>
          </div>
          <div>
            <p className="scover__lede">
              The catalogue’s appendix: how the data was put together, where the maker ranking comes from, the
              references for all {list.length} robots, the market, tax and legal sources, and the photo credits.
            </p>
            <p className="scover__meta">
              <span>
                Data <span className="nowrap">as of {asOf}</span>
              </span>
              <span>External links open in a new tab</span>
            </p>
          </div>
        </div>
        <div className="container">
          <dl className="sfigures">
            <div>
              <dt>Models in the catalogue</dt>
              <dd>
                <CountUp value={list.length} />
              </dd>
            </div>
            <div>
              <dt>References by model</dt>
              <dd>
                <CountUp value={modelRefs} />
              </dd>
            </div>
            <div>
              <dt>Market and guide sources</dt>
              <dd>
                <CountUp value={market.sources.length} />
              </dd>
            </div>
            <div>
              <dt>Credited photos and clips</dt>
              <dd>
                <CountUp value={list.length + galleryCount} />
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="section ssec" aria-labelledby="src-en-method" ref={method}>
        <div className="container">
          <p className="sen-thai">
            <Info size={18} aria-hidden />
            <span>
              This English page covers every part of the appendix in brief. Source titles are given as published, so
              some are in Thai.{' '}
              <a href="/sources" hrefLang="th">
                Full detail in Thai
              </a>
            </span>
          </p>
          <div className="section-head">
            <h2 id="src-en-method">How the data was gathered</h2>
            <p>The rules used to choose the models and put the figures together on every page.</p>
          </div>
          <ol className="smethod">
            {methods.map((m) => (
              <li key={m.title} data-reveal>
                <h3>{m.title}</h3>
                <p>{m.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section--band ssec" aria-labelledby="src-en-rank">
        <div className="container">
          <div className="section-head">
            <h2 id="src-en-rank">Where the maker order comes from</h2>
            <p>
              The catalogue is ordered by each maker’s worldwide shipments of humanoid robots. A maker’s figure counts
              every model it ships, not only those sold in Thailand.
            </p>
          </div>
          <div className="gtable sen-table">
            <table>
              <caption>Humanoid robot shipments worldwide</caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Maker</th>
                  <th scope="col">Units shipped</th>
                  <th scope="col">Period</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r) => {
                  const inCatalogue = list.filter((m) => sameMaker(r.brand, m.brand))
                  return (
                    <tr key={r.brand}>
                      <td>{r.rank}</td>
                      <th scope="row">
                        {r.brand}
                        {inCatalogue.length > 0 && (
                          <span className="sen-sub">
                            In the catalogue:{' '}
                            {inCatalogue.map((m, i) => (
                              <span key={m.id}>
                                {i > 0 && ', '}
                                <Link to={`/models/${m.id}`}>{m.nameEn}</Link>
                              </span>
                            ))}
                          </span>
                        )}
                        {r.note && <span className="sen-sub">{r.note}</span>}
                      </th>
                      <td>{formatNumber(r.units)}</td>
                      <td>{r.period}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section ssec" aria-labelledby="src-en-models">
        <div className="container">
          <div className="section-head">
            <h2 id="src-en-models">References by model</h2>
            <p>
              The makers’ product pages and spec sheets, sellers’ price pages and technology press used for each model:{' '}
              {list.length} models, {formatNumber(modelRefs)} references.
            </p>
          </div>
          <div className="sacc">
            {list.map((m) => (
              <details key={m.id}>
                <summary>
                  <span className="sacc__thumb">
                    <Picture src={m.image.srcSmall} alt="" sizes="120px" style={photoStyle(m.image)} />
                  </span>
                  <span className="sacc__name">
                    <span className="sacc__en">{m.nameEn}</span>
                  </span>
                  <span className="chip sacc__count">{m.sources.length} references</span>
                </summary>
                <div className="sacc__panel">
                  <ol className="sen-refs">
                    {m.sources.map((s) => {
                      const { title, publisher } = splitSource(s.title)
                      return (
                        <li key={s.url}>
                          <OutLink href={s.url}>{title}</OutLink>
                          {publisher && (
                            <span className="sen-sub" lang={langFor(publisher, 'en')}>
                              {publisher}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                  <Link to={`/models/${m.id}`} className="link-arrow sacc__go">
                    <span>See the {m.nameEn} page</span>
                    <ArrowRight size={16} aria-hidden />
                  </Link>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--band ssec" aria-labelledby="src-en-market">
        <div className="container">
          <div className="section-head">
            <h2 id="src-en-market">Market and guide sources</h2>
            <p>
              Shipments, exchange rates, Thai sellers, import tax, law and the costs used in the buyer’s guide:{' '}
              {groups.length} topics, {market.sources.length} sources.
            </p>
          </div>
          <div className="sgroups">
            {groups.map((g) => (
              <section key={g.id} className="sgroup" aria-labelledby={`src-en-g-${g.id}`}>
                <h3 id={`src-en-g-${g.id}`} className="sgroup__title">
                  <span>{GROUP_EN[g.id] ?? g.title}</span>
                  <span className="sgroup__count">{g.items.length}</span>
                </h3>
                <ol className="sen-refs" start={g.items[0].n}>
                  {g.items.map((s) => {
                    const { title, publisher } = splitSource(s.title)
                    return (
                      <li key={s.url}>
                        <OutLink href={s.url}>{title}</OutLink>
                        {publisher && (
                            <span className="sen-sub" lang={langFor(publisher, 'en')}>
                              {publisher}
                            </span>
                          )}
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
          </div>
        </div>
      </section>

      <section className="section ssec" aria-labelledby="src-en-photos">
        <div className="container">
          <div className="section-head">
            <h2 id="src-en-photos">Photo credits</h2>
            <p>
              Every robot photo and clip is from Wikimedia Commons, used under its author’s licence. Photos may be cropped
              or resized for layout.
            </p>
          </div>
          <ul className="scredits">
            {list.flatMap((m) =>
              [
                { key: `${m.id}-main`, src: m.image.srcSmall, image: m.image, alt: 'Main photo', author: m.image.author, license: m.image.license, page: m.image.page, kind: 'image' as const },
                ...(m.gallery ?? []).map((g, i) => ({
                  key: `${m.id}-g${i}`,
                  src: g.srcSmall,
                  image: { focus: g.focus, zoom: g.zoom } as ModelImage,
                  alt: g.alt,
                  author: g.author,
                  license: g.license,
                  page: g.page,
                  kind: g.kind,
                })),
              ].map((c) => {
                const deed = licenceUrl(c.license)
                return (
                  <li key={c.key}>
                    <span className="scredits__media">
                      <Picture src={c.src} alt="" sizes="120px" style={photoStyle(c.image)} />
                    </span>
                    <p className="scredits__name">
                      {m.nameEn}
                      <span className="sen-sub">{c.kind === 'video' ? `Video: ${c.alt}` : c.alt}</span>
                    </p>
                    <dl className="scredits__spec">
                      <div>
                        <dt>{c.kind === 'video' ? 'Filmed by' : 'Photographer'}</dt>
                        <dd>{c.author}</dd>
                      </div>
                      <div>
                        <dt>Licence</dt>
                        <dd>{deed ? <OutLink href={deed}>{c.license}</OutLink> : c.license}</dd>
                      </div>
                      <div>
                        <dt>Original</dt>
                        <dd>
                          <OutLink href={c.page}>Wikimedia Commons</OutLink>
                        </dd>
                      </div>
                    </dl>
                  </li>
                )
              }),
            )}
          </ul>
        </div>
      </section>

      <section className="snotice end-band on-navy" aria-labelledby="src-en-notice">
        <div className="container snotice__inner">
          <div>
            <h2 id="src-en-notice">
              Trademarks
              <br />
              <span className="tint">and the limits of the data</span>
            </h2>
          </div>
          <div className="snotice__body">
            <p>
              All model names, logos and trademarks belong to their owners. This site gives information to help you
              decide and has no connection with any maker or distributor.
            </p>
            <p>
              Data as of {asOf}. Prices, specifications and terms of sale may change without notice. Prices converted from
              foreign currencies are approximate and exclude shipping, import duty and VAT. Check with the seller before
              you decide.
            </p>
            <Link to="/" className="link-arrow snotice__cta">
              Back to all robots
              <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
