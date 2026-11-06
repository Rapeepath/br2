import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Check, ExternalLink, ShoppingCart, XCircle } from 'lucide-react'
import { api, errorMessage } from '../api'
import { daysLeft, FINANCE_MODE_LABEL, QUOTE_STATUS_LABEL, QUOTE_STATUS_TONE } from '../crm'
import { baht, bahtText, dateOnly, dateTime } from '../format'
import { useDebounced, useLoad } from '../hooks'
import { useToast } from '../session'
import type { Quotation, QuotationDetail, QuotationStatus } from '../types'
import { Card, Empty, ErrorNote, Field, Loading, PageHead, TableWrap, useNow, Words } from '../ui'
import './crm.css'
import './orders.css'

function QuoteStatusBadge({ status }: { status: QuotationStatus }) {
  return <span className={`badge ${QUOTE_STATUS_TONE[status]}`}>{QUOTE_STATUS_LABEL[status]}</span>
}

/** "เหลือ 12 วัน" / "หมดอายุแล้ว", amber in the last week */
function DaysLeft({ q, now }: { q: Pick<Quotation, 'validUntil' | 'status'>; now: Date }) {
  if (q.status === 'converted') return <span className="muted">–</span>
  const d = daysLeft(q.validUntil, now)
  if (d <= 0 || q.status === 'expired') return <span className="days-left">หมดอายุแล้ว</span>
  return <span className={`days-left ${d <= 7 ? 'is-soon' : ''}`}>เหลือ {d} วัน</span>
}

export function QuotesPage() {
  const now = useNow()
  const [sp, setSp] = useSearchParams()
  const status = (sp.get('status') ?? '') as QuotationStatus | ''
  const [qText, setQText] = useState(sp.get('q') ?? '')
  const q = useDebounced(qText, 300)
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (q) params.set('q', q)
  const list = useLoad((signal) => api<{ rows: Quotation[] }>(`/quotes?${params}`, { signal }), [params.toString()])
  const rows = list.data?.rows ?? []
  const open = rows.filter((r) => r.status === 'sent' || r.status === 'accepted')

  return (
    <>
      <PageHead title="ใบเสนอราคา" lead="ใบเสนอราคาที่ลูกค้าจัดสเปกและขอจากเว็บไซต์ มีอายุ 30 วัน เมื่อลูกค้าตกลงแล้วเปิดในหน้าขายเพื่อออกบิลได้ทันที" />

      <div className="filters">
        <div className="filters__row">
          <Field label="ค้นหา" className="filters__search">
            {(id) => <input id={id} type="search" value={qText} placeholder="เลขที่ ชื่อลูกค้า บริษัท เบอร์โทร หรือรุ่น" onChange={(e) => setQText(e.target.value)} />}
          </Field>
          <Field label="สถานะ">
            {(id) => (
              <select
                id={id}
                value={status}
                onChange={(e) => {
                  const next = new URLSearchParams(sp)
                  if (e.target.value) next.set('status', e.target.value)
                  else next.delete('status')
                  setSp(next, { replace: true })
                }}
              >
                <option value="">ทุกสถานะ</option>
                {(Object.keys(QUOTE_STATUS_LABEL) as QuotationStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {QUOTE_STATUS_LABEL[s]}
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
              {rows.length.toLocaleString('th-TH')} ใบ ยังเปิดอยู่ {open.length} ใบ มูลค่ารวม {bahtText(open.reduce((s, r) => s + r.totals.total, 0))}
            </p>
            {rows.length === 0 ? (
              <Empty>ยังไม่มีใบเสนอราคา ลูกค้าขอได้จากหน้า "จัดสเปกและขอใบเสนอราคา" ของแต่ละรุ่นบนเว็บไซต์</Empty>
            ) : (
              <TableWrap label="ตารางใบเสนอราคา">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">เลขที่</th>
                      <th scope="col">วันที่ขอ</th>
                      <th scope="col">ลูกค้า</th>
                      <th scope="col">รายการ</th>
                      <th scope="col" className="num">
                        ยอดรวม (บาท)
                      </th>
                      <th scope="col">การชำระ</th>
                      <th scope="col">สถานะ</th>
                      <th scope="col">อายุใบ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Link to={`/quotes/${r.id}`} className="mono-link">
                            {r.no}
                          </Link>
                        </td>
                        <td className="nowrap">{dateOnly(r.createdAt)}</td>
                        <td className="cell-name">
                          <Words text={r.customer.company ?? r.customer.name} />
                          {r.customer.company && (
                            <span className="cell-sub">
                              <Words text={r.customer.name} />
                            </span>
                          )}
                        </td>
                        <td className="cell-wide">
                          {r.lines[0]?.name}
                          {r.lines.length > 1 && <span className="muted"> และอีก {r.lines.length - 1} รายการ</span>}
                        </td>
                        <td className="num">{baht(r.totals.total)}</td>
                        <td>{FINANCE_MODE_LABEL[r.financing?.mode ?? 'cash']}</td>
                        <td>
                          <QuoteStatusBadge status={r.status} />
                        </td>
                        <td>
                          <DaysLeft q={r} now={now} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </>
        )}
      </Card>
    </>
  )
}

export function QuotePage() {
  const { id = '' } = useParams()
  const now = useNow()
  const navigate = useNavigate()
  const notify = useToast()
  const detail = useLoad((signal) => api<QuotationDetail>(`/quotes/${encodeURIComponent(id)}`, { signal }), [id])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!detail.data) return detail.error ? <ErrorNote message={detail.error} onRetry={detail.reload} /> : <Loading />
  const { quotation: q, lead, publicPath } = detail.data
  const t = q.totals
  const f = q.financing
  const live = q.status === 'sent' || q.status === 'accepted'

  const setStatus = async (status: QuotationStatus, done: string) => {
    setBusy(true)
    setError(null)
    try {
      await api(`/quotes/${q.id}`, { method: 'PATCH', body: { status } })
      notify(done)
      detail.reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHead
        back={{ to: '/quotes', label: 'ใบเสนอราคา' }}
        title={
          <>
            ใบเสนอราคา <span className="mono">{q.no}</span>
          </>
        }
        lead={`ขอเมื่อ ${dateTime(q.createdAt)} ใช้ได้ถึง ${dateOnly(q.validUntil)}`}
        actions={
          <>
            <a className="btn btn-ghost" href={publicPath} target="_blank" rel="noreferrer">
              <ExternalLink size={18} aria-hidden />
              ดูหน้าที่ลูกค้าเห็น
            </a>
            {live && (
              <button type="button" className="btn btn-primary" onClick={() => navigate(`/pos?quote=${encodeURIComponent(q.id)}`)}>
                <ShoppingCart size={18} aria-hidden />
                เปิดในหน้าขาย
              </button>
            )}
          </>
        }
      />

      {error && (
        <p className="form__error gap-below" role="alert">
          {error}
        </p>
      )}

      <div className="quote-grid">
        <Card title="รายการที่เสนอ">
          <TableWrap label="รายการในใบเสนอราคา">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">รายการ</th>
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
                {q.lines.map((l) => (
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
              <dd>{baht(t.subtotal)}</dd>
            </div>
            {t.lineDiscount + t.billDiscount > 0 && (
              <div>
                <dt>ส่วนลด</dt>
                <dd>−{baht(t.lineDiscount + t.billDiscount)}</dd>
              </div>
            )}
            <div>
              <dt>มูลค่าก่อนภาษี</dt>
              <dd>{baht(t.beforeVat)}</dd>
            </div>
            <div>
              <dt>ภาษีมูลค่าเพิ่ม {t.vatRate}%</dt>
              <dd>{baht(t.vat)}</dd>
            </div>
            <div className="totals__grand">
              <dt>ยอดรวมทั้งสิ้น</dt>
              <dd>{bahtText(t.total)}</dd>
            </div>
          </dl>
          {q.note && <p className="message">หมายเหตุจากลูกค้า: {q.note}</p>}
        </Card>

        <div className="quote-grid__side">
          <Card title="สถานะ">
            <dl className="kv">
              <div>
                <dt>สถานะ</dt>
                <dd>
                  <QuoteStatusBadge status={q.status} />
                </dd>
              </div>
              <div>
                <dt>อายุใบเสนอราคา</dt>
                <dd>
                  <DaysLeft q={q} now={now} />
                </dd>
              </div>
              {q.orderNo && (
                <div>
                  <dt>ออกบิลแล้ว</dt>
                  <dd>
                    <Link to={`/orders?q=${encodeURIComponent(q.orderNo)}&range=30`} className="mono-link">
                      {q.orderNo}
                    </Link>
                  </dd>
                </div>
              )}
              {lead && (
                <div>
                  <dt>รายชื่อผู้สนใจ</dt>
                  <dd>
                    <Link to={`/leads/${lead.id}`} className="mono-link">
                      {lead.no}
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
            {live && (
              <div className="contact-actions">
                {q.status === 'sent' && (
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setStatus('accepted', `บันทึกว่าลูกค้าตกลงใบ ${q.no} แล้ว`)}>
                    <Check size={16} aria-hidden />
                    ลูกค้าตกลงแล้ว
                  </button>
                )}
                {q.status === 'accepted' && (
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setStatus('sent', `ย้อนใบ ${q.no} เป็นรอลูกค้าตัดสินใจ`)}>
                    ย้อนเป็นรอลูกค้าตัดสินใจ
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setStatus('expired', `ปิดใบเสนอราคา ${q.no} แล้ว`)}>
                  <XCircle size={16} aria-hidden />
                  ปิดใบเสนอราคา
                </button>
              </div>
            )}
          </Card>

          <Card title="ลูกค้า">
            <dl className="kv">
              {q.customer.company && (
                <div>
                  <dt>บริษัท/หน่วยงาน</dt>
                  <dd>{q.customer.company}</dd>
                </div>
              )}
              <div>
                <dt>ผู้ติดต่อ</dt>
                <dd>{q.customer.name}</dd>
              </div>
              <div>
                <dt>โทร</dt>
                <dd>{q.customer.phone || '–'}</dd>
              </div>
              <div>
                <dt>อีเมล</dt>
                <dd>{q.customer.email ?? '–'}</dd>
              </div>
              <div>
                <dt>เลขประจำตัวผู้เสียภาษี</dt>
                <dd>{q.customer.taxId ?? '–'}</dd>
              </div>
              <div>
                <dt>ที่อยู่ออกใบกำกับภาษี</dt>
                <dd>{q.customer.address ?? '–'}</dd>
              </div>
            </dl>
          </Card>

          <Card title="การชำระเงินที่ลูกค้าเลือก">
            {f && f.mode !== 'cash' ? (
              <dl className="kv">
                <div>
                  <dt>รูปแบบ</dt>
                  <dd>{FINANCE_MODE_LABEL[f.mode]}</dd>
                </div>
                <div>
                  <dt>เงินดาวน์</dt>
                  <dd>
                    {bahtText(f.downPayment)} ({f.downPct}%)
                  </dd>
                </div>
                <div>
                  <dt>ยอดจัด</dt>
                  <dd>{bahtText(f.financed)}</dd>
                </div>
                <div>
                  <dt>ระยะเวลา</dt>
                  <dd>
                    {f.months} เดือน ดอกเบี้ย {f.ratePct}% ต่อปี (คงที่)
                  </dd>
                </div>
                <div className="kv__strong">
                  <dt>ผ่อนต่อเดือน</dt>
                  <dd>{bahtText(f.monthly)}</dd>
                </div>
                <div>
                  <dt>รวมที่ต้องชำระทั้งหมด</dt>
                  <dd>{bahtText(f.totalPayable)}</dd>
                </div>
              </dl>
            ) : (
              <p className="muted">ชำระเต็มจำนวน {bahtText(t.total)}</p>
            )}
            <p className="muted section-gap">ตัวเลขผ่อนเป็นการประมาณการ อนุมัติจริงขึ้นกับสถาบันการเงิน</p>
          </Card>
        </div>
      </div>
    </>
  )
}
