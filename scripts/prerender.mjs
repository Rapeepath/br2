// Runs after `vite build` and `vite build --ssr src/entry-server.tsx --outDir dist-ssr` (see `npm run build`).
// Writes every public route, Thai and English, as static HTML (markup + title, description, canonical,
// hreflang, Open Graph, JSON-LD) so search engines and link previews (LINE, Facebook) see the real page,
// plus 404 pages, the client-only shell, sitemap.xml, robots.txt and the list of client-only routes.
// Usage: node scripts/prerender.mjs [outDir]   (default dist; SITE_URL sets the public origin)
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, process.argv[2] ?? 'dist')
const ssrDir = join(root, 'dist-ssr')
const entry = join(ssrDir, 'entry-server.js')
if (!existsSync(entry)) throw new Error('dist-ssr/entry-server.js is missing: run `vite build --ssr src/entry-server.tsx --outDir dist-ssr` first')

const ssr = await import(pathToFileURL(entry).href)
const templatePath = join(dist, 'index.html')
// Keep the untouched client template the first time; later runs (re-prerendering) read it back
const shellPath = join(dist, '_app.html')
const template = existsSync(shellPath) && readFileSync(templatePath, 'utf8').includes('data-prerendered')
  ? readFileSync(shellPath, 'utf8').replace('<meta name="robots" content="noindex" />', '')
  : readFileSync(templatePath, 'utf8')

const site = ssr.siteUrl()

/** The template with this page's head and markup in place of the defaults. */
function page({ html, head, lang }) {
  return template
    .replace(/<html lang="[^"]*"/, `<html lang="${lang}" data-prerendered`)
    .replace(/\s*<title>[\s\S]*?<\/title>/, '')
    .replace(/\s*<meta name="description"[^>]*>/, '')
    // Function replacements: the markup may contain $ sequences that a string replacement would expand
    .replace('</head>', () => `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', () => `<div id="root">${html}</div>`)
}

function write(urlPath, contents) {
  const file = urlPath === '/' ? join(dist, 'index.html') : join(dist, urlPath.replace(/^\//, ''), 'index.html')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, contents)
}

// The client-only shell (per-visitor pages such as a quotation): the plain template, kept out of search
writeFileSync(shellPath, template.replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>'))

const paths = ssr.prerenderPaths()
const sitemap = []
let count = 0
for (const path of paths) {
  for (const lang of ssr.LANGS) {
    const url = ssr.localePath(path, lang)
    const out = ssr.render(url)
    write(url, page(out))
    count++
    if (lang === 'th' && !out.meta.noindex) sitemap.push(out.meta)
  }
}

// Not-found pages: served with status 404 for unknown paths (server/index.ts, server/vite-plugin.ts)
for (const lang of ssr.LANGS) {
  const out = ssr.render(ssr.localePath('/__not-found__', lang))
  const file = lang === 'th' ? join(dist, '404.html') : join(dist, 'en', '404.html')
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, page(out))
}

writeFileSync(join(dist, '_routes.json'), `${JSON.stringify({ clientOnly: ssr.clientOnlyPrefixes() }, null, 2)}\n`)

const xmlEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
const alt = (m) =>
  [
    `<xhtml:link rel="alternate" hreflang="th" href="${xmlEsc(m.alternates.th)}"/>`,
    `<xhtml:link rel="alternate" hreflang="en" href="${xmlEsc(m.alternates.en)}"/>`,
    `<xhtml:link rel="alternate" hreflang="x-default" href="${xmlEsc(m.alternates.th)}"/>`,
  ].join('')
const today = new Date().toISOString().slice(0, 10)
writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemap
  .flatMap((m) => [m.alternates.th, m.alternates.en].map((loc) => `  <url><loc>${xmlEsc(loc)}</loc><lastmod>${today}</lastmod>${alt(m)}</url>`))
  .join('\n')}
</urlset>
`,
)

writeFileSync(
  join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${site}/sitemap.xml\n`,
)

rmSync(ssrDir, { recursive: true, force: true })
console.log(`prerender: ${count} pages (${paths.length} routes × ${ssr.LANGS.length} languages), ${sitemap.length * 2} sitemap URLs → ${dist}`)
