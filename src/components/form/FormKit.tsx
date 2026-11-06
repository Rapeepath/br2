import { useCallback, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useLang, type Lang } from '../../i18n'
import { ApiError, errorText } from '../../lib/publicApi'
import './Form.css'

/**
 * The form kit every public form uses: visible labels, hints and errors tied to their fields, the PDPA
 * consent tick (linking /privacy), the hidden honeypot bots fill in, and a submit hook that maps the API's
 * `{ code, field, errorEn }` errors onto the right field in the page's language.
 */

const COPY = {
  th: {
    required: 'จำเป็น',
    optional: 'ไม่บังคับ',
    name: 'ชื่อ–นามสกุล',
    phone: 'เบอร์โทรศัพท์',
    phoneHint: 'เช่น 081-234-5678',
    email: 'อีเมล',
    lineId: 'LINE ID',
    consentBefore: 'ยินยอมให้โชว์รูมใช้ข้อมูลนี้เพื่อติดต่อกลับเรื่องที่ขอ ตาม',
    consentLink: 'นโยบายความเป็นส่วนตัว',
    consentAfter: '',
    sending: 'กำลังส่ง…',
    summary: 'ตรวจข้อมูลอีกครั้ง',
    errName: 'กรอกชื่อ',
    errPhone: 'กรอกเบอร์โทรศัพท์ 9–10 หลัก',
    errEmail: 'รูปแบบอีเมลไม่ถูกต้อง',
    errConsent: 'ติ๊กยินยอมก่อนส่ง',
    errRequired: 'กรอกช่องนี้',
    honeypot: 'เว็บไซต์ (เว้นว่างไว้)',
  },
  en: {
    required: 'required',
    optional: 'optional',
    name: 'Full name',
    phone: 'Phone number',
    phoneHint: 'e.g. 081-234-5678',
    email: 'Email',
    lineId: 'LINE ID',
    consentBefore: 'I agree that the showroom may use these details to reply to this request, as set out in the',
    consentLink: 'privacy policy',
    consentAfter: '.',
    sending: 'Sending…',
    summary: 'Please check the form',
    errName: 'Enter your name',
    errPhone: 'Enter a phone number (9–10 digits)',
    errEmail: 'This email address doesn’t look right',
    errConsent: 'Tick the box to agree before sending',
    errRequired: 'Fill in this field',
    honeypot: 'Website (leave blank)',
  },
}

export const formCopy = (lang: Lang) => COPY[lang]

export type FieldErrors = Record<string, string | undefined>

interface FieldProps {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: ReactNode
  required?: boolean
  type?: 'text' | 'tel' | 'email' | 'number' | 'date'
  multiline?: boolean
  rows?: number
  autoComplete?: string
  inputMode?: 'text' | 'tel' | 'email' | 'numeric' | 'decimal'
  maxLength?: number
  placeholder?: string
  lang?: string
}

/** A labelled input or textarea; the hint and the error are announced with it. */
export function Field({ label, name, value, onChange, error, hint, required, type = 'text', multiline, rows = 4, ...rest }: FieldProps) {
  const id = useId()
  const l = formCopy(useLang())
  const hintId = hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-err` : undefined
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined
  const common = {
    id,
    name,
    value,
    required,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    className: 'field__control',
    ...rest,
  }
  return (
    <div className="field" data-invalid={error ? '' : undefined}>
      <label className="field__label" htmlFor={id}>
        {label}
        <span className="field__req">{required ? l.required : l.optional}</span>
      </label>
      {multiline ? (
        <textarea {...common} rows={rows} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} type={type} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={errId}>
          <AlertCircle size={15} aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}

interface SelectProps {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  error?: string
  hint?: ReactNode
  required?: boolean
}

export function SelectField({ label, name, value, onChange, options, error, hint, required }: SelectProps) {
  const id = useId()
  const l = formCopy(useLang())
  const hintId = hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-err` : undefined
  return (
    <div className="field" data-invalid={error ? '' : undefined}>
      <label className="field__label" htmlFor={id}>
        {label}
        <span className="field__req">{required ? l.required : l.optional}</span>
      </label>
      <select
        id={id}
        name={name}
        className="field__control field__select"
        value={value}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errId].filter(Boolean).join(' ') || undefined}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={errId}>
          <AlertCircle size={15} aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}

/** The PDPA tick every form needs before it sends anything. */
export function Consent({ checked, onChange, error }: { checked: boolean; onChange: (v: boolean) => void; error?: string }) {
  const id = useId()
  const l = formCopy(useLang())
  return (
    <div className="consent" data-invalid={error ? '' : undefined}>
      <input
        id={id}
        name="consent"
        type="checkbox"
        className="consent__box"
        checked={checked}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id} className="consent__label">
        {l.consentBefore} <Link to="/privacy">{l.consentLink}</Link>
        {l.consentAfter}
      </label>
      {error && (
        <p className="field__error consent__error" id={`${id}-err`}>
          <AlertCircle size={15} aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}

/** Off-screen and out of the tab order; people never see it, form-filling bots fill it in. */
export function Honeypot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const l = formCopy(useLang())
  return (
    <div className="honeypot" aria-hidden="true">
      <label>
        {l.honeypot}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
    </div>
  )
}

export function SubmitButton({ busy, children, disabled }: { busy: boolean; children: ReactNode; disabled?: boolean }) {
  const l = formCopy(useLang())
  return (
    <button type="submit" className="btn btn-primary form-submit" aria-disabled={busy || disabled || undefined}>
      {busy ? (
        <>
          <Loader2 size={18} aria-hidden className="form-submit__spin" />
          {l.sending}
        </>
      ) : (
        children
      )}
    </button>
  )
}

/** A form-level message (offline, rate limited…), announced when it appears. */
export function FormAlert({ message }: { message: string | null }) {
  return (
    <div className="form-alert" role="alert" tabIndex={-1} hidden={!message}>
      {message && (
        <>
          <AlertCircle size={18} aria-hidden />
          <p>{message}</p>
        </>
      )}
    </div>
  )
}

const PHONE_RE = /^[0-9+\-\s()]{9,20}$/
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export interface Person {
  name: string
  phone: string
  email: string
  lineId: string
}

export const emptyPerson = (): Person => ({ name: '', phone: '', email: '', lineId: '' })

/** The same checks the server makes, so most mistakes show before anything is sent. */
export function validatePerson(p: Person, lang: Lang): FieldErrors {
  const l = formCopy(lang)
  const e: FieldErrors = {}
  if (!p.name.trim()) e.name = l.errName
  if (!PHONE_RE.test(p.phone.trim()) || p.phone.replace(/\D/g, '').length < 9) e.phone = l.errPhone
  if (p.email.trim() && !EMAIL_RE.test(p.email.trim())) e.email = l.errEmail
  return e
}

/** Name, phone, email and LINE ID, laid out two by two. */
export function PersonFields({ value, onChange, errors, withLine = true }: { value: Person; onChange: (p: Person) => void; errors: FieldErrors; withLine?: boolean }) {
  const l = formCopy(useLang())
  const set = (k: keyof Person) => (v: string) => onChange({ ...value, [k]: v })
  return (
    <div className="form-grid">
      <Field label={l.name} name="name" value={value.name} onChange={set('name')} error={errors.name} required autoComplete="name" maxLength={120} />
      <Field
        label={l.phone}
        name="phone"
        type="tel"
        inputMode="tel"
        value={value.phone}
        onChange={set('phone')}
        error={errors.phone}
        hint={l.phoneHint}
        required
        autoComplete="tel"
        maxLength={20}
      />
      <Field label={l.email} name="email" type="email" inputMode="email" value={value.email} onChange={set('email')} error={errors.email} autoComplete="email" maxLength={120} />
      {withLine && <Field label={l.lineId} name="lineId" value={value.lineId} onChange={set('lineId')} error={errors.lineId} maxLength={40} lang="en" />}
    </div>
  )
}

/**
 * Runs a form's submit: client checks first, then the API call. Errors that name a field land on it;
 * anything else becomes the form's alert. Focus moves to the first problem so keyboard and screen-reader
 * users hear what to fix.
 */
export function useSubmit<T>(lang: Lang) {
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [alert, setAlert] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const focusFirst = () =>
    requestAnimationFrame(() => {
      const el = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], .form-alert:not([hidden])')
      el?.focus?.()
      if (el && !el.matches('input, textarea, select')) el.scrollIntoView({ block: 'center' })
    })

  const run = useCallback(
    async (e: FormEvent, check: () => FieldErrors, send: () => Promise<T>, done: (result: T) => void) => {
      e.preventDefault()
      if (busy) return
      const found = Object.fromEntries(Object.entries(check()).filter(([, v]) => v))
      setErrors(found)
      setAlert(null)
      if (Object.keys(found).length) {
        focusFirst()
        return
      }
      setBusy(true)
      try {
        done(await send())
      } catch (err) {
        const msg = errorText(err, lang)
        if (err instanceof ApiError && err.field) setErrors({ [err.field]: msg })
        else if (err instanceof ApiError && err.code === 'CONSENT_REQUIRED') setErrors({ consent: msg })
        else setAlert(msg)
        focusFirst()
      } finally {
        setBusy(false)
      }
    },
    [busy, lang],
  )

  return { busy, errors, setErrors, alert, setAlert, formRef, run }
}
