import { useEffect } from 'react'
import { matchRoutes, useLocation } from 'react-router'
import { localePath, translate, useLang, type DictKey, type Lang } from '../i18n'
import { NOT_FOUND, PAGES, type MetaInput } from '../routes'
import { asset } from './asset'
import { srcSetFor } from '../components/Picture'
import { STATIC_STORE } from './storeInfo'

/** Public origin for canonical and share URLs: SITE_URL at build time, else the demo domain. */
export const DEFAULT_SITE_URL = 'https://servo-showroom.example'

export function siteUrl(): string {
  const fromNode = typeof process !== 'undefined' ? process.env?.SITE_URL : undefined
  const fromVite = (import.meta.env?.VITE_SITE_URL as string | undefined) ?? undefined
  return (fromNode || fromVite || DEFAULT_SITE_URL).replace(/\/+$/, '')
}

export interface ResolvedMeta {
  lang: Lang
  /** Path inside the language root */
  path: string
  title: string
  description: string
  canonical: string
  alternates: { th: string; en: string }
  image: string
  noindex: boolean
  jsonLd: object[]
  preload?: { src: string; sizes: string }
}

const ROUTES = [...PAGES, NOT_FOUND].map((p) => ({ path: p.path === '' ? '/' : `/${p.path}`, def: p }))

/** The page definition and params for an in-language path. */
export function matchPage(path: string) {
  const hit = matchRoutes(ROUTES, path)?.at(-1)
  const def = (hit?.route as { def?: typeof NOT_FOUND } | undefined)?.def ?? NOT_FOUND
  return { def, params: (hit?.params ?? {}) as Record<string, string | undefined> }
}

const abs = (site: string, path: string) => `${site}${path}`

export function resolveMeta(path: string, lang: Lang): ResolvedMeta {
  const site = siteUrl()
  const { def, params } = matchPage(path)
  const t = (key: DictKey) => translate(lang, key)
  const m: MetaInput = def.meta({ params, lang, t })
  const name = t('site.name')
  const title = m.title == null ? `${name} ${t('site.tagline')}` : `${m.title} – ${name}`
  const thPath = localePath(path, 'th')
  const enPath = localePath(path, 'en')
  const jsonLd = [...(m.jsonLd ?? [])].map((o) => absolutize(o, site))
  if (m.store) jsonLd.unshift(storeJsonLd(site, lang))
  if (m.breadcrumb?.length) jsonLd.push(breadcrumbJsonLd(site, lang, m.breadcrumb))
  return {
    lang,
    path,
    title,
    description: m.description,
    canonical: abs(site, lang === 'en' ? enPath : thPath),
    alternates: { th: abs(site, thPath), en: abs(site, enPath) },
    image: `${site}${asset(m.image ?? PAGES_COVER)}`,
    noindex: !!m.noindex || def === NOT_FOUND,
    jsonLd,
    preload: m.preload,
  }
}

// The share image when a page names none: the first model's photo
const PAGES_COVER = (() => {
  const home = PAGES.find((p) => p.path === '')
  return home?.meta({ params: {}, lang: 'th', t: (k) => translate('th', k) }).image ?? 'favicon.svg'
})()

/** Turns site paths in an image field into absolute URLs (schema.org wants absolute). */
function absolutize(o: object, site: string): object {
  const copy = JSON.parse(JSON.stringify(o)) as Record<string, unknown>
  if (Array.isArray(copy.image)) copy.image = copy.image.map((p) => (typeof p === 'string' ? `${site}${asset(p)}` : p))
  else if (typeof copy.image === 'string') copy.image = `${site}${asset(copy.image)}`
  return copy
}

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function storeJsonLd(site: string, lang: Lang): object {
  const s = STATIC_STORE
  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: s.storeName,
    url: abs(site, localePath('/', lang)),
    telephone: s.phone,
    email: s.email,
    image: `${site}${asset(PAGES_COVER)}`,
    address: { '@type': 'PostalAddress', streetAddress: s.address, addressLocality: 'กรุงเทพมหานคร', addressCountry: 'TH' },
    openingHoursSpecification: s.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${DAY[h.day]}`,
      opens: h.open,
      closes: h.close,
    })),
    sameAs: [s.lineUrl],
  }
}

function breadcrumbJsonLd(site: string, lang: Lang, crumbs: { name: string; path: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(site, localePath(c.path, lang)) })),
  }
}

/** FAQPage structured data for a list of questions (for the FAQ page's meta). */
export function faqJsonLd(items: { q: string; a: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })),
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Everything that goes in <head> for a page, as HTML (used by the prerender script). */
export function headTags(m: ResolvedMeta): string {
  const name = translate(m.lang, 'site.name')
  const tags = [
    `<title>${esc(m.title)}</title>`,
    `<meta name="description" content="${esc(m.description)}" />`,
    m.noindex ? '<meta name="robots" content="noindex" />' : '',
    `<link rel="canonical" href="${esc(m.canonical)}" />`,
    `<link rel="alternate" hreflang="th" href="${esc(m.alternates.th)}" />`,
    `<link rel="alternate" hreflang="en" href="${esc(m.alternates.en)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${esc(m.alternates.th)}" />`,
    `<meta property="og:type" content="${m.path.startsWith('/models/') ? 'product' : 'website'}" />`,
    `<meta property="og:site_name" content="${esc(name)}" />`,
    `<meta property="og:locale" content="${m.lang === 'en' ? 'en_US' : 'th_TH'}" />`,
    `<meta property="og:locale:alternate" content="${m.lang === 'en' ? 'th_TH' : 'en_US'}" />`,
    `<meta property="og:title" content="${esc(m.title)}" />`,
    `<meta property="og:description" content="${esc(m.description)}" />`,
    `<meta property="og:url" content="${esc(m.canonical)}" />`,
    `<meta property="og:image" content="${esc(m.image)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${esc(m.title)}" />`,
    `<meta name="twitter:description" content="${esc(m.description)}" />`,
    `<meta name="twitter:image" content="${esc(m.image)}" />`,
  ]
  if (m.preload) {
    const set = srcSetFor(m.preload.src, 'avif')
    tags.push(
      set
        ? `<link rel="preload" as="image" type="image/avif" imagesrcset="${esc(set)}" imagesizes="${esc(m.preload.sizes)}" fetchpriority="high" />`
        : `<link rel="preload" as="image" href="${esc(asset(m.preload.src))}" fetchpriority="high" />`,
    )
  }
  for (const o of m.jsonLd) tags.push(`<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`)
  return tags.filter(Boolean).join('\n    ')
}

// ---------- In the browser ----------

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

function setLink(rel: string, href: string, hreflang?: string) {
  const sel = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]:not([hreflang])`
  let el = document.head.querySelector<HTMLLinkElement>(sel)
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    if (hreflang) el.hreflang = hreflang
    document.head.appendChild(el)
  }
  el.href = href
}

/** Applies a page's meta after client-side navigation (prerendered pages already carry it). */
export function applyMeta(m: ResolvedMeta) {
  document.title = m.title
  document.documentElement.lang = m.lang
  setMeta('name', 'description', m.description)
  setLink('canonical', m.canonical)
  setLink('alternate', m.alternates.th, 'th')
  setLink('alternate', m.alternates.en, 'en')
  setLink('alternate', m.alternates.th, 'x-default')
  setMeta('property', 'og:title', m.title)
  setMeta('property', 'og:description', m.description)
  setMeta('property', 'og:url', m.canonical)
  setMeta('property', 'og:image', m.image)
  setMeta('name', 'twitter:title', m.title)
  setMeta('name', 'twitter:description', m.description)
  setMeta('name', 'twitter:image', m.image)
  const robots = document.head.querySelector('meta[name="robots"]')
  if (m.noindex && !robots) setMeta('name', 'robots', 'noindex')
  else if (!m.noindex) robots?.remove()
  document.head.querySelectorAll('script[type="application/ld+json"]').forEach((s) => s.remove())
  for (const o of m.jsonLd) {
    const s = document.createElement('script')
    s.type = 'application/ld+json'
    s.textContent = JSON.stringify(o)
    document.head.appendChild(s)
  }
}

/** Keeps <head> in step with the current route (Layout calls it once). */
export function useRouteMeta() {
  const { pathname } = useLocation()
  const lang = useLang()
  useEffect(() => {
    applyMeta(resolveMeta(pathname, lang))
  }, [pathname, lang])
}
