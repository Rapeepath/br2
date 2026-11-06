import { Link } from 'react-router'
import { ArrowRight, CalendarCheck, MessageSquareText, SlidersHorizontal } from 'lucide-react'
import { useLang, type Lang } from '../../i18n'
import { FINANCE_TERMS, lowestMonthly } from '../../lib/finance'
import { useLiveCatalog, type LiveItem } from '../../lib/live'
import { baht } from '../../lib/localeFormat'
import './Commerce.css'

/**
 * Pieces other pages place beside a model or product (the model page, cards, compare):
 *   <StockBadge refId="unitree-g1" />      live stock across the model's trims
 *   <StockBadge productId="acc-gantry" />  one product
 *   <FinanceWidget price={456000} />        lowest monthly estimate, links to /finance
 *   <CtaRow modelId="unitree-g1" />          configure / book a demo / contact
 * Each renders nothing until live data arrives, and nothing when the showroom's API isn't reachable.
 */

const COPY = {
  th: {
    in: 'มีเครื่องพร้อมส่ง',
    inCount: 'พร้อมส่ง {n} {unit}',
    low: 'เหลือ {n} {unit}',
    out: 'สินค้าหมด สั่งจองได้',
    unitRobot: 'เครื่อง',
    unitItem: 'ชิ้น',
    srPrefix: 'สต็อกที่โชว์รูม:',
    from: 'ผ่อนเช่าซื้อประมาณ',
    perMonth: 'ต่อเดือน',
    terms: 'ดาวน์ {down}% {months} งวด ดอกเบี้ย {rate}% ต่อปี (คงที่) ประมาณการ',
    calc: 'คำนวณค่างวด',
    configure: 'จัดสเปกและขอใบเสนอราคา',
    demo: 'นัดชมการสาธิต',
    contact: 'สอบถาม',
  },
  en: {
    in: 'In stock',
    inCount: '{n} in stock',
    low: 'Only {n} left',
    out: 'Out of stock, order now',
    unitRobot: '',
    unitItem: '',
    srPrefix: 'Showroom stock:',
    from: 'Hire purchase from about',
    perMonth: 'a month',
    terms: '{down}% down, {months} months, {rate}% a year flat, estimate',
    calc: 'Work out payments',
    configure: 'Configure and get a quote',
    demo: 'Book a demonstration',
    contact: 'Ask a question',
  },
}

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? '')).replace(/\s+$/, '')

type State = 'in' | 'low' | 'out'

function stateOf(items: LiveItem[]): { state: State; stock: number } | null {
  const tracked = items.filter((i) => i.stockState !== 'service')
  if (!tracked.length) return null
  const stock = tracked.reduce((s, i) => s + (i.stock ?? 0), 0)
  if (tracked.some((i) => i.stockState === 'in')) return { state: 'in', stock }
  if (tracked.some((i) => i.stockState === 'low')) return { state: 'low', stock }
  return { state: 'out', stock: 0 }
}

export function stockText(state: State, stock: number, isRobot: boolean, lang: Lang): string {
  const c = COPY[lang]
  const unit = isRobot ? c.unitRobot : c.unitItem
  if (state === 'out') return c.out
  if (state === 'low') return fill(c.low, { n: stock, unit })
  return stock > 0 ? fill(c.inCount, { n: stock, unit }) : c.in
}

/** Live stock for a model (every trim together) or one product. */
export function StockBadge({ refId, productId, className = '' }: { refId?: string; productId?: string; className?: string }) {
  const lang = useLang()
  const live = useLiveCatalog()
  if (live.status !== 'live') return null
  const items = productId ? [live.byId(productId)].filter((x): x is LiveItem => !!x) : refId ? live.byRef(refId) : []
  const s = stateOf(items)
  if (!s) return null
  const isRobot = items.some((i) => i.categoryId === 'robot')
  return (
    <span className={`stock-badge ${className}`} data-state={s.state}>
      <span className="stock-badge__dot" aria-hidden="true" />
      <span className="visually-hidden">{COPY[lang].srPrefix} </span>
      {stockText(s.state, s.stock, isRobot, lang)}
    </span>
  )
}

/** The lowest monthly estimate for a price, linking to the full calculator. */
export function FinanceWidget({ price, modelId }: { price: number; modelId?: string }) {
  const lang = useLang()
  const c = COPY[lang]
  const f = lowestMonthly(price)
  const q = new URLSearchParams({ price: String(price), ...(modelId ? { model: modelId } : {}) })
  return (
    <div className="finance-widget">
      <p className="finance-widget__lead">{c.from}</p>
      <p className="finance-widget__figure">
        <span className="figure-display">{baht(f.monthly, lang)}</span> <span className="finance-widget__per">{c.perMonth}</span>
      </p>
      <p className="finance-widget__terms">
        {fill(c.terms, { down: FINANCE_TERMS.hire.downPct.default, months: f.months, rate: f.ratePct })}
      </p>
      <Link to={`/finance?${q}`} className="link-arrow finance-widget__link">
        {c.calc}
        <ArrowRight size={16} aria-hidden />
      </Link>
    </div>
  )
}

/** The three next steps for a model. */
export function CtaRow({ modelId, className = '' }: { modelId: string; className?: string }) {
  const c = COPY[useLang()]
  return (
    <div className={`cta-row ${className}`}>
      <Link to={`/configure/${modelId}`} className="btn btn-primary">
        <SlidersHorizontal size={18} aria-hidden />
        {c.configure}
      </Link>
      <Link to={`/booking?model=${modelId}`} className="btn btn-ghost">
        <CalendarCheck size={18} aria-hidden />
        {c.demo}
      </Link>
      <Link to={`/contact?model=${modelId}`} className="btn btn-ghost">
        <MessageSquareText size={18} aria-hidden />
        {c.contact}
      </Link>
    </div>
  )
}
