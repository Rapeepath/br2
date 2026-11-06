import { useRef } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowRight, CalendarCheck, SlidersHorizontal } from 'lucide-react'
import { StockBadge } from '../../components/commerce/CommerceBits'
import { Picture } from '../../components/Picture'
import { market } from '../../data'
import { useLang } from '../../i18n'
import { localizedMarket } from '../../i18n/content'
import { baht } from '../../lib/localeFormat'
import { useReveal } from '../../lib/motion'
import { photoStyle } from '../../lib/photo'
import { NotFoundPage } from '../NotFoundPage'
import { PageStage } from './PageStage'
import { SOLUTIONS, matchModels, solutionOf, type SolutionSlug } from './solutions'
import './solutions.css'

const COPY = {
  th: {
    title: 'โซลูชันตามงาน',
    sub: 'เลือกหุ่นยนต์จากงานที่จะใช้',
    lede: 'เริ่มจากงานของคุณ แล้วดูว่ารุ่นไหนผู้ผลิตออกแบบมาเพื่องานนั้น พร้อมสิ่งที่ต้องเตรียมก่อนเริ่มใช้',
    models: '{n} รุ่นที่เหมาะ',
    explore: 'ดูโซลูชัน',
    fitTitle: 'รุ่นที่เหมาะกับงานนี้',
    fitLede: 'เรียงจากรุ่นที่ผู้ผลิตออกแบบมาเพื่องานนี้โดยตรง เหตุผลยกมาจากข้อมูลของแต่ละรุ่น',
    primary: 'ออกแบบมาเพื่องานนี้',
    also: 'ใช้กับงานนี้ได้',
    from: 'เริ่มต้น',
    approx: 'ประมาณ',
    configure: 'จัดสเปก',
    model: 'ดูรุ่นนี้',
    needsTitle: 'สิ่งที่ควรเตรียมสำหรับงานนี้',
    setupTitle: 'ขั้นตอนเตรียมพื้นที่ก่อนรับเครื่อง',
    setupLede: 'จากคู่มือก่อนซื้อ ใช้ได้กับทุกรุ่น',
    demo: 'นัดชมการสาธิต',
    others: 'โซลูชันอื่น',
    finance: 'คำนวณค่างวด',
    none: 'ยังไม่มีรุ่นในแค็ตตาล็อกสำหรับงานนี้',
  },
  en: {
    title: 'Solutions by use',
    sub: 'Choose a robot by the job',
    lede: 'Start from your job, then see which models their makers built for it, and what to prepare before you start.',
    models: '{n} suitable models',
    explore: 'See the solution',
    fitTitle: 'Models that fit this job',
    fitLede: 'Models built for this job come first. The reasons are quoted from each model’s own data.',
    primary: 'Built for this job',
    also: 'Also used for this',
    from: 'From',
    approx: 'about',
    configure: 'Configure',
    model: 'See the model',
    needsTitle: 'What to prepare for this job',
    setupTitle: 'Preparing the space before delivery',
    setupLede: 'From the buyer’s guide; applies to every model.',
    demo: 'Book a demonstration',
    others: 'Other solutions',
    finance: 'Work out payments',
    none: 'No model in the catalogue fits this job yet',
  },
}

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''))

export function SolutionsPage() {
  const lang = useLang()
  const c = COPY[lang]
  const root = useRef<HTMLUListElement>(null)
  useReveal(root)
  return (
    <>
      <PageStage title={c.title} sub={c.sub} lede={c.lede} />
      <div className="container c-page">
        <ul className="sol-grid" ref={root}>
          {SOLUTIONS.map((s) => {
            const fits = matchModels(s.slug, lang)
            const cover = fits[0]?.model
            const t = s[lang]
            return (
              <li key={s.slug} data-reveal>
                <Link to={`/solutions/${s.slug}`} className="sol-card">
                  <span className="sol-card__photo">
                    {cover && <Picture src={cover.image.srcSmall} alt="" sizes="(max-width: 720px) 100vw, 50vw" style={photoStyle(cover.image)} />}
                  </span>
                  <span className="sol-card__body">
                    <span className="sol-card__title">{t.title}</span>
                    <span className="sol-card__short">{t.short}</span>
                    <span className="sol-card__count">{fill(c.models, { n: fits.length })}</span>
                    <span className="sol-card__go">
                      {c.explore}
                      <ArrowRight size={16} aria-hidden />
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}

export function SolutionPage() {
  const { slug } = useParams()
  const lang = useLang()
  const c = COPY[lang]
  const def = solutionOf(slug)
  const root = useRef<HTMLDivElement>(null)
  useReveal(root, slug)
  if (!def) return <NotFoundPage />
  const t = def[lang]
  const fits = matchModels(def.slug as SolutionSlug, lang)
  const steps = localizedMarket(market, lang).setup.steps

  return (
    <>
      <PageStage title={t.title} sub={t.short} lede={t.lede}>
        <div className="pstage__actions">
          <Link to="/booking" className="btn btn-primary">
            <CalendarCheck size={18} aria-hidden />
            {c.demo}
          </Link>
          <Link to="/solutions" className="btn btn-ghost">
            {c.others}
          </Link>
        </div>
      </PageStage>

      <div className="container c-page" ref={root}>
        <section className="c-section" aria-labelledby="sol-fit">
          <h2 id="sol-fit">{c.fitTitle}</h2>
          <p className="c-section__lede">{c.fitLede}</p>
          {fits.length === 0 && <p className="c-muted">{c.none}</p>}
          <ul className="sol-models">
            {fits.map(({ model: m, reasons, primary }) => {
              const cheapest = m.trims.find((x) => x.priceTHB != null)
              return (
                <li key={m.id} className="sol-model" data-reveal>
                  <div className="sol-model__photo">
                    <Picture src={m.image.srcSmall} alt="" sizes="(max-width: 720px) 100vw, 30vw" style={photoStyle(m.image)} />
                  </div>
                  <div className="sol-model__body">
                    <p className="sol-model__fit">{primary ? c.primary : c.also}</p>
                    <h3 lang="en">
                      <Link to={`/models/${m.id}`}>{m.nameEn}</Link>
                    </h3>
                    {reasons.length > 0 && (
                      <ul className="sol-model__reasons">
                        {reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    )}
                    <div className="sol-model__foot">
                      {cheapest?.priceTHB != null && (
                        <p className="sol-model__price">
                          {c.from} {cheapest.priceBasis === 'converted' && c.approx} <strong>{baht(cheapest.priceTHB, lang)}</strong>
                        </p>
                      )}
                      <StockBadge refId={m.id} />
                    </div>
                    <div className="sol-model__actions">
                      <Link to={`/configure/${m.id}`} className="btn btn-primary btn-sm">
                        <SlidersHorizontal size={16} aria-hidden />
                        {c.configure}
                      </Link>
                      <Link to={`/models/${m.id}`} className="btn btn-ghost btn-sm">
                        {c.model}
                      </Link>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="c-section c-split" aria-labelledby="sol-needs">
          <div className="c-sheet c-sheet--dark">
            <h2 id="sol-needs">{c.needsTitle}</h2>
            <ul className="sol-needs">
              {t.needs.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <div className="c-actions">
              <Link to="/finance" className="link-arrow">
                {c.finance}
                <ArrowRight size={16} aria-hidden />
              </Link>
            </div>
          </div>
          <div>
            <h2 className="sol-setup__title">{c.setupTitle}</h2>
            <p className="c-muted sol-setup__lede">{c.setupLede}</p>
            <ol className="c-steps sol-setup">
              {steps.map((s) => (
                <li key={s.title}>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <nav className="c-section" aria-labelledby="sol-others">
          <h2 id="sol-others">{c.others}</h2>
          <ul className="c-cards">
            {SOLUTIONS.filter((s) => s.slug !== def.slug).map((s) => (
              <li key={s.slug}>
                <Link to={`/solutions/${s.slug}`} className="c-card">
                  <h3>{s[lang].title}</h3>
                  <p>{s[lang].short}</p>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  )
}
