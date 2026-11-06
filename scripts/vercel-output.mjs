// npm run build:vercel (Vercel's build command, see vercel.json): after `npm run build`, writes the Build Output API
// folder Vercel deploys as is (https://vercel.com/docs/build-output-api):
//   .vercel/output/static/              dist/ on the CDN
//   .vercel/output/functions/api.func/  server/vercel.ts bundled, with the catalogue data and the prerendered pages
//   .vercel/output/config.json          /api/* → the function; files the CDN has; anything else → the function
//                                       (which answers pages, the client-only shell and 404s like server/index.ts)
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const out = join(root, '.vercel', 'output')
const fn = join(out, 'functions', 'api.func')
/** What server/catalog.ts reads at runtime */
const DATA = ['src/data/models.json']

if (!existsSync(join(dist, 'admin', 'index.html')) || !existsSync(join(dist, '_routes.json'))) {
  throw new Error('dist/ is missing or not prerendered: run `npm run build` first')
}

rmSync(out, { recursive: true, force: true })
cpSync(dist, join(out, 'static'), { recursive: true })

await build({
  configFile: false,
  root,
  logLevel: 'warn',
  publicDir: false,
  ssr: { noExternal: true, target: 'node' },
  build: {
    ssr: join(root, 'server', 'vercel.ts'),
    outDir: fn,
    emptyOutDir: false,
    minify: false,
    target: 'node22',
    rolldownOptions: { output: { format: 'es', entryFileNames: 'index.mjs' } },
  },
})

for (const file of DATA) {
  mkdirSync(dirname(join(fn, file)), { recursive: true })
  cpSync(join(root, file), join(fn, file))
}

// Every HTML page (and the client-only route list) for the function's own page serving
const walk = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]))
let pages = 0
for (const file of walk(dist)) {
  if (!file.endsWith('.html') && !file.endsWith('_routes.json')) continue
  const target = join(fn, 'pages', relative(dist, file))
  mkdirSync(dirname(target), { recursive: true })
  cpSync(file, target)
  pages++
}

writeFileSync(
  join(fn, '.vc-config.json'),
  `${JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false }, null, 2)}\n`,
)

writeFileSync(
  join(out, 'config.json'),
  `${JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/api(?:/.*)?$', dest: '/api' },
        // Hashed build files never change
        { src: '^/assets/.+$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
        { handle: 'filesystem' },
        { src: '^/.*$', dest: '/api' },
      ],
    },
    null,
    2,
  )}\n`,
)

console.log(`vercel-output: static ${relative(root, join(out, 'static'))}, function ${relative(root, fn)} (${pages} pages) → ${relative(root, out)}`)
