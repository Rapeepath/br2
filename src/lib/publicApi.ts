// The brochure's calls to the showroom's public API (/api/public/*). Errors arrive as
// `{ error (Thai), code, errorEn?, field? }`; ApiError keeps all of them so a form can show the message in
// the page's language next to the field it concerns.
import type { Lang } from '../i18n'

export class ApiError extends Error {
  status: number
  code: string
  en: string | null
  field: string | null
  constructor(status: number, message: string, code: string, en: string | null, field: string | null) {
    super(message)
    this.status = status
    this.code = code
    this.en = en
    this.field = field
  }
}

/** Status 0: the request never reached the showroom (offline, static hosting without the API). */
const OFFLINE = new ApiError(0, 'เชื่อมต่อระบบของโชว์รูมไม่ได้', 'OFFLINE', 'The showroom’s system can’t be reached.', null)

async function call<T>(method: 'GET' | 'POST', url: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw OFFLINE
  }
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    // An HTML page (static host's 404) instead of JSON: the API isn't there
    throw OFFLINE
  }
  if (!res.ok) {
    const d = (data ?? {}) as { error?: string; code?: string; errorEn?: string; field?: string }
    throw new ApiError(res.status, d.error ?? 'ส่งข้อมูลไม่สำเร็จ', d.code ?? 'ERROR', d.errorEn ?? null, d.field ?? null)
  }
  return data as T
}

export const apiGet = <T>(url: string) => call<T>('GET', url)
export const apiPost = <T>(url: string, body: unknown) => call<T>('POST', url, body)

const EN_BY_CODE: Record<string, string> = {
  OFFLINE: 'The showroom’s system can’t be reached right now. Please call or message us on LINE.',
  RATE_LIMITED: 'Too many forms sent from this connection. Please wait a few minutes and try again.',
  CONSENT_REQUIRED: 'Please tick the box to agree to how we use your details.',
  SPAM: 'The form could not be sent.',
  SLOT_TAKEN: 'Someone has just booked that time. Please pick another slot.',
  SLOT_INVALID: 'That date or time is not open for booking. Please pick a listed slot.',
  NOT_FOUND: 'We couldn’t find that.',
  EXPIRED: 'This has expired.',
}

const TH_BY_CODE: Record<string, string> = {
  OFFLINE: 'ตอนนี้เชื่อมต่อระบบของโชว์รูมไม่ได้ โทรหรือทัก LINE หาเราได้เลย',
  RATE_LIMITED: 'ส่งแบบฟอร์มจากเครือข่ายนี้บ่อยเกินไป รอสักครู่แล้วลองใหม่',
}

/** The message to show for a failed call, in the page's language. */
export function errorText(err: unknown, lang: Lang): string {
  if (err instanceof ApiError) {
    if (lang === 'en') return err.en ?? EN_BY_CODE[err.code] ?? 'Something went wrong. Please try again.'
    return TH_BY_CODE[err.code] ?? err.message
  }
  return lang === 'en' ? 'Something went wrong. Please try again.' : 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง'
}
