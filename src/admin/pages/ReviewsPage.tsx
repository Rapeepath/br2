import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Check, ExternalLink, Star, X } from 'lucide-react'
import { api, errorMessage } from '../api'
import { LANG_LABEL, refName, REVIEW_STATUS_LABEL, REVIEW_STATUS_TONE } from '../crm'
import { dateTime } from '../format'
import { useLoad } from '../hooks'
import { useSession, useToast } from '../session'
import type { Review, ReviewStatus } from '../types'
import { Card, Empty, ErrorNote, Loading, PageHead } from '../ui'
import './crm.css'

const TABS: { value: ReviewStatus | ''; label: string }[] = [
  { value: 'pending', label: 'รอตรวจ' },
  { value: 'approved', label: 'แสดงบนเว็บไซต์' },
  { value: 'rejected', label: 'ไม่อนุมัติ' },
  { value: '', label: 'ทั้งหมด' },
]

function Stars({ rating }: { rating: number }) {
  return (
    <span className="review__stars" role="img" aria-label={`${rating} จาก 5 ดาว`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={16} aria-hidden className={i <= rating ? undefined : 'is-off'} fill={i <= rating ? 'currentColor' : 'none'} />
      ))}
    </span>
  )
}

export function ReviewsPage() {
  const { isManager } = useSession()
  const notify = useToast()
  const [sp] = useSearchParams()
  const status = (sp.has('status') ? sp.get('status') : 'pending') as ReviewStatus | ''
  const list = useLoad((signal) => api<{ rows: Review[] }>(`/reviews${status ? `?status=${status}` : ''}`, { signal }), [status])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const moderate = async (r: Review, to: ReviewStatus) => {
    setBusyId(r.id)
    setError(null)
    try {
      await api(`/reviews/${r.id}`, { method: 'PATCH', body: { status: to } })
      notify(to === 'approved' ? `อนุมัติรีวิวของ ${r.name} แล้ว แสดงบนหน้า ${refName(r.refId)}` : to === 'rejected' ? `ไม่อนุมัติรีวิวของ ${r.name}` : `ย้ายรีวิวของ ${r.name} กลับไปรอตรวจ`)
      list.reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const rows = list.data?.rows ?? []

  return (
    <>
      <PageHead title="รีวิว" lead="รีวิวที่ผู้เยี่ยมชมเขียนบนหน้ารุ่นของเว็บไซต์ จะแสดงต่อสาธารณะหลังผู้จัดการอนุมัติเท่านั้น" />

      <nav aria-label="กรองตามสถานะรีวิว">
        <ul className="status-tabs">
          {TABS.map((t) => (
            <li key={t.label}>
              <Link to={t.value === 'pending' ? '/reviews' : `/reviews?status=${t.value}`} aria-current={status === t.value ? 'page' : undefined}>
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {!isManager && <p className="muted gap-below">เฉพาะผู้จัดการอนุมัติหรือไม่อนุมัติรีวิวได้ พนักงานดูได้อย่างเดียว</p>}
      {error && (
        <p className="form__error gap-below" role="alert">
          {error}
        </p>
      )}

      <Card className={list.loading ? 'is-refreshing' : ''}>
        {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
        {!list.data && !list.error && <Loading />}
        {list.data && rows.length === 0 && (
          <Empty>
            {status === 'pending'
              ? 'ไม่มีรีวิวรอตรวจ รีวิวมาจากฟอร์มบนหน้ารุ่นของเว็บไซต์ เมื่อมีคนส่งเข้ามาจะขึ้นที่นี่ให้ผู้จัดการอนุมัติ'
              : 'ยังไม่มีรีวิวในสถานะนี้'}
          </Empty>
        )}
        {rows.length > 0 && (
          <ul className="reviews" aria-live="polite">
            {rows.map((r) => (
              <li key={r.id} className="review" data-review={r.name}>
                <div className="review__head">
                  <span className="badge-row">
                    <Stars rating={r.rating} />
                    <span className={`badge ${REVIEW_STATUS_TONE[r.status]}`}>{REVIEW_STATUS_LABEL[r.status]}</span>
                  </span>
                  <a className="text-link" href={`/models/${r.refId}`} target="_blank" rel="noreferrer">
                    {refName(r.refId)}
                    <ExternalLink size={14} aria-hidden />
                  </a>
                </div>
                {r.title && <p className="review__title">{r.title}</p>}
                <p className="review__body" lang={r.lang}>
                  {r.body}
                </p>
                <p className="review__meta">
                  โดย {r.name} ส่งเมื่อ {dateTime(r.createdAt)} ({LANG_LABEL[r.lang]})
                  {r.moderatedBy && r.moderatedAt && ` ตรวจโดย ${r.moderatedBy} ${dateTime(r.moderatedAt)}`}
                </p>
                {isManager && (
                  <div className="review__actions">
                    {r.status !== 'approved' && (
                      <button type="button" className="btn btn-primary btn-sm" disabled={busyId === r.id} onClick={() => moderate(r, 'approved')}>
                        <Check size={16} aria-hidden />
                        อนุมัติ<span className="visually-hidden"> รีวิวของ {r.name}</span>
                      </button>
                    )}
                    {r.status !== 'rejected' && (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === r.id} onClick={() => moderate(r, 'rejected')}>
                        <X size={16} aria-hidden />
                        ไม่อนุมัติ<span className="visually-hidden"> รีวิวของ {r.name}</span>
                      </button>
                    )}
                    {r.status !== 'pending' && (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === r.id} onClick={() => moderate(r, 'pending')}>
                        กลับไปรอตรวจ<span className="visually-hidden"> รีวิวของ {r.name}</span>
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
