import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api, errorMessage } from '../api'
import { BOOKING_ACTIONS, BOOKING_STATUS_LABEL, BOOKING_STATUS_TONE, endTime, refName, weekDays, weekStart } from '../crm'
import { addDays, dateTime, dayLong, todayKey } from '../format'
import { useLoad } from '../hooks'
import { useSession, useToast } from '../session'
import type { Booking, BookingStatus } from '../types'
import { Card, Empty, ErrorNote, Field, Loading, PageHead, Segmented, TableWrap, Words } from '../ui'
import './crm.css'

type View = 'week' | 'list'

const noonOf = (day: string) => new Date(`${day}T12:00:00+07:00`)
const weekdayShort = (day: string) => noonOf(day).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'long' })
const dayMonth = (day: string) => noonOf(day).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })

export function BookingsPage() {
  const { meta } = useSession()
  const notify = useToast()
  const [sp, setSp] = useSearchParams()
  const today = todayKey()
  const view = (sp.get('view') as View | null) ?? 'week'
  const monday = weekStart(sp.get('date') ?? today)
  const status = (sp.get('status') ?? '') as BookingStatus | ''
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setSp(next, { replace: true })
  }

  // The week view shows one Monday–Sunday; the list runs from a month back to six weeks ahead
  const from = view === 'week' ? monday : addDays(today, -30)
  const to = view === 'week' ? addDays(monday, 6) : addDays(today, 42)
  const params = new URLSearchParams({ from, to })
  if (status) params.set('status', status)
  const list = useLoad((signal) => api<{ rows: Booking[] }>(`/bookings?${params}`, { signal }), [params.toString()])

  const act = async (b: Booking, to: BookingStatus) => {
    setBusyId(b.id)
    setError(null)
    try {
      await api(`/bookings/${b.id}`, { method: 'PATCH', body: { status: to } })
      notify(`นัด ${b.no} (${b.name}): ${BOOKING_STATUS_LABEL[to]}`)
      list.reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const openDays = new Set((meta?.settings.hours ?? []).map((h) => h.day))
  const rows = list.data?.rows ?? []
  const actions = (b: Booking) =>
    BOOKING_ACTIONS[b.status].length > 0 && (
      <span className="appt__actions">
        {BOOKING_ACTIONS[b.status].map((a) => (
          <button key={a.to} type="button" className="btn btn-ghost btn-sm" disabled={busyId === b.id} onClick={() => act(b, a.to)}>
            {a.label}
            <span className="visually-hidden">
              {' '}
              {b.no} {b.name}
            </span>
          </button>
        ))}
      </span>
    )

  return (
    <>
      <PageHead title="นัดหมาย" lead="นัดชมการสาธิตที่ลูกค้าจองจากเว็บไซต์ ยืนยันนัดก่อนวันนัดอย่างน้อย 1 วัน แล้วบันทึกผลเมื่อถึงเวลา" />

      <div className="filters">
        <div className="agenda-bar">
          <Segmented<View>
            legend="มุมมอง"
            value={view}
            onChange={(v) => set({ view: v === 'week' ? null : v })}
            options={[
              { value: 'week', label: 'รายสัปดาห์' },
              { value: 'list', label: 'รายการ' },
            ]}
          />
          {view === 'week' && (
            <div className="agenda-bar__nav">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ date: addDays(monday, -7) })}>
                <ChevronLeft size={16} aria-hidden />
                สัปดาห์ก่อน
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ date: null })} disabled={monday === weekStart(today)}>
                สัปดาห์นี้
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ date: addDays(monday, 7) })}>
                สัปดาห์หน้า
                <ChevronRight size={16} aria-hidden />
              </button>
            </div>
          )}
          <Field label="สถานะ">
            {(id) => (
              <select id={id} value={status} onChange={(e) => set({ status: e.target.value })}>
                <option value="">ทุกสถานะ</option>
                {(Object.keys(BOOKING_STATUS_LABEL) as BookingStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {BOOKING_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </div>

      {error && (
        <p className="form__error section-gap" role="alert">
          {error}
        </p>
      )}
      {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
      {!list.data && !list.error && <Loading />}

      {list.data && view === 'week' && (
        <section aria-labelledby="week-title" className={list.loading ? 'is-refreshing' : ''}>
          <h2 id="week-title" className="agenda-bar__range section-title" aria-live="polite">
            {dayLong(monday)} ถึง {dayLong(addDays(monday, 6))}
          </h2>
          <ol className="agenda">
            {weekDays(monday).map((day) => {
              const wd = new Date(`${day}T00:00:00Z`).getUTCDay()
              const closed = !openDays.has(wd)
              const mine = rows.filter((b) => b.date === day)
              return (
                <li key={day} className={`agenda__day ${day === today ? 'is-today' : ''} ${closed ? 'is-closed' : ''}`}>
                  <span className="agenda__date">
                    <span className="agenda__wd">{weekdayShort(day)}</span>
                    <span className="agenda__dm">{dayMonth(day)}</span>
                    {day === today && <span className="visually-hidden">(วันนี้)</span>}
                  </span>
                  {mine.length > 0 ? (
                    <ul className="agenda__list">
                      {mine.map((b) => (
                        <li key={b.id} className={`appt is-${b.status}`} data-booking={b.no}>
                          <span className="appt__time nowrap">
                            {b.time}–{endTime(b.time, b.durationMin)} น.
                          </span>
                          <span className="appt__name">
                            <Words text={b.name} />
                          </span>
                          <span>{b.refId ? refName(b.refId) : 'ยังไม่ระบุรุ่น'}</span>
                          <span className="badge-row">
                            <span className={`badge ${BOOKING_STATUS_TONE[b.status]}`}>{BOOKING_STATUS_LABEL[b.status]}</span>
                            {b.leadId && (
                              <Link to={`/leads/${b.leadId}`} className="mono-link">
                                {b.no}
                              </Link>
                            )}
                          </span>
                          {actions(b)}
                        </li>
                      ))}
                    </ul>
                  ) : closed ? (
                    <span className="agenda__closed">ร้านปิด</span>
                  ) : (
                    <span className="agenda__none">ไม่มีนัด</span>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      )}

      {list.data && view === 'list' && (
        <Card className={list.loading ? 'is-refreshing' : ''}>
          <p className="list-summary" aria-live="polite">
            {rows.length.toLocaleString('th-TH')} นัด ระหว่าง {dayLong(from)} ถึง {dayLong(to)}
          </p>
          {rows.length === 0 ? (
            <Empty>ยังไม่มีนัดในช่วงนี้ ลูกค้านัดได้จากหน้า "นัดชมการสาธิต" บนเว็บไซต์</Empty>
          ) : (
            <TableWrap label="ตารางนัดหมาย">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">เลขที่</th>
                    <th scope="col">วันและเวลา</th>
                    <th scope="col">ลูกค้า</th>
                    <th scope="col">รุ่นที่สนใจ</th>
                    <th scope="col">สถานะ</th>
                    <th scope="col">จองเมื่อ</th>
                    <th scope="col">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={b.id} data-booking={b.no}>
                      <td>{b.leadId ? <Link to={`/leads/${b.leadId}`} className="mono-link">{b.no}</Link> : <span className="mono">{b.no}</span>}</td>
                      <td>
                        <span className="nowrap">{dayLong(b.date)}</span>
                        <span className="cell-sub">
                          {b.time}–{endTime(b.time, b.durationMin)} น.
                        </span>
                      </td>
                      <td className="cell-name">
                        <Words text={b.name} />
                        <span className="cell-sub">{b.phone || '–'}</span>
                      </td>
                      <td>{b.refId ? refName(b.refId) : '–'}</td>
                      <td>
                        <span className={`badge ${BOOKING_STATUS_TONE[b.status]}`}>{BOOKING_STATUS_LABEL[b.status]}</span>
                      </td>
                      <td className="nowrap">{dateTime(b.createdAt)}</td>
                      <td>{actions(b) || <span className="muted">–</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      )}
    </>
  )
}
