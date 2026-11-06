// Route registry and request helpers shared by the admin API (api.ts), the brochure's public API
// (public.ts), the CRM (crm.ts) and each shop's own extras (extras.ts).
import type { IncomingMessage } from 'node:http'
import type { Catalog } from './catalog.ts'
import type { Store } from './store.ts'
import type { Lang, Staff } from './types.ts'
import { HttpError } from './util.ts'

export type Handler = (ctx: Ctx) => unknown
export interface Ctx {
  req: IncomingMessage
  params: Record<string, string>
  query: URLSearchParams
  body: any
  store: Store
  catalog: Catalog
  now: Date
  /** The signed-in staff member (set for every route except the public ones) */
  staff: Staff
}

export interface Route {
  method: string
  pattern: RegExp
  keys: string[]
  handler: Handler
  public?: boolean
}

export const routes: Route[] = []

export function route(method: string, path: string, handler: Handler, opts: { public?: boolean } = {}) {
  const keys: string[] = []
  const pattern = new RegExp(
    `^${path.replace(/:(\w+)/g, (_, k) => {
      keys.push(k)
      return '([^/]+)'
    })}$`,
  )
  routes.push({ method, pattern, keys, handler, public: opts.public })
}

/** A route the brochure calls without signing in */
export const publicRoute = (method: string, path: string, handler: Handler) => route(method, path, handler, { public: true })

export const requireManager = (staff: Staff) => {
  if (staff.role !== 'manager') throw new HttpError(403, 'เฉพาะผู้จัดการเท่านั้น')
}

interface TextOpts {
  required?: boolean
  max?: number
  /** English field name, for the brochure's English pages */
  en?: string
  /** The body key, echoed back so a form can mark the field */
  key?: string
}

const fieldError = (message: string, en: string, key?: string) => {
  const e = new HttpError(400, message, 'VALIDATION', en)
  if (key) (e as HttpError & { field?: string }).field = key
  return e
}

export const text = (v: unknown, field: string, { required = true, max = 200, en, key }: TextOpts = {}): string | null => {
  const name = en ?? field
  if (v === undefined || v === null || v === '') {
    if (required) throw fieldError(`กรอก${field}`, `Please enter ${name}.`, key)
    return null
  }
  if (typeof v !== 'string') throw fieldError(`${field}ไม่ถูกต้อง`, `${cap(name)} is not valid.`, key)
  const t = v.trim()
  if (required && !t) throw fieldError(`กรอก${field}`, `Please enter ${name}.`, key)
  if (t.length > max) throw fieldError(`${field}ยาวเกิน ${max} ตัวอักษร`, `${cap(name)} is longer than ${max} characters.`, key)
  return t || null
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const num = (v: unknown, field: string): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new HttpError(400, `${field}ต้องเป็นตัวเลข`)
  return n
}

export const day = (v: string | null, fallback: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : fallback)

export const PHONE_RE = /^[0-9+\-\s()]{9,20}$/
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const phoneOf = (v: unknown, key = 'phone') => {
  const phone = text(v, 'เบอร์โทร', { max: 20, en: 'a phone number', key })!
  if (!PHONE_RE.test(phone)) throw fieldError('เบอร์โทรไม่ถูกต้อง', 'The phone number is not valid.', key)
  return phone
}

export const emailOf = (v: unknown, key = 'email') => {
  const email = text(v, 'อีเมล', { required: false, max: 120, en: 'an email address', key })
  if (email && !EMAIL_RE.test(email)) throw fieldError('อีเมลไม่ถูกต้อง', 'The email address is not valid.', key)
  return email
}

export const lineIdOf = (v: unknown, key = 'lineId') => {
  const id = text(v, 'LINE ID', { required: false, max: 50, en: 'a LINE ID', key })
  if (id && !/^@?[\w.\-]{2,49}$/.test(id)) throw fieldError('LINE ID ไม่ถูกต้อง', 'The LINE ID is not valid.', key)
  return id
}

export const langOf = (v: unknown): Lang => (v === 'en' ? 'en' : 'th')

/**
 * Every public form: an empty honeypot (`website`, hidden from people, filled by bots) and an explicit
 * PDPA consent tick.
 */
export function publicForm(body: any, { consent = true } = {}) {
  if (!body || typeof body !== 'object') throw new HttpError(400, 'ข้อมูลที่ส่งมาไม่ถูกต้อง', 'INVALID', 'The request is not valid.')
  if (body.website) throw new HttpError(400, 'ส่งข้อมูลไม่สำเร็จ', 'SPAM', 'The form could not be sent.')
  if (consent && body.consent !== true) {
    throw new HttpError(
      400,
      'กรุณายินยอมให้ร้านเก็บและใช้ข้อมูลเพื่อติดต่อกลับตามนโยบายความเป็นส่วนตัว',
      'CONSENT_REQUIRED',
      'Please agree to the privacy notice so we can contact you.',
    )
  }
}

/** Sliding-window limit on the brochure's POSTs per client address. */
export function rateLimiter(limit: number, windowMs = 10 * 60_000) {
  const hits = new Map<string, number[]>()
  return (key: string, now = Date.now()) => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
    if (recent.length >= limit) {
      hits.set(key, recent)
      throw new HttpError(429, 'ส่งข้อมูลบ่อยเกินไป ลองใหม่อีกครั้งในอีกสักครู่', 'RATE_LIMITED', 'Too many requests. Please try again in a few minutes.')
    }
    recent.push(now)
    hits.set(key, recent)
    // Forget idle clients now and then
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k)
  }
}

/**
 * The client's address for rate limiting. X-Forwarded-For is only believed behind a reverse proxy that sets
 * it (POS_TRUST_PROXY=1); otherwise any visitor could dodge the limit by sending a made-up header.
 */
export function clientIp(req: IncomingMessage): string {
  const fwd = process.env.POS_TRUST_PROXY === '1' ? req.headers['x-forwarded-for'] : undefined
  const first = Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0]
  return (first?.trim() || req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '')
}
