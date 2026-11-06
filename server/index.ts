// Standalone server: the built brochure and admin (dist/) plus the POS API on one port, no Vite needed.
//   npm run build && npm run server   →   http://localhost:3002/  and  http://localhost:3002/admin
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { createApi } from './api.ts'
import { redirectAdmin, servePage } from './vite-plugin.ts'

const root = resolve(import.meta.dirname, '..')
const dist = join(root, 'dist')
const port = Number(process.env.PORT ?? 3002)

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.xml': 'application/xml; charset=utf-8',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
}

if (!existsSync(join(dist, 'admin', 'index.html'))) {
  console.error('ยังไม่มีไฟล์ build ของหน้า admin: รัน npm run build ก่อน')
  process.exit(1)
}

const api = createApi(root)

createServer((req, res) => {
  if (redirectAdmin(req, res)) return
  api.handle(req, res).then((handled) => {
    if (handled) return
    // Pages: prerendered HTML, the client-only shell, or the 404 page
    if (servePage(dist, req, res)) return
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname)
    let file = normalize(join(dist, path))
    if (!file.startsWith(dist + sep) && file !== dist) {
      res.writeHead(403).end()
      return
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
    if (!existsSync(file)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('ไม่พบหน้านี้')
      return
    }
    const hashed = file.includes(`${sep}assets${sep}`)
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    createReadStream(file).pipe(res)
  })
}).listen(port, () => {
  console.log(`Servo POS  เว็บไซต์ http://localhost:${port}/   หลังร้าน http://localhost:${port}/admin`)
  console.log(`ฐานข้อมูลจำลอง ${api.store.file}`)
})
