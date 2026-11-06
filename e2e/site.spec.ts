import { readFileSync } from 'node:fs'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { CATEGORY_BRIEF } from '../src/lib/format'
import type { Category } from '../src/lib/types'

interface ModelLite {
  id: string
  nameEn: string
  category: Category
  heightCm: number
}
// Read the generated catalogue so the tests follow the data, whatever the lineup is.
const models: ModelLite[] = JSON.parse(readFileSync(new URL('../src/data/models.json', import.meta.url), 'utf8'))
const byLongestName = [...models].sort((a, b) => b.nameEn.length - a.nameEn.length)
// The first model's category, so the filter tests follow the data whatever the lineup is
const category = models[0].category
const inCategory = models.filter((m) => m.category === category)

const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'model', path: `/models/${models[0].id}` },
  { name: 'compare', path: '/compare' },
  { name: 'guide', path: '/guide' },
  { name: 'sources', path: '/sources' },
]

const setCompare = (page: Page, ids: string[]) =>
  page.addInitScript((list) => localStorage.setItem('servo.compare', JSON.stringify(list)), ids)

/** Collects console errors and failed requests so every test can assert a clean page. */
function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`))
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`)
  })
  return errors
}

async function settle(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
}

async function loadAllImages(page: Page) {
  // Lazy images only load near the viewport; scroll through the page so all of them are fetched.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 40))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForLoadState('networkidle')
}

for (const route of ROUTES) {
  test.describe(`${route.name} page`, () => {
    test('renders cleanly: no errors, no broken images, no sideways scroll', async ({ page }) => {
      const errors = watchErrors(page)
      await setCompare(page, models.slice(0, 2).map((m) => m.id))
      await page.goto(route.path)
      await settle(page)
      await loadAllImages(page)

      const broken = await page.$$eval('img', (imgs) =>
        imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')),
      )
      expect(broken, 'broken images').toEqual([])

      // Mobile emulation stretches innerWidth to fit wide content, so measure against the device width.
      const deviceWidth = page.viewportSize()!.width
      const widest = await page.evaluate(() =>
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, window.innerWidth),
      )
      expect(widest - deviceWidth, 'horizontal overflow (px)').toBeLessThanOrEqual(0)

      expect(errors, 'console/network errors').toEqual([])
    })

    for (const theme of ['light', 'dark'] as const) {
      test(`has no serious accessibility violations (${theme})`, async ({ page }) => {
        // The full-page screenshot of the longest pages at a phone's pixel density takes a while
        test.setTimeout(120_000)
        await page.addInitScript((t) => localStorage.setItem('servo.theme', t), theme)
        await setCompare(page, models.slice(0, 3).map((m) => m.id))
        await page.goto(route.path)
        await settle(page)
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
        const serious = results.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => `${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
        expect(serious).toEqual([])

        await loadAllImages(page)
        await page.screenshot({
          path: `e2e/screenshots/${test.info().project.name}-${route.name}-${theme}.png`,
          fullPage: true,
        })
      })
    }
  })
}

test('browse → filter → open a model → back keeps the filter', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('radio', { name: CATEGORY_BRIEF[category], exact: true }).check()
  await expect(page).toHaveURL(new RegExp(`category=${category}`))
  const grid = page.locator('.model-grid')
  await expect(grid.getByRole('heading', { level: 3 })).toHaveCount(inCategory.length)

  await grid.getByRole('link', { name: inCategory[0].nameEn, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(inCategory[0].nameEn)

  await page.getByRole('tab').last().click()
  await expect(page.getByRole('tabpanel')).toBeVisible()

  await page.goBack()
  await expect(page.getByRole('radio', { name: CATEGORY_BRIEF[category], exact: true })).toBeChecked()
  await expect(grid.getByRole('heading', { level: 3 })).toHaveCount(inCategory.length)
})

test('compare three models from the catalogue', async ({ page }) => {
  await page.goto('/')
  const add = page.getByRole('button', { name: /เพิ่มเพื่อเปรียบเทียบ/ })
  for (let i = 0; i < 3; i++) await add.first().click()
  await expect(page.getByRole('button', { name: /อยู่ในรายการเปรียบเทียบ/ })).toHaveCount(3)

  const tray = page.getByRole('complementary', { name: 'รายการเปรียบเทียบ' })
  await expect(tray).toBeVisible()
  await tray.getByRole('link', { name: /เปรียบเทียบ 3\/3/ }).click()

  const table = page.getByRole('table').first()
  await expect(table.getByRole('columnheader')).toHaveCount(3)
  await expect(tray).toBeHidden()

  // The choice survives a reload.
  await page.reload()
  await expect(page.getByRole('table').first().getByRole('columnheader')).toHaveCount(3)
})

test('theme toggle switches and remembers dark mode', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'เปลี่ยนเป็นธีมมืด' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('button', { name: 'เปลี่ยนเป็นธีมสว่าง' })).toBeVisible()
})

test('keyboard: skip link and tab arrows work', async ({ page }) => {
  await page.goto(`/models/${models[1].id}`)
  await settle(page)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'ข้ามไปยังเนื้อหา' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('#main')).toBeFocused()

  const tabs = page.getByRole('tab')
  await page.getByRole('tab', { name: 'ภาพรวม' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(tabs.nth(1)).toBeFocused()
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
})

test.describe('regressions', () => {
  test('every route reflows at 320px with a full compare tray (WCAG 1.4.10)', async ({ page }) => {
    await setCompare(page, byLongestName.slice(0, 3).map((m) => m.id))
    await page.setViewportSize({ width: 320, height: 720 })
    for (const route of ROUTES) {
      await page.goto(route.path)
      await settle(page)
      const widest = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth))
      expect(widest, `${route.name} width at 320px`).toBeLessThanOrEqual(320)

      // Nothing inside the floating tray may overlap anything else in it.
      const boxes = await page.$$eval('.compare-tray li, .compare-tray .btn', (els) =>
        els
          .map((e) => e.getBoundingClientRect())
          .filter((r) => r.width > 0)
          .map((r) => ({ l: r.left, r: r.right, t: r.top, b: r.bottom })),
      )
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]
          const b = boxes[j]
          const overlap = a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1
          expect(overlap, `${route.name}: tray items ${i} and ${j} overlap`).toBe(false)
        }
    }
  })

  for (const width of [700, 820, 1100]) {
    test(`the tray never overlaps itself at ${width}px with long names`, async ({ page }) => {
      await setCompare(page, byLongestName.slice(0, 3).map((m) => m.id))
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/guide')
      await settle(page)
      const boxes = await page.$$eval('.compare-tray li, .compare-tray .btn', (els) =>
        els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0),
      )
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const [a, b] = [boxes[i], boxes[j]]
          const overlap = a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
          expect(overlap, `items ${i} and ${j} overlap`).toBe(false)
        }
    })
  }

  test('self-disabling buttons hand focus on (compare "เพิ่ม", checklist "เริ่มใหม่")', async ({ page }) => {
    await setCompare(page, models.slice(0, 2).map((m) => m.id))
    await page.goto('/compare')
    await settle(page)
    await page.getByLabel('เพิ่มรุ่น').selectOption(models[2].id)
    await page.getByRole('button', { name: 'เพิ่ม', exact: true }).click()
    await expect(page.getByRole('table').first().getByRole('columnheader')).toHaveCount(3)
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')

    await page.goto('/guide')
    await settle(page)
    await page.getByRole('checkbox').first().check()
    await page.getByRole('button', { name: 'เริ่มใหม่' }).click()
    await expect(page.getByRole('checkbox').first()).toBeFocused()
  })

  test('the phone price chart keeps column headers for screen readers', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto('/guide')
    await settle(page)
    const chart = page.getByRole('table', { name: /ช่วงราคา/ })
    expect(await chart.getByRole('columnheader').count()).toBeGreaterThanOrEqual(2)
  })

  test('the model pager keeps the filtered list for the way back', async ({ page }) => {
    await page.goto(`/?category=${category}`)
    await settle(page)
    await page.locator('.model-grid').getByRole('link', { name: inCategory[0].nameEn, exact: true }).click()
    await page.getByRole('link', { name: /ถัดไป/ }).click()
    await page.getByRole('link', { name: 'หุ่นยนต์ทั้งหมด' }).click()
    await expect(page).toHaveURL(new RegExp(`category=${category}`))
    await expect(page.locator('.model-grid').getByRole('heading', { level: 3 })).toHaveCount(inCategory.length)
    await expect(page.locator('#models')).toBeFocused()
  })

  test('each route has its own document title', async ({ page }) => {
    const titles = new Set<string>()
    for (const route of ROUTES) {
      await page.goto(route.path)
      await settle(page)
      titles.add(await page.title())
    }
    expect(titles.size).toBe(ROUTES.length)
  })

  test('removing models from the tray never drops focus to <body>', async ({ page }) => {
    await setCompare(page, models.slice(0, 2).map((m) => m.id))
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/guide')
    await settle(page)
    const tray = page.getByRole('complementary', { name: 'รายการเปรียบเทียบ' })
    await tray.getByRole('button', { name: `นำ ${models[0].nameEn} ออกจากรายการเปรียบเทียบ` }).click()
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')
    await tray.getByRole('button', { name: `นำ ${models[1].nameEn} ออกจากรายการเปรียบเทียบ` }).click()
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')
    await expect(tray).toBeHidden()
  })

  test('the last model tab is reachable on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 })
    await page.goto(`/models/${byLongestName[0].id}`)
    await settle(page)
    const last = page.getByRole('tab').last()
    await page.getByRole('tab', { name: 'ภาพรวม' }).focus()
    await page.keyboard.press('End')
    await expect(last).toBeFocused()
    await expect(last).toBeInViewport()
    // Loading a model page must not scroll the page down to the tabs.
    await page.reload()
    await settle(page)
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
  })
})

test.describe('showroom stage (motion on)', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('switches models from the rail with the keyboard, scans the photo and settles the readouts', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/')
    await settle(page)
    await expect(page.locator('html')).toHaveClass(/motion-ok/)

    const rail = page.getByRole('tablist', { name: 'เลือกรุ่นที่จะแสดง' })
    const tabs = rail.getByRole('tab')
    await expect(tabs).toHaveCount(models.length)
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')

    await tabs.first().focus()
    await page.keyboard.press('ArrowRight')
    await expect(tabs.nth(1)).toBeFocused()
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')

    const panel = page.getByRole('tabpanel')
    const next = models[1]
    await expect(panel.getByRole('heading', { level: 2 })).toContainText(next.nameEn.split(' ').at(-1)!)
    // The scan line runs, then the photo underneath is dropped
    await expect(page.locator('.stage__scan')).toHaveCount(1)
    await expect(page.locator('.stage__img--under')).toHaveCount(0, { timeout: 4000 })
    // Readouts end on the real figures (screen readers only ever get the final value)
    await expect(panel.locator('.stage__readouts')).toContainText(`${next.heightCm.toLocaleString('th-TH')} ซม.`)

    await page.keyboard.press('End')
    await expect(tabs.last()).toHaveAttribute('aria-selected', 'true')
    await panel.getByRole('link', { name: new RegExp(`ดูสเปกและราคา ${models.at(-1)!.nameEn}`) }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(models.at(-1)!.nameEn)
    expect(errors).toEqual([])
  })

  test('lineup cards reveal as they scroll into view', async ({ page }) => {
    await page.goto('/')
    await settle(page)
    const last = page.locator('.model-grid > li').last()
    await last.scrollIntoViewIfNeeded()
    await expect(last).toHaveClass(/is-in/)
    await expect(last).toHaveCSS('opacity', '1', { timeout: 3000 })
  })
})

test.describe('real URLs, prerendered pages and the English mirror', () => {
  test('old #/ links open the same page at its real address', async ({ page }) => {
    await page.goto(`/#/models/${models[1].id}`)
    await expect(page).toHaveURL(new RegExp(`/models/${models[1].id}$`))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(models[1].nameEn)
  })

  test('pages arrive as HTML with their meta; unknown paths answer 404; sitemap and robots exist', async ({ request }) => {
    const res = await request.get(`/models/${models[0].id}`)
    expect(res.status()).toBe(200)
    const html = await res.text()
    expect(html).toContain(`<title>${models[0].nameEn} – Servo</title>`)
    expect(html).toMatch(/<meta property="og:image" content="https?:\/\/[^"]+\/images\/[^"]+"/)
    expect(html).toContain(`hreflang="en" href="`)
    expect(html).toContain('application/ld+json')
    expect(html).toMatch(/<h1[^>]*>/)

    const missing = await request.get('/no-such-page')
    expect(missing.status()).toBe(404)
    expect(await missing.text()).toContain('noindex')

    const sitemap = await (await request.get('/sitemap.xml')).text()
    expect(sitemap).toContain(`/models/${models[0].id}</loc>`)
    expect(sitemap).toContain(`/en/models/${models[0].id}</loc>`)
    expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /admin')
  })

  test('English pages keep their language while browsing, and the switch returns to Thai', async ({ page }) => {
    await page.goto('/en/compare')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    const nav = page.getByRole('navigation', { name: 'Main menu' })
    await nav.getByRole('link', { name: 'Robots' }).click()
    await expect(page).toHaveURL(/\/en$/)
    await page.locator('.model-grid').getByRole('link', { name: models[0].nameEn, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/en/models/${models[0].id}$`))
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/en/models/${models[0].id}$`))
    await page.getByRole('link', { name: 'ภาษาไทย' }).click()
    await expect(page).toHaveURL(new RegExp(`/models/${models[0].id}$`))
    await expect(page.locator('html')).toHaveAttribute('lang', 'th')
    await expect(page).toHaveTitle(`${models[0].nameEn} – Servo`)
  })
})