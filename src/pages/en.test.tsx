import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { en, models } from '../data'
import { localized } from '../i18n/content'
import { hasThai } from '../lib/bilingual'
import { renderAt } from '../test/render'

const withGallery = models.find((m) => m.gallery.length >= 2)!
const plain = (s: string | null | undefined) => (s ?? '').replace(/\u2060/g, '').replace(/\s+/g, ' ').trim()

/** Answers the reviews API (and anything else) the way the showroom's POS would */
function mockFetch(reviews: { average: number | null; count: number; rows: unknown[] }, post?: (body: unknown) => Response) {
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url)
    if (u.startsWith('/api/public/reviews') && (!init || init.method !== 'POST')) {
      return new Response(JSON.stringify(reviews), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (u === '/api/public/reviews' && init?.method === 'POST') {
      return post ? post(JSON.parse(String(init.body))) : new Response(JSON.stringify({ status: 'pending' }), { status: 200 })
    }
    return new Response('{}', { status: 404 })
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('English content overlay', () => {
  it('keeps every trim price and spec while taking the English text', () => {
    for (const m of models) {
      const e = localized(m, 'en')
      expect(e.trims.map((t) => t.priceTHB)).toEqual(m.trims.map((t) => t.priceTHB))
      expect(e.trims.map((t) => t.dof)).toEqual(m.trims.map((t) => t.dof))
      expect(e.summary).toBe(en.records[m.id].summary)
      expect(hasThai(e.tagline)).toBe(false)
      expect(e.gallery.map((g) => g.src)).toEqual(m.gallery.map((g) => g.src))
      e.gallery.forEach((g, i) => expect(g.alt).toBe(en.records[m.id].gallery[i].alt))
    }
  })
})

describe('English pages', () => {
  it('renders the home page and lineup in English', () => {
    mockFetch({ average: null, count: 0, rows: [] })
    renderAt('/en')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/humanoid robots/)
    expect(screen.getByRole('heading', { name: 'All robots' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search robots' })).toBeInTheDocument()
    const card = screen.getByRole('heading', { level: 3, name: models[0].nameEn }).closest('article')!
    expect(card.textContent).toContain('baht')
    expect(hasThai(card.textContent ?? '')).toBe(false)
  })

  it('renders a model page in English, every tab included', async () => {
    mockFetch({ average: null, count: 0, rows: [] })
    const user = userEvent.setup()
    const m = models[0]
    renderAt(`/en/models/${m.id}`)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(m.nameEn)
    expect(screen.queryByText(m.nameTh)).not.toBeInTheDocument()
    expect(plain(document.querySelector('.mp-lede')?.textContent)).toBe(plain(en.records[m.id].summary))
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.querySelector('.tabs__full')?.textContent ?? t.textContent)).toEqual([
      'Overview',
      'Trims and prices',
      'Size and systems',
      'Safety and warranty',
      'Before you buy',
    ])
    for (const tab of tabs) {
      await user.click(tab)
      const panel = screen.getByRole('tabpanel')
      // Proper names aside, the panel reads in English
      const text = plain(panel.textContent).replace(new RegExp(m.distributor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')
      expect(hasThai(text), `${tab.textContent} panel`).toBe(false)
    }
  })

  it('renders the comparison in English', () => {
    localStorage.setItem('servo.compare', JSON.stringify(models.slice(0, 2).map((m) => m.id)))
    renderAt('/en/compare')
    const table = screen.getByRole('table')
    expect(within(table).getByRole('rowheader', { name: 'Starting price' })).toBeInTheDocument()
    expect(within(table).getAllByRole('link', { name: /Configure and get a quote/ })).toHaveLength(2)
    expect(hasThai(table.textContent ?? '')).toBe(false)
  })

  it('sums up all eight guide sections in English and links to the Thai guide', () => {
    renderAt('/en/guide')
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    for (const t of ['Market overview', 'Buyer’s checklist', 'Preparing the space', 'Where to buy in Thailand', 'Electricity per charge', 'Yearly running costs', 'Prices by model', 'Incentives and the law']) {
      expect(titles).toContain(t)
    }
    expect(screen.getByRole('link', { name: 'Full detail in Thai' })).toHaveAttribute('href', '/guide')
    expect(hasThai(document.querySelector('main')!.textContent ?? '')).toBe(false)
  })

  it('credits every main photo and gallery item on the English sources page', () => {
    renderAt('/en/sources')
    const credits = screen.getByRole('heading', { name: 'Photo credits' }).closest('section')!
    const total = models.length + models.reduce((n, m) => n + m.gallery.length, 0)
    expect(within(credits).getAllByRole('listitem')).toHaveLength(total)
    expect(screen.getByRole('link', { name: 'Full detail in Thai' })).toHaveAttribute('href', '/sources')
  })

  it('lists the gallery credits on the Thai sources page too', () => {
    renderAt('/sources')
    const section = screen.getByRole('heading', { name: 'เครดิตภาพและวิดีโอในแกลเลอรี' }).closest('section')!
    expect(within(section).getAllByRole('listitem')).toHaveLength(models.reduce((n, m) => n + m.gallery.length, 0))
  })
})

describe('model gallery', () => {
  it('opens on the photo pressed, moves with the arrow keys and gives focus back on close', async () => {
    mockFetch({ average: null, count: 0, rows: [] })
    const user = userEvent.setup()
    renderAt(`/models/${withGallery.id}`)
    const region = screen.getByRole('region', { name: 'ภาพและวิดีโอ' })
    const thumbs = within(region).getAllByRole('button')
    expect(thumbs).toHaveLength(1 + withGallery.gallery.length)
    await user.click(thumbs[1])
    const dialog = document.querySelector('dialog.gal__dialog') as HTMLDialogElement
    expect(dialog.open).toBe(true)
    const counter = () => dialog.querySelector('.gal__counter')?.textContent
    expect(counter()).toBe(`2 / ${thumbs.length}`)
    fireEvent.keyDown(dialog, { key: 'ArrowRight' })
    expect(counter()).toBe(`3 / ${thumbs.length}`)
    fireEvent.keyDown(dialog, { key: 'Home' })
    expect(counter()).toBe(`1 / ${thumbs.length}`)
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' })
    expect(counter()).toBe(`${thumbs.length} / ${thumbs.length}`)
    // Every slide credits its author and licence
    expect(dialog.querySelector('.gal__credit')?.textContent).toContain(withGallery.gallery.at(-1)!.author)
    await user.click(within(dialog).getByRole('button', { name: 'ปิด' }))
    // jsdom may not fire the dialog's close event itself
    fireEvent(dialog, new Event('close'))
    // Back on the thumbnail of the slide that was showing
    expect(thumbs.at(-1)).toHaveFocus()
  })
})

describe('reviews', () => {
  it('invites the first review when none is approved, and never claims a rating', async () => {
    mockFetch({ average: null, count: 0, rows: [] })
    renderAt(`/models/${models[0].id}`)
    expect(await screen.findByText(`ยังไม่มีรีวิวของ ${models[0].nameEn}`)).toBeInTheDocument()
    expect(document.querySelector('.rv script[type="application/ld+json"]')).toBeNull()
  })

  it('shows approved reviews with their average and the rating data', async () => {
    mockFetch({
      average: 4.5,
      count: 2,
      rows: [
        { id: 'r1', name: 'ผู้ใช้ทดสอบ', rating: 5, title: 'ดีมาก', body: 'เดินได้นิ่งมาก ใช้งานง่าย', lang: 'th', createdAt: '2026-11-01T03:00:00Z' },
        { id: 'r2', name: 'Tester', rating: 4, title: null, body: 'Smooth and easy to set up.', lang: 'en', createdAt: '2026-11-02T03:00:00Z' },
      ],
    })
    renderAt(`/models/${models[0].id}`)
    expect(await screen.findByText('เดินได้นิ่งมาก ใช้งานง่าย')).toBeInTheDocument()
    expect(screen.getByText('จาก 5 (2 รีวิว)')).toBeInTheDocument()
    expect(screen.getByText('Smooth and easy to set up.').closest('li')).toHaveAttribute('lang', 'en')
    const ld = JSON.parse(document.querySelector('.rv script[type="application/ld+json"]')!.textContent!)
    expect(ld.aggregateRating).toMatchObject({ ratingValue: 4.5, reviewCount: 2 })
  })

  it('checks the form, sends it with consent and the honeypot, and says it waits for a manager', async () => {
    const posted: unknown[] = []
    mockFetch({ average: null, count: 0, rows: [] }, (body) => {
      posted.push(body)
      return new Response(JSON.stringify({ status: 'pending' }), { status: 200 })
    })
    const user = userEvent.setup()
    renderAt(`/models/${models[0].id}`)
    // The form is folded behind one button until someone wants to write
    await user.click(await screen.findByRole('button', { name: 'เขียนรีวิว' }))
    const form = (await screen.findByText(`เขียนรีวิว ${models[0].nameEn}`)).closest('form')!
    await user.click(within(form).getByRole('button', { name: 'ส่งรีวิว' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('กรอกชื่อที่จะแสดงกับรีวิว')
    expect(within(form).getByLabelText('ชื่อที่แสดง')).toHaveFocus()
    await user.type(within(form).getByLabelText('ชื่อที่แสดง'), 'คุณทดสอบ')
    await user.click(within(form).getByRole('radio', { name: '4 ดาว' }))
    await user.type(within(form).getByLabelText('ประสบการณ์ของคุณ'), 'ได้ชมการสาธิตแล้ว เดินได้นิ่ง')
    await user.click(within(form).getByRole('button', { name: 'ส่งรีวิว' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('ติ๊กยินยอม')
    await user.click(within(form).getByRole('checkbox'))
    await user.click(within(form).getByRole('button', { name: 'ส่งรีวิว' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('รีวิวจะแสดงหลังผู้จัดการตรวจสอบ'))
    expect(posted[0]).toMatchObject({ refId: models[0].id, rating: 4, consent: true, website: '', lang: 'th' })
  })

  it('shows the server’s English message on the English page', async () => {
    mockFetch({ average: null, count: 0, rows: [] }, () =>
      new Response(JSON.stringify({ error: 'เล่าประสบการณ์อย่างน้อย 10 ตัวอักษร', errorEn: 'Please write at least 10 characters.', code: 'VALIDATION', field: 'body' }), { status: 400 }),
    )
    const user = userEvent.setup()
    renderAt(`/en/models/${models[0].id}`)
    await user.click(await screen.findByRole('button', { name: 'Write a review' }))
    const form = (await screen.findByText(`Review the ${models[0].nameEn}`)).closest('form')!
    await user.type(within(form).getByLabelText('Display name'), 'Tester')
    await user.click(within(form).getByRole('radio', { name: '5 stars' }))
    await user.type(within(form).getByLabelText('Your experience'), 'Long enough text here')
    await user.click(within(form).getByRole('checkbox'))
    await user.click(within(form).getByRole('button', { name: 'Send review' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent('Please write at least 10 characters.')
  })
})
