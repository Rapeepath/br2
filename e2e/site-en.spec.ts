import { readFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// English pages, the model gallery and reviews (site.spec.ts covers the Thai pages).
interface ModelLite {
  id: string
  nameEn: string
  gallery?: unknown[]
}
const models: ModelLite[] = JSON.parse(readFileSync(new URL('../src/data/models.json', import.meta.url), 'utf8'))
const withGallery = models.find((m) => (m.gallery?.length ?? 0) >= 2) ?? models[0]
const slides = 1 + (withGallery.gallery?.length ?? 0)

const EN_ROUTES = [
  { name: 'home', path: '/en' },
  { name: 'model', path: `/en/models/${withGallery.id}` },
  { name: 'compare', path: '/en/compare' },
  { name: 'guide', path: '/en/guide' },
  { name: 'sources', path: '/en/sources' },
]

const setCompare = (page: Page, ids: string[]) =>
  page.addInitScript((list) => localStorage.setItem('servo.compare', JSON.stringify(list)), ids)

function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`)
  })
  return errors
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
}

/** Thai text in <main> outside anything marked lang="th" (Thai source titles keep their own language). */
const strayThai = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = []
    const walker = document.createTreeWalker(document.querySelector('main')!, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      const text = node.textContent ?? ''
      if (!/[฀-๿]/.test(text)) continue
      const el = node.parentElement
      if (el?.closest('[lang="th"], [hreflang="th"], .visually-hidden[lang]')) continue
      out.push(text.trim().slice(0, 50))
    }
    return out
  })

for (const route of EN_ROUTES) {
  test.describe(`English ${route.name} page`, () => {
    test('is in English, clean, and fits the screen', async ({ page }) => {
      const errors = watchErrors(page)
      await setCompare(page, models.slice(0, 3).map((m) => m.id))
      await page.goto(route.path)
      await settle(page)
      await expect(page.locator('html')).toHaveAttribute('lang', 'en')
      expect(await strayThai(page), 'Thai text on the English page').toEqual([])
      const deviceWidth = page.viewportSize()!.width
      const widest = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth))
      expect(widest - deviceWidth, 'horizontal overflow (px)').toBeLessThanOrEqual(0)
      expect(errors, 'console/network errors').toEqual([])
    })

    for (const theme of ['light', 'dark'] as const) {
      test(`has no serious accessibility violations (${theme})`, async ({ page }) => {
        test.setTimeout(90_000)
        await page.addInitScript((t) => localStorage.setItem('servo.theme', t), theme)
        await setCompare(page, models.slice(0, 3).map((m) => m.id))
        await page.goto(route.path)
        await settle(page)
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
        const serious = results.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => `${v.id}: ${v.help} | ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
        expect(serious).toEqual([])
      })
    }
  })
}

test('the guide and sources in English link to the full Thai pages', async ({ page }) => {
  for (const path of ['/en/guide', '/en/sources']) {
    await page.goto(path)
    const link = page.getByRole('link', { name: 'Full detail in Thai' })
    await expect(link).toHaveAttribute('href', path.replace('/en', ''))
    await expect(link).toHaveAttribute('hreflang', 'th')
  }
})

test('the gallery lightbox opens, moves with the keyboard, closes with Escape and returns focus', async ({ page }) => {
  await page.goto(`/models/${withGallery.id}`)
  await settle(page)
  const gallery = page.getByRole('region', { name: 'ภาพและวิดีโอ' }).or(page.locator('section.gal'))
  const thumbs = gallery.locator('.gal__thumb')
  await expect(thumbs).toHaveCount(slides)
  await thumbs.first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const counter = dialog.locator('.gal__counter')
  await expect(counter).toHaveText(`1 / ${slides}`)
  await page.keyboard.press('ArrowRight')
  await expect(counter).toHaveText(`2 / ${slides}`)
  await page.keyboard.press('End')
  await expect(counter).toHaveText(`${slides} / ${slides}`)
  await page.keyboard.press('Home')
  await expect(counter).toHaveText(`1 / ${slides}`)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(thumbs.first()).toBeFocused()
})

test('a review is sent for checking, in Thai and in English', async ({ page }) => {
  for (const [path, done] of [
    [`/models/${models[0].id}`, 'รีวิวจะแสดงหลังผู้จัดการตรวจสอบ'],
    [`/en/models/${models[0].id}`, 'It will appear once a manager has checked it'],
  ] as const) {
    await page.goto(path)
    await settle(page)
    const en = path.startsWith('/en')
    // The form opens from one button, so the section reads as reviews first
    const write = page.getByRole('button', { name: en ? 'Write a review' : 'เขียนรีวิว' })
    await write.scrollIntoViewIfNeeded()
    await write.click()
    const form = page.locator('form.rv-form')
    await expect(form.getByLabel(en ? 'Display name' : 'ชื่อที่แสดง')).toBeFocused()
    // Sending without a rating names what to fix
    await form.getByLabel(en ? 'Display name' : 'ชื่อที่แสดง').fill('e2e reviewer')
    await form.getByRole('button', { name: en ? 'Send review' : 'ส่งรีวิว' }).click()
    await expect(form.getByRole('alert')).toBeVisible()
    await form.getByRole('radio', { name: en ? '4 stars' : '4 ดาว' }).check()
    await form.getByLabel(en ? 'Your experience' : 'ประสบการณ์ของคุณ').fill('Saw it at a demonstration; it walks smoothly.')
    await form.getByRole('checkbox').check()
    await form.getByRole('button', { name: en ? 'Send review' : 'ส่งรีวิว' }).click()
    await expect(page.getByRole('status').filter({ hasText: done })).toBeVisible()
  }
})

test('compare columns lead on to the configurator', async ({ page }) => {
  await setCompare(page, models.slice(0, 2).map((m) => m.id))
  await page.goto('/compare')
  const links = page.locator('.cmp-model__configure')
  await expect(links).toHaveCount(2)
  await expect(links.first()).toHaveAttribute('href', `/configure/${models[0].id}`)
})
