import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { models } from '../data'
import { langOfPath, localePath, stripLang, translate } from '../i18n'
import { en } from '../i18n/en'
import { th } from '../i18n/th'
import { imageKey } from '../components/Picture'
import { PAGES } from '../routes'
import { renderAt } from '../test/render'
import { asset } from './asset'
import { headTags, resolveMeta } from './seo'

describe('language paths', () => {
  it('maps between in-language paths and full URLs', () => {
    expect(langOfPath('/en')).toBe('en')
    expect(langOfPath('/en/models/x')).toBe('en')
    expect(langOfPath('/english')).toBe('th')
    expect(stripLang('/en/compare')).toBe('/compare')
    expect(stripLang('/en')).toBe('/')
    expect(localePath('/', 'en')).toBe('/en')
    expect(localePath('/compare', 'en')).toBe('/en/compare')
    expect(localePath('/compare', 'th')).toBe('/compare')
  })

  it('has every Thai key in English and fills placeholders', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(th).sort())
    expect(translate('en', 'tray.go', { count: 2, limit: 3 })).toBe('Compare 2/3')
  })
})

describe('page meta', () => {
  const m = models[0]

  it('gives a model page its title, canonical, alternates, share image and product data', () => {
    const meta = resolveMeta(`/models/${m.id}`, 'th')
    expect(meta.title).toBe(`${m.nameEn} – Servo`)
    expect(meta.canonical).toMatch(new RegExp(`^https?://[^/]+/models/${m.id}$`))
    expect(meta.alternates.en).toMatch(new RegExp(`/en/models/${m.id}$`))
    expect(meta.image).toMatch(/^https?:\/\/.+\/images\/.+\.jpg$/)
    expect(meta.noindex).toBe(false)
    const types = meta.jsonLd.map((o) => (o as { '@type': string })['@type'])
    expect(types).toEqual(['Product', 'BreadcrumbList'])
    const html = headTags(meta)
    expect(html).toContain('<link rel="canonical"')
    expect(html).toContain('og:image')
  })

  it('writes English meta under /en and keeps unknown pages out of search', () => {
    const meta = resolveMeta('/compare', 'en')
    expect(meta.title).toBe('Compare models – Servo')
    expect(meta.canonical).toMatch(/\/en\/compare$/)
    expect(resolveMeta('/nope', 'th').noindex).toBe(true)
    expect(resolveMeta('/models/not-a-model', 'th').noindex).toBe(true)
  })

  it('adds the store to the home page and lists every page in one registry', () => {
    const types = resolveMeta('/', 'th').jsonLd.map((o) => (o as { '@type': string })['@type'])
    expect(types).toContain('Store')
    const paths = PAGES.map((p) => p.path)
    expect(paths).toEqual(expect.arrayContaining(['', 'models/:id', 'compare', 'guide', 'sources', 'contact', 'booking', 'faq', 'privacy']))
  })
})

describe('assets', () => {
  it('serves catalogue images from the site root and shares sources between a photo and its small copy', () => {
    expect(asset('images/x.jpg')).toBe('/images/x.jpg')
    expect(asset('/images/x.jpg')).toBe('/images/x.jpg')
    expect(asset('https://example.com/a.jpg')).toBe('https://example.com/a.jpg')
    expect(imageKey('images/unitree-g1-sm.jpg')).toBe('unitree-g1')
    expect(imageKey('/images/gallery/unitree-g1/2.jpg')).toBe('gallery/unitree-g1/2')
  })
})

describe('English shell', () => {
  it('renders the menu in English under /en', () => {
    renderAt('/en/compare')
    const nav = screen.getByRole('navigation', { name: 'Main menu' })
    expect(within(nav).getByRole('link', { name: 'Compare' })).toHaveClass('active')
    expect(screen.getByRole('link', { name: 'ภาษาไทย' })).toHaveAttribute('href', '/compare')
  })
})
