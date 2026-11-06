import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { CalendarDays, FileText, Mail, MessageCircle, Phone, ShieldAlert, UserX } from 'lucide-react'
import { api, errorMessage } from '../api'
import {
  ageOf,
  BOOKING_STATUS_LABEL,
  BOOKING_STATUS_TONE,
  isOverdue,
  LANG_LABEL,
  LEAD_FLOW,
  LEAD_KIND_LABEL,
  LEAD_STATUS_LABEL,
  LEAD_STATUS_TONE,
  lineHref,
  PRIVACY_REQUEST_LABEL,
  QUOTE_STATUS_LABEL,
  QUOTE_STATUS_TONE,
  refName,
  telHref,
} from '../crm'
import { bahtText, dateTime, dayLong } from '../format'
import { useDebounced, useLoad } from '../hooks'
import { useSession, useToast } from '../session'
import type { LeadDetail, LeadKind, LeadList, LeadRow, LeadStatus } from '../types'
import { Card, Dialog, Empty, ErrorNote, Field, Loading, PageHead, Pagination, TableWrap, useNow, Words } from '../ui'
import './crm.css'

const PAGE = 25

function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <span className={`badge ${LEAD_STATUS_TONE[status]}`}>{LEAD_STATUS_LABEL[status]}</span>
}

function KindBadge({ lead }: { lead: Pick<LeadRow, 'kind'> }) {
  return <span className={`badge ${lead.kind === 'privacy' ? 'badge--pdpa' : 'badge--quiet'}`}>{LEAD_KIND_LABEL[lead.kind]}</span>
}

export function LeadsPage() {
  const now = useNow()
  const [sp, setSp] = useSearchParams()
  const status = (sp.get('status') ?? '') as LeadStatus | ''
  const kind = (sp.get('kind') ?? '') as LeadKind | ''
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

  const params = new URLSearchParams({ limit: String(PAGE), offset: String(page * PAGE) })
  if (status) params.set('status', status)
  if (kind) params.set('kind', kind)
  if (q) params.set('q', q)
  const list = useLoad((signal) => api<LeadList>(`/leads?${params}`, { signal }), [params.toString()])
  const counts = list.data?.counts
  const all = counts ? Object.values(counts).reduce((s, n) => s + n, 0) : null

  const tabHref = (s: LeadStatus | '') => {
    const next = new URLSearchParams(sp)
    if (s) next.set('status', s)
    else next.delete('status')
    next.delete('page')
    const qs = next.toString()
    return qs ? `/leads?${qs}` : '/leads'
  }

  return (
    <>
      <PageHead title="ลูกค้าที่สนใจ" lead="ทุกคนที่ติดต่อมาจากเว็บไซต์: สอบถาม นัดชมการสาธิต ขอใบเสนอราคา และคำขอตาม PDPA ตอบรายใหม่ภายใน 24 ชั่วโมง" />

      <nav aria-label="กรองตามสถานะ">
        <ul className="status-tabs">
          <li>
            <Link to={tabHref('')} aria-current={!status ? 'page' : undefined}>
              ทั้งหมด {all !== null && <span className="status-tabs__n">{all}</span>}
            </Link>
          </li>
          {LEAD_FLOW.map((s) => (
            <li key={s}>
              <Link to={tabHref(s)} aria-current={status === s ? 'page' : undefined}>
                {LEAD_STATUS_LABEL[s]} {counts && <span className="status-tabs__n">{counts[s] ?? 0}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="filters">
        <div className="filters__row">
          <Field label="ค้นหา" className="filters__search">
            {(id) => <input id={id} type="search" value={qText} placeholder="เลขที่ ชื่อ เบอร์โทร อีเมล หรือข้อความ" onChange={(e) => setQText(e.target.value)} />}
          </Field>
          <Field label="เรื่อง">
            {(id) => (
              <select id={id} value={kind} onChange={(e) => set({ kind: e.target.value })}>
                <option value="">ทุกเรื่อง</option>
                {(Object.keys(LEAD_KIND_LABEL) as LeadKind[])
                  .filter((k) => k !== 'reservation')
                  .map((k) => (
                    <option key={k} value={k}>
                      {LEAD_KIND_LABEL[k]}
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
              พบ {list.data.total.toLocaleString('th-TH')} รายการ
            </p>
            {list.data.rows.length === 0 ? (
              <Empty>ไม่มีรายการตามเงื่อนไขนี้ เมื่อมีคนส่งฟอร์มจากเว็บไซต์ รายชื่อจะขึ้นที่นี่ทันที</Empty>
            ) : (
              <TableWrap label="ตารางลูกค้าที่สนใจ">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">เลขที่</th>
                      <th scope="col">ได้รับเมื่อ</th>
                      <th scope="col">ชื่อและการติดต่อ</th>
                      <th scope="col">เรื่อง</th>
                      <th scope="col">ส่งจาก</th>
                      <th scope="col">สถานะ</th>
                      <th scope="col">ผู้ดูแล</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.rows.map((l) => (
                      <tr key={l.id} className={l.kind === 'privacy' ? 'is-privacy' : undefined}>
                        <td>
                          <Link to={`/leads/${l.id}`} className="mono-link">
                            {l.no}
                          </Link>
                        </td>
                        <td>
                          <span className={`nowrap ${isOverdue(l, now) ? 'overdue' : ''}`}>{ageOf(l.createdAt, now)}</span>
                          <span className="cell-sub">{dateTime(l.createdAt)}</span>
                        </td>
                        <td className="cell-name">
                          <Words text={l.name} />
                          <span className="cell-sub">{l.phone || 'ไม่มีเบอร์โทร'}</span>
                        </td>
                        <td className="cell-wide">
                          <span className="badge-row">
                            <KindBadge lead={l} />
                            {l.request && <span className="badge badge--pdpa">{PRIVACY_REQUEST_LABEL[l.request]}</span>}
                          </span>
                          {l.refIds.length > 0 && <span className="cell-sub">{l.refIds.map(refName).join(', ')}</span>}
                        </td>
                        <td>
                          <span className="nowrap">{l.page ?? 'ไม่ระบุหน้า'}</span>
                          <span className="cell-sub">{LANG_LABEL[l.lang]}</span>
                        </td>
                        <td>
                          <LeadStatusBadge status={l.status} />
                        </td>
                        <td>{l.assignee ? <Words text={l.assignee.name} /> : <span className="muted nowrap">ยังไม่มอบหมาย</span>}</td>
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

export function LeadPage() {
  const { id = '' } = useParams()
  const { meta, isManager } = useSession()
  const notify = useToast()
  const detail = useLoad((signal) => api<LeadDetail>(`/leads/${encodeURIComponent(id)}`, { signal }), [id])
  const [wiping, setWiping] = useState(false)

  if (!detail.data) return detail.error ? <ErrorNote message={detail.error} onRetry={detail.reload} /> : <Loading />
  const { lead, booking, quotation } = detail.data
  const wiped = Boolean(lead.anonymisedAt)

  return (
    <>
      <PageHead
        back={{ to: '/leads', label: 'ลูกค้าที่สนใจ' }}
        title={lead.name}
        lead={`${lead.no} ${LEAD_KIND_LABEL[lead.kind]} ได้รับเมื่อ ${dateTime(lead.createdAt)}`}
      />

      <div className="lead-grid">
        <div className="lead-grid__side">
          <Card title="รายละเอียด" className={lead.kind === 'privacy' ? 'card--warn' : ''}>
            <div className="badge-row">
              <KindBadge lead={lead} />
              <LeadStatusBadge status={lead.status} />
              {lead.request && <span className="badge badge--pdpa">{PRIVACY_REQUEST_LABEL[lead.request]}</span>}
            </div>
            {wiped ? (
              <p className="wiped">
                ลบข้อมูลส่วนบุคคลตามคำขอแล้วเมื่อ {dateTime(lead.anonymisedAt!)} เหลือไว้เพียงเลขที่ วันที่ และสถานะเพื่อเป็นหลักฐาน
              </p>
            ) : (
              <>
                <dl className="kv section-gap">
                  <div>
                    <dt>โทร</dt>
                    <dd>{lead.phone || '–'}</dd>
                  </div>
                  <div>
                    <dt>อีเมล</dt>
                    <dd>{lead.email ?? '–'}</dd>
                  </div>
                  <div>
                    <dt>LINE</dt>
                    <dd>{lead.lineId ?? '–'}</dd>
                  </div>
                  <div>
                    <dt>สนใจรุ่น</dt>
                    <dd>
                      {lead.refIds.length
                        ? lead.refIds.map((r, i) => (
                            <span key={r}>
                              {i > 0 && ', '}
                              <a href={`/models/${r}`} target="_blank" rel="noreferrer">{refName(r)}</a>
                            </span>
                          ))
                        : 'ไม่ได้ระบุ'}
                    </dd>
                  </div>
                  <div>
                    <dt>ส่งจากหน้า</dt>
                    <dd>
                      {lead.page ?? 'ไม่ระบุ'} ({LANG_LABEL[lead.lang]})
                    </dd>
                  </div>
                  <div>
                    <dt>ยินยอมให้ติดต่อเมื่อ</dt>
                    <dd>{dateTime(lead.consentAt)}</dd>
                  </div>
                </dl>
                <div className="contact-actions">
                  {lead.phone && (
                    <a className="btn btn-primary btn-sm" href={telHref(lead.phone)}>
                      <Phone size={16} aria-hidden />
                      โทรหา {lead.phone}
                    </a>
                  )}
                  {lead.email && (
                    <a className="btn btn-ghost btn-sm" href={`mailto:${lead.email}?subject=${encodeURIComponent(`${meta?.settings.storeName ?? 'Servo'} ${lead.no}`)}`}>
                      <Mail size={16} aria-hidden />
                      ส่งอีเมล
                    </a>
                  )}
                  {lead.lineId && (
                    <a className="btn btn-ghost btn-sm" href={lineHref(lead.lineId)} target="_blank" rel="noreferrer">
                      <MessageCircle size={16} aria-hidden />
                      เปิดแชต LINE
                    </a>
                  )}
                </div>
                {lead.message && <p className="message">{lead.message}</p>}
              </>
            )}
          </Card>

          {(booking || quotation) && (
            <Card title="รายการที่เกี่ยวข้อง">
              <dl className="kv">
                {booking && (
                  <div>
                    <dt>
                      <CalendarDays size={16} aria-hidden /> นัดหมาย
                    </dt>
                    <dd>
                      <Link to={`/bookings?date=${booking.date}`} className="mono-link">
                        {booking.no}
                      </Link>{' '}
                      {dayLong(booking.date)} เวลา {booking.time} น.{' '}
                      <span className={`badge ${BOOKING_STATUS_TONE[booking.status]}`}>{BOOKING_STATUS_LABEL[booking.status]}</span>
                    </dd>
                  </div>
                )}
                {quotation && (
                  <div>
                    <dt>
                      <FileText size={16} aria-hidden /> ใบเสนอราคา
                    </dt>
                    <dd>
                      <Link to={`/quotes/${quotation.id}`} className="mono-link">
                        {quotation.no}
                      </Link>{' '}
                      {bahtText(quotation.totals.total)}{' '}
                      <span className={`badge ${QUOTE_STATUS_TONE[quotation.status]}`}>{QUOTE_STATUS_LABEL[quotation.status]}</span>
                    </dd>
                  </div>
                )}
              </dl>
            </Card>
          )}

          {(lead.kind === 'privacy' || isManager) && (
            <Card title="ข้อมูลส่วนบุคคล (PDPA)">
              {lead.kind === 'privacy' && (
                <p className="muted">
                  {lead.request === 'delete'
                    ? 'ผู้ขอต้องการให้ลบข้อมูล ยืนยันตัวตนทางโทรศัพท์ก่อน แล้วลบข้อมูลของรายการนี้และรายการที่เกี่ยวข้อง ภายใน 30 วัน'
                    : lead.request === 'access'
                      ? 'ผู้ขอต้องการทราบว่าร้านเก็บข้อมูลอะไรไว้ ยืนยันตัวตนแล้วส่งสรุปข้อมูลให้ภายใน 30 วัน'
                      : 'ผู้ขอต้องการแก้ไขข้อมูล ยืนยันตัวตนแล้วแก้ไขในระบบ และบันทึกสิ่งที่แก้ไว้ด้านล่าง'}
                </p>
              )}
              {isManager ? (
                wiped ? (
                  <p className="muted section-gap">ลบข้อมูลแล้ว</p>
                ) : (
                  <button type="button" className="btn btn-ghost section-gap" onClick={() => setWiping(true)}>
                    <UserX size={18} aria-hidden />
                    ลบข้อมูลส่วนบุคคลของรายนี้
                  </button>
                )
              ) : (
                <p className="muted section-gap">การลบข้อมูลตามคำขอทำได้เฉพาะผู้จัดการ</p>
              )}
            </Card>
          )}
        </div>

        <div className="lead-grid__side">
          {!wiped && (
            <Card title="การติดตาม">
              <FollowUpForm
                key={`${lead.status}-${lead.assignedTo}-${lead.notes.length}`}
                lead={lead}
                onSaved={(msg) => {
                  notify(msg)
                  detail.reload()
                }}
              />
            </Card>
          )}
          <Card title="บันทึกการติดต่อ">
            {lead.notes.length === 0 ? (
              <p className="muted">ยังไม่มีบันทึก จดสิ่งที่คุยกับลูกค้าไว้ที่นี่ ทีมจะได้ตามต่อได้</p>
            ) : (
              <ol className="timeline" aria-label="บันทึกการติดต่อ เรียงจากใหม่ไปเก่า">
                {[...lead.notes].reverse().map((n, i) => (
                  <li key={`${n.at}-${i}`}>
                    <span className="timeline__meta">
                      {dateTime(n.at)} โดย {n.staffName}
                    </span>
                    <span className="timeline__text">{n.text}</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={wiping} onClose={() => setWiping(false)} title="ลบข้อมูลส่วนบุคคล" size="sm">
        <WipeConfirm
          leadId={lead.id}
          name={lead.name}
          onCancel={() => setWiping(false)}
          onDone={() => {
            setWiping(false)
            notify(`ลบข้อมูลส่วนบุคคลของ ${lead.no} แล้ว`)
            detail.reload()
          }}
        />
      </Dialog>
    </>
  )
}

function FollowUpForm({ lead, onSaved }: { lead: LeadRow; onSaved: (message: string) => void }) {
  const { meta } = useSession()
  const [status, setStatus] = useState<LeadStatus>(lead.status)
  const [assignedTo, setAssignedTo] = useState(lead.assignedTo ?? '')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const changed = status !== lead.status || assignedTo !== (lead.assignedTo ?? '') || note.trim() !== ''

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!changed) return setError('เลือกสถานะใหม่ ผู้ดูแล หรือเขียนบันทึกก่อนบันทึก')
    setBusy(true)
    setError(null)
    try {
      await api(`/leads/${lead.id}`, {
        method: 'PATCH',
        body: { status, assignedTo: assignedTo || null, note: note.trim() || undefined },
      })
      onSaved(`บันทึกการติดตาม ${lead.no} แล้ว`)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <fieldset className="seg">
        <legend className="seg__legend">สถานะ</legend>
        <div className="seg__options">
          {LEAD_FLOW.map((s) => (
            <label key={s} className="seg__option">
              <input type="radio" name="lead-status" value={s} checked={status === s} onChange={() => setStatus(s)} />
              <span>{LEAD_STATUS_LABEL[s]}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="ผู้ดูแล">
        {(id) => (
          <select id={id} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">ยังไม่มอบหมาย</option>
            {meta?.staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.title})
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="บันทึกการติดต่อ (ไม่บังคับ)" hint="เช่น โทรแล้ว ลูกค้าขอใบเสนอราคา 2 เครื่อง นัดคุยอีกครั้งวันศุกร์">
        {(id, d) => <textarea id={id} rows={3} value={note} aria-describedby={d} onChange={(e) => setNote(e.target.value)} />}
      </Field>
      {error && (
        <p className="form__error gap-below" role="alert">
          {error}
        </p>
      )}
      <div className="form__actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'กำลังบันทึก' : 'บันทึกการติดตาม'}
        </button>
      </div>
    </form>
  )
}

function WipeConfirm({ leadId, name, onCancel, onDone }: { leadId: string; name: string; onCancel: () => void; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const wipe = async () => {
    setBusy(true)
    setError(null)
    try {
      await api(`/leads/${leadId}/anonymise`, { body: {} })
      onDone()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }
  return (
    <div className="form">
      <p>
        <ShieldAlert size={18} aria-hidden /> ชื่อ เบอร์โทร อีเมล LINE ข้อความ และบันทึกของ <strong>{name}</strong> รวมถึงนัดหมายและใบเสนอราคาที่ผูกกับรายนี้
        จะถูกแทนด้วยข้อความว่าลบตามคำขอ ย้อนกลับไม่ได้
      </p>
      {error && (
        <p className="form__error gap-below" role="alert">
          {error}
        </p>
      )}
      <div className="form__actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          ยกเลิก
        </button>
        <button type="button" className="btn btn-primary" onClick={wipe} disabled={busy}>
          {busy ? 'กำลังลบข้อมูล' : 'ลบข้อมูลถาวร'}
        </button>
      </div>
    </div>
  )
}
