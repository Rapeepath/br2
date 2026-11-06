import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CalendarPlus, Loader2, MapPin } from 'lucide-react'
import { Consent, Field, FormAlert, Honeypot, PersonFields, SelectField, SubmitButton, emptyPerson, formCopy, useSubmit, validatePerson } from '../../components/form/FormKit'
import { models } from '../../data'
import { useLang } from '../../i18n'
import { bookingCalendar, bookingIcs, defaultWindow, endTime } from '../../lib/booking'
import { useStoreInfo } from '../../lib/live'
import { dayLabel, telHref } from '../../lib/localeFormat'
import { ApiError, apiGet, apiPost } from '../../lib/publicApi'
import { HoursTable, StoreDetails } from './ContactPage'
import { PageStage, SimNote } from './PageStage'
import './booking.css'

const COPY = {
  th: {
    title: 'นัดชมการสาธิต',
    sub: 'ดูหุ่นยนต์ตัวจริงที่โชว์รูม',
    lede: 'ครั้งละ {min} นาที วิศวกรสาธิตการเดิน การสั่งงาน และตอบคำถามเรื่องการใช้งานจริง จองล่วงหน้าได้ {days} วัน ไม่มีค่าใช้จ่าย',
    step1: 'เลือกวัน',
    step2: 'เลือกเวลา',
    step3: 'ข้อมูลผู้นัด',
    week: ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'],
    weekFull: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'],
    closedDay: 'ปิด',
    pickDay: 'เลือกวันจากปฏิทินก่อน',
    loading: 'กำลังดูเวลาว่าง…',
    noSlots: 'วันนี้เต็มแล้ว ลองเลือกวันอื่น',
    full: 'ไม่ว่าง',
    slotsOffline: 'ตอนนี้ดูเวลาว่างไม่ได้ โทร {phone} เพื่อนัดได้เลย',
    model: 'รุ่นที่อยากดู',
    anyModel: 'ยังไม่แน่ใจ ให้ทีมงานแนะนำ',
    note: 'สิ่งที่อยากให้สาธิต',
    noteHint: 'เช่น เดินบนพื้นต่างระดับ สั่งงานด้วยเสียง หรือการเขียนโปรแกรม',
    errDay: 'เลือกวัน',
    errTime: 'เลือกเวลา',
    send: 'ยืนยันการนัด',
    doneTitle: 'นัดหมายเรียบร้อย',
    doneBody: 'ทีมงานจะโทรยืนยันอีกครั้งก่อนวันนัด หากต้องการเลื่อนหรือยกเลิก โทรหรือทัก LINE พร้อมเลขนัดหมาย',
    doneRef: 'เลขนัดหมาย',
    when: 'วันเวลา',
    where: 'สถานที่',
    ics: 'เพิ่มลงปฏิทิน (.ics)',
    map: 'ดูแผนที่',
    another: 'นัดอีกครั้ง',
    visitTitle: 'ในการสาธิต',
    visit: [
      ['ระยะเวลา', '{min} นาที ต่อการนัดหนึ่งครั้ง'],
      ['สิ่งที่ได้ดู', 'การเดินและการทรงตัว การสั่งงานผ่านรีโมตและแอป และการเขียนโปรแกรมเบื้องต้นตามรุ่น'],
      ['ผู้เข้าชม', 'มาได้ไม่เกิน 6 คนต่อการนัด เหมาะกับทีมที่ต้องตัดสินใจร่วมกัน'],
      ['ค่าใช้จ่าย', 'ไม่มีค่าใช้จ่าย'],
    ],
    storeTitle: 'โชว์รูม',
    hoursTitle: 'เวลาทำการ',
    sim: 'การนัดหมายนี้เป็นระบบจำลอง ไม่มีการนัดจริง',
    dayOf: '{day} ({state})',
    available: 'เปิดให้นัด',
    unavailable: 'ไม่เปิดให้นัด',
    calendar: 'ปฏิทินวันนัด',
    bookingTitle: 'นัดชมการสาธิตหุ่นยนต์',
    contactInstead: 'หรือติดต่อทีมขาย',
  },
  en: {
    title: 'Book a demonstration',
    sub: 'See the robots for real at the showroom',
    lede: '{min} minutes each. An engineer shows walking, control and programming and answers questions about real use. Book up to {days} days ahead, free of charge.',
    step1: 'Pick a day',
    step2: 'Pick a time',
    step3: 'Your details',
    week: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    weekFull: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    closedDay: 'Closed',
    pickDay: 'Pick a day on the calendar first',
    loading: 'Checking free times…',
    noSlots: 'That day is fully booked. Try another day.',
    full: 'Taken',
    slotsOffline: 'Free times can’t be checked right now. Call {phone} to book.',
    model: 'Model you’d like to see',
    anyModel: 'Not sure yet, please advise',
    note: 'What you’d like shown',
    noteHint: 'For example walking on uneven floors, voice commands or programming',
    errDay: 'Pick a day',
    errTime: 'Pick a time',
    send: 'Confirm booking',
    doneTitle: 'You’re booked',
    doneBody: 'We will call to confirm before the day. To move or cancel, call or LINE us with your booking number.',
    doneRef: 'Booking number',
    when: 'When',
    where: 'Where',
    ics: 'Add to calendar (.ics)',
    map: 'Open the map',
    another: 'Book another time',
    visitTitle: 'At the demonstration',
    visit: [
      ['Length', '{min} minutes per booking'],
      ['What you see', 'Walking and balance, control by remote and app, and basic programming depending on the model'],
      ['Visitors', 'Up to 6 people per booking, so a team can decide together'],
      ['Cost', 'Free'],
    ],
    storeTitle: 'Showroom',
    hoursTitle: 'Opening hours',
    sim: 'This booking is part of a demonstration system; no real appointment is made.',
    dayOf: '{day} ({state})',
    available: 'open for booking',
    unavailable: 'not bookable',
    calendar: 'Booking calendar',
    bookingTitle: 'Humanoid robot demonstration',
    contactInstead: 'or contact the sales team',
  },
}

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''))

interface SlotDay {
  date: string
  open: boolean
  durationMin: number
  slots: { time: string; available: boolean }[]
}

interface BookingWindow {
  from: string
  to: string
  durationMin?: number
  windowDays?: number
}

type Result = { no: string; date: string; time: string; durationMin: number }

export function BookingPage() {
  const lang = useLang()
  const c = COPY[lang]
  const k = formCopy(lang)
  const store = useStoreInfo()
  const [params] = useSearchParams()
  const pre = params.get('model') ?? ''
  const win = (store as unknown as { booking?: BookingWindow }).booking
  const { from, to } = win?.from && win.to ? win : defaultWindow()
  const durationMin = win?.durationMin ?? 90
  const weeks = useMemo(() => bookingCalendar(from, to, store.hours), [from, to, store.hours])

  const [date, setDate] = useState<string | null>(null)
  const [day, setDay] = useState<SlotDay | null>(null)
  const [slotState, setSlotState] = useState<'idle' | 'loading' | 'ready' | 'offline'>('idle')
  const [time, setTime] = useState<string | null>(null)
  const [refId, setRefId] = useState(models.some((m) => m.id === pre) ? pre : '')
  const [person, setPerson] = useState(emptyPerson)
  const [note, setNote] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [done, setDone] = useState<Result | null>(null)
  const doneRef = useRef<HTMLDivElement>(null)
  const { busy, errors, setErrors, alert, formRef, run } = useSubmit<Result>(lang)

  const loadSlots = (d: string) => {
    setSlotState('loading')
    apiGet<SlotDay>(`/api/public/slots?date=${d}`).then(
      (r) => {
        setDay(r)
        setSlotState('ready')
      },
      () => setSlotState('offline'),
    )
  }

  useEffect(() => {
    if (!date) return
    setTime(null)
    loadSlots(date)
  }, [date])

  const submit = (e: FormEvent) =>
    run(
      e,
      () => ({
        date: date ? undefined : c.errDay,
        time: time ? undefined : c.errTime,
        ...validatePerson(person, lang),
        consent: consent ? undefined : k.errConsent,
      }),
      () =>
        apiPost<Result>('/api/public/bookings', {
          date,
          time,
          refId: refId || undefined,
          ...person,
          note: note.trim() || undefined,
          lang,
          page: '/booking',
          consent,
          website,
        }).catch((err) => {
          // Someone took the slot meanwhile: show the day again with fresh times
          if (err instanceof ApiError && (err.code === 'SLOT_TAKEN' || err.code === 'SLOT_INVALID') && date) {
            loadSlots(date)
            setTime(null)
            throw new ApiError(err.status, err.message, err.code, err.en, 'time')
          }
          throw err
        }),
      (r) => {
        setDone(r)
        requestAnimationFrame(() => doneRef.current?.focus())
      },
    )

  const icsHref = useMemo(() => {
    if (!done || typeof URL === 'undefined' || typeof Blob === 'undefined') return null
    const model = models.find((m) => m.id === refId)
    const body = bookingIcs({
      no: done.no,
      date: done.date,
      time: done.time,
      durationMin: done.durationMin,
      title: `${c.bookingTitle}${model ? ` ${model.nameEn}` : ''} (${store.storeName})`,
      location: `${store.storeName} ${store.address}`,
      description: `${c.doneRef} ${done.no} | ${store.phone}`,
    })
    return URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }))
  }, [done, refId, store, c])

  useEffect(() => () => {
    if (icsHref) URL.revokeObjectURL(icsHref)
  }, [icsHref])

  return (
    <>
      <PageStage title={c.title} sub={c.sub} lede={fill(c.lede, { min: durationMin, days: win?.windowDays ?? 21 })} />

      <div className="container c-page">
        <div className="c-split">
          <section className="c-sheet" aria-label={c.title}>
            {done ? (
              <div className="c-done" ref={doneRef} tabIndex={-1} role="status">
                <h2>{c.doneTitle}</h2>
                <p>
                  {c.doneRef} <span className="c-done__ref">{done.no}</span>
                </p>
                <dl className="c-dl">
                  <div>
                    <dt>{c.when}</dt>
                    <dd>
                      {dayLabel(done.date, lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{' '}
                      <span className="nowrap">
                        {done.time}–{endTime(done.time, done.durationMin)}
                        {lang === 'th' ? ' น.' : ''}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>{c.where}</dt>
                    <dd>
                      {store.storeName} {store.branch}
                      <br />
                      {store.address}
                    </dd>
                  </div>
                </dl>
                <p className="c-muted">{c.doneBody}</p>
                <div className="c-actions">
                  {icsHref && (
                    <a className="btn btn-primary" href={icsHref} download={`${done.no}.ics`}>
                      <CalendarPlus size={18} aria-hidden />
                      {c.ics}
                    </a>
                  )}
                  <a className="btn btn-ghost" href={store.mapUrl} target="_blank" rel="noopener">
                    <MapPin size={18} aria-hidden />
                    {c.map}
                  </a>
                </div>
              </div>
            ) : (
              <form ref={formRef} className="booking-form" noValidate onSubmit={submit}>
                <FormAlert message={alert} />
                <fieldset className="booking-step">
                  <legend>
                    <span className="booking-step__no" aria-hidden="true">
                      1
                    </span>
                    {c.step1}
                  </legend>
                  <div className="cal" role="radiogroup" aria-label={c.calendar} aria-invalid={errors.date ? true : undefined}>
                    <div className="cal__head" aria-hidden="true">
                      {c.week.map((w) => (
                        <span key={w}>{w}</span>
                      ))}
                    </div>
                    {weeks.map((week) => (
                      <div className="cal__week" key={week[0].date}>
                        {week.map((d) => {
                          const n = Number(d.date.slice(8))
                          const label = fill(c.dayOf, {
                            day: dayLabel(d.date, lang, { weekday: 'long', day: 'numeric', month: 'long' }),
                            state: d.bookable ? c.available : c.unavailable,
                          })
                          if (d.reason === 'past' || d.reason === 'beyond') {
                            return <span key={d.date} className="cal__day cal__day--out" aria-hidden="true" />
                          }
                          return (
                            <label key={d.date} className="cal__day" data-closed={d.reason === 'closed' ? '' : undefined}>
                              <input
                                type="radio"
                                name="date"
                                value={d.date}
                                checked={date === d.date}
                                disabled={!d.bookable}
                                onChange={() => {
                                  setDate(d.date)
                                  setErrors((x) => ({ ...x, date: undefined }))
                                }}
                                aria-label={label}
                              />
                              <span className="cal__num" aria-hidden="true">
                                {n}
                              </span>
                              <span className="cal__month" aria-hidden="true">
                                {n === 1 || d.date === from ? dayLabel(d.date, lang, { month: 'short' }) : ''}
                              </span>
                              {d.reason === 'closed' && (
                                <span className="cal__closed" aria-hidden="true">
                                  {c.closedDay}
                                </span>
                              )}
                            </label>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                  {errors.date && <p className="field__error">{errors.date}</p>}
                </fieldset>

                <fieldset className="booking-step">
                  <legend>
                    <span className="booking-step__no" aria-hidden="true">
                      2
                    </span>
                    {c.step2}
                    {date && <span className="booking-step__picked">{dayLabel(date, lang)}</span>}
                  </legend>
                  <div aria-live="polite">
                    {!date && <p className="c-muted">{c.pickDay}</p>}
                    {date && slotState === 'loading' && (
                      <p className="c-muted booking-loading">
                        <Loader2 size={16} aria-hidden className="form-submit__spin" />
                        {c.loading}
                      </p>
                    )}
                    {date && slotState === 'offline' && <p className="c-muted">{fill(c.slotsOffline, { phone: store.phone })}</p>}
                    {date && slotState === 'ready' && day && !day.slots.some((s) => s.available) && <p className="c-muted">{c.noSlots}</p>}
                  </div>
                  {date && slotState === 'ready' && day && day.slots.length > 0 && (
                    <div className="slots" role="radiogroup" aria-label={c.step2} aria-invalid={errors.time ? true : undefined}>
                      {day.slots.map((s) => (
                        <label key={s.time} className="choice slot">
                          <input
                            type="radio"
                            name="time"
                            value={s.time}
                            checked={time === s.time}
                            disabled={!s.available}
                            onChange={() => {
                              setTime(s.time)
                              setErrors((x) => ({ ...x, time: undefined }))
                            }}
                          />
                          <span className="slot__time">
                            {s.time}–{endTime(s.time, day.durationMin)}
                          </span>
                          {!s.available && <span className="slot__full">{c.full}</span>}
                        </label>
                      ))}
                    </div>
                  )}
                  {errors.time && <p className="field__error">{errors.time}</p>}
                </fieldset>

                <fieldset className="booking-step">
                  <legend>
                    <span className="booking-step__no" aria-hidden="true">
                      3
                    </span>
                    {c.step3}
                  </legend>
                  <div className="booking-step__fields">
                    <SelectField
                      label={c.model}
                      name="refId"
                      value={refId}
                      onChange={setRefId}
                      options={[{ value: '', label: c.anyModel }, ...models.map((m) => ({ value: m.id, label: m.nameEn }))]}
                    />
                    <PersonFields value={person} onChange={setPerson} errors={errors} />
                    <Field label={c.note} name="note" multiline rows={3} value={note} onChange={setNote} hint={c.noteHint} maxLength={500} />
                    <Consent checked={consent} onChange={setConsent} error={errors.consent} />
                    <Honeypot value={website} onChange={setWebsite} />
                  </div>
                </fieldset>

                <div className="booking-submit">
                  <SubmitButton busy={busy} disabled={slotState === 'offline'}>
                    {c.send}
                  </SubmitButton>
                  <Link to="/contact" className="link-arrow">
                    {c.contactInstead}
                  </Link>
                </div>
              </form>
            )}
            <SimNote>{c.sim}</SimNote>
          </section>

          <aside className="contact-aside">
            <section className="c-sheet c-sheet--dark" aria-labelledby="visit-title">
              <h2 id="visit-title">{c.visitTitle}</h2>
              <dl className="c-dl">
                {c.visit.map(([dt, dd]) => (
                  <div key={dt}>
                    <dt>{dt}</dt>
                    <dd>{fill(dd, { min: durationMin })}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="c-sheet" aria-labelledby="bstore-title">
              <h2 id="bstore-title">{c.storeTitle}</h2>
              <StoreDetails lang={lang} />
            </section>
            <section className="c-sheet" aria-labelledby="bhours-title">
              <h2 id="bhours-title">{c.hoursTitle}</h2>
              <HoursTable hours={store.hours} lang={lang} />
              <p className="c-muted booking-call">
                <a href={telHref(store.phone)}>{store.phone}</a>
              </p>
            </section>
          </aside>
        </div>
      </div>
    </>
  )
}
