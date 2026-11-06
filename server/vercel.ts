// Vercel Function: the POS API, plus any page the CDN doesn't answer, for a deploy on Vercel.
// scripts/vercel-output.mjs bundles this file into .vercel/output/functions/api.func together with the catalogue
// data and the prerendered pages. A function's disk is per instance and wiped on every cold start, so the database
// lives in Upstash Redis when the project has one connected (KV_REST_API_URL + KV_REST_API_TOKEN, or
// UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN). Without one each instance keeps its own copy in /tmp:
// enough to try the back office, but it starts over from fresh demo data whenever Vercel starts a new instance.
import { randomUUID } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { createApi } from './api.ts'
import { redirectAdmin, servePage } from './vite-plugin.ts'

// Vercel sets X-Forwarded-For itself (a visitor can't forge it), so the form rate limit can count real visitors
process.env.POS_TRUST_PROXY ??= '1'

const root = import.meta.dirname
const pages = join(root, 'pages')
// The build bakes in the package name, so two shops can share one Redis database
const key = process.env.POS_REDIS_KEY ?? process.env.POS_REDIS_KEY_DEFAULT ?? 'pos'

interface Remote {
  get(key: string): Promise<string | null>
  /** Sets every pair in one transaction */
  set(pairs: [string, string][]): Promise<void>
}

/** Upstash's REST API (plain fetch, no client library). */
function upstash(): Remote | null {
  const url = (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL)?.replace(/\/$/, '')
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  const call = async (path: string, command: unknown) => {
    const res = await fetch(`${url}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
    })
    const out = (await res.json().catch(() => null)) as unknown
    const failed = (x: unknown) => !x || typeof x !== 'object' || 'error' in x
    if (!res.ok || (Array.isArray(out) ? out.some(failed) : failed(out))) {
      throw new Error(`Upstash ${res.status}: ${JSON.stringify(out)}`)
    }
    return out
  }
  return {
    get: async (k) => ((await call('', ['GET', k])) as { result: string | null }).result,
    set: async (pairs) => {
      await call('/multi-exec', pairs.map(([k, v]) => ['SET', k, v]))
    },
  }
}

const remote = upstash()
/** JSON of changes not yet in Redis */
let unsaved: string | null = null
/** The Redis revision this instance's data matches */
let syncedRev: string | null = null

const api = createApi(root, process.env.POS_DB ?? '/tmp/pos-data/db.json', {
  onSave: remote
    ? (text) => {
        unsaved = text
      }
    : undefined,
})

/** Brings in what another instance saved, unless this instance already has it. */
async function pull(r: Remote) {
  const rev = await r.get(`${key}:rev`)
  if (rev === null) {
    // Nothing in Redis yet: this instance's demo data goes up with the next push
    unsaved ??= JSON.stringify(api.store.get())
    return
  }
  if (rev === syncedRev) return
  const text = await r.get(`${key}:db`)
  if (text !== null && api.store.adopt(text)) {
    syncedRev = rev
    unsaved = null
  } else {
    // An older data version upstream (after a deploy that changed it): replace it with this instance's
    unsaved ??= JSON.stringify(api.store.get())
  }
}

async function push(r: Remote) {
  if (unsaved === null) return
  const text = unsaved
  const rev = randomUUID()
  await r.set([
    [`${key}:db`, text],
    [`${key}:rev`, rev],
  ])
  syncedRev = rev
  if (unsaved === text) unsaved = null
}

// One API request at a time per instance, so each sees the data the one before it saved
let queue: Promise<unknown> = Promise.resolve()
function serial(task: () => Promise<void>): Promise<void> {
  const run = queue.then(task, task)
  queue = run.catch(() => {})
  return run
}

async function handleApi(req: IncomingMessage, res: ServerResponse, r: Remote) {
  await pull(r)
  // Hold the response until the change is in Redis: Vercel may freeze the instance as soon as it is sent
  const end = res.end.bind(res) as (...args: unknown[]) => ServerResponse
  let saved: Promise<void> = Promise.resolve()
  res.end = ((...args: unknown[]) => {
    saved = push(r).then(
      () => void end(...args),
      (err: unknown) => {
        // Kept in `unsaved`, so the next request tries again
        console.error('Saving to Upstash failed', err)
        end(...args)
      },
    )
    return res
  }) as ServerResponse['end']
  await api.handle(req, res)
  await saved
}

function sendHtml(req: IncomingMessage, res: ServerResponse, file: string) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
  if (req.method === 'HEAD') res.end()
  else createReadStream(file).pipe(res)
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname
  if (path.startsWith('/api/')) {
    try {
      if (remote) await serial(() => handleApi(req, res, remote))
      else await api.handle(req, res)
    } catch (err) {
      console.error(err)
      if (!res.headersSent) {
        res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ error: 'ฐานข้อมูลของร้านไม่ตอบ ลองใหม่อีกครั้ง', errorEn: 'The shop database is not responding. Please try again.' }))
      }
    }
    return
  }
  // Pages: prerendered HTML, the client-only shell, the 404 pages, and the back office
  if (redirectAdmin(req, res)) return
  if (servePage(pages, req, res)) return
  const admin = join(pages, 'admin', 'index.html')
  if ((path === '/admin/' || path === '/admin/index.html') && existsSync(admin)) {
    sendHtml(req, res, admin)
    return
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('ไม่พบหน้านี้')
}
