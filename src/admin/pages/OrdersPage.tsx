import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Printer, Undo2 } from 'lucide-react'
import { api, errorMessage } from '../api'
import { addDays, baht, bahtText, dateTime, KIND_LABEL, PAYMENT_LABEL, STATUS_LABEL, todayKey } from '../format'
import { useDebounced, useLoad } from '../hooks'
import { isFullInvoice, PrintButton, Receipt } from '../Receipt'
import { useSession, useToast } from '../session'
import type { OrderDetail, OrderList } from '../types'
import { Card, Dialog, Empty, ErrorNote, Field, Loading, PageHead, Pagination, RangeFilter, rangeOf, StatusBadge, TableWrap, type RangePreset } from '../ui'
import './orders.css'

const PAGE = 25

export function OrdersPage() {
  const { meta } = useSession()
  const [sp, setSp] = useSearchParams()
  const preset = (sp.get('range') as RangePreset | null) ?? '7'
  const { from, to } = rangeOf(preset, { from: sp.get('from') ?? addDays(todayKey(), -6), to: sp.get('to') ?? todayKey() })
  const status = sp.get('status') ?? ''
  const payment = sp.get('payment') ?? ''
  const staffId = sp.get('staff') ?? ''
  const page = Number(sp.get('page') ?? 0) || 0
  const [qText, setQText] = useState(sp.get('q') ?? '')
  const q = useDebounced(qText, 300)

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('page' in patch)) next.delete('page')
    setSp(next, { replace: true })
  }

  useEffect(() => {
    if ((sp.get('q') ?? '') !== q) set({ q })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const params = new URLSearchParams({ from, to, limit: String(PAGE), offset: String(page * PAGE) })
  if (status) params.set('status', status)
  if (payment) params.set('payment', payment)
  if (staffId) params.set('staffId', staffId)
  if (q) params.set('q', q)
  const list = useLoad((signal) => api<OrderList>(`/orders?${params}`, { signal }), [params.toString()])

  return (
    <>
      <PageHead title="รายการขาย" lead="ทุกบิลที่ขายผ่านหน้าร้าน ค้นหาด้วยเลขที่บิล ชื่อลูกค้า หรือชื่อสินค้า" />

      <div className="filters">
        <RangeFilter preset={preset} from={from} to={to} onChange={(p, f, t) => set({ range: p, from: p === 'custom' ? f : null, to: p === 'custom' ? t : null })} />
        <div className="filters__row">
          <Field label="ค้นหา" className="filters__search">
            {(id) => <input id={id} type="search" value={qText} placeholder="เลขที่บิล ลูกค้า หรือสินค้า" onChange={(e) => setQText(e.target.value)} />}
          </Field>
          <Field label="สถานะ">
            {(id) => (
              <select id={id} value={status} onChange={(e) => set({ status: e.target.value })}>
                <option value="">ทุกสถานะ</option>
                <option value="paid">{STATUS_LABEL.paid}</option>
                <option value="refunded">{STATUS_LABEL.refunded}</option>
              </select>
            )}
          </Field>
          <Field label="ชำระโดย">
            {(id) => (
              <select id={id} value={payment} onChange={(e) => set({ payment: e.target.value })}>
                <option value="">ทุกช่องทาง</option>
                {Object.entries(PAYMENT_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="พนักงาน">
            {(id) => (
              <select id={id} value={staffId} onChange={(e) => set({ staff: e.target.value })}>
                <option value="">ทุกคน</option>
                {meta?.staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </div>

      <Card className={list.loading ? 'is-refreshing' : ''}>
        {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
        {!list.data && !list.error && <Loading />}
        {list.data && (
          <>
            <p className="list-summary" aria-live="polite">
              พบ {list.data.total.toLocaleString('th-TH')} บิล ยอดที่ชำระแล้ว {bahtText(list.data.revenue)}
            </p>
            {list.data.rows.length === 0 ? (
              <Empty>ไม่มีบิลตามเงื่อนไขนี้ ลองขยายช่วงวันที่หรือล้างคำค้น</Empty>
            ) : (
              <TableWrap label="ตารางรายการขาย">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">เลขที่บิล</th>
                      <th scope="col">วันเวลา</th>
                      <th scope="col">ลูกค้า</th>
                      <th scope="col">รายการ</th>
                      <th scope="col">ชำระโดย</th>
                      <th scope="col" className="num">
                        ยอดสุทธิ (บาท)
                      </th>
                      <th scope="col">สถานะ</th>
                      <th scope="col">พนักงาน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.rows.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <Link to={`/orders/${o.id}`} className="mono-link">
                            {o.no}
                          </Link>
                        </td>
                        <td className="nowrap">{dateTime(o.createdAt)}</td>
                        <td>{o.customerName ?? 'ลูกค้าทั่วไป'}</td>
                        <td className="cell-wide">
                          {o.lines[0]?.name}
                          {o.lines.length > 1 && <span className="muted"> และอีก {o.lines.length - 1} รายการ</span>}
                        </td>
                        <td>{PAYMENT_LABEL[o.payment.method]}</td>
                        <td className="num">{baht(o.total)}</td>
                        <td>
                          <StatusBadge status={o.status} />
                        </td>
                        <td>{o.staffName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
            <Pagination page={page} pageSize={PAGE} total={list.data.total} onPage={(p) => set({ page: String(p) })} />
          </>
        )}
      </Card>
    </>
  )
}

export function OrderPage() {
  const { id = '' } = useParams()
  const { isManager, refreshShift } = useSession()
  const notify = useToast()
  const detail = useLoad((signal) => api<OrderDetail>(`/orders/${encodeURIComponent(id)}`, { signal }), [id])
  const [printing, setPrinting] = useState(false)
  const [refunding, setRefunding] = useState(false)

  if (!detail.data) return detail.error ? <ErrorNote message={detail.error} onRetry={detail.reload} /> : <Loading />
  const { order: o, customer, settings } = detail.data
  const p = o.payment

  return (
    <>
      <PageHead
        back={{ to: '/orders', label: 'รายการขาย' }}
        title={
          <>
            บิล <span className="mono">{o.no}</span>
          </>
        }
        lead={`${dateTime(o.createdAt)} ขายโดย ${o.staffName}`}
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setPrinting(true)}>
              <Printer size={18} aria-hidden />
              ดูและพิมพ์ใบเสร็จ
            </button>
            {o.status === 'paid' && (
              <button type="button" className="btn btn-primary" onClick={() => setRefunding(true)}>
                <Undo2 size={18} aria-hidden />
                คืนเงิน
              </button>
            )}
          </>
        }
      />

      <div className="order-grid">
        <Card title="รายการสินค้า" className="order-grid__lines">
          <TableWrap label="รายการสินค้าในบิล">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">สินค้า</th>
                  <th scope="col" className="num">
                    จำนวน
                  </th>
                  <th scope="col" className="num">
                    ราคาต่อหน่วย
                  </th>
                  <th scope="col" className="num">
                    ส่วนลด
                  </th>
                  <th scope="col" className="num">
                    รวม (บาท)
                  </th>
                </tr>
              </thead>
              <tbody>
                {o.lines.map((l) => (
                  <tr key={l.productId}>
                    <td className="cell-wide">
                      <Link to={`/products/${l.productId}`}>{l.name}</Link>
                      <span className="cell-sub">{l.sku}</span>
                    </td>
                    <td className="num">{l.qty}</td>
                    <td className="num">{baht(l.unitPrice)}</td>
                    <td className="num">{l.discount ? baht(l.discount) : '–'}</td>
                    <td className="num">{baht(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <dl className="totals">
            <div>
              <dt>รวมเป็นเงิน</dt>
              <dd>{baht(o.subtotal)}</dd>
            </div>
            <div>
              <dt>ส่วนลดรายการ</dt>
              <dd>{o.lineDiscount ? `−${baht(o.lineDiscount)}` : '–'}</dd>
            </div>
            <div>
              <dt>ส่วนลดท้ายบิล</dt>
              <dd>{o.billDiscount ? `−${baht(o.billDiscount)}` : '–'}</dd>
            </div>
            <div>
              <dt>มูลค่าก่อนภาษี</dt>
              <dd>{baht(o.beforeVat)}</dd>
            </div>
            <div>
              <dt>ภาษีมูลค่าเพิ่ม {o.vatRate}%</dt>
              <dd>{baht(o.vat)}</dd>
            </div>
            <div className="totals__grand">
              <dt>ยอดสุทธิ</dt>
              <dd>{bahtText(o.total)}</dd>
            </div>
          </dl>
        </Card>

        <div className="order-grid__side">
          <Card title="สถานะและการชำระเงิน">
            <dl className="kv">
              <div>
                <dt>สถานะ</dt>
                <dd>
                  <StatusBadge status={o.status} />
                </dd>
              </div>
              <div>
                <dt>ชำระโดย</dt>
                <dd>{PAYMENT_LABEL[p.method]}</dd>
              </div>
              <div>
                <dt>จำนวนเงิน</dt>
                <dd>{bahtText(p.amount)}</dd>
              </div>
              {p.tendered !== null && (
                <div>
                  <dt>รับเงินมา</dt>
                  <dd>{bahtText(p.tendered)}</dd>
                </div>
              )}
              {p.change !== null && (
                <div>
                  <dt>เงินทอน</dt>
                  <dd>{bahtText(p.change)}</dd>
                </div>
              )}
              {p.cardLast4 && (
                <div>
                  <dt>บัตร</dt>
                  <dd>**** {p.cardLast4}</dd>
                </div>
              )}
              {p.reference && (
                <div>
                  <dt>{p.method === 'card' ? 'รหัสอนุมัติ' : 'เลขอ้างอิง'}</dt>
                  <dd className="mono">{p.reference}</dd>
                </div>
              )}
              {o.quotationNo && (
                <div>
                  <dt>ตามใบเสนอราคา</dt>
                  <dd>
                    <Link to={`/quotes/${encodeURIComponent(o.quotationNo)}`} className="mono-link">
                      {o.quotationNo}
                    </Link>
                  </dd>
                </div>
              )}
              <div>
                <dt>กะ</dt>
                <dd>{o.shiftId ? <Link to="/shifts">{o.shiftId}</Link> : '–'}</dd>
              </div>
              {o.note && (
                <div>
                  <dt>หมายเหตุ</dt>
                  <dd>{o.note}</dd>
                </div>
              )}
            </dl>
          </Card>

          {o.refund && (
            <Card title="การคืนเงิน" className="card--warn">
              <dl className="kv">
                <div>
                  <dt>คืนเมื่อ</dt>
                  <dd>{dateTime(o.refund.at)}</dd>
                </div>
                <div>
                  <dt>ทำรายการโดย</dt>
                  <dd>{o.refund.staffName}</dd>
                </div>
                <div>
                  <dt>อนุมัติโดย</dt>
                  <dd>{o.refund.approvedBy}</dd>
                </div>
                <div>
                  <dt>เหตุผล</dt>
                  <dd>{o.refund.reason}</dd>
                </div>
              </dl>
            </Card>
          )}

          <Card title="ลูกค้า">
            {customer ? (
              <dl className="kv">
                <div>
                  <dt>ชื่อ</dt>
                  <dd>
                    <Link to={`/customers/${customer.id}`}>{customer.name}</Link>
                  </dd>
                </div>
                <div>
                  <dt>ประเภท</dt>
                  <dd>{KIND_LABEL[customer.kind]}</dd>
                </div>
                <div>
                  <dt>โทร</dt>
                  <dd>{customer.phone}</dd>
                </div>
                {customer.taxId && (
                  <div>
                    <dt>เลขประจำตัวผู้เสียภาษี</dt>
                    <dd>{customer.taxId}</dd>
                  </div>
                )}
                {customer.address && (
                  <div>
                    <dt>ที่อยู่</dt>
                    <dd>{customer.address}</dd>
                  </div>
                )}
                <div>
                  <dt>เอกสาร</dt>
                  <dd>{isFullInvoice(customer) ? 'ใบกำกับภาษีเต็มรูป' : 'ใบกำกับภาษีอย่างย่อ'}</dd>
                </div>
              </dl>
            ) : (
              <p className="muted">ลูกค้าทั่วไป ไม่ได้บันทึกข้อมูลลูกค้า</p>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={printing} onClose={() => setPrinting(false)} title={`ใบเสร็จ ${o.no}`} size="lg" className="dialog--receipt">
        <div className="done">
          <Receipt order={o} customer={customer} settings={settings} />
          <div className="done__actions">
            <PrintButton />
          </div>
        </div>
      </Dialog>

      <Dialog open={refunding} onClose={() => setRefunding(false)} title={`คืนเงินบิล ${o.no}`}>
        <RefundForm
          orderId={o.id}
          total={o.total}
          needsPin={!isManager}
          onDone={() => {
            setRefunding(false)
            notify(`คืนเงินบิล ${o.no} แล้ว สินค้ากลับเข้าสต็อก`)
            detail.reload()
            refreshShift()
          }}
        />
      </Dialog>
    </>
  )
}

const REASONS = ['ลูกค้าเปลี่ยนใจ', 'คิดเงินผิดรายการ', 'สินค้ามีปัญหา', 'ยกเลิกคำสั่งซื้อ']

function RefundForm({ orderId, total, needsPin, onDone }: { orderId: string; total: number; needsPin: boolean; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return setError('ระบุเหตุผลการคืนเงิน')
    if (needsPin && pin.length < 4) return setError('ใส่รหัส PIN ของผู้จัดการเพื่ออนุมัติ')
    setBusy(true)
    setError(null)
    try {
      await api(`/orders/${orderId}/refund`, { body: { reason, managerPin: needsPin ? pin : undefined } })
      onDone()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <p>
        คืนเงิน {bahtText(total)} ให้ลูกค้า สินค้าที่นับสต็อกจะกลับเข้าสต็อก และบิลจะถูกทำเครื่องหมายว่าคืนเงินแล้ว ย้อนกลับไม่ได้
      </p>
      <Field label="เหตุผลการคืนเงิน">{(id) => <input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      <div className="chips" role="group" aria-label="เหตุผลที่ใช้บ่อย">
        {REASONS.map((r) => (
          <button key={r} type="button" className="chip-btn" aria-pressed={reason === r} onClick={() => setReason(r)}>
            {r}
          </button>
        ))}
      </div>
      {needsPin && (
        <Field label="รหัส PIN ผู้จัดการ" hint="พนักงานต้องให้ผู้จัดการอนุมัติการคืนเงิน (รหัสทดลอง 1111)">
          {(id, d) => <input id={id} type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} aria-describedby={d} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />}
        </Field>
      )}
      {error && (
        <p className="form__error" role="alert">
          {error}
        </p>
      )}
      <div className="form__actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          <Undo2 size={18} aria-hidden />
          {busy ? 'กำลังคืนเงิน' : 'ยืนยันคืนเงิน'}
        </button>
      </div>
    </form>
  )
}
