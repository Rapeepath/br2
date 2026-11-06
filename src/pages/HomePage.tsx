import { useEffect, useMemo, useRef } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { ArrowUpRight, ClipboardCheck, LayoutGrid, RotateCcw, Wallet } from 'lucide-react'
import { FilterBar } from '../components/FilterBar'
import { ModelCard } from '../components/ModelCard'
import { ShowroomStage } from '../components/ShowroomStage'
import { market, models } from '../data'
import { focusSoon, useTitle } from '../lib/a11y'
import { applyFilters, BUDGET_LABEL, DEFAULT_FILTERS, isFiltered, SORT_LABEL, type Budget, type Filters, type SortKey } from '../lib/filter'
import { formatNumber } from '../lib/format'
import { useLang } from '../i18n'
import { localized, localizedMarket } from '../i18n/content'
import { pick } from '../lib/bilingual'
import type { Category } from '../lib/types'
import { useReveal } from '../lib/motion'
import './HomePage.css'

const CATEGORY_ORDER: Category[] = ['research', 'education', 'home', 'industrial', 'service']
// Brands in alphabetical order for the brand select
const BRANDS = [...new Set(models.map((m) => m.brand))].sort((a, b) => a.localeCompare(b, 'en'))

function readFilters(p: URLSearchParams): Filters {
  const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const v = p.get(key)
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
  }
  return {
    q: p.get('q') ?? '',
    category: pick('category', ['all', ...CATEGORY_ORDER] as const, 'all'),
    brand: pick('brand', ['all', ...BRANDS], 'all'),
    budget: pick('budget', Object.keys(BUDGET_LABEL) as Budget[], 'all'),
    sort: pick('sort', Object.keys(SORT_LABEL) as SortKey[], 'default'),
  }
}

function toParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(f)) {
    if (v !== DEFAULT_FILTERS[k as keyof Filters] && v !== '') p.set(k, v)
  }
  return p
}

const sum = (xs: { min: number; max: number }[]) =>
  xs.reduce((acc, x) => ({ min: acc.min + x.min, max: acc.max + x.max }), { min: 0, max: 0 })

const round100 = (n: number) => Math.round(n / 100) * 100

/**
 * Yearly running cost, as the guide totals it: the fixed items plus one electricity tariff. Rows named
 * "ค่าไฟฟ้า…" are alternatives, so the low end takes the cheapest and the high end the dearest.
 */
function yearlyCost(items: { item: string; min: number; max: number }[]) {
  const isPower = (i: { item: string }) => i.item.startsWith('ค่าไฟฟ้า')
  const power = items.filter(isPower)
  if (power.length < 2) {
    const all = sum(items)
    return { min: round100(all.min), max: round100(all.max) }
  }
  const fixed = sum(items.filter((i) => !isPower(i)))
  return {
    min: round100(fixed.min + Math.min(...power.map((c) => c.min))),
    max: round100(fixed.max + Math.max(...power.map((c) => c.max))),
  }
}

export function HomePage() {
  const lang = useLang()
  const tx = <T,>(th: T, en: T) => pick(lang, th, en)
  const [params, setParams] = useSearchParams()
  const filters = readFilters(params)
  const location = useLocation()
  useTitle(null)

  // Coming back from a model page: land on the list, not the hero.
  useEffect(() => {
    if ((location.state as { scrollTo?: string } | null)?.scrollTo === 'models') {
      requestAnimationFrame(() => {
        const list = document.getElementById('models')
        list?.scrollIntoView()
        list?.focus({ preventScroll: true })
      })
    }
  }, [location.key, location.state])
  // English search runs over the English text (segment, tagline, uses), Thai over the Thai
  const shown = useMemo(() => models.map((m) => localized(m, lang)), [lang])
  const results = applyFilters(shown, filters)

  const update = (patch: Partial<Filters>) => setParams(toParams({ ...filters, ...patch }), { replace: true })
  const reset = () => {
    setParams(new URLSearchParams(), { replace: true })
    // The reset button removes itself, so hand focus to the search box.
    focusSoon('[data-model-search]')
  }

  const categoryOptions = useMemo(() => CATEGORY_ORDER.filter((c) => models.some((m) => m.category === c)), [])

  // Totals come from the Thai rows (the item names decide which rows are electricity tariffs)
  const yearly = yearlyCost(market.ownershipCost.yearly)
  const mk = localizedMarket(market, lang)
  const lineup = useRef<HTMLElement>(null)
  const band = useRef<HTMLElement>(null)
  useReveal(lineup, results.map((m) => m.id).join())
  useReveal(band)

  const scrollToModels = () => {
    const el = document.getElementById('models')
    el?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    el?.focus({ preventScroll: true })
  }

  return (
    <>
      <ShowroomStage
        models={shown}
        title={
          lang === 'en' ? (
            <>
              {models.length} humanoid robots
              <span className="tint">you can order in Thailand</span>
            </>
          ) : (
            <>
              หุ่นยนต์ฮิวแมนนอยด์ <span className="nowrap">{models.length} รุ่น</span>
              <span className="tint">ที่สั่งซื้อได้ในไทย</span>
            </>
          )
        }
        onBrowse={scrollToModels}
      />
      <section id="models" ref={lineup} className="section lineup" aria-labelledby="models-title" tabIndex={-1}>
        <div className="container">
          <div className="section-head">
            <h2 id="models-title">{tx('หุ่นยนต์ทั้งหมด', 'All robots')}</h2>
            <p>
              {tx(
                'เลือกรุ่นเพื่อดูสเปกและราคาครบทุกรุ่นย่อย หรือเพิ่มได้สูงสุด 3 รุ่นเพื่อเปรียบเทียบกัน',
                'Open a model for its full specs and the price of every trim, or add up to three to compare side by side.',
              )}
            </p>
          </div>


          <FilterBar filters={filters} onChange={update} categoryOptions={categoryOptions} brandOptions={BRANDS} />

          <div className="results-meta">
            <p aria-live="polite">
              {isFiltered(filters)
                ? tx(`พบ ${results.length} จาก ${models.length} รุ่น`, `Showing ${results.length} of ${models.length} models`)
                : tx(`ทั้งหมด ${models.length} รุ่น`, `All ${models.length} models`)}
            </p>
            {isFiltered(filters) && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
                <RotateCcw size={14} aria-hidden />
                {tx('ล้างตัวกรอง', 'Clear filters')}
              </button>
            )}
          </div>

          {results.length > 0 ? (
            <ul className="model-grid">
              {results.map((m) => (
                <li key={m.id} data-reveal>
                  <ModelCard model={m} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">
              <p className="empty__title">{tx('ไม่พบรุ่นที่ตรงกับเงื่อนไขนี้', 'No model matches these filters')}</p>
              <p>{tx('ลองใช้คำค้นที่สั้นลง หรือลดตัวกรองบางข้อ', 'Try a shorter search, or remove a filter or two.')}</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={reset}>
                {tx('ล้างตัวกรองทั้งหมด', 'Clear all filters')}
              </button>
            </div>
          )}
        </div>
      </section>

      <section ref={band} className="guide-band end-band on-navy" aria-labelledby="guide-band-title">
        <div className="container guide-band__inner">
          <div className="guide-band__intro">
            <h2 id="guide-band-title">
              {tx('ก่อนตัดสินใจซื้อหุ่นยนต์', 'Before you buy a robot')}
              <span className="tint">{tx('สามเรื่องที่ควรพร้อม ไม่ว่าจะเลือกรุ่นใด', 'Three things to have ready, whichever model you choose')}</span>
            </h2>
            <Link to="/guide" className="link-arrow guide-band__cta">
              {tx('อ่านคู่มือก่อนซื้อ', 'Read the buyer’s guide')}
              <ArrowUpRight size={18} aria-hidden />
            </Link>
          </div>
          <ul className="guide-band__list">
            <li data-reveal>
              <Link to="/guide" state={{ section: 'checklist' }}>
                <ClipboardCheck className="guide-band__icon" size={24} strokeWidth={1.6} aria-hidden />
                <h3>{tx('เช็กลิสต์ก่อนซื้อ', 'Buyer’s checklist')}</h3>
                <p>
                  {tx(`${mk.buyerChecklist.length} ข้อที่ควรตรวจก่อนสั่งซื้อ`, `${mk.buyerChecklist.length} things to check before you order`)}
                </p>
              </Link>
            </li>
            <li data-reveal>
              <Link to="/guide" state={{ section: 'setup' }}>
                <LayoutGrid className="guide-band__icon" size={24} strokeWidth={1.6} aria-hidden />
                <h3>{tx('การเตรียมพื้นที่', 'Preparing the space')}</h3>
                <p>{tx('พื้นที่ใช้งาน จุดชาร์จ เครือข่าย และอุปกรณ์ความปลอดภัย', 'Working area, charging point, network and safety gear')}</p>
              </Link>
            </li>
            <li data-reveal>
              <Link to="/guide" state={{ section: 'costs' }}>
                <Wallet className="guide-band__icon" size={24} strokeWidth={1.6} aria-hidden />
                <h3>{tx('ค่าใช้จ่ายต่อปี', 'Yearly running costs')}</h3>
                {lang === 'en' ? (
                  <p>
                    About <span className="nowrap">{formatNumber(yearly.min)}–{formatNumber(yearly.max)} baht</span> a year
                    including maintenance and electricity, not counting the robot itself
                  </p>
                ) : (
                  <p>
                    ประมาณ <span className="nowrap">{formatNumber(yearly.min)}–{formatNumber(yearly.max)} บาท</span>{' '}
                    รวมค่าบำรุงรักษาและค่าไฟ ไม่รวมราคาหุ่นยนต์
                  </p>
                )}
              </Link>
            </li>
          </ul>
        </div>
      </section>
    </>
  )
}
