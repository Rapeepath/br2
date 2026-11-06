import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Minus, Plus, Sparkles } from 'lucide-react'
import { StockBadge } from '../../components/commerce/CommerceBits'
import { Consent, Field, FormAlert, Honeypot, SubmitButton, formCopy, useSubmit, validatePerson, type FieldErrors } from '../../components/form/FormKit'
import { Picture } from '../../components/Picture'
import { getModel, models } from '../../data'
import { useLang } from '../../i18n'
import { localized } from '../../i18n/content'
import { itemName, suggestedFor } from '../../lib/catalogNames'
import { FINANCE_TERMS, finance, type FinanceMode } from '../../lib/finance'
import { useLiveCatalog, type LiveItem } from '../../lib/live'
import { baht, num } from '../../lib/localeFormat'
import { photoStyle } from '../../lib/photo'
import { apiPost } from '../../lib/publicApi'
import { PageStage, SimNote } from './PageStage'
import './configure.css'
import './finance.css'

type Pay = 'cash' | FinanceMode

const COPY = {
  th: {
    title: 'จัดสเปก',
    sub: 'แล้วรับใบเสนอราคาทันที',
    lede: 'เลือกรุ่นย่อย อุปกรณ์เสริม บริการ และวิธีชำระ ราคาคำนวณจากระบบของโชว์รูม รวม VAT แล้ว ใบเสนอราคามีอายุ 30 วัน',
    otherModel: 'เปลี่ยนรุ่น',
    s1: 'รุ่นย่อย',
    s2: 'อุปกรณ์เสริม',
    s3: 'บริการ',
    s4: 'การชำระเงิน',
    s5: 'ข้อมูลผู้ขอใบเสนอราคา',
    dof: 'องศาอิสระ',
    payload: 'รับน้ำหนัก',
    runtime: 'ใช้งาน',
    hand: 'มือ',
    none: 'ไม่ระบุ',
    approx: 'ประมาณ',
    suggested: 'แนะนำสำหรับรุ่นนี้',
    qty: 'จำนวน',
    less: 'ลดจำนวน {name}',
    more: 'เพิ่มจำนวน {name}',
    pays: { cash: 'ชำระเต็มจำนวน', hire: 'เช่าซื้อ', lease: 'ลีสซิ่ง' } as Record<Pay, string>,
    down: 'เงินดาวน์',
    months: '{n} เดือน',
    term: 'ระยะเวลา',
    monthlyAbout: 'ค่างวดประมาณ {amount} ต่อเดือน',
    rate: 'ดอกเบี้ยคงที่ {rate}% ต่อปี',
    name: 'ชื่อผู้ติดต่อ',
    company: 'ชื่อบริษัทหรือหน่วยงาน',
    taxId: 'เลขประจำตัวผู้เสียภาษี',
    taxHint: '13 หลัก สำหรับใบกำกับภาษีเต็มรูป',
    address: 'ที่อยู่สำหรับออกใบกำกับภาษี',
    note: 'หมายเหตุถึงทีมขาย',
    errTax: 'เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก',
    summary: 'สรุปรายการ',
    subtotal: 'รวม',
    vat: 'ภาษีมูลค่าเพิ่ม 7% (รวมในราคาแล้ว)',
    total: 'ยอดรวม',
    financing: 'ค่างวด',
    send: 'ขอใบเสนอราคา',
    offline: 'ตอนนี้เชื่อมต่อระบบของโชว์รูมไม่ได้ ราคาด้านล่างเป็นราคาโดยประมาณจากแค็ตตาล็อก และยังขอใบเสนอราคาออนไลน์ไม่ได้ โทรหาเราเพื่อขอใบเสนอราคาได้',
    loading: 'กำลังโหลดราคาและสต็อก…',
    notFound: 'ไม่พบรุ่นนี้ในแค็ตตาล็อก',
    pickModel: 'เลือกรุ่นที่จะจัดสเปก',
    sim: 'ใบเสนอราคานี้ออกจากระบบจำลองเพื่อการสาธิต ไม่มีการซื้อขายจริง',
    totalBar: 'ยอดรวม',
    toSummary: 'ดูสรุป',
  },
  en: {
    title: 'Configure',
    sub: 'and get a quotation at once',
    lede: 'Choose a trim, accessories, services and how to pay. Prices come from the showroom’s system and include VAT. The quotation is valid for 30 days.',
    otherModel: 'Change model',
    s1: 'Trim',
    s2: 'Accessories',
    s3: 'Services',
    s4: 'Payment',
    s5: 'Who the quotation is for',
    dof: 'Degrees of freedom',
    payload: 'Payload',
    runtime: 'Runtime',
    hand: 'Hands',
    none: 'Not stated',
    approx: 'about',
    suggested: 'Suggested for this model',
    qty: 'Quantity',
    less: 'Fewer {name}',
    more: 'More {name}',
    pays: { cash: 'Pay in full', hire: 'Hire purchase', lease: 'Leasing' } as Record<Pay, string>,
    down: 'Down payment',
    months: '{n} months',
    term: 'Term',
    monthlyAbout: 'About {amount} a month',
    rate: '{rate}% a year flat',
    name: 'Contact name',
    company: 'Company or organisation',
    taxId: 'Tax ID',
    taxHint: '13 digits, for a full tax invoice',
    address: 'Billing address',
    note: 'Note to the sales team',
    errTax: 'The tax ID must be 13 digits',
    summary: 'Summary',
    subtotal: 'Subtotal',
    vat: 'VAT 7% (included)',
    total: 'Total',
    financing: 'Payments',
    send: 'Request quotation',
    offline: 'The showroom’s system can’t be reached right now. Prices below are catalogue estimates and online quotations are unavailable; call us for a quotation.',
    loading: 'Loading prices and stock…',
    notFound: 'This model isn’t in the catalogue',
    pickModel: 'Choose a model to configure',
    sim: 'Quotations come from a demonstration system; no sale takes place.',
    totalBar: 'Total',
    toSummary: 'See summary',
  },
}

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''))

interface QuoteResult {
  no: string
  token: string
}

export function ConfigurePage() {
  const { id } = useParams()
  const lang = useLang()
  const c = COPY[lang]
  const k = formCopy(lang)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const base = getModel(id)
  const model = base ? localized(base, lang) : null
  const live = useLiveCatalog()

  const trims = useMemo(() => {
    if (!model) return []
    const liveTrims = live.byRef(model.id).filter((i) => i.categoryId === 'robot')
    return model.trims
      .filter((t) => t.priceTHB != null)
      .map((t) => {
        const item = liveTrims.find((i) => i.variant === t.name) ?? null
        return { trim: t, item, price: item?.price ?? t.priceTHB! }
      })
  }, [model, live])

  const accessories = live.items?.filter((i) => i.categoryId === 'accessory') ?? []
  const services = live.items?.filter((i) => i.categoryId === 'service') ?? []
  const suggested = model ? suggestedFor(model.heightCm, model.locomotion) : []

  const qPay = params.get('finance')
  const [trimName, setTrimName] = useState<string | null>(null)
  const [qty, setQty] = useState<Record<string, number>>({})
  const [pay, setPay] = useState<Pay>(qPay === 'hire' || qPay === 'lease' ? qPay : 'cash')
  const [downPct, setDownPct] = useState<number>(Number(params.get('down')) || FINANCE_TERMS.hire.downPct.default)
  const [months, setMonths] = useState<number>(Number(params.get('months')) || 36)
  const [cust, setCust] = useState({ name: '', phone: '', email: '', lineId: '', company: '', taxId: '', address: '' })
  const [note, setNote] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const { busy, errors, alert, setAlert, formRef, run } = useSubmit<QuoteResult>(lang)

  if (!model) {
    return (
      <>
        <PageStage title={c.notFound} />
        <div className="container c-page">
          <h2 className="cfg-pick__title">{c.pickModel}</h2>
          <ul className="c-cards">
            {models.map((m) => (
              <li key={m.id}>
                <Link to={`/configure/${m.id}`} className="c-card">
                  <h3 lang="en">{m.nameEn}</h3>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </>
    )
  }

  const chosen = trims.find((t) => t.trim.name === trimName) ?? trims[0]
  const extras = [...accessories, ...services]
  const lines = [
    ...(chosen ? [{ id: chosen.item?.id ?? null, name: chosen.trim.name, qty: 1, price: chosen.price }] : []),
    ...extras.filter((i) => (qty[i.id] ?? 0) > 0).map((i) => ({ id: i.id, name: itemName(i, lang).name, qty: qty[i.id], price: i.price })),
  ]
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const vat = Math.round(((total * 7) / 107) * 100) / 100
  const terms = pay === 'cash' ? null : FINANCE_TERMS[pay]
  const safeDown = terms ? Math.min(terms.downPct.max, Math.max(terms.downPct.min, downPct)) : 0
  const safeMonths = terms ? ((terms.months as readonly number[]).includes(months) ? months : terms.months.at(-1)!) : 0
  const fin = terms && total > 0 ? finance(total, pay as FinanceMode, safeDown, safeMonths) : null
  const canQuote = live.status === 'live' && !!chosen?.item

  const setQ = (pid: string, n: number) => setQty((q) => ({ ...q, [pid]: Math.max(0, Math.min(10, n)) }))
  const setCustField = (key: keyof typeof cust) => (v: string) => setCust((x) => ({ ...x, [key]: v }))

  const submit = (e: FormEvent) => {
    if (!canQuote) {
      e.preventDefault()
      setAlert(c.offline)
      return
    }
    return run(
      e,
      (): FieldErrors => ({
        ...validatePerson({ name: cust.name, phone: cust.phone, email: cust.email, lineId: '' }, lang),
        taxId: cust.taxId.trim() && !/^\d{13}$/.test(cust.taxId.trim()) ? c.errTax : undefined,
        consent: consent ? undefined : k.errConsent,
      }),
      () =>
        apiPost<QuoteResult>('/api/public/quotes', {
          lines: lines.filter((l) => l.id).map((l) => ({ productId: l.id, qty: l.qty })),
          customer: {
            name: cust.name,
            phone: cust.phone,
            email: cust.email || undefined,
            company: cust.company || undefined,
            taxId: cust.taxId.trim() || undefined,
            address: cust.address || undefined,
          },
          financing: pay === 'cash' ? undefined : { mode: pay, downPct: safeDown, months: safeMonths },
          note: note.trim() || undefined,
          lang,
          consent,
          website,
        }),
      (r) => navigate(`/quote/${r.no}?t=${r.token}`),
    )
  }

  // A render function, not a component: a component defined here would remount (and drop focus) on every change
  const extraRow = (item: LiveItem) => {
    const n = itemName(item, lang)
    const q = qty[item.id] ?? 0
    return (
      <li key={item.id} className="cfg-extra" data-on={q > 0 ? '' : undefined}>
        <label className="cfg-extra__main">
          <input type="checkbox" checked={q > 0} onChange={(e) => setQ(item.id, e.target.checked ? 1 : 0)} />
          <span className="cfg-extra__text">
            <span className="cfg-extra__name">{n.name}</span>
            {n.subtitle && <span className="cfg-extra__sub">{n.subtitle}</span>}
            {suggested.includes(item.id) && (
              <span className="cfg-extra__tag">
                <Sparkles size={13} aria-hidden />
                {c.suggested}
              </span>
            )}
          </span>
        </label>
        <span className="cfg-extra__price">{baht(item.price, lang)}</span>
        {q > 0 && (
          <span className="cfg-qty" role="group" aria-label={`${c.qty} ${n.name}`}>
            <button type="button" onClick={() => setQ(item.id, q - 1)} aria-label={fill(c.less, { name: n.name })}>
              <Minus size={16} aria-hidden />
            </button>
            <output aria-live="polite">{q}</output>
            <button type="button" onClick={() => setQ(item.id, q + 1)} aria-label={fill(c.more, { name: n.name })} disabled={q >= 10}>
              <Plus size={16} aria-hidden />
            </button>
          </span>
        )}
      </li>
    )
  }

  return (
    <>
      <PageStage title={`${c.title} ${model.nameEn}`} sub={c.sub} lede={c.lede}>
        <div className="pstage__actions">
          <StockBadge refId={model.id} />
          <label className="cfg-switch">
            <span className="visually-hidden">{c.otherModel}</span>
            <select
              className="field__control field__select cfg-switch__select"
              value={model.id}
              onChange={(e) => navigate(`/configure/${e.target.value}`)}
              aria-label={c.otherModel}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nameEn}
                </option>
              ))}
            </select>
          </label>
        </div>
      </PageStage>

      <form ref={formRef} className="container c-page cfg" noValidate onSubmit={submit}>
        <div className="cfg__steps">
          {live.status === 'loading' && <p className="c-muted cfg__status">{c.loading}</p>}
          {live.status === 'offline' && <p className="c-simnote cfg__status">{c.offline}</p>}
          <FormAlert message={alert} />

          <fieldset className="cfg-step">
            <legend>
              <span className="cfg-step__no" aria-hidden="true">
                1
              </span>
              {c.s1}
            </legend>
            <div className="cfg-trims">
              {trims.map(({ trim, item, price }) => (
                <label key={trim.name} className="choice cfg-trim">
                  <input type="radio" name="trim" checked={chosen?.trim.name === trim.name} onChange={() => setTrimName(trim.name)} />
                  <span className="cfg-trim__name" lang="en">
                    {trim.name}
                  </span>
                  <span className="cfg-trim__price">
                    {!item && trim.priceBasis === 'converted' && <span className="cfg-trim__approx">{c.approx} </span>}
                    {baht(price, lang)}
                  </span>
                  <span className="cfg-trim__specs">
                    <span>
                      {c.dof} {trim.dof != null ? num(trim.dof, lang) : c.none}
                    </span>
                    <span>
                      {c.payload} {trim.payloadKg != null ? `${num(trim.payloadKg, lang)} ${lang === 'en' ? 'kg' : 'กก.'}` : c.none}
                    </span>
                    <span>
                      {c.runtime} {trim.runtimeH != null ? `${num(trim.runtimeH, lang)} ${lang === 'en' ? 'h' : 'ชม.'}` : c.none}
                    </span>
                  </span>
                  {item && <StockBadge productId={item.id} />}
                </label>
              ))}
            </div>
          </fieldset>

          {accessories.length > 0 && (
            <fieldset className="cfg-step">
              <legend>
                <span className="cfg-step__no" aria-hidden="true">
                  2
                </span>
                {c.s2}
              </legend>
              <ul className="cfg-extras">
                {accessories.map(extraRow)}
              </ul>
            </fieldset>
          )}

          {services.length > 0 && (
            <fieldset className="cfg-step">
              <legend>
                <span className="cfg-step__no" aria-hidden="true">
                  3
                </span>
                {c.s3}
              </legend>
              <ul className="cfg-extras">
                {services.map(extraRow)}
              </ul>
            </fieldset>
          )}

          <fieldset className="cfg-step">
            <legend>
              <span className="cfg-step__no" aria-hidden="true">
                4
              </span>
              {c.s4}
            </legend>
            <div className="fin-seg fin-seg--3" role="radiogroup" aria-label={c.s4}>
              {(['cash', 'hire', 'lease'] as Pay[]).map((p) => (
                <label key={p} className="fin-seg__opt">
                  <input
                    type="radio"
                    name="pay"
                    checked={pay === p}
                    onChange={() => {
                      setPay(p)
                      if (p !== 'cash') {
                        setDownPct(FINANCE_TERMS[p].downPct.default)
                        setMonths(FINANCE_TERMS[p].months.at(-1)!)
                      }
                    }}
                  />
                  <span>{c.pays[p]}</span>
                </label>
              ))}
            </div>
            {terms && (
              <div className="cfg-fin">
                <div className="field">
                  <label className="field__label" htmlFor="cfg-down">
                    {c.down} <output className="fin-out">{safeDown}%</output>
                  </label>
                  <input
                    id="cfg-down"
                    type="range"
                    className="fin-range"
                    min={terms.downPct.min}
                    max={terms.downPct.max}
                    step={5}
                    value={safeDown}
                    onChange={(e) => setDownPct(Number(e.target.value))}
                    aria-valuetext={`${safeDown}%`}
                  />
                </div>
                <div className="fin-seg fin-seg--wrap" role="radiogroup" aria-label={c.term}>
                  {terms.months.map((m) => (
                    <label key={m} className="fin-seg__opt">
                      <input type="radio" name="months" checked={safeMonths === m} onChange={() => setMonths(m)} />
                      <span>{fill(c.months, { n: m })}</span>
                    </label>
                  ))}
                </div>
                {fin && (
                  <p className="cfg-fin__result" aria-live="polite">
                    <strong>{fill(c.monthlyAbout, { amount: baht(fin.monthly, lang) })}</strong> {fill(c.rate, { rate: fin.ratePct })}
                  </p>
                )}
              </div>
            )}
          </fieldset>

          <fieldset className="cfg-step" id="cfg-details">
            <legend>
              <span className="cfg-step__no" aria-hidden="true">
                5
              </span>
              {c.s5}
            </legend>
            <div className="form-grid">
              <Field label={c.name} name="name" value={cust.name} onChange={setCustField('name')} error={errors.name} required autoComplete="name" maxLength={120} />
              <Field
                label={k.phone}
                name="phone"
                type="tel"
                inputMode="tel"
                value={cust.phone}
                onChange={setCustField('phone')}
                error={errors.phone}
                hint={k.phoneHint}
                required
                autoComplete="tel"
                maxLength={20}
              />
              <Field label={k.email} name="email" type="email" inputMode="email" value={cust.email} onChange={setCustField('email')} error={errors.email} autoComplete="email" maxLength={120} />
              <Field label={c.company} name="company" value={cust.company} onChange={setCustField('company')} error={errors.company} autoComplete="organization" maxLength={160} />
              <Field label={c.taxId} name="taxId" inputMode="numeric" value={cust.taxId} onChange={setCustField('taxId')} error={errors.taxId} hint={c.taxHint} maxLength={13} />
              <Field label={c.address} name="address" value={cust.address} onChange={setCustField('address')} error={errors.address} autoComplete="street-address" maxLength={300} />
            </div>
            <div className="cfg-step__more">
              <Field label={c.note} name="note" multiline rows={3} value={note} onChange={setNote} error={errors.note} maxLength={1000} />
              <Consent checked={consent} onChange={setConsent} error={errors.consent} />
              <Honeypot value={website} onChange={setWebsite} />
            </div>
          </fieldset>
        </div>

        <aside className="cfg__summary" id="cfg-summary" aria-labelledby="cfg-sum-title">
          <div className="cfg-sum">
            <div className="cfg-sum__photo">
              <Picture src={model.image.srcSmall} alt="" sizes="(max-width: 960px) 100vw, 30vw" style={photoStyle(model.image)} />
            </div>
            <h2 id="cfg-sum-title">{c.summary}</h2>
            <ul className="cfg-sum__lines">
              {lines.map((l) => (
                <li key={l.name}>
                  <span>
                    {l.name}
                    {l.qty > 1 && <span className="cfg-sum__qty"> ×{l.qty}</span>}
                  </span>
                  <span className="cfg-sum__amt">{baht(l.price * l.qty, lang)}</span>
                </li>
              ))}
            </ul>
            <dl className="cfg-sum__totals">
              <div>
                <dt>{c.vat}</dt>
                <dd>{baht(vat, lang)}</dd>
              </div>
              <div className="cfg-sum__grand">
                <dt>{c.total}</dt>
                <dd aria-live="polite">{baht(total, lang)}</dd>
              </div>
              {fin && (
                <div>
                  <dt>
                    {c.financing} ({c.pays[pay]})
                  </dt>
                  <dd>{fill(c.monthlyAbout, { amount: baht(fin.monthly, lang) })}</dd>
                </div>
              )}
            </dl>
            <SubmitButton busy={busy} disabled={!canQuote}>
              {c.send}
            </SubmitButton>
            <SimNote>{c.sim}</SimNote>
          </div>
        </aside>

        <div className="cfg-bar" aria-hidden="true">
          <span>
            {c.totalBar} <strong>{baht(total, lang)}</strong>
          </span>
          <a href="#cfg-summary" tabIndex={-1}>
            {c.toSummary}
          </a>
        </div>
      </form>
    </>
  )
}
