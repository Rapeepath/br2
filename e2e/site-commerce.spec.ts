import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// The showroom's service pages: contact, booking, FAQ, privacy, after-sales, finance, configure → quotation,
// solutions. They talk to the preview server's freshly seeded POS database (playwright.config.ts).

const ROUTES = [
  { name: 'contact', path: '/contact' },
  { name: 'booking', path: '/booking' },
  { name: 'faq', path: '/faq' },
  { name: 'privacy', path: '/privacy' },
  { name: 'service', path: '/service' },
  { name: 'finance', path: '/finance' },
  { name: 'configure', path: '/configure/unitree-g1' },
  { name: 'solutions', path: '/solutions' },
  { name: 'solution', path: '/solutions/research' },
  { name: 'en-contact', path: '/en/contact' },
  { name: 'en-configure', path: '/en/configure/nao6' },
]

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

const widest = (page: Page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth))

for (const route of ROUTES) {
  test.describe(`${route.name} page`, () => {
    test('renders cleanly with no errors or sideways scroll', async ({ page }) => {
      const errors = watchErrors(page)
      await page.goto(route.path)
      await settle(page)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await widest(page)).toBeLessThanOrEqual(page.viewportSize()!.width)
      expect(errors).toEqual([])
    })

    for (const theme of ['light', 'dark'] as const) {
      test(`has no serious accessibility violations (${theme})`, async ({ page }) => {
        test.setTimeout(90_000)
        await page.addInitScript((t) => localStorage.setItem('servo.theme', t), theme)
        await page.goto(route.path)
        await settle(page)
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
        const serious = results.violations
          .filter((v) => v.impact === 'serious' || v.impact === 'critical')
          .map((v) => `${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
        expect(serious).toEqual([])
        await page.screenshot({ path: `e2e/screenshots/${test.info().project.name}-commerce-${route.name}-${theme}.png`, fullPage: true })
      })
    }
  })
}

test('every service page reflows at 320px (WCAG 1.4.10)', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one width sweep is enough')
  await page.setViewportSize({ width: 320, height: 720 })
  for (const r of ROUTES) {
    await page.goto(r.path)
    await settle(page)
    expect(await widest(page), `${r.name} at 320px`).toBeLessThanOrEqual(320)
  }
})

test('contact: sends an inquiry and shows its reference', async ({ page }) => {
  await page.goto('/contact?model=nao6')
  await expect(page.getByRole('checkbox', { name: 'Maxtronics NAO6' })).toBeChecked()
  await page.getByRole('button', { name: 'ส่งข้อความ' }).click()
  await expect(page.getByText('กรอกชื่อ', { exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: /ชื่อ–นามสกุล/ })).toBeFocused()

  await page.getByRole('textbox', { name: /ชื่อ–นามสกุล/ }).fill('ผู้ทดสอบ อัตโนมัติ')
  await page.getByRole('textbox', { name: /เบอร์โทรศัพท์/ }).fill('081-234-5678')
  await page.getByRole('textbox', { name: /ข้อความ/ }).fill('ขอราคา NAO6 สำหรับโรงเรียน 3 เครื่อง')
  await page.getByRole('checkbox', { name: /ยินยอม/ }).check()
  await page.getByRole('button', { name: 'ส่งข้อความ' }).click()
  await expect(page.getByRole('status').getByText(/^LD\d{6}-\d{4}$/)).toBeVisible()
})

test('booking: picks a free slot, confirms, and offers a calendar file', async ({ page }, info) => {
  await page.goto('/booking?model=unitree-g1')
  await settle(page)
  // Desktop and mobile run side by side on one database: take different days so they never race for a slot
  const days = page.locator('.cal__day:not([data-closed]) input:not([disabled])')
  await days.nth(info.project.name === 'desktop' ? 2 : 5).check()
  const slots = page.locator('.slot input:not([disabled])')
  await expect(slots.first()).toBeVisible()
  await (info.project.name === 'desktop' ? slots.first() : slots.last()).check()
  await page.getByRole('textbox', { name: /ชื่อ–นามสกุล/ }).fill('ผู้ทดสอบ นัดหมาย')
  await page.getByRole('textbox', { name: /เบอร์โทรศัพท์/ }).fill('089-111-2222')
  await page.getByRole('checkbox', { name: /ยินยอม/ }).check()
  await page.getByRole('button', { name: 'ยืนยันการนัด' }).click()
  const done = page.getByRole('status').filter({ hasText: 'นัดหมายเรียบร้อย' })
  await expect(done.getByText(/^BK\d{6}-\d{4}$/)).toBeVisible()
  const ics = done.getByRole('link', { name: /เพิ่มลงปฏิทิน/ })
  await expect(ics).toHaveAttribute('download', /\.ics$/)
})

test('configure → quotation: prices the build, requests a quote and opens the printable document', async ({ page }) => {
  await page.goto('/configure/nao6')
  await settle(page)
  const summary = page.getByRole('complementary', { name: 'สรุปรายการ' })
  await expect(summary.getByText('NAO6', { exact: true })).toBeVisible()
  await page.getByRole('checkbox', { name: /เราเตอร์ Wi-Fi 6/ }).check()
  await page.getByRole('button', { name: /เพิ่มจำนวน เราเตอร์/ }).click()
  await expect(summary.getByText('×2')).toBeVisible()
  await page.locator('.fin-seg__opt', { hasText: 'เช่าซื้อ' }).first().click()
  await expect(summary.getByText(/ค่างวดประมาณ/)).toBeVisible()

  await page.getByRole('textbox', { name: /ชื่อผู้ติดต่อ/ }).fill('ผู้ทดสอบ ใบเสนอราคา')
  await page.getByRole('textbox', { name: /เบอร์โทรศัพท์/ }).fill('02-555-1234')
  await page.getByRole('textbox', { name: /ชื่อบริษัท/ }).fill('โรงเรียนทดสอบวิทยา')
  await page.getByRole('textbox', { name: /เลขประจำตัวผู้เสียภาษี/ }).fill('0994000223453')
  await page.getByRole('checkbox', { name: /ยินยอม/ }).check()
  await page.getByRole('button', { name: 'ขอใบเสนอราคา' }).click()

  await expect(page).toHaveURL(/\/quote\/QT\d{6}-\d{4}\?t=/)
  const doc = page.getByRole('article', { name: 'ใบเสนอราคา' })
  await expect(doc.getByText(/^QT\d{6}-\d{4}$/)).toBeVisible()
  await expect(doc.getByText('โรงเรียนทดสอบวิทยา')).toBeVisible()
  await expect(doc.getByText('0994000223453')).toBeVisible()
  await expect(doc.getByRole('heading', { name: /ประมาณการผ่อนชำระ: เช่าซื้อ/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /พิมพ์หรือบันทึกเป็น PDF/ })).toBeVisible()

  // The link only opens with its token
  const url = new URL(page.url())
  await page.goto(url.pathname)
  await expect(page.getByRole('heading', { level: 1, name: 'ไม่พบใบเสนอราคานี้' })).toBeVisible()
})

test('privacy: sends a deletion request', async ({ page }) => {
  await page.goto('/privacy')
  await page.getByRole('radio', { name: 'ขอลบข้อมูล' }).check()
  await page.getByRole('textbox', { name: /ชื่อ–นามสกุล/ }).fill('ผู้ทดสอบ ขอลบข้อมูล')
  await page.getByRole('textbox', { name: /เบอร์โทรศัพท์/ }).fill('081-999-0000')
  await page.getByRole('checkbox', { name: /ยินยอม/ }).check()
  await page.getByRole('button', { name: 'ส่งคำขอ' }).click()
  await expect(page.getByRole('status').getByText(/^LD\d{6}-\d{4}$/)).toBeVisible()
})

test('FAQ ships FAQPage structured data in its HTML', async ({ request }) => {
  const html = await (await request.get('/faq')).text()
  expect(html).toContain('"@type":"FAQPage"')
  const en = await (await request.get('/en/faq')).text()
  expect(en).toContain('Frequently asked questions')
})

test('English pages read in English', async ({ page }) => {
  await page.goto('/en/finance')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Financing and running costs')
  await expect(page.getByText('Monthly payment', { exact: true })).toBeVisible()
  await page.goto('/en/solutions/industrial')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Industry and warehousing')
})

test('phones: the floating LINE and call buttons sit above the compare tray', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phone layout only')
  await page.addInitScript(() => localStorage.setItem('servo.compare', JSON.stringify(['unitree-g1', 'nao6'])))
  await page.goto('/faq')
  await settle(page)
  const call = page.getByRole('link', { name: /^โทร 0/ })
  await expect(call).toBeVisible()
  const fab = await page.locator('.contact-fab').boundingBox()
  const tray = await page.locator('.compare-tray').boundingBox()
  expect(fab && tray && fab.y + fab.height <= tray.y).toBe(true)
  // Pages with their own contact actions leave the buttons out
  await page.goto('/contact')
  await expect(page.locator('.contact-fab')).toHaveCount(0)
})
