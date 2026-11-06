import { createHash, randomBytes } from 'node:crypto'

/** Thailand has no daylight saving: Bangkok is always UTC+7. */
const BKK_OFFSET_MS = 7 * 60 * 60 * 1000

/** Rounds to satang (2 decimals) without float drift creeping into totals. */
export const money = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

/** Bangkok calendar day of an instant, as YYYY-MM-DD. */
export function dayKey(at: string | number | Date): string {
  const t = new Date(at).getTime() + BKK_OFFSET_MS
  return new Date(t).toISOString().slice(0, 10)
}

/** Bangkok hour of day (0–23). */
export function bkkHour(at: string | number | Date): number {
  return new Date(new Date(at).getTime() + BKK_OFFSET_MS).getUTCHours()
}

/** The UTC instant of a Bangkok wall-clock time on a given day. */
export function bkkTime(day: string, hour: number, minute = 0, second = 0): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hour, minute, second) - BKK_OFFSET_MS)
}

/** Shifts a YYYY-MM-DD day by whole days. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Every day from `from` to `to`, inclusive. */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/** Buddhist-era date stamp for receipt numbers: 2026-11-06 → "691106". */
export function beStamp(day: string): string {
  const [y, m, d] = day.split('-')
  return `${String(Number(y) + 543).slice(-2)}${m}${d}`
}

export const hashPin = (staffId: string, pin: string): string =>
  createHash('sha256').update(`${staffId}:${pin}`).digest('hex')

export const newToken = (): string => randomBytes(24).toString('hex')

/** Small, fast, seedable PRNG (mulberry32) so the simulated history is the same on every reset. */
export function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    /** Integer in [min, max] */
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
    /** Picks by weight; weights need not sum to 1 */
    weighted: <T,>(items: readonly T[], weight: (item: T) => number): T => {
      const total = items.reduce((s, i) => s + weight(i), 0)
      let r = next() * total
      for (const item of items) {
        r -= weight(item)
        if (r <= 0) return item
      }
      return items[items.length - 1]
    },
    chance: (p: number) => next() < p,
  }
}

export type Rng = ReturnType<typeof rng>

/** Rounds a price to a tidy shelf figure: steps of 500 under 20,000 baht, 1,000 above. */
export function shelfPrice(n: number): number {
  const step = n < 2000 ? 10 : n < 20000 ? 500 : 1000
  return Math.max(step, Math.round(n / step) * step)
}

const DEFAULT_CODE: Record<number, string> = {
  400: 'INVALID',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  410: 'GONE',
  413: 'TOO_LARGE',
  429: 'RATE_LIMITED',
}

/**
 * An error the API answers with `{ error, code, errorEn? }`: `error` is the Thai message the admin shows,
 * `code` a stable key the brochure's English pages translate, `en` an English message where one exists.
 */
export class HttpError extends Error {
  status: number
  code: string
  en: string | null
  constructor(status: number, message: string, code?: string, en?: string) {
    super(message)
    this.status = status
    this.code = code ?? DEFAULT_CODE[status] ?? 'ERROR'
    this.en = en ?? null
  }
}

/** Shifts an instant by `ms` milliseconds. */
export const addMs = (at: Date, ms: number) => new Date(at.getTime() + ms)
export const HOUR = 3_600_000
export const DAY = 24 * HOUR

/** "HH:MM" → minutes after midnight */
export const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** minutes after midnight → "HH:MM" */
export const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** Bangkok weekday (0 = Sunday) of a YYYY-MM-DD day. */
export const weekdayOf = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay()
