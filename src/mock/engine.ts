// The POS answered in the browser, for static hosting with no server behind /api (Vercel and the like). It is the
// same engine as `npm run server` (server/api.ts): vite.config.ts swaps node:fs, node:path and node:crypto for the
// small stand-ins beside this file, and the demo database is kept in this browser's localStorage. Loaded on demand
// by src/lib/apiFallback.ts.
import './process-env'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createApi } from '../../server/api.ts'

const api = createApi('/', '/pos-mock/db.json')

/** Runs one /api request through the engine and returns what the server would have sent. */
export async function answer(url: URL, init: RequestInit = {}): Promise<Response> {
  if (init.signal?.aborted) throw new DOMException('The request was aborted', 'AbortError')
  const body = typeof init.body === 'string' ? new TextEncoder().encode(init.body) : null
  const req = {
    method: (init.method ?? 'GET').toUpperCase(),
    url: url.pathname + url.search,
    headers: Object.fromEntries(new Headers(init.headers).entries()),
    socket: { remoteAddress: 'browser' },
    async *[Symbol.asyncIterator]() {
      if (body) yield body
    },
  }
  let status = 200
  let headers: Record<string, string> = {}
  let payload = ''
  const res = {
    headersSent: false,
    writeHead(code: number, h?: Record<string, string>) {
      status = code
      headers = h ?? {}
      return res
    },
    end(chunk?: string) {
      payload = chunk ?? ''
      res.headersSent = true
      return res
    },
  }
  await api.handle(req as unknown as IncomingMessage, res as unknown as ServerResponse)
  return new Response(status === 204 ? null : payload, { status, headers })
}
