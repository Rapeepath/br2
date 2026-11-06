import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Star } from 'lucide-react'
import { useLang } from '../i18n'
import { pick } from '../lib/bilingual'
import './Reviews.css'

interface ReviewRow {
  id: string
  name: string
  rating: number
  title: string | null
  body: string
  lang: 'th' | 'en'
  createdAt: string
}

interface Summary {
  average: number | null
  count: number
  rows: ReviewRow[]
}

type Load = { status: 'loading' } | { status: 'ready'; data: Summary } | { status: 'offline' }

/** Five stars, filled to the rating; decoration beside a figure that says the same in words. */
function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="rv-stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= Math.round(value) ? 'is-on' : undefined} fill={i <= Math.round(value) ? 'currentColor' : 'none'} />
      ))}
    </span>
  )
}

const dateOf = (iso: string, lang: 'th' | 'en') =>
  new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

/**
 * Visitors' reviews of one model, from the showroom's POS (`/api/public/reviews`). Only reviews a manager
 * has approved are shown; a new one waits for that check. Nothing is made up: with none yet, the section
 * says so and invites the first. The rating's structured data is added in the browser only, once real
 * reviews exist (the prerendered page never claims a rating).
 */
export function Reviews({ refId, name }: { refId: string; name: string }) {
  const lang = useLang()
  const tx = <T,>(th: T, en: T) => pick(lang, th, en)
  const id = useId()
  const [load, setLoad] = useState<Load>({ status: 'loading' })

  useEffect(() => {
    let alive = true
    if (typeof fetch === 'undefined') {
      setLoad({ status: 'offline' })
      return
    }
    fetch(`/api/public/reviews?refId=${encodeURIComponent(refId)}`, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? (r.json() as Promise<Summary>) : Promise.reject(new Error(String(r.status)))))
      .then((data) => alive && setLoad({ status: 'ready', data }))
      .catch(() => alive && setLoad({ status: 'offline' }))
    return () => {
      alive = false
    }
  }, [refId])

  const data = load.status === 'ready' ? load.data : null

  return (
    <section className="rv" aria-labelledby={`${id}-title`}>
      <div className="rv__head">
        <h2 id={`${id}-title`} className="rv__title">
          {tx('รีวิวจากผู้ใช้', 'Reviews')}
        </h2>
        {data && data.count > 0 && data.average != null && (
          <p className="rv__score">
            <Stars value={data.average} size={18} />
            <span className="rv__avg figure-display">{data.average.toLocaleString(lang === 'en' ? 'en-GB' : 'th-TH')}</span>
            <span className="rv__of">
              {tx(`จาก 5 (${data.count} รีวิว)`, `out of 5 (${data.count} ${data.count === 1 ? 'review' : 'reviews'})`)}
            </span>
          </p>
        )}
      </div>

      <div className="rv__grid">
        <div className="rv__list" aria-live="polite" aria-busy={load.status === 'loading'}>
          {load.status === 'loading' && <p className="rv__note">{tx('กำลังโหลดรีวิว', 'Loading reviews')}</p>}
          {load.status === 'offline' && (
            <p className="rv__note">
              {tx(
                'โหลดรีวิวไม่ได้ในขณะนี้ ลองเปิดหน้านี้ใหม่อีกครั้งภายหลัง',
                'Reviews can’t be loaded right now. Try opening this page again later.',
              )}
            </p>
          )}
          {data && data.count === 0 && (
            <div className="rv__empty">
              <p className="rv__empty-title">{tx(`ยังไม่มีรีวิวของ ${name}`, `No reviews of the ${name} yet`)}</p>
              <p>
                {tx(
                  'ถ้าคุณเคยใช้หรือชมการสาธิตรุ่นนี้ เล่าประสบการณ์ให้ผู้ซื้อคนต่อไปได้',
                  'If you have used this model or seen it demonstrated, tell the next buyer about it.',
                )}
              </p>
            </div>
          )}
          {data && data.count > 0 && (
            <ul className="rv__rows">
              {data.rows.map((r) => (
                <li key={r.id} className="rv__row" lang={r.lang === lang ? undefined : r.lang}>
                  <p className="rv__row-head">
                    <Stars value={r.rating} />
                    <span className="visually-hidden">{tx(`${r.rating} จาก 5 ดาว`, `${r.rating} out of 5 stars`)}</span>
                    {r.title && <strong className="rv__row-title">{r.title}</strong>}
                  </p>
                  <p className="rv__body">{r.body}</p>
                  <p className="rv__by">
                    {r.name}, {dateOf(r.createdAt, lang)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {data && data.count > 0 && data.average != null && (
            <script
              type="application/ld+json"
              // A real, approved count only: structured data must describe what the page shows
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  '@context': 'https://schema.org',
                  '@type': 'Product',
                  name,
                  aggregateRating: { '@type': 'AggregateRating', ratingValue: data.average, reviewCount: data.count, bestRating: 5, worstRating: 1 },
                }),
              }}
            />
          )}
        </div>

        <WriteReview refId={refId} name={name} />
      </div>
    </section>
  )
}

/** The form stays folded behind one button, so the section reads as reviews first, a form only on request. */
function WriteReview({ refId, name }: { refId: string; name: string }) {
  const lang = useLang()
  const tx = <T,>(th: T, en: T) => pick(lang, th, en)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    // Opening hands focus to the first field, so keyboard and screen reader users land in the form
    if (open) document.querySelector<HTMLInputElement>('.rv-form input:not([type=hidden])')?.focus()
  }, [open])
  if (open) return <ReviewForm refId={refId} name={name} />
  return (
    <div className="rv-write">
      <button type="button" className="btn btn-ghost" aria-expanded="false" onClick={() => setOpen(true)}>
        {tx('เขียนรีวิว', 'Write a review')}
      </button>
      <p className="rv-write__hint">{tx('รีวิวจะแสดงหลังผู้จัดการตรวจสอบ', 'Reviews appear after a manager has checked them.')}</p>
    </div>
  )
}

interface ApiError {
  error?: string
  errorEn?: string
  code?: string
  field?: string
}

function ReviewForm({ refId, name }: { refId: string; name: string }) {
  const lang = useLang()
  const tx = <T,>(th: T, en: T) => pick(lang, th, en)
  const id = useId()
  const [form, setForm] = useState({ name: '', rating: 0, title: '', body: '', consent: false, website: '' })
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<{ message: string; field: string | null } | null>(null)
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))

  // Checks the server repeats; done here first so the visitor sees what to fix beside the field
  const check = (): { message: string; field: string } | null => {
    if (!form.name.trim()) return { field: 'name', message: tx('กรอกชื่อที่จะแสดงกับรีวิว', 'Enter the name to show with your review') }
    if (form.rating < 1) return { field: 'rating', message: tx('ให้คะแนน 1 ถึง 5 ดาว', 'Give a rating from 1 to 5 stars') }
    if (form.body.trim().length < 10) return { field: 'body', message: tx('เล่าประสบการณ์อย่างน้อย 10 ตัวอักษร', 'Write at least 10 characters') }
    if (!form.consent) return { field: 'consent', message: tx('ติ๊กยินยอมก่อนส่งรีวิว', 'Tick the consent box to send your review') }
    return null
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const problem = check()
    if (problem) {
      setError(problem)
      document.getElementById(`${id}-${problem.field}`)?.focus()
      return
    }
    setError(null)
    setState('sending')
    try {
      const res = await fetch('/api/public/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          refId,
          name: form.name.trim(),
          rating: form.rating,
          title: form.title.trim() || null,
          body: form.body.trim(),
          consent: form.consent,
          website: form.website,
          lang,
          page: typeof location !== 'undefined' ? location.pathname : null,
        }),
      })
      if (res.ok) {
        setState('sent')
        return
      }
      const body = (await res.json().catch(() => ({}))) as ApiError
      const message =
        (lang === 'en' ? body.errorEn : body.error) ??
        (res.status === 429
          ? tx('ส่งบ่อยเกินไป รอสักครู่แล้วลองใหม่', 'Too many tries. Wait a few minutes and try again.')
          : tx('ส่งรีวิวไม่สำเร็จ ลองอีกครั้ง', 'Your review wasn’t sent. Please try again.'))
      setError({ message, field: body.field ?? null })
      setState('idle')
    } catch {
      setError({
        message: tx(
          'ส่งรีวิวไม่สำเร็จเพราะเชื่อมต่อร้านไม่ได้ ลองอีกครั้งภายหลัง',
          'Your review couldn’t be sent because the showroom can’t be reached. Please try again later.',
        ),
        field: null,
      })
      setState('idle')
    }
  }

  if (state === 'sent') {
    return (
      <div className="rv-form rv-form--sent" role="status">
        <p className="rv-form__title">{tx('ขอบคุณสำหรับรีวิว', 'Thank you for your review')}</p>
        <p>
          {tx(
            'รีวิวจะแสดงหลังผู้จัดการตรวจสอบ ซึ่งปกติใช้เวลาไม่เกิน 2 วันทำการ',
            'It will appear once a manager has checked it, usually within two working days.',
          )}
        </p>
      </div>
    )
  }

  const err = (field: string) => (error?.field === field ? `${id}-err` : undefined)

  return (
    <form className="rv-form" onSubmit={submit} noValidate aria-labelledby={`${id}-form-title`}>
      <p id={`${id}-form-title`} className="rv-form__title">
        {tx(`เขียนรีวิว ${name}`, `Review the ${name}`)}
      </p>
      <p className="rv-form__hint">
        {tx('รีวิวจะแสดงหลังผู้จัดการตรวจสอบ', 'Reviews appear after a manager has checked them.')}
      </p>

      <div className="rv-field">
        <label htmlFor={`${id}-name`}>{tx('ชื่อที่แสดง', 'Display name')}</label>
        <input
          id={`${id}-name`}
          value={form.name}
          maxLength={60}
          autoComplete="nickname"
          aria-invalid={error?.field === 'name' || undefined}
          aria-describedby={err('name')}
          onChange={(e) => set('name', e.target.value)}
        />
      </div>

      <fieldset className="rv-rating" aria-describedby={err('rating')}>
        <legend>{tx('คะแนน', 'Rating')}</legend>
        <div className="rv-rating__stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={n <= form.rating ? 'rv-rating__star is-on' : 'rv-rating__star'}>
              <input
                type="radio"
                name={`${id}-rating`}
                id={n === 1 ? `${id}-rating` : undefined}
                value={n}
                checked={form.rating === n}
                onChange={() => set('rating', n)}
              />
              <Star size={26} aria-hidden fill={n <= form.rating ? 'currentColor' : 'none'} />
              <span className="visually-hidden">{tx(`${n} ดาว`, `${n} ${n === 1 ? 'star' : 'stars'}`)}</span>
            </label>
          ))}
          <span className="rv-rating__text" aria-hidden="true">
            {form.rating ? tx(`${form.rating} จาก 5`, `${form.rating} of 5`) : tx('ยังไม่ได้ให้คะแนน', 'Not rated yet')}
          </span>
        </div>
      </fieldset>

      <div className="rv-field">
        <label htmlFor={`${id}-title`}>
          {tx('หัวข้อ', 'Title')} <span className="rv-field__opt">{tx('(ไม่บังคับ)', '(optional)')}</span>
        </label>
        <input id={`${id}-title`} value={form.title} maxLength={120} onChange={(e) => set('title', e.target.value)} />
      </div>

      <div className="rv-field">
        <label htmlFor={`${id}-body`}>{tx('ประสบการณ์ของคุณ', 'Your experience')}</label>
        <textarea
          id={`${id}-body`}
          rows={5}
          maxLength={2000}
          value={form.body}
          aria-invalid={error?.field === 'body' || undefined}
          aria-describedby={err('body')}
          onChange={(e) => set('body', e.target.value)}
        />
      </div>

      {/* Left empty by people; bots that fill every field are turned away by the server */}
      <div className="rv-hp" aria-hidden="true">
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} />
      </div>

      <label className="rv-consent" htmlFor={`${id}-consent`}>
        <input
          id={`${id}-consent`}
          type="checkbox"
          checked={form.consent}
          aria-invalid={error?.field === 'consent' || undefined}
          aria-describedby={err('consent')}
          onChange={(e) => set('consent', e.target.checked)}
        />
        <span>
          {tx('ยินยอมให้ร้านเก็บและแสดงชื่อกับรีวิวนี้ตาม', 'I agree that the showroom may keep and publish my name and this review under its')}{' '}
          <Link to="/privacy">{tx('นโยบายความเป็นส่วนตัว', 'privacy policy')}</Link>
        </span>
      </label>

      {error && (
        <p id={`${id}-err`} className="rv-form__error" role="alert">
          {error.message}
        </p>
      )}

      <button type="submit" className="btn btn-primary" disabled={state === 'sending'}>
        {state === 'sending' ? tx('กำลังส่ง', 'Sending') : tx('ส่งรีวิว', 'Send review')}
      </button>
    </form>
  )
}
