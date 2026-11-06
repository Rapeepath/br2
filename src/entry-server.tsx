// Build-time renderer for scripts/prerender.mjs: turns a URL into the page's HTML and <head> tags.
// Built with `vite build --ssr src/entry-server.tsx --outDir dist-ssr`.
import { StrictMode } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'
import { AppProviders, AppRoutes } from './App'
import { EN_PREFIX, langOfPath, localePath, stripLang, type Lang } from './i18n'
import { PAGES } from './routes'
import { headTags, matchPage, resolveMeta, siteUrl } from './lib/seo'

export function render(url: string) {
  const lang = langOfPath(url)
  const path = stripLang(url)
  const html = renderToString(
    <StrictMode>
      <StaticRouter location={url} basename={lang === 'en' ? EN_PREFIX : undefined}>
        <AppProviders lang={lang}>
          <AppRoutes />
        </AppProviders>
      </StaticRouter>
    </StrictMode>,
  )
  const meta = resolveMeta(path, lang)
  return { html, head: headTags(meta), lang, meta }
}

/** Every in-language path to prerender (without the /en prefix), in PAGES order. */
export function prerenderPaths(): string[] {
  return PAGES.flatMap((p) => {
    if (p.prerender === 'none') return []
    if (p.prerender === 'static') return [p.path === '' ? '/' : `/${p.path}`]
    return p.prerender()
  })
}

/** Route prefixes rendered only in the browser (per-visitor pages such as a quotation), both languages. */
export function clientOnlyPrefixes(): string[] {
  const prefixes = PAGES.filter((p) => p.prerender === 'none').map((p) => `/${p.path.split('/:')[0]}/`)
  return prefixes.flatMap((p) => [p, `${EN_PREFIX}${p}`])
}

export const LANGS: Lang[] = ['th', 'en']
export { localePath, matchPage, siteUrl }
