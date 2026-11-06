// Static hosting (Vercel, any file server) has nothing behind /api. The first /api request tells: a POS server
// answers JSON (or the CSV export), a static host answers an HTML 404 page or fails. From then on this tab answers
// /api/* in the browser with the same engine and demo data (src/mock/engine.ts), so the brochure's live data, its
// forms and the whole back office work as a mock-up with nothing to set up. Imported first by both entry points.
type Mode = 'server' | 'browser'
const KEY = 'pos.apiMode'

let mode: Mode | null = (() => {
  try {
    const v = sessionStorage.getItem(KEY)
    return v === 'server' || v === 'browser' ? v : null
  } catch {
    return null
  }
})()

function remember(m: Mode) {
  mode = m
  try {
    sessionStorage.setItem(KEY, m)
  } catch {
    // private mode: decided again on the next page load
  }
}

const realFetch = window.fetch.bind(window)

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = new URL(input instanceof Request ? input.url : String(input), location.href)
  if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return realFetch(input, init)
  if (mode !== 'browser') {
    try {
      const res = await realFetch(input, init)
      if (mode === 'server' || /json|csv/.test(res.headers.get('content-type') ?? '')) {
        remember('server')
        return res
      }
    } catch (err) {
      if (mode === 'server' || (err as Error).name === 'AbortError') throw err
    }
    remember('browser')
  }
  const { answer } = await import('../mock/engine')
  return answer(url, init ?? (input instanceof Request ? { method: input.method, headers: input.headers } : undefined))
}
