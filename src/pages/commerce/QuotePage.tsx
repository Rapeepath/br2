import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { CalendarCheck, Loader2, MessageCircle, Printer } from 'lucide-react'
import { BrandMark } from '../../components/BrandMark'
import { models } from '../../data'
import { useLang } from '../../i18n'
import { useStoreInfo } from '../../lib/live'
import { baht, instantLabel, num } from '../../lib/localeFormat'
import { ApiError, apiGet, errorText } from '../../lib/publicApi'
import './quote.css'

interface QuoteLine {
  productId: string
  sku: string
  name: string
  qty: number
  unitPrice: number
  discount: number
  total: number
}

interface Quotation {
  no: string
  createdAt: string
  validUntil: string
  customer: { name: string; company: string | null; taxId: string | null; phone: string; email: string | null; address: string | null }
  lines: QuoteLine[]
  totals: { subtotal: number; lineDiscount: number; billDiscount: number; total: number; vat: number; beforeVat: number; vatRate: number }
  financing: { mode: 'hire' | 'lease'; downPct: number; months: number; ratePct: number; downPayment: number; financed: number; monthly: number; totalPayable: number } | null
  note: string | null
  status: 'sent' | 'accepted' | 'expired' | 'converted'
  orderNo: string | null
  store: { storeName: string; branch: string; address: string; phone: string; email: string; taxId: string; lineUrl: string; lineId: string }
}

const COPY = {
  th: {
    doc: 'ใบเสนอราคา',
    docEn: 'Quotation',
    no: 'เลขที่',
    date: 'วันที่',
    valid: 'ยืนราคาถึง',
    taxId: 'เลขประจำตัวผู้เสียภาษี',
    to: 'เสนอราคาแก่',
    phone: 'โทร',
    email: 'อีเมล',
    cols: ['ลำดับ', 'รายการ', 'จำนวน', 'ราคาต่อหน่วย', 'ส่วนลด', 'จำนวนเงิน'],
    subtotal: 'รวมเป็นเงิน',
    discount: 'ส่วนลด',
    total: 'ยอดรวมทั้งสิ้น (รวม VAT)',
    beforeVat: 'มูลค่าสินค้าและบริการก่อน VAT',
    vat: 'ภาษีมูลค่าเพิ่ม {rate}%',
    finTitle: 'ประมาณการผ่อนชำระ',
    modes: { hire: 'เช่าซื้อ', lease: 'ลีสซิ่ง' },
    down: 'เงินดาวน์ {pct}%',
    financed: 'ยอดจัด',
    monthly: 'ค่างวด {months} เดือน',
    perMonth: 'ต่อเดือน',
    rate: '{rate}% ต่อปี',
    rateLabel: 'ดอกเบี้ยคงที่',
    totalPayable: 'รวมที่ชำระทั้งหมด',
    finNote: 'ค่างวดเป็นประมาณการ การอนุมัติและอัตราจริงขึ้นกับบริษัทลีสซิ่งหรือสถาบันการเงิน',
    note: 'หมายเหตุ',
    terms: 'เงื่อนไข',
    termList: [
      'ราคานี้รวมภาษีมูลค่าเพิ่มแล้ว',
      'ยืนราคาตามวันที่ระบุ หลังจากนั้นราคาอาจเปลี่ยนตามราคาผู้ผลิตและอัตราแลกเปลี่ยน',
      'กำหนดส่งมอบและติดตั้งยืนยันเมื่อสั่งซื้อ ขึ้นกับสต็อกและรอบนำเข้า',
      'การรับประกันเป็นไปตามเงื่อนไขของผู้ผลิตแต่ละรุ่น',
    ],
    sim: 'เอกสารนี้ออกจากระบบจำลองเพื่อการสาธิต ไม่ใช่ข้อเสนอขายจริง',
    signBuyer: 'ผู้อนุมัติสั่งซื้อ',
    signSeller: 'ผู้เสนอราคา',
    signDate: 'วันที่',
    print: 'พิมพ์หรือบันทึกเป็น PDF',
    book: 'นัดชมการสาธิต',
    line: 'คุยกับทีมขายทาง LINE',
    again: 'จัดสเปกใหม่',
    loading: 'กำลังโหลดใบเสนอราคา…',
    notFound: 'ไม่พบใบเสนอราคานี้',
    notFoundBody: 'ลิงก์อาจไม่ครบ ลองเปิดจากลิงก์เดิมอีกครั้ง หรือติดต่อทีมขายพร้อมเลขที่ใบเสนอราคา',
    expired: 'ใบเสนอราคานี้หมดอายุแล้ว ราคาอาจเปลี่ยน ขอใบใหม่ได้จากหน้าจัดสเปก',
    accepted: 'ทีมขายรับการยืนยันใบเสนอราคานี้แล้ว',
    converted: 'ใบเสนอราคานี้ออกบิลขายแล้ว เลขที่บิล {order}',
    sent: 'ใบเสนอราคาพร้อมแล้ว เก็บลิงก์นี้ไว้เพื่อเปิดดูภายหลัง',
    unit: 'หน่วย',
  },
  en: {
    doc: 'Quotation',
    docEn: 'ใบเสนอราคา',
    no: 'No.',
    date: 'Date',
    valid: 'Valid until',
    taxId: 'Tax ID',
    to: 'Quoted to',
    phone: 'Phone',
    email: 'Email',
    cols: ['#', 'Item', 'Qty', 'Unit price', 'Discount', 'Amount'],
    subtotal: 'Subtotal',
    discount: 'Discount',
    total: 'Total (VAT included)',
    beforeVat: 'Value before VAT',
    vat: 'VAT {rate}%',
    finTitle: 'Financing estimate',
    modes: { hire: 'Hire purchase', lease: 'Leasing' },
    down: 'Down payment {pct}%',
    financed: 'Amount financed',
    monthly: '{months} monthly payments',
    perMonth: 'a month',
    rate: '{rate}% a year',
    rateLabel: 'Flat interest',
    totalPayable: 'Total paid',
    finNote: 'Payments are estimates; approval and actual rates depend on the leasing company or bank.',
    note: 'Note',
    terms: 'Terms',
    termList: [
      'Prices include VAT.',
      'Prices hold until the date shown; after that they may change with the maker’s prices and exchange rates.',
      'Delivery and installation dates are confirmed on order and depend on stock and import schedules.',
      'Warranty follows each maker’s terms.',
    ],
    sim: 'This document comes from a demonstration system and is not a real offer to sell.',
    signBuyer: 'Approved by (buyer)',
    signSeller: 'Quoted by',
    signDate: 'Date',
    print: 'Print or save as PDF',
    book: 'Book a demonstration',
    line: 'Talk to sales on LINE',
    again: 'Configure again',
    loading: 'Loading the quotation…',
    notFound: 'Quotation not found',
    notFoundBody: 'The link may be incomplete. Open it again from the original link, or contact sales with the quotation number.',
    expired: 'This quotation has expired and prices may have changed. Request a new one from the configure page.',
    accepted: 'The sales team has confirmed this quotation.',
    converted: 'This quotation has been invoiced, bill number {order}.',
    sent: 'Your quotation is ready. Keep this link to open it again later.',
    unit: 'unit',
  },
}

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''))

export function QuotePage() {
  const { no } = useParams()
  const [params] = useSearchParams()
  const token = params.get('t') ?? ''
  const lang = useLang()
  const c = COPY[lang]
  const storeInfo = useStoreInfo()
  const [state, setState] = useState<{ q: Quotation | null; error: unknown; loading: boolean }>({ q: null, error: null, loading: true })

  useEffect(() => {
    let alive = true
    setState({ q: null, error: null, loading: true })
    apiGet<Quotation>(`/api/public/quotes/${encodeURIComponent(no ?? '')}?t=${encodeURIComponent(token)}`).then(
      (q) => alive && setState({ q, error: null, loading: false }),
      (error) => alive && setState({ q: null, error, loading: false }),
    )
    return () => {
      alive = false
    }
  }, [no, token])

  if (state.loading) {
    return (
      <section className="container c-page quote-state" aria-live="polite">
        <h1 className="visually-hidden">{c.doc}</h1>
        <p className="c-muted quote-state__msg">
          <Loader2 size={18} aria-hidden className="form-submit__spin" />
          {c.loading}
        </p>
      </section>
    )
  }

  if (!state.q) {
    const missing = state.error instanceof ApiError && state.error.code === 'NOT_FOUND'
    return (
      <section className="container c-page quote-state">
        <h1>{c.notFound}</h1>
        <p className="c-muted">{missing ? c.notFoundBody : errorText(state.error, lang)}</p>
        <div className="c-actions">
          <Link to="/contact" className="btn btn-primary">
            {lang === 'en' ? 'Contact sales' : 'ติดต่อทีมขาย'}
          </Link>
        </div>
      </section>
    )
  }

  const q = state.q
  const store = { ...storeInfo, ...q.store }
  const discount = q.totals.lineDiscount + q.totals.billDiscount
  const status = q.status === 'converted' ? fill(c.converted, { order: q.orderNo ?? '' }) : c[q.status]

  return (
    <div className="container c-page quote">
      <div className="quote__bar" role="status" data-status={q.status}>
        <p>{status}</p>
        <div className="quote__actions">
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={18} aria-hidden />
            {c.print}
          </button>
          <Link to="/booking" className="btn btn-ghost">
            <CalendarCheck size={18} aria-hidden />
            {c.book}
          </Link>
          <a href={store.lineUrl} target="_blank" rel="noopener" className="btn btn-ghost">
            <MessageCircle size={18} aria-hidden />
            {c.line}
          </a>
        </div>
      </div>

      <article className="qdoc" aria-labelledby="qdoc-title">
        <header className="qdoc__head">
          <div className="qdoc__store">
            <BrandMark size={44} />
            <div>
              <p className="qdoc__store-name">
                {store.storeName} <span className="qdoc__branch">{store.branch}</span>
              </p>
              <p>{store.address}</p>
              <p>
                {c.phone} {store.phone} {store.email && <span lang="en">{store.email}</span>}
              </p>
              <p>
                {c.taxId} {store.taxId}
              </p>
            </div>
          </div>
          <div className="qdoc__title">
            <h1 id="qdoc-title">{c.doc}</h1>
            <p className="qdoc__title-alt" lang={lang === 'en' ? 'th' : 'en'}>
              {c.docEn}
            </p>
            <dl className="qdoc__meta">
              <div>
                <dt>{c.no}</dt>
                <dd>{q.no}</dd>
              </div>
              <div>
                <dt>{c.date}</dt>
                <dd>{instantLabel(q.createdAt, lang)}</dd>
              </div>
              <div>
                <dt>{c.valid}</dt>
                <dd>{instantLabel(q.validUntil, lang)}</dd>
              </div>
            </dl>
          </div>
        </header>

        <section className="qdoc__to" aria-label={c.to}>
          <p className="qdoc__label">{c.to}</p>
          <p className="qdoc__to-name">{q.customer.company ?? q.customer.name}</p>
          {q.customer.company && <p>{q.customer.name}</p>}
          {q.customer.address && <p>{q.customer.address}</p>}
          {q.customer.taxId && (
            <p>
              {c.taxId} {q.customer.taxId}
            </p>
          )}
          <p>
            {c.phone} {q.customer.phone}
            {q.customer.email && (
              <>
                {'  '}
                {c.email} <span lang="en">{q.customer.email}</span>
              </>
            )}
          </p>
        </section>

        <table className="qdoc__lines">
          <thead>
            <tr>
              {c.cols.map((h, i) => (
                <th key={h} scope="col" className={i >= 2 ? 'num' : undefined}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {q.lines.map((l, i) => (
              <tr key={`${l.productId}-${i}`}>
                <td>{i + 1}</td>
                <td>
                  <span className="qdoc__item">{l.name}</span>
                  <span className="qdoc__sku" lang="en">
                    {l.sku}
                  </span>
                </td>
                <td className="num">{num(l.qty, lang)}</td>
                <td className="num">{num(l.unitPrice, lang)}</td>
                <td className="num">{l.discount ? num(l.discount, lang) : '–'}</td>
                <td className="num">{num(l.total, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="qdoc__bottom">
          <div className="qdoc__terms">
            {q.financing && (
              <section className="qdoc__fin" aria-labelledby="qdoc-fin">
                <h2 id="qdoc-fin">
                  {c.finTitle}: {c.modes[q.financing.mode]}
                </h2>
                <dl>
                  <div>
                    <dt>{fill(c.down, { pct: q.financing.downPct })}</dt>
                    <dd>{baht(q.financing.downPayment, lang)}</dd>
                  </div>
                  <div>
                    <dt>{c.financed}</dt>
                    <dd>{baht(q.financing.financed, lang)}</dd>
                  </div>
                  <div>
                    <dt>{fill(c.monthly, { months: q.financing.months })}</dt>
                    <dd>
                      {baht(q.financing.monthly, lang)} {c.perMonth}
                    </dd>
                  </div>
                  <div>
                    <dt>{c.rateLabel}</dt>
                    <dd>{fill(c.rate, { rate: q.financing.ratePct })}</dd>
                  </div>
                  <div>
                    <dt>{c.totalPayable}</dt>
                    <dd>{baht(q.financing.totalPayable, lang)}</dd>
                  </div>
                </dl>
                <p className="qdoc__small">{c.finNote}</p>
              </section>
            )}
            {q.note && (
              <section>
                <h2>{c.note}</h2>
                <p>{q.note}</p>
              </section>
            )}
            <section>
              <h2>{c.terms}</h2>
              <ul>
                {c.termList.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          </div>

          <dl className="qdoc__totals">
            <div>
              <dt>{c.subtotal}</dt>
              <dd>{num(q.totals.subtotal, lang)}</dd>
            </div>
            {discount > 0 && (
              <div>
                <dt>{c.discount}</dt>
                <dd>−{num(discount, lang)}</dd>
              </div>
            )}
            <div>
              <dt>{c.beforeVat}</dt>
              <dd>{num(q.totals.beforeVat, lang)}</dd>
            </div>
            <div>
              <dt>{fill(c.vat, { rate: q.totals.vatRate })}</dt>
              <dd>{num(q.totals.vat, lang)}</dd>
            </div>
            <div className="qdoc__grand">
              <dt>{c.total}</dt>
              <dd>{baht(q.totals.total, lang)}</dd>
            </div>
          </dl>
        </div>

        <div className="qdoc__sign">
          <div>
            <span className="qdoc__sign-line" />
            <p>{c.signSeller}</p>
            <p className="qdoc__small">
              {c.signDate} ............................
            </p>
          </div>
          <div>
            <span className="qdoc__sign-line" />
            <p>{c.signBuyer}</p>
            <p className="qdoc__small">
              {c.signDate} ............................
            </p>
          </div>
        </div>

        <p className="qdoc__sim">{c.sim}</p>
      </article>

      <div className="c-actions quote__after">
        <Link to={`/configure/${(models.find((m) => q.lines.some((l) => l.productId.startsWith(`${m.id}-`))) ?? models[0]).id}`} className="link-arrow">
          {c.again}
        </Link>
      </div>
    </div>
  )
}
