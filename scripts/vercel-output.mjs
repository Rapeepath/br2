// npm run build:vercel (Vercel's build command, see vercel.json): after `npm run build`, writes the Build Output API
// folder Vercel deploys as is (https://vercel.com/docs/build-output-api). Everything is static: the POS API runs in
// the visitor's browser there (src/lib/apiFallback.ts), so /api/* just gets the 404 page that tells it so.
//   .vercel/output/static/      dist/ on the CDN
//   .vercel/output/config.json  the files; client-only routes (dist/_routes.json) → the shell; else the 404 pages
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const out = join(root, '.vercel', 'output')

if (!existsSync(join(dist, 'admin', 'index.html')) || !existsSync(join(dist, '_routes.json'))) {
  throw new Error('dist/ is missing or not prerendered: run `npm run build` first')
}

rmSync(out, { recursive: true, force: true })
cpSync(dist, join(out, 'static'), { recursive: true })

// "/quote/" covers /quote and /quote/<anything>, as in server/vite-plugin.ts
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const clientOnly = JSON.parse(readFileSync(join(dist, '_routes.json'), 'utf8')).clientOnly.map((prefix) => ({
  src: `^${escape(prefix.replace(/\/$/, ''))}(?:/.*)?$`,
  dest: '/_app.html',
}))

writeFileSync(
  join(out, 'config.json'),
  `${JSON.stringify(
    {
      version: 3,
      routes: [
        // Hashed build files never change
        { src: '^/assets/.+$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
        { handle: 'filesystem' },
        ...clientOnly,
        { src: '^/en(?:/.*)?$', status: 404, dest: '/en/404.html' },
        { src: '^/.*$', status: 404, dest: '/404.html' },
      ],
    },
    null,
    2,
  )}\n`,
)

console.log(`vercel-output: ${relative(root, out)} (static, ${clientOnly.length} client-only routes)`)
