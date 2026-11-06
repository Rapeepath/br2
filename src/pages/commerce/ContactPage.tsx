import { useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CalendarCheck, Mail, MapPin, MessageCircle, Phone, SlidersHorizontal, Wrench } from 'lucide-react'
import { Consent, Field, FormAlert, Honeypot, PersonFields, SelectField, SubmitButton, emptyPerson, formCopy, useSubmit, validatePerson } from '../../components/form/FormKit'
import { models } from '../../data'
import { useLang, type Lang } from '../../i18n'
import { useStoreInfo } from '../../lib/live'
import { bangkokWeekday, hoursSummary, telHref, weekHours, weekdayName } from '../../lib/localeFormat'
import { apiPost } from '../../lib/publicApi'
import { PageStage, SimNote } from './PageStage'
import './contact.css'

const COPY = {
  th: {
    title: 'ติดต่อโชว์รูม',
    sub: 'คุยกับทีมขายและวิศวกร',
    lede: 'ถามราคา สเปก เวลานำเข้า หรือเรื่องการติดตั้งได้ทุกช่องทาง ฝากข้อความไว้แล้วทีมงานจะติดต่อกลับ',
    call: 'โทร',
    line: 'ทัก LINE',
    map: 'ดูแผนที่',
    formTitle: 'ส่งคำถามถึงทีมขาย',
    formLede: 'บอกเราว่าสนใจรุ่นไหนและจะใช้ทำอะไร ทีมงานจะติดต่อกลับภายใน 1 วันทำการ',
    topic: 'เรื่องที่ติดต่อ',
    topics: ['สอบถามราคาและสเปก', 'ขอใบเสนอราคา', 'นัดชมการสาธิต', 'บริการหลังการขาย', 'เรื่องอื่น'],
    models: 'รุ่นที่สนใจ',
    modelsHint: 'เลือกได้หลายรุ่น หรือไม่เลือกก็ได้',
    message: 'ข้อความ',
    messageHint: 'เช่น งานที่จะใช้ จำนวนเครื่อง และช่วงเวลาที่ต้องการ',
    errMessage: 'เขียนข้อความถึงเราสั้นๆ',
    send: 'ส่งข้อความ',
    doneTitle: 'ได้รับข้อความแล้ว',
    doneBody: 'ทีมขายจะติดต่อกลับทางเบอร์ที่ให้ไว้ภายใน 1 วันทำการ เก็บเลขอ้างอิงนี้ไว้หากโทรตามเรื่อง',
    doneRef: 'เลขอ้างอิง',
    another: 'ส่งข้อความอีกครั้ง',
    storeTitle: 'โชว์รูม',
    address: 'ที่อยู่',
    phone: 'โทรศัพท์',
    email: 'อีเมล',
    lineId: 'LINE',
    hoursTitle: 'เวลาทำการ',
    today: 'วันนี้',
    closed: 'ปิด',
    nextTitle: 'ทางลัด',
    nextBook: 'นัดชมการสาธิต',
    nextBookHint: 'เลือกวันและเวลาที่สะดวก ครั้งละ 90 นาที',
    nextQuote: 'จัดสเปกและขอใบเสนอราคา',
    nextQuoteHint: 'เลือกรุ่นย่อย อุปกรณ์ และบริการ แล้วรับใบเสนอราคาทันที',
    nextService: 'บริการหลังการขาย',
    nextServiceHint: 'การรับประกัน อะไหล่ และแผนบำรุงรักษา',
    sim: 'โชว์รูมนี้เป็นระบบจำลองเพื่อการสาธิต ข้อมูลที่ส่งจะไปอยู่ในหลังร้านของระบบจำลองเท่านั้น',
    minutes: 'น.',
  },
  en: {
    title: 'Contact the showroom',
    sub: 'Talk to our sales team and engineers',
    lede: 'Ask about prices, specs, import lead times or installation through any channel. Leave a message and we will get back to you.',
    call: 'Call',
    line: 'LINE us',
    map: 'Open the map',
    formTitle: 'Send the sales team a question',
    formLede: 'Tell us which model interests you and what it is for. We reply within one working day.',
    topic: 'What is it about?',
    topics: ['Prices and specs', 'A quotation', 'A demonstration', 'After-sales service', 'Something else'],
    models: 'Models you’re interested in',
    modelsHint: 'Pick any number, or none',
    message: 'Message',
    messageHint: 'For example the job, how many robots and when you need them',
    errMessage: 'Write us a short message',
    send: 'Send message',
    doneTitle: 'Message received',
    doneBody: 'The sales team will call the number you gave within one working day. Keep this reference if you follow up.',
    doneRef: 'Reference',
    another: 'Send another message',
    storeTitle: 'Showroom',
    address: 'Address',
    phone: 'Phone',
    email: 'Email',
    lineId: 'LINE',
    hoursTitle: 'Opening hours',
    today: 'Today',
    closed: 'Closed',
    nextTitle: 'Shortcuts',
    nextBook: 'Book a demonstration',
    nextBookHint: 'Pick a day and time, 90 minutes each',
    nextQuote: 'Configure and get a quote',
    nextQuoteHint: 'Choose a trim, accessories and services, get a quotation at once',
    nextService: 'After-sales service',
    nextServiceHint: 'Warranty, spare parts and maintenance plans',
    sim: 'This showroom is a demonstration. What you send only reaches the demo back office.',
    minutes: '',
  },
}

export const contactCopy = (lang: Lang) => COPY[lang]

/** Opening hours, Monday first, today marked */
export function HoursTable({ hours, lang }: { hours: { day: number; open: string; close: string }[]; lang: Lang }) {
  const c = COPY[lang]
  const today = bangkokWeekday()
  return (
    <table className="hours-table">
      <caption className="visually-hidden">{c.hoursTitle}</caption>
      <tbody>
        {weekHours(hours).map(({ day, hours: h }) => (
          <tr key={day} data-today={day === today ? '' : undefined}>
            <th scope="row">
              {weekdayName(day, lang)}
              {day === today && <span className="hours-table__today">{c.today}</span>}
            </th>
            <td>{h ? `${h.open}–${h.close}${c.minutes ? ` ${c.minutes}` : ''}` : c.closed}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The showroom's address, phone, email and LINE as a definition list with action links */
export function StoreDetails({ lang }: { lang: Lang }) {
  const c = COPY[lang]
  const store = useStoreInfo()
  return (
    <dl className="c-dl">
      <div>
        <dt>{c.address}</dt>
        <dd>
          {store.storeName} <span className="nowrap">{store.branch}</span>
          <br />
          {store.address}
          <br />
          <a href={store.mapUrl} target="_blank" rel="noopener" className="store-link">
            <MapPin size={16} aria-hidden />
            {c.map}
          </a>
        </dd>
      </div>
      <div>
        <dt>{c.phone}</dt>
        <dd>
          <a href={telHref(store.phone)} className="store-link">
            <Phone size={16} aria-hidden />
            {store.phone}
          </a>
        </dd>
      </div>
      <div>
        <dt>{c.email}</dt>
        <dd>
          <a href={`mailto:${store.email}`} className="store-link" lang="en">
            <Mail size={16} aria-hidden />
            {store.email}
          </a>
        </dd>
      </div>
      <div>
        <dt>{c.lineId}</dt>
        <dd>
          <a href={store.lineUrl} target="_blank" rel="noopener" className="store-link" lang="en">
            <MessageCircle size={16} aria-hidden />
            {store.lineId}
          </a>
        </dd>
      </div>
    </dl>
  )
}

export function ContactPage() {
  const lang = useLang()
  const c = COPY[lang]
  const store = useStoreInfo()
  const [params] = useSearchParams()
  const pre = params.get('model')
  const [topic, setTopic] = useState('0')
  const [picked, setPicked] = useState<string[]>(() => (pre && models.some((m) => m.id === pre) ? [pre] : []))
  const [person, setPerson] = useState(emptyPerson)
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const doneRef = useRef<HTMLDivElement>(null)
  const { busy, errors, alert, formRef, run } = useSubmit<{ no: string }>(lang)
  const k = formCopy(lang)

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const submit = (e: FormEvent) =>
    run(
      e,
      () => ({
        ...validatePerson(person, lang),
        message: message.trim() ? undefined : c.errMessage,
        consent: consent ? undefined : k.errConsent,
      }),
      () =>
        apiPost<{ no: string }>('/api/public/leads', {
          kind: 'inquiry',
          ...person,
          message: `[${c.topics[Number(topic)]}] ${message.trim()}`,
          refIds: picked,
          page: '/contact',
          lang,
          consent,
          website,
        }),
      (r) => {
        setDone(r.no)
        requestAnimationFrame(() => doneRef.current?.focus())
      },
    )

  const reset = () => {
    setDone(null)
    setMessage('')
    setConsent(false)
  }

  const summary = hoursSummary(store.hours, lang)

  return (
    <>
      <PageStage title={c.title} sub={c.sub} lede={c.lede}>
        <div className="pstage__actions">
          <a href={telHref(store.phone)} className="btn btn-primary">
            <Phone size={18} aria-hidden />
            {c.call} {store.phone}
          </a>
          <a href={store.lineUrl} target="_blank" rel="noopener" className="btn btn-ghost">
            <MessageCircle size={18} aria-hidden />
            {c.line}
          </a>
        </div>
      </PageStage>

      <div className="container c-page">
        <div className="c-split">
          <section className="c-sheet" aria-labelledby="contact-form-title">
            <h2 id="contact-form-title">{c.formTitle}</h2>
            {done ? (
              <div className="c-done" ref={doneRef} tabIndex={-1} role="status">
                <h3>{c.doneTitle}</h3>
                <p>
                  {c.doneRef} <span className="c-done__ref">{done}</span>
                </p>
                <p className="c-muted">{c.doneBody}</p>
                <div className="c-actions">
                  <button type="button" className="btn btn-ghost" onClick={reset}>
                    {c.another}
                  </button>
                </div>
              </div>
            ) : (
              <form ref={formRef} className="contact-form" noValidate onSubmit={submit}>
                <p className="c-muted contact-form__lede">{c.formLede}</p>
                <FormAlert message={alert} />
                <SelectField
                  label={c.topic}
                  name="topic"
                  value={topic}
                  onChange={setTopic}
                  required
                  options={c.topics.map((label, i) => ({ value: String(i), label }))}
                />
                <fieldset className="model-pick">
                  <legend className="field__label">
                    {c.models}
                    <span className="field__req">{k.optional}</span>
                  </legend>
                  <p className="field__hint">{c.modelsHint}</p>
                  <div className="model-pick__list">
                    {models.map((m) => (
                      <label key={m.id} className="model-pick__item">
                        <input type="checkbox" checked={picked.includes(m.id)} onChange={() => toggle(m.id)} />
                        <span lang="en">{m.nameEn}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <PersonFields value={person} onChange={setPerson} errors={errors} />
                <Field
                  label={c.message}
                  name="message"
                  multiline
                  rows={5}
                  value={message}
                  onChange={setMessage}
                  error={errors.message}
                  hint={c.messageHint}
                  required
                  maxLength={2000}
                />
                <Consent checked={consent} onChange={setConsent} error={errors.consent} />
                <Honeypot value={website} onChange={setWebsite} />
                <SubmitButton busy={busy}>{c.send}</SubmitButton>
              </form>
            )}
            <SimNote>{c.sim}</SimNote>
          </section>

          <aside className="contact-aside">
            <section className="c-sheet c-sheet--dark" aria-labelledby="store-title">
              <h2 id="store-title">{c.storeTitle}</h2>
              <StoreDetails lang={lang} />
            </section>
            <section className="c-sheet" aria-labelledby="hours-title">
              <h2 id="hours-title">{c.hoursTitle}</h2>
              {summary && <p className="c-muted hours-summary">{summary}</p>}
              <HoursTable hours={store.hours} lang={lang} />
            </section>
            <nav className="c-sheet contact-next" aria-labelledby="next-title">
              <h2 id="next-title">{c.nextTitle}</h2>
              <ul>
                <li>
                  <Link to="/booking">
                    <CalendarCheck size={20} aria-hidden />
                    <span>
                      <strong>{c.nextBook}</strong>
                      <span>{c.nextBookHint}</span>
                    </span>
                  </Link>
                </li>
                <li>
                  <Link to={`/configure/${pre && models.some((m) => m.id === pre) ? pre : models[0].id}`}>
                    <SlidersHorizontal size={20} aria-hidden />
                    <span>
                      <strong>{c.nextQuote}</strong>
                      <span>{c.nextQuoteHint}</span>
                    </span>
                  </Link>
                </li>
                <li>
                  <Link to="/service">
                    <Wrench size={20} aria-hidden />
                    <span>
                      <strong>{c.nextService}</strong>
                      <span>{c.nextServiceHint}</span>
                    </span>
                  </Link>
                </li>
              </ul>
            </nav>
          </aside>
        </div>
      </div>
    </>
  )
}
