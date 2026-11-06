import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { formatNumber } from '../lib/format'
import { useLang } from '../i18n'
import { pick, units } from '../lib/bilingual'
import { motionOk } from '../lib/motion'
import { photoStyle } from '../lib/photo'
import type { Model } from '../lib/types'
import { CountUp } from './CountUp'
import { Picture } from './Picture'
import './ShowroomStage.css'

interface Props {
  models: Model[]
  /** The page's h1, set small above the featured model */
  title: ReactNode
  /** "ดูทั้ง N รุ่น": jumps to the lineup */
  onBrowse: () => void
}

/** The model's own name without its maker: "AGIBOT X2" → "X2", "LimX Luna" (LimX Dynamics) → "Luna" */
export const shortName = (m: Model) => {
  for (const prefix of [m.brand, m.brand.split(/\s+/)[0]]) {
    const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const rest = m.nameEn.replace(new RegExp(`^${esc}\\s+`, 'i'), '')
    if (rest !== m.nameEn && rest) return rest
  }
  return m.nameEn
}

/**
 * The home page's showroom stage, like a car maker's model switcher: one robot under a spotlight with
 * its name, starting price and four spec readouts, and a rail of every model along the floor. Picking a
 * model sweeps an LED scan line down the photo (a LIDAR pass) while the readouts count to the new
 * figures. The rail is a WAI-ARIA tab list: arrows, Home and End move and select.
 */
export function ShowroomStage({ models, title, onBrowse }: Props) {
  const lang = useLang()
  const tx = <T,>(th: T, en: T) => pick(lang, th, en)
  const u = units(lang)
  const base = useId()
  const [index, setIndex] = useState(0)
  // The photo being scanned over, kept underneath until the new one is fully revealed
  const [under, setUnder] = useState<Model | null>(null)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const model = models[index]
  if (!model) return null

  const select = (next: number) => {
    if (next === index) return
    if (motionOk()) setUnder(models[index])
    setIndex(next)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = models.length - 1
    let next: number | null = null
    if (e.key === 'ArrowRight') next = index === last ? 0 : index + 1
    else if (e.key === 'ArrowLeft') next = index === 0 ? last : index - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = last
    if (next == null) return
    e.preventDefault()
    select(next)
    tabs.current[next]?.focus()
  }

  const cheapest = model.trims.find((t) => t.priceTHB != null) ?? null
  const short = shortName(model)
  const readouts: { label: string; value: number | null; unit: string }[] = [
    { label: tx('ความสูง', 'Height'), value: model.heightCm, unit: u.cm },
    { label: tx('องศาอิสระสูงสุด', 'Degrees of freedom'), value: model.span.dof?.[1] ?? null, unit: 'DOF' },
    { label: tx('ใช้งานต่อการชาร์จ', 'Runtime per charge'), value: model.span.runtimeH?.[1] ?? null, unit: u.h },
  ]
  const panelId = `${base}-panel`
  const tabId = (i: number) => `${base}-tab-${i}`

  return (
    <section className="stage on-navy" aria-labelledby={`${base}-title`}>
      <div className="container stage__inner">
        <div className="stage__intro">
          <h1 id={`${base}-title`} className="stage__title">
            {title}
          </h1>
        </div>

        <div className="stage__photo" aria-hidden="true">
          {under && (
            <Picture className="stage__img stage__img--under" src={under.image.src} alt="" sizes="(max-width: 960px) 100vw, 66vw" loading="eager" style={photoStyle(under.image)} />
          )}
          <Picture
            key={model.id}
            className="stage__img stage__img--in"
            src={model.image.src}
            alt=""
            sizes="(max-width: 960px) 100vw, 66vw"
            priority={index === 0}
            loading="eager"
            style={photoStyle(model.image)}
            onAnimationEnd={() => setUnder(null)}
          />
          <span key={`scan-${model.id}`} className="stage__scan" />
        </div>

        <div className="stage__panel" role="tabpanel" id={panelId} aria-labelledby={tabId(index)} tabIndex={0}>
          <div key={model.id} className="stage__copy">
            {/* The brand small, the model's own name as large as its letters allow (sized per name) */}
            <h2 className="stage__name" lang="en" style={{ '--chars': Math.max(3, short.length) } as CSSProperties}>
              {short !== model.nameEn && (
                <>
                  <span className="stage__brand">{model.brand}</span>{' '}
                </>
              )}
              <span className="stage__model">{short}</span>
            </h2>
            {lang === 'en' ? <p className="stage__th">{model.segment}</p> : <p className="stage__th">{model.nameTh}</p>}
            <p className="stage__price">
              <span className="stage__price-label">
                {cheapest?.priceBasis === 'converted' ? tx('ราคาเริ่มต้นประมาณ', 'From about') : tx('ราคาเริ่มต้น', 'From')}
              </span>
              {cheapest?.priceTHB != null ? (
                <span className="stage__price-figure figure-display">
                  {formatNumber(cheapest.priceTHB)} <span className="stage__price-unit">{u.baht}</span>
                </span>
              ) : (
                <span className="stage__price-figure">{tx('ยังไม่ประกาศราคา', 'Price not announced')}</span>
              )}
            </p>
          </div>

          <dl className="stage__readouts">
            {readouts.map((r) => (
              <div key={r.label}>
                <dt>{r.label}</dt>
                <dd>
                  {r.value != null ? (
                    <>
                      <span className="stage__readout-figure">
                        <CountUp value={r.value} />
                      </span>{' '}
                      <span className="stage__readout-unit">{r.unit}</span>
                    </>
                  ) : (
                    <span className="stage__readout-none">{tx('ไม่ระบุ', 'Not stated')}</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <div className="stage__actions">
            <Link to={`/models/${model.id}`} className="btn btn-primary">
              {tx('ดูสเปกและราคา', 'See specs and prices')}
              <span className="visually-hidden"> {model.nameEn}</span>
              <ArrowRight size={18} aria-hidden className="btn__arrow" />
            </Link>
            <button type="button" className="btn btn-ghost" onClick={onBrowse}>
              {tx(`ดูทั้ง ${models.length} รุ่น`, `See all ${models.length} models`)}
            </button>
          </div>
        </div>

        <div className="stage__rail" role="tablist" aria-label={tx('เลือกรุ่นที่จะแสดง', 'Choose a model to show')} onKeyDown={onKeyDown}>
          {models.map((m, i) => (
            <button
              key={m.id}
              ref={(el) => {
                tabs.current[i] = el
              }}
              type="button"
              role="tab"
              id={tabId(i)}
              aria-selected={i === index}
              aria-controls={panelId}
              tabIndex={i === index ? 0 : -1}
              className="stage__tab"
              onClick={() => select(i)}
            >
              <span className="stage__tab-brand" lang="en">
                {m.brand}
              </span>{' '}
              <span className="stage__tab-name" lang="en">
                {shortName(m)}
              </span>
            </button>
          ))}
        </div>

        <p className="stage__credit">
          {tx('ภาพ', 'Photo of')} {model.nameEn}: {model.image.author} ({model.image.license})
        </p>
      </div>
    </section>
  )
}
