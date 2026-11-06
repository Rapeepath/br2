// Mounts the POS API inside Vite's dev and preview servers, so `npm run dev` / `npm run preview` serve the
// brochure, /admin and /api from one port. In preview (and the standalone server) it also serves the
// prerendered pages: dist/<path>/index.html, the client-only shell, or the 404 page.
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'
import type { Plugin, PreviewServer, ViteDevServer } from 'vite'
import { createApi, type Api } from './api.ts'

/** /admin → /admin/ so the admin page's relative asset paths resolve. */
export function redirectAdmin(req: IncomingMessage, res: ServerResponse): boolean {
  const url = req.url ?? ''
  if (url !== '/admin' && !url.startsWith('/admin?')) return false
  res.writeHead(302, { Location: `/admin/${url.slice('/admin'.length)}` })
  res.end()
  return true
}

function clientOnly(dist: string): string[] {
  try {
    return (JSON.parse(readFileSync(join(dist, '_routes.json'), 'utf8')) as { clientOnly?: string[] }).clientOnly ?? []
  } catch {
    return []
  }
}

function sendHtml(req: IncomingMessage, res: ServerResponse, file: string, status: number) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
  if (req.method === 'HEAD') res.end()
  else createReadStream(file).pipe(res)
}

/**
 * Answers a request for a public page from a built site: its prerendered HTML, the client-only shell for
 * per-visitor routes (/quote/…), or the language's 404 page with status 404. Returns false for anything
 * else (API, admin, files with an extension), so the caller can carry on.
 */
export function servePage(dist: string, req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  let path: string
  try {
    path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
  } catch {
    return false
  }
  if (path.startsWith('/api/') || path === '/admin' || path.startsWith('/admin/') || extname(path)) return false
  const file = resolve(dist, `.${path}`, 'index.html')
  if (!file.startsWith(dist + sep)) return false
  if (existsSync(file) && statSync(file).isFile()) {
    sendHtml(req, res, file, 200)
    return true
  }
  const shell = join(dist, '_app.html')
  const bare = path.endsWith('/') ? path : `${path}/`
  if (existsSync(shell) && clientOnly(dist).some((p) => bare.startsWith(p))) {
    sendHtml(req, res, shell, 200)
    return true
  }
  const notFound = path === '/en' || path.startsWith('/en/') ? join(dist, 'en', '404.html') : join(dist, '404.html')
  if (existsSync(notFound)) {
    sendHtml(req, res, notFound, 404)
    return true
  }
  return false
}

export function posApi(): Plugin {
  let api: Api | undefined
  const mount = (server: ViteDevServer | PreviewServer, preview: boolean) => {
    api ??= createApi(server.config.root)
    const ready = api
    const dist = resolve(server.config.root, server.config.build.outDir)
    server.middlewares.use((req, res, next) => {
      if (redirectAdmin(req, res)) return
      ready.handle(req, res).then((handled) => {
        if (handled) return
        // Dev serves index.html itself (Vite transforms it); preview serves the prerendered build
        if (preview && servePage(dist, req, res)) return
        next()
      }, next)
    })
  }
  return {
    name: 'pos-api',
    configureServer: (server) => mount(server, false),
    configurePreviewServer: (server) => mount(server, true),
  }
}
