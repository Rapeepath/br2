// Vercel Function: the POS API, plus any page the CDN doesn't answer, for a deploy on Vercel.
// scripts/vercel-output.mjs bundles this file into .vercel/output/functions/api.func together with the catalogue
// data and the prerendered pages. The shop is a mock-up with no real database: each instance seeds its own demo
// data into /tmp (the only writable disk) and keeps it while it runs. When Vercel starts a fresh instance (after a
// quiet spell) the demo data starts over and staff sign in again.
import { createReadStream, existsSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { createApi } from './api.ts'
import { redirectAdmin, servePage } from './vite-plugin.ts'

// Vercel sets X-Forwarded-For itself (a visitor can't forge it), so the form rate limit can count real visitors
process.env.POS_TRUST_PROXY ??= '1'

const root = import.meta.dirname
const pages = join(root, 'pages')
const api = createApi(root, process.env.POS_DB ?? '/tmp/pos-data/db.json')

function sendHtml(req: IncomingMessage, res: ServerResponse, file: string) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
  if (req.method === 'HEAD') res.end()
  else createReadStream(file).pipe(res)
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (redirectAdmin(req, res)) return
  if (await api.handle(req, res)) return
  // Pages: prerendered HTML, the client-only shell, the 404 pages, and the back office
  if (servePage(pages, req, res)) return
  const path = new URL(req.url ?? '/', 'http://localhost').pathname
  const admin = join(pages, 'admin', 'index.html')
  if ((path === '/admin/' || path === '/admin/index.html') && existsSync(admin)) {
    sendHtml(req, res, admin)
    return
  }
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('ไม่พบหน้านี้')
}
