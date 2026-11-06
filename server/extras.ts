// Servo's own part of the POS: quotations from the brochure's configurator, with hire-purchase and lease
// estimates, and the way a quotation becomes a sale at the till. (Maew's extras.ts holds kittens and
// reservations instead; both export registerExtras and seedExtras.)
import type { Catalog } from './catalog.ts'
import { createLead, nextNo, personOf } from './crm.ts'
import { langOf, publicForm, publicRoute, route, text } from './http.ts'
import { getProduct, log, nextId, quote } from './logic.ts'
import { publicStore } from './public.ts'
import type { CartLineInput, Db, Financing, Quotation, QuotationStatus, Staff } from './types.ts'
import { HttpError, money, newToken, type Rng } from './util.ts'

export const QUOTE_VALID_DAYS = 30

/** Limits and default rates for the estimates (flat rate per year, as Thai hire purchase is quoted) */
export const FINANCE_TERMS = {
  hire: { downPct: { min: 10, max: 50, default: 25 }, months: [12, 24, 36, 48, 60], ratePct: 4.5 },
  lease: { downPct: { min: 0, max: 30, default: 0 }, months: [12, 24, 36, 48], ratePct: 6.5 },
} as const

/** Monthly payment on a flat rate: (financed + financed × rate × years) ÷ months, rounded up to the baht. */
export function financingOf(total: number, input: any): Financing | null {
  if (!input || input.mode === undefined || input.mode === null || input.mode === 'cash') return null
  const mode: 'hire' | 'lease' = input.mode
  if (mode !== 'hire' && mode !== 'lease') throw new HttpError(400, 'รูปแบบการผ่อนไม่ถูกต้อง', 'VALIDATION', 'Unknown financing type.')
  const terms = FINANCE_TERMS[mode]
  const downPct = input.downPct === undefined ? terms.downPct.default : Number(input.downPct)
  if (!Number.isFinite(downPct) || downPct < terms.downPct.min || downPct > terms.downPct.max) {
    throw new HttpError(400, `เงินดาวน์ต้องอยู่ระหว่าง ${terms.downPct.min}–${terms.downPct.max}%`, 'VALIDATION', `Down payment must be ${terms.downPct.min}–${terms.downPct.max}%.`)
  }
  const months = Number(input.months ?? terms.months[2] ?? terms.months[0])
  if (!(terms.months as readonly number[]).includes(months)) {
    throw new HttpError(400, `ระยะเวลาผ่อนต้องเป็น ${terms.months.join(', ')} เดือน`, 'VALIDATION', `Term must be ${terms.months.join(', ')} months.`)
  }
  const ratePct = input.ratePct === undefined ? terms.ratePct : Number(input.ratePct)
  if (!Number.isFinite(ratePct) || ratePct < 0 || ratePct > 15) throw new HttpError(400, 'อัตราดอกเบี้ยต้องอยู่ระหว่าง 0–15% ต่อปี', 'VALIDATION', 'Rate must be 0–15% a year.')
  const downPayment = money(Math.round((total * downPct) / 100))
  const financed = money(total - downPayment)
  const monthly = Math.ceil((financed + (financed * ratePct * months) / 1200) / months)
  return { mode, downPct, months, ratePct, downPayment, financed, monthly, totalPayable: money(downPayment + monthly * months) }
}

export interface QuotationInput {
  lines: unknown
  customer: any
  financing?: unknown
  note?: unknown
  lang?: unknown
}

export function createQuotation(db: Db, input: QuotationInput, now: Date): Quotation {
  if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 20) {
    throw new HttpError(400, 'เลือกรุ่นและอุปกรณ์อย่างน้อย 1 รายการ', 'VALIDATION', 'Choose at least one item.')
  }
  const lines: CartLineInput[] = input.lines.map((l: any) => {
    const qty = Number(l?.qty ?? 1)
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw new HttpError(400, 'จำนวนต่อรายการต้องเป็น 1–10', 'VALIDATION', 'Quantity must be 1–10 per item.')
    getProduct(db, String(l?.productId ?? ''))
    return { productId: String(l.productId), qty }
  })
  // Items for later delivery: priced from the catalogue, no stock check
  const q = quote(db, { lines }, { ignoreStock: true })
  const c = input.customer ?? {}
  const person = personOf(c)
  const company = text(c.company, 'ชื่อบริษัท', { required: false, max: 160, en: 'a company name', key: 'company' })
  const taxId = text(c.taxId, 'เลขประจำตัวผู้เสียภาษี', { required: false, max: 13, en: 'a tax ID', key: 'taxId' })
  if (taxId && !/^\d{13}$/.test(taxId)) throw new HttpError(400, 'เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก', 'VALIDATION', 'The tax ID must be 13 digits.')
  const address = text(c.address, 'ที่อยู่สำหรับออกใบกำกับภาษี', { required: false, max: 300, en: 'an address', key: 'address' })
  const financing = financingOf(q.total, input.financing)
  const note = text(input.note, 'หมายเหตุ', { required: false, max: 1000, en: 'a note', key: 'note' })
  const lang = langOf(input.lang)
  const at = now.toISOString()

  const summary = q.lines.map((l) => `${l.name} ×${l.qty}`).join(', ')
  const refIds = [...new Set(q.lines.map((l) => getProduct(db, l.productId).refId).filter((x): x is string => !!x))]
  const lead = createLead(
    db,
    { kind: 'quote', name: person.name, phone: person.phone, email: person.email, lineId: person.lineId, message: note ? `${summary} | ${note}` : summary, refIds, page: '/configure', lang },
    now,
  )
  const { lines: priced, ...totals } = q
  const quotation: Quotation = {
    id: nextId(db, 'qt'),
    no: nextNo(db, 'QT', now),
    token: newToken(),
    createdAt: at,
    updatedAt: at,
    validUntil: new Date(now.getTime() + QUOTE_VALID_DAYS * 86_400_000).toISOString(),
    customer: { name: person.name, company, taxId, phone: person.phone, email: person.email, address },
    lines: priced,
    totals,
    financing,
    note,
    lang,
    status: 'sent',
    leadId: lead.id,
    orderNo: null,
  }
  db.quotations.push(quotation)
  lead.linked.quoteNo = quotation.no
  log(db, 'sale', null, `ขอใบเสนอราคา ${quotation.no} ยอด ${totals.total.toLocaleString('th-TH')} บาท (${person.name}${company ? `, ${company}` : ''})`, quotation.no, now)
  return quotation
}

export const findQuotation = (db: Db, id: string) => {
  const q = db.quotations.find((x) => x.id === id || x.no === id)
  if (!q) throw new HttpError(404, 'ไม่พบใบเสนอราคานี้', 'NOT_FOUND', 'Quotation not found.')
  return q
}

/** Status as of now: a sent quotation past its date has lapsed even before housekeeping runs */
const statusNow = (q: Quotation, now: Date): QuotationStatus => (q.status === 'sent' && q.validUntil <= now.toISOString() ? 'expired' : q.status)

/** What the visitor's quotation link shows (no internal ids) */
/** What the customer's quotation link may show: never the token, the CRM lead or our cost prices. */
function publicQuotation(db: Db, q: Quotation, now: Date) {
  const { token: _token, leadId: _leadId, ...rest } = q
  const lines = q.lines.map(({ unitCost: _unitCost, ...line }) => line)
  return { ...rest, lines, status: statusNow(q, now), store: publicStore(db) }
}

export function setQuotationStatus(db: Db, staff: Staff, id: string, patch: any, now: Date): Quotation {
  const q = findQuotation(db, id)
  const changes: string[] = []
  if (patch.status !== undefined) {
    if (!['sent', 'accepted', 'expired'].includes(patch.status)) throw new HttpError(400, 'สถานะใบเสนอราคาไม่ถูกต้อง')
    if (q.status === 'converted') throw new HttpError(409, `ใบเสนอราคานี้ออกบิล ${q.orderNo} แล้ว`)
    if (patch.status !== q.status) changes.push(`สถานะ ${q.status} → ${patch.status}`)
    q.status = patch.status
    const lead = q.leadId ? db.leads.find((l) => l.id === q.leadId) : undefined
    if (lead && patch.status === 'accepted' && lead.status !== 'won') lead.status = 'scheduled'
  }
  if (patch.note !== undefined) {
    q.note = text(patch.note, 'หมายเหตุ', { required: false, max: 1000 })
    changes.push('แก้หมายเหตุ')
  }
  if (!changes.length) return q
  q.updatedAt = now.toISOString()
  log(db, 'sale', staff, `ใบเสนอราคา ${q.no}: ${changes.join(', ')}`, q.no, now)
  return q
}

/**
 * Cart lines that ring the quotation up at the till. Prices come from today's catalogue; where the quoted
 * price was lower, the difference is a line discount, so the bill matches what the customer was offered.
 */
export function quotationToCart(db: Db, id: string, now: Date) {
  const q = findQuotation(db, id)
  if (q.status === 'converted') throw new HttpError(409, `ใบเสนอราคานี้ออกบิล ${q.orderNo} แล้ว`)
  if (statusNow(q, now) === 'expired') throw new HttpError(409, 'ใบเสนอราคานี้หมดอายุแล้ว ออกใบใหม่ก่อน')
  const lines: CartLineInput[] = q.lines.map((l) => {
    const p = getProduct(db, l.productId)
    const discount = money(Math.max(0, p.price * l.qty - l.total))
    return { productId: l.productId, qty: l.qty, ...(discount ? { discount } : {}) }
  })
  const digits = (s: string) => s.replace(/\D/g, '')
  const customer = q.customer.phone ? (db.customers.find((c) => digits(c.phone) === digits(q.customer.phone)) ?? null) : null
  return { quotationNo: q.no, lines, customer, quotedTotal: q.totals.total }
}

export function registerExtras() {
  publicRoute('POST', '/api/public/quotes', ({ store, body, now }) => {
    publicForm(body)
    return store.write((db) => {
      const q = createQuotation(db, body, now)
      return { ...publicQuotation(db, q, now), token: q.token }
    })
  })

  publicRoute('GET', '/api/public/quotes/:no', ({ store, params, query, now }) => {
    const db = store.get()
    const q = db.quotations.find((x) => x.no === params.no)
    // A wrong token looks exactly like a missing quotation
    if (!q || !query.get('t') || query.get('t') !== q.token) throw new HttpError(404, 'ไม่พบใบเสนอราคานี้', 'NOT_FOUND', 'Quotation not found.')
    return publicQuotation(db, q, now)
  })

  route('GET', '/api/quotes', ({ store, query, now }) => {
    const db = store.get()
    const status = query.get('status')
    const q = (query.get('q') ?? '').trim().toLowerCase()
    const rows = db.quotations
      .map((x) => ({ ...x, status: statusNow(x, now) }))
      .filter((x) => !status || x.status === status)
      .filter((x) => !q || `${x.no} ${x.customer.name} ${x.customer.company ?? ''} ${x.customer.phone} ${x.lines.map((l) => l.name).join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return { rows }
  })

  route('GET', '/api/quotes/:id', ({ store, params, now }) => {
    const db = store.get()
    const q = findQuotation(db, params.id)
    return {
      quotation: { ...q, status: statusNow(q, now) },
      lead: q.leadId ? (db.leads.find((l) => l.id === q.leadId) ?? null) : null,
      publicPath: `/quote/${q.no}?t=${q.token}`,
    }
  })

  route('PATCH', '/api/quotes/:id', ({ store, params, body, staff, now }) =>
    store.write((db) => setQuotationStatus(db, staff, params.id, body ?? {}, now)),
  )

  route('POST', '/api/quotes/:id/to-cart', ({ store, params, now }) => quotationToCart(store.get(), params.id, now))
}

// ---------- Seed ----------

interface QuoteSeed {
  daysAgo: number
  customerIndex: number
  lines: [productId: string, qty: number][]
  financing?: { mode: 'hire' | 'lease'; downPct?: number; months: number }
  status: QuotationStatus
  leadStatus: 'new' | 'contacted' | 'scheduled' | 'lost'
  note?: string
}

const QUOTE_SEEDS: QuoteSeed[] = [
  { daysAgo: 40, customerIndex: 3, lines: [['agibot-a2-lite', 1], ['svc-install', 1], ['svc-care', 1]], status: 'sent', leadStatus: 'lost', note: 'ต้องการรุ่นที่เดินได้ในโกดัง' },
  { daysAgo: 25, customerIndex: 0, lines: [['unitree-g1-pro', 2], ['acc-gantry', 2], ['svc-install', 1], ['svc-sdk', 1]], status: 'sent', leadStatus: 'contacted' },
  { daysAgo: 8, customerIndex: 2, lines: [['nao6-std', 3], ['svc-install', 1]], financing: { mode: 'hire', downPct: 20, months: 36 }, status: 'accepted', leadStatus: 'scheduled', note: 'งบประมาณปีการศึกษาหน้า' },
  { daysAgo: 2, customerIndex: 5, lines: [['agibot-x2-ultra', 1], ['acc-battery-xl', 1], ['svc-care', 1]], financing: { mode: 'lease', months: 24 }, status: 'sent', leadStatus: 'new' },
  { daysAgo: 0, customerIndex: 12, lines: [['unitree-g1-std', 1], ['acc-gantry', 1], ['acc-mat', 1]], status: 'sent', leadStatus: 'new', note: 'ใช้ในห้องแล็บส่วนตัว' },
]

/** Demo quotations from the configurator, a mix of open, accepted and lapsed. */
export function seedExtras(db: Db, _catalog: Catalog, r: Rng, now: Date) {
  const staff = db.staff.filter((s) => s.role === 'staff')
  for (const s of QUOTE_SEEDS) {
    const lines = s.lines.filter(([id]) => db.products.some((p) => p.id === id))
    if (!lines.length) continue
    const c = db.customers[s.customerIndex % db.customers.length]
    const at = new Date(now.getTime() - s.daysAgo * 86_400_000 - r.int(1, 5) * 3_600_000)
    const q = createQuotation(
      db,
      {
        lines: lines.map(([productId, qty]) => ({ productId, qty })),
        customer: {
          name: c.kind === 'company' ? `ฝ่ายจัดซื้อ ${c.name}` : c.name,
          company: c.kind === 'company' ? c.name : null,
          taxId: c.taxId,
          phone: c.phone,
          email: c.email,
          address: c.address,
        },
        financing: s.financing ?? null,
        note: s.note ?? null,
      },
      at,
    )
    q.status = s.status
    const lead = db.leads.find((l) => l.id === q.leadId)
    if (lead) {
      lead.status = s.leadStatus
      if (s.leadStatus !== 'new' && staff.length) lead.assignedTo = r.pick(staff).id
    }
  }
}
