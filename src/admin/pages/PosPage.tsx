import { useEffect, useMemo, useReducer, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Banknote, Building, CreditCard, FileText, Landmark, Minus, Plus, QrCode, Search, ShoppingCart, TicketPercent, Trash, User, UserPlus, X } from 'lucide-react'
import { api, errorMessage } from '../api'
import { cartReducer, emptyCart, itemCount, quickTenders, toCheckout, toLines, type Cart } from '../cart'
import { CustomerForm, OpenShiftForm } from '../forms'
import { baht, bahtText, KIND_LABEL, PAYMENT_LABEL } from '../format'
import { useDebounced, useLoad } from '../hooks'
import { isFullInvoice, PrintButton, Receipt } from '../Receipt'
import { useSession, useToast } from '../session'
import type { CartFromQuote, Customer, CustomerRow, Order, PaymentMethod, ProductRow, Quote, QuotationDetail } from '../types'
import { Dialog, Empty, ErrorNote, Field, Loading, PageHead, ProductThumb, Segmented, parseAmount } from '../ui'
import './pos.css'

export function PosPage() {
  const { shift } = useSession()
  if (shift === undefined) return <Loading />
  if (!shift)
    return (
      <>
        <PageHead title="ขายหน้าร้าน" lead="เปิดกะก่อน แล้วหน้าขายจะพร้อมใช้งาน" />
        <div className="card">
          <OpenShiftForm />
        </div>
      </>
    )
  return <Register />
}

function Register() {
  const { meta, refreshShift } = useSession()
  const notify = useToast()
  const products = useLoad((signal) => api<ProductRow[]>('/products', { signal }), [])
  const [cart, dispatch] = useReducer(cartReducer, emptyCart)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [discountOpen, setDiscountOpen] = useState<string[]>([])
  const [picking, setPicking] = useState(false)
  const [paying, setPaying] = useState(false)
  const [done, setDone] = useState<{ order: Order; customer: Customer | null } | null>(null)
  // A quotation opened from ใบเสนอราคา: its lines become the bill and the sale marks it converted
  const [sp, setSp] = useSearchParams()
  const [fromQuote, setFromQuote] = useState<{ no: string; quotedTotal: number; buyer: QuotationDetail['quotation']['customer'] | null } | null>(null)
  const [quoteLoadError, setQuoteLoadError] = useState<string | null>(null)
  const [addingBuyer, setAddingBuyer] = useState(false)
  const loadedQuote = useRef<string | null>(null)

  useEffect(() => {
    const id = sp.get('quote')
    if (!id || loadedQuote.current === id) return
    loadedQuote.current = id
    Promise.all([api<CartFromQuote>(`/quotes/${encodeURIComponent(id)}/to-cart`, { body: {} }), api<QuotationDetail>(`/quotes/${encodeURIComponent(id)}`)]).then(
      ([c, detail]) => {
        dispatch({ type: 'loadQuote', quotationNo: c.quotationNo, lines: c.lines, customerId: c.customer?.id ?? null })
        setCustomer(c.customer)
        setFromQuote({ no: c.quotationNo, quotedTotal: c.quotedTotal, buyer: c.customer ? null : detail.quotation.customer })
        setQuoteLoadError(null)
        notify(`เปิดใบเสนอราคา ${c.quotationNo} ในบิลแล้ว`)
      },
      (err) => setQuoteLoadError(errorMessage(err)),
    )
    const next = new URLSearchParams(sp)
    next.delete('quote')
    setSp(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp])
  const byId = useMemo(() => new Map((products.data ?? []).map((p) => [p.id, p])), [products.data])
  const settled = useDebounced(cart, 220)

  // The server prices every cart (discounts, VAT, stock); the screen only shows what it says
  useEffect(() => {
    if (!settled.lines.length) {
      setQuote(null)
      setQuoteError(null)
      return
    }
    const ctrl = new AbortController()
    setQuoting(true)
    api<Quote>('/quote', {
      body: { lines: toLines(settled), billDiscount: settled.billDiscount.value > 0 ? settled.billDiscount : undefined },
      signal: ctrl.signal,
    })
      .then(
        (qt) => {
          setQuote(qt)
          setQuoteError(null)
        },
        (err) => {
          if ((err as Error).name === 'AbortError') return
          setQuote(null)
          setQuoteError(errorMessage(err))
        },
      )
      .finally(() => {
        if (!ctrl.signal.aborted) setQuoting(false)
      })
    return () => ctrl.abort()
  }, [settled])

  const fresh = settled === cart && !quoting && quote !== null && !quoteError
  const inCart = (id: string) => cart.lines.find((l) => l.productId === id)?.qty ?? 0
  const maxOf = (p: ProductRow) => (p.trackStock ? p.stock : null)

  const shown = (products.data ?? [])
    .filter((p) => p.active)
    .filter((p) => cat === 'all' || p.categoryId === cat)
    .filter((p) => {
      const s = q.trim().toLowerCase()
      return !s || `${p.name} ${p.subtitle} ${p.sku}`.toLowerCase().includes(s)
    })

  const paid = (order: Order) => {
    setPaying(false)
    setDone({ order, customer })
    dispatch({ type: 'clear' })
    setCustomer(null)
    setFromQuote(null)
    setDiscountOpen([])
    products.reload()
    refreshShift()
    notify(`บันทึกการขาย ${order.no} แล้ว`)
  }

  const count = itemCount(cart)

  return (
    <div className="pos">
      <PageHead title="ขายหน้าร้าน" lead="แตะสินค้าเพื่อใส่บิล ราคา ส่วนลด และภาษีคำนวณโดยเซิร์ฟเวอร์ทุกครั้ง" />

      <div className="pos__layout">
        <section className="pos__catalog" aria-labelledby="catalog-title">
          <h2 id="catalog-title" className="visually-hidden">
            สินค้า
          </h2>
          <div className="pos__filters">
            <div className="search">
              <label htmlFor="pos-search" className="visually-hidden">
                ค้นหาสินค้า
              </label>
              <Search size={18} aria-hidden className="search__icon" />
              <input id="pos-search" type="search" placeholder="ค้นหาชื่อ รุ่น หรือ SKU" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Segmented
              legend="หมวดสินค้า"
              hideLegend
              value={cat}
              onChange={setCat}
              options={[{ value: 'all', label: 'ทั้งหมด' }, ...(meta?.categories ?? []).map((c) => ({ value: c.id, label: c.label }))]}
            />
          </div>

          {products.error && <ErrorNote message={products.error} onRetry={products.reload} />}
          {!products.data && !products.error && <Loading label="กำลังโหลดสินค้า" />}
          {products.data && !shown.length && <Empty>ไม่พบสินค้าที่ตรงกับคำค้น ลองพิมพ์ชื่อรุ่นหรือ SKU อื่น</Empty>}

          <ul className="tiles">
            {shown.map((p) => {
              const left = p.trackStock ? p.stock - inCart(p.id) : null
              const out = left !== null && left <= 0
              return (
                <li key={p.id}>
                  <button type="button" className="tile" disabled={out} onClick={() => dispatch({ type: 'add', productId: p.id, max: maxOf(p) })}>
                    <ProductThumb product={p} size="md" />
                    <span className="tile__body">
                      <span className="tile__name">{p.name}</span>
                      <span className="tile__sub">{p.subtitle}</span>
                      <span className="tile__foot">
                        <span className="tile__price">{baht(p.price)} <span className="tile__unit">บาท</span></span>
                        <span className={`tile__stock ${out ? 'is-out' : left !== null && left <= p.reorderLevel ? 'is-low' : ''}`}>
                          {left === null ? 'ไม่นับสต็อก' : out ? (inCart(p.id) ? 'อยู่ในบิลครบแล้ว' : 'หมด') : `เหลือ ${left} ${p.unit}`}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="pos__cart" id="cart" aria-labelledby="cart-title" tabIndex={-1}>
          <div className="slip">
            <div className="slip__head">
              <h2 id="cart-title">บิลปัจจุบัน</h2>
              {cart.lines.length > 0 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'clear' })}>
                  ล้างบิล
                </button>
              )}
            </div>

            <div className="slip__customer">
              <span className="slip__customer-icon" aria-hidden="true">
                {customer?.kind === 'company' ? <Building size={18} /> : <User size={18} />}
              </span>
              <span className="slip__customer-text">
                <span className="slip__customer-name">{customer ? customer.name : 'ลูกค้าทั่วไป'}</span>
                <span className="slip__customer-sub">
                  {customer ? (isFullInvoice(customer) ? 'ออกใบกำกับภาษีเต็มรูป' : `${KIND_LABEL[customer.kind]} โทร ${customer.phone}`) : 'ใบเสร็จรับเงิน/ใบกำกับภาษีอย่างย่อ'}
                </span>
              </span>
              <span className="slip__customer-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicking(true)}>
                  {customer ? 'เปลี่ยน' : 'เลือกลูกค้า'}
                </button>
                {customer && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="กลับเป็นลูกค้าทั่วไป"
                    onClick={() => {
                      setCustomer(null)
                      dispatch({ type: 'customer', customerId: null })
                    }}
                  >
                    <X size={18} aria-hidden />
                  </button>
                )}
              </span>
            </div>

            {quoteLoadError && (
              <p className="slip__error" role="alert">
                เปิดใบเสนอราคาไม่ได้: {quoteLoadError}
              </p>
            )}
            {fromQuote && cart.quotationNo && (
              <div className="quote-ref">
                <FileText size={18} aria-hidden />
                <span>
                  ตามใบเสนอราคา <strong>{fromQuote.no}</strong> ยอดที่เสนอ {bahtText(fromQuote.quotedTotal)}
                </span>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => {
                    dispatch({ type: 'unlinkQuote' })
                    setFromQuote(null)
                  }}
                >
                  ไม่อ้างอิงใบเสนอราคานี้
                </button>
                {fromQuote.buyer && !customer && (
                  <span className="muted">
                    ผู้ซื้อ {fromQuote.buyer.company ?? fromQuote.buyer.name} ยังไม่มีในรายชื่อลูกค้า{' '}
                    <button type="button" className="text-btn" onClick={() => setAddingBuyer(true)}>
                      เพิ่มเป็นลูกค้า
                    </button>
                  </span>
                )}
              </div>
            )}

            {cart.lines.length === 0 ? (
              <p className="slip__empty">ยังไม่มีสินค้าในบิล แตะสินค้าทางซ้ายเพื่อเพิ่ม</p>
            ) : (
              <ul className="lines">
                {cart.lines.map((l) => {
                  const p = byId.get(l.productId)
                  if (!p) return null
                  const priced = quote?.lines.find((x) => x.productId === l.productId)
                  const open = discountOpen.includes(l.productId) || l.discount > 0
                  return (
                    <li key={l.productId} className="line">
                      <div className="line__top">
                        <span className="line__name">{p.name}</span>
                        <span className="line__total">{baht(priced?.total ?? p.price * l.qty - l.discount)}</span>
                      </div>
                      <p className="line__meta">
                        {p.sku} ราคาต่อหน่วย {baht(p.price)}
                      </p>
                      <div className="line__controls">
                        <div className="stepper" role="group" aria-label={`จำนวน ${p.name}`}>
                          <button type="button" aria-label={`ลดจำนวน ${p.name}`} onClick={() => (l.qty > 1 ? dispatch({ type: 'qty', productId: p.id, qty: l.qty - 1, max: maxOf(p) }) : dispatch({ type: 'remove', productId: p.id }))}>
                            <Minus size={16} aria-hidden />
                          </button>
                          <input
                            aria-label={`จำนวน ${p.name}`}
                            inputMode="numeric"
                            value={l.qty}
                            onChange={(e) => dispatch({ type: 'qty', productId: p.id, qty: Number(e.target.value.replace(/\D/g, '')) || 1, max: maxOf(p) })}
                          />
                          <button type="button" aria-label={`เพิ่มจำนวน ${p.name}`} disabled={p.trackStock && l.qty >= p.stock} onClick={() => dispatch({ type: 'qty', productId: p.id, qty: l.qty + 1, max: maxOf(p) })}>
                            <Plus size={16} aria-hidden />
                          </button>
                        </div>
                        {!open && (
                          <button type="button" className="text-btn" onClick={() => setDiscountOpen((d) => [...d, p.id])}>
                            <TicketPercent size={16} aria-hidden />
                            ส่วนลดรายการ
                          </button>
                        )}
                        <button type="button" className="icon-btn line__remove" aria-label={`ลบ ${p.name} ออกจากบิล`} onClick={() => dispatch({ type: 'remove', productId: p.id })}>
                          <Trash size={18} aria-hidden />
                        </button>
                      </div>
                      {open && (
                        <div className="line__discount">
                          <label htmlFor={`disc-${p.id}`}>ส่วนลดรายการนี้ (บาท)</label>
                          <input
                            id={`disc-${p.id}`}
                            inputMode="decimal"
                            value={l.discount || ''}
                            placeholder="0"
                            onChange={(e) => dispatch({ type: 'discount', productId: p.id, discount: parseAmount(e.target.value || '0') })}
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {cart.lines.length > 0 && <BillControls cart={cart} onChange={(d) => dispatch(d)} />}

            <div className="slip__totals" aria-live="polite">
              {quoteError && (
                <p className="slip__error" role="alert">
                  {quoteError}
                </p>
              )}
              {quote && (
                <dl>
                  <div>
                    <dt>รวมเป็นเงิน</dt>
                    <dd>{baht(quote.subtotal)}</dd>
                  </div>
                  {quote.lineDiscount + quote.billDiscount > 0 && (
                    <div>
                      <dt>ส่วนลดทั้งหมด</dt>
                      <dd>−{baht(quote.lineDiscount + quote.billDiscount)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>ภาษีมูลค่าเพิ่ม {quote.vatRate}% (รวมในราคาแล้ว)</dt>
                    <dd>{baht(quote.vat)}</dd>
                  </div>
                  <div className="slip__grand">
                    <dt>ยอดชำระ</dt>
                    <dd>
                      {baht(quote.total)} <span>บาท</span>
                    </dd>
                  </div>
                </dl>
              )}
              {!quote && !quoteError && cart.lines.length > 0 && <p className="slip__pending">กำลังคำนวณยอด</p>}
            </div>

            <button type="button" className="btn btn-primary slip__pay" disabled={!fresh} onClick={() => setPaying(true)}>
              <Banknote size={20} aria-hidden />
              {quote && fresh ? `ชำระเงิน ${bahtText(quote.total)}` : 'ชำระเงิน'}
            </button>
          </div>
        </section>
      </div>

      {/* Phones: the bill sits below the catalogue, so keep its total in reach */}
      {count > 0 && (
        <div className="pos__bar">
          <span className="pos__bar-text">
            <span>
              บิลนี้ {count} ชิ้น
            </span>
            <strong>{quote ? bahtText(quote.total) : 'กำลังคำนวณ'}</strong>
          </span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              const el = document.getElementById('cart')
              el?.scrollIntoView({ block: 'start' })
              el?.focus({ preventScroll: true })
            }}
          >
            <ShoppingCart size={16} aria-hidden />
            ไปที่บิล
          </button>
        </div>
      )}

      <Dialog open={picking} onClose={() => setPicking(false)} title="เลือกลูกค้า" size="lg">
        <CustomerPicker
          onPick={(c) => {
            setCustomer(c)
            dispatch({ type: 'customer', customerId: c.id })
            setPicking(false)
          }}
        />
      </Dialog>

      <Dialog open={addingBuyer} onClose={() => setAddingBuyer(false)} title="เพิ่มลูกค้าจากใบเสนอราคา" size="lg">
        {fromQuote?.buyer && (
          <CustomerForm
            prefill={{
              kind: fromQuote.buyer.company ? 'company' : 'person',
              name: fromQuote.buyer.company ?? fromQuote.buyer.name,
              phone: fromQuote.buyer.phone,
              email: fromQuote.buyer.email,
              taxId: fromQuote.buyer.taxId,
              address: fromQuote.buyer.address,
              note: fromQuote.buyer.company ? `ผู้ติดต่อ ${fromQuote.buyer.name}` : null,
            }}
            submitLabel="เพิ่มและเลือกลูกค้านี้"
            onSaved={(c) => {
              setCustomer(c)
              dispatch({ type: 'customer', customerId: c.id })
              setAddingBuyer(false)
              notify(`เพิ่มลูกค้า ${c.name} แล้ว`)
            }}
          />
        )}
      </Dialog>

      <Dialog open={paying} onClose={() => setPaying(false)} title="รับชำระเงิน">
        {quote && <PayForm total={quote.total} cart={cart} onPaid={paid} />}
      </Dialog>

      <Dialog open={done !== null} onClose={() => setDone(null)} title="ชำระเงินเรียบร้อย" size="lg" className="dialog--receipt">
        {done && meta && (
          <div className="done">
            <Receipt order={done.order} customer={done.customer} settings={meta.settings} />
            <div className="done__actions">
              <PrintButton />
              <Link className="btn btn-ghost" to={`/orders/${done.order.id}`}>
                ดูรายละเอียดบิล
              </Link>
              <button type="button" className="btn btn-primary" onClick={() => setDone(null)}>
                บิลใหม่
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}

function BillControls({ cart, onChange }: { cart: Cart; onChange: (a: { type: 'billDiscount'; discount: Cart['billDiscount'] } | { type: 'note'; note: string }) => void }) {
  const [text, setText] = useState(cart.billDiscount.value ? String(cart.billDiscount.value) : '')
  return (
    <div className="slip__bill">
      <div className="slip__discount">
        <Segmented<'amount' | 'percent'>
          legend="ส่วนลดท้ายบิล"
          value={cart.billDiscount.type}
          onChange={(type) => onChange({ type: 'billDiscount', discount: { type, value: parseAmount(text || '0') || 0 } })}
          options={[
            { value: 'amount', label: 'บาท' },
            { value: 'percent', label: '%' },
          ]}
        />
        <label htmlFor="bill-discount" className="visually-hidden">
          ส่วนลดท้ายบิล ({cart.billDiscount.type === 'percent' ? 'เปอร์เซ็นต์' : 'บาท'})
        </label>
        <input
          id="bill-discount"
          inputMode="decimal"
          placeholder="0"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            onChange({ type: 'billDiscount', discount: { type: cart.billDiscount.type, value: parseAmount(e.target.value || '0') || 0 } })
          }}
        />
      </div>
      <Field label="หมายเหตุในบิล (ไม่บังคับ)">{(id) => <input id={id} value={cart.note} onChange={(e) => onChange({ type: 'note', note: e.target.value })} />}</Field>
    </div>
  )
}

function CustomerPicker({ onPick }: { onPick: (c: Customer) => void }) {
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const term = useDebounced(q, 250)
  const list = useLoad((signal) => api<CustomerRow[]>(`/customers?q=${encodeURIComponent(term)}`, { signal }), [term])

  if (adding)
    return (
      <div className="picker">
        <button type="button" className="text-btn" onClick={() => setAdding(false)}>
          กลับไปค้นหาลูกค้า
        </button>
        <CustomerForm onSaved={onPick} submitLabel="เพิ่มและเลือกลูกค้านี้" />
      </div>
    )

  return (
    <div className="picker">
      <div className="picker__bar">
        <div className="search">
          <label htmlFor="pick-search" className="visually-hidden">
            ค้นหาลูกค้า
          </label>
          <Search size={18} aria-hidden className="search__icon" />
          <input id="pick-search" type="search" placeholder="ชื่อ เบอร์โทร หรืออีเมล" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setAdding(true)}>
          <UserPlus size={18} aria-hidden />
          ลูกค้าใหม่
        </button>
      </div>
      {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
      {list.data && !list.data.length && <Empty>ไม่พบลูกค้า กด "ลูกค้าใหม่" เพื่อเพิ่ม</Empty>}
      <ul className="picker__list">
        {list.data?.slice(0, 40).map((c) => (
          <li key={c.id}>
            <span className="picker__icon" aria-hidden="true">
              {c.kind === 'company' ? <Building size={18} /> : <User size={18} />}
            </span>
            <span className="picker__text">
              <span className="picker__name">{c.name}</span>
              <span className="picker__sub">
                {KIND_LABEL[c.kind]} โทร {c.phone}
                {c.taxId ? ` เลขผู้เสียภาษี ${c.taxId}` : ''}
              </span>
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPick(c)}>
              เลือก<span className="visually-hidden"> {c.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

const METHODS: { id: PaymentMethod; Icon: typeof Banknote }[] = [
  { id: 'cash', Icon: Banknote },
  { id: 'promptpay', Icon: QrCode },
  { id: 'card', Icon: CreditCard },
  { id: 'transfer', Icon: Landmark },
]

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function PayForm({ total, cart, onPaid }: { total: number; cart: Cart; onPaid: (o: Order) => void }) {
  const [method, setMethod] = useState<PaymentMethod>(total > 300_000 ? 'transfer' : 'cash')
  const [tendered, setTendered] = useState(String(total))
  const [last4, setLast4] = useState('')
  const [phase, setPhase] = useState<'idle' | 'approving' | 'sending'>('idle')
  const [error, setError] = useState<string | null>(null)

  const cash = parseAmount(tendered)
  const change = cash - total

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (method === 'cash' && !(cash >= total)) return setError(`รับเงินยังไม่พอ ขาดอีก ${bahtText(total - (cash || 0))}`)
    if (method === 'card' && last4 && !/^\d{4}$/.test(last4)) return setError('เลขท้ายบัตรต้องเป็นตัวเลข 4 หลัก หรือเว้นว่างไว้')
    try {
      if (method === 'card') {
        setPhase('approving')
        await wait(900)
      }
      setPhase('sending')
      const order = await api<Order>('/orders', {
        body: toCheckout(cart, { method, tendered: method === 'cash' ? cash : null, cardLast4: method === 'card' && last4 ? last4 : null }),
      })
      onPaid(order)
    } catch (err) {
      setError(errorMessage(err))
      setPhase('idle')
    }
  }

  const label =
    method === 'cash'
      ? `รับเงินสด ${bahtText(Number.isFinite(cash) ? cash : 0)}`
      : method === 'promptpay'
        ? 'ยืนยันว่าได้รับเงินพร้อมเพย์แล้ว'
        : method === 'card'
          ? 'รูดบัตรและชำระเงิน'
          : 'ยืนยันว่าได้รับเงินโอนแล้ว'

  return (
    <form className="pay" onSubmit={submit} noValidate>
      <p className="pay__due">
        <span>ยอดที่ต้องชำระ</span>
        <strong>{bahtText(total)}</strong>
      </p>

      <fieldset className="pay__methods">
        <legend>วิธีชำระเงิน</legend>
        {METHODS.map(({ id, Icon }) => (
          <label key={id} className="pay__method">
            <input type="radio" name="method" value={id} checked={method === id} onChange={() => setMethod(id)} />
            <Icon size={22} aria-hidden />
            <span>{PAYMENT_LABEL[id]}</span>
          </label>
        ))}
      </fieldset>

      {method === 'cash' && (
        <div className="pay__panel">
          <Field label="รับเงินมา (บาท)">{(id) => <input id={id} inputMode="decimal" value={tendered} onChange={(e) => setTendered(e.target.value)} />}</Field>
          <div className="pay__quick" role="group" aria-label="จำนวนเงินที่รับบ่อย">
            {quickTenders(total).map((v, i) => (
              <button key={v} type="button" className="btn btn-ghost btn-sm" onClick={() => setTendered(String(v))}>
                {i === 0 ? `พอดี ${baht(v)}` : baht(v)}
              </button>
            ))}
          </div>
          <p className={`pay__change ${change < 0 ? 'is-short' : ''}`} aria-live="polite">
            {Number.isFinite(change) ? (change >= 0 ? `เงินทอน ${bahtText(change)}` : `ยังขาดอีก ${bahtText(-change)}`) : 'ใส่จำนวนเงินที่รับมาเป็นตัวเลข'}
          </p>
        </div>
      )}

      {method === 'promptpay' && (
        <div className="pay__panel pay__qr">
          <FakeQr seed={`${total}`} label={`QR พร้อมเพย์จำลอง ยอด ${bahtText(total)}`} />
          <p>QR จำลองสำหรับทดสอบ สแกนจ่ายจริงไม่ได้ เมื่อลูกค้าแจ้งว่าโอนแล้ว กดยืนยันเพื่อบันทึกการขาย</p>
        </div>
      )}

      {method === 'card' && (
        <div className="pay__panel">
          <Field label="เลขท้ายบัตร 4 หลัก (ไม่บังคับ)" hint="ไม่กรอกก็ได้ ระบบจะสุ่มเลขให้ในใบเสร็จ">
            {(id, d) => <input id={id} inputMode="numeric" maxLength={4} value={last4} aria-describedby={d} onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))} />}
          </Field>
          {phase === 'approving' && (
            <p className="pay__approving" role="status">
              <span className="spinner" aria-hidden="true" />
              กำลังขออนุมัติจากธนาคาร (จำลอง)
            </p>
          )}
        </div>
      )}

      {method === 'transfer' && (
        <div className="pay__panel">
          <dl className="kv">
            <div>
              <dt>ธนาคาร</dt>
              <dd>ธนาคารตัวอย่าง สาขาบางนา</dd>
            </div>
            <div>
              <dt>เลขที่บัญชี</dt>
              <dd>123-4-56789-0</dd>
            </div>
            <div>
              <dt>ชื่อบัญชี</dt>
              <dd>บริษัท เซอร์โว ฮิวแมนนอยด์ จำกัด</dd>
            </div>
          </dl>
          <p className="muted">บัญชีจำลอง ตรวจยอดในแอปธนาคารแล้วกดยืนยัน ระบบจะออกเลขอ้างอิงให้</p>
        </div>
      )}

      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <p className="pay__sim">ระบบจำลอง ไม่มีการตัดเงินจริง</p>
      <button type="submit" className="btn btn-primary pay__submit" disabled={phase !== 'idle'}>
        {phase === 'sending' ? 'กำลังบันทึกการขาย' : phase === 'approving' ? 'กำลังขออนุมัติ' : label}
      </button>
    </form>
  )
}

/** A QR-looking pattern with the three finder squares; decorative stand-in, not a real payment code. */
function FakeQr({ seed, label }: { seed: string; label: string }) {
  const n = 25
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const cells: [number, number][] = []
  const finder = (x: number, y: number) => x < 8 && y < 8
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (finder(x, y) || finder(n - 1 - x, y) || finder(x, n - 1 - y)) continue
      h = Math.imul(h ^ (x * 31 + y), 16777619)
      if ((h >>> 7) % 2) cells.push([x, y])
    }
  const eye = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={7} height={7} fill="currentColor" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} fill="currentColor" />
    </g>
  )
  return (
    <svg className="fake-qr" viewBox={`-2 -2 ${n + 4} ${n + 4}`} role="img" aria-label={label}>
      <rect x={-2} y={-2} width={n + 4} height={n + 4} fill="#fff" />
      {cells.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x} y={y} width={1} height={1} fill="currentColor" />
      ))}
      {eye(0, 0)}
      {eye(n - 7, 0)}
      {eye(0, n - 7)}
    </svg>
  )
}
