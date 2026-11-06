// Talks to the simulated POS server at /api (served by the same origin in dev, preview and `npm run server`).
const TOKEN_KEY = 'servo.pos.token'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let onUnauthorized: (() => void) | null = null

/** Called whenever the server says the session is gone, so the app can go back to the sign-in screen. */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Private mode: the session lasts until the tab closes
  }
}

const headers = (json: boolean): HeadersInit => {
  const token = getToken()
  return { ...(json ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: headers(opts.body !== undefined),
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    throw new ApiError(0, 'ติดต่อเซิร์ฟเวอร์ไม่ได้ ตรวจว่าเปิด npm run dev หรือ npm run server อยู่')
  }
  const data = (await res.json().catch(() => null)) as { error?: string } | null
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    setToken(null)
    onUnauthorized?.()
  }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `เกิดข้อผิดพลาด (${res.status})`)
  return data as T
}

/** Downloads an authenticated file (the CSV export) through a temporary link. */
export async function download(path: string, filename: string) {
  const res = await fetch(`/api${path}`, { headers: headers(false) })
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(res.status, data?.error ?? 'ดาวน์โหลดไม่สำเร็จ')
  }
  const url = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const errorMessage = (err: unknown) => (err instanceof Error ? err.message : 'เกิดข้อผิดพลาด ลองอีกครั้ง')
