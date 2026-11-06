import AxeBuilder from '@axe-core/playwright'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

// The admin tests share one freshly seeded server database (see playwright.config.ts) and run in parallel on
// desktop and mobile, so they never assert global counts: each finds what it created by its own number or
// name, and tops stock up before selling it. The open shift is never closed here.

const STAFF = { id: 'st-2', name: 'อรอนงค์ ศรีประเสริฐ', pin: '2222' }
const MANAGER = { id: 'st-1', name: 'กฤษดา วัฒนกุล', pin: '1111' }
const TOKEN_KEY = 'servo.pos.token'

async function tokenFor(request: APIRequestContext, who: { id: string; pin: string }) {
  const res = await request.post('api/auth/login', { data: { staffId: who.id, pin: who.pin } })
  expect(res.ok()).toBeTruthy()
  return ((await res.json()) as { token: string }).token
}

async function apiAs<T>(request: APIRequestContext, token: string, method: 'GET' | 'POST' | 'PATCH', path: string, data?: unknown): Promise<T> {
  const res = await request.fetch(`api${path}`, { method, data, headers: { Authorization: `Bearer ${token}` } })
  expect(res.ok(), `${method} ${path}: ${await res.text()}`).toBeTruthy()
  return (await res.json()) as T
}

/** Signs in through the API and opens an admin screen with that session. */
async function openAs(page: Page, request: APIRequestContext, who: { id: string; pin: string }, hash: string, theme?: 'light' | 'dark') {
  const token = await tokenFor(request, who)
  await page.addInitScript(
    ([key, t, th]) => {
      localStorage.setItem(key, t)
      if (th) localStorage.setItem('servo.theme', th)
    },
    [TOKEN_KEY, token, theme ?? ''] as const,
  )
  await page.goto(`admin/${hash}`)
  await expect(page.locator('#main h1')).toBeVisible()
  return token
}

/** Console errors, page errors, failed requests and 4xx/5xx responses (aborted refetches are normal). */
function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('requestfailed', (r) => {
    if (r.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(`request failed: ${r.url()} ${r.failure()?.errorText}`)
  })
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
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 40))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForLoadState('networkidle')
}

interface ProductRow {
  id: string
  sku: string
  name: string
  price: number
  stock: number
  trackStock: boolean
}

let orderId = ''
let leadId = ''
let leadName = ''
let quoteId = ''
let quoteNo = ''

test.beforeAll(async ({ request }) => {
  const token = await tokenFor(request, MANAGER)
  // Selling needs an open shift; the seed leaves one open, this only guards a hand-closed one
  const shift = await apiAs<unknown>(request, token, 'GET', '/shifts/current')
  if (!shift) await apiAs(request, token, 'POST', '/shifts/open', { openingCash: 5000 })
  const list = await apiAs<{ rows: { id: string }[] }>(request, token, 'GET', '/orders?limit=1')
  orderId = list.rows[0].id
  // An old seeded inquiry and quotation for the detail screens (tests only change what they create)
  const leads = await apiAs<{ rows: { id: string; name: string }[] }>(request, token, 'GET', '/leads?kind=inquiry&limit=100')
  leadId = leads.rows.at(-1)!.id
  leadName = leads.rows.at(-1)!.name
  const quotes = await apiAs<{ rows: { id: string; no: string }[] }>(request, token, 'GET', '/quotes')
  quoteId = quotes.rows.at(-1)!.id
  quoteNo = quotes.rows.at(-1)!.no
})

const ROUTES = [
  { name: 'dashboard', hash: '#/', heading: 'ภาพรวมโชว์รูม' },
  { name: 'pos', hash: '#/pos', heading: 'ขายหน้าร้าน' },
  { name: 'orders', hash: '#/orders', heading: 'รายการขาย' },
  { name: 'order', hash: () => `#/orders/${orderId}`, heading: /บิล SV/ },
  { name: 'products', hash: '#/products', heading: 'สินค้าและสต็อก' },
  { name: 'product', hash: '#/products/unitree-g1-pro', heading: 'Unitree G1 Pro' },
  { name: 'stock', hash: '#/stock', heading: 'ความเคลื่อนไหวสต็อก' },
  { name: 'customers', hash: '#/customers', heading: 'ลูกค้า' },
  { name: 'customer', hash: '#/customers/c00001', heading: 'บริษัท ไทยโรโบติกส์ โซลูชั่น จำกัด' },
  { name: 'shifts', hash: '#/shifts', heading: 'กะและเงินสด' },
  { name: 'reports', hash: '#/reports', heading: 'รายงานยอดขาย' },
  { name: 'activity', hash: '#/activity', heading: 'บันทึกกิจกรรม' },
  { name: 'settings', hash: '#/settings', heading: 'ตั้งค่า' },
  { name: 'leads', hash: '#/leads', heading: 'ลูกค้าที่สนใจ' },
  { name: 'lead', hash: () => `#/leads/${leadId}`, heading: () => leadName },
  { name: 'bookings', hash: '#/bookings', heading: 'นัดหมาย' },
  { name: 'bookings-list', hash: '#/bookings?view=list', heading: 'นัดหมาย' },
  { name: 'quotes', hash: '#/quotes', heading: 'ใบเสนอราคา' },
  { name: 'quote', hash: () => `#/quotes/${quoteId}`, heading: () => `ใบเสนอราคา ${quoteNo}` },
  { name: 'reviews', hash: '#/reviews?status=', heading: 'รีวิว' },
] as { name: string; hash: string | (() => string); heading: string | RegExp | (() => string) }[]

const hashOf = (r: (typeof ROUTES)[number]) => (typeof r.hash === 'function' ? r.hash() : r.hash)
const headingOf = (r: (typeof ROUTES)[number]) => (typeof r.heading === 'function' ? r.heading() : r.heading)

test.describe('admin screens', () => {
  for (const route of ROUTES) {
    test(`${route.name} renders cleanly: no errors, no broken images, no sideways scroll`, async ({ page, request }) => {
      const errors = watchErrors(page)
      await openAs(page, request, MANAGER, hashOf(route))
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(headingOf(route))
      await settle(page)
      await loadAllImages(page)

      const broken = await page.$$eval('img', (imgs) => imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src')))
      expect(broken, 'broken images').toEqual([])
      const deviceWidth = page.viewportSize()!.width
      const widest = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth, window.innerWidth))
      expect(widest - deviceWidth, 'horizontal overflow (px)').toBeLessThanOrEqual(0)

      // Phones show tables as labelled row cards: nothing scrolls sideways inside a table frame either
      if (deviceWidth <= 560) {
        const wide = await page.$$eval('.table-wrap--stack', (wraps) =>
          wraps.filter((w) => w.scrollWidth - w.clientWidth > 1).map((w) => w.getAttribute('aria-label')),
        )
        expect(wide, 'tables scrolling sideways').toEqual([])
        const unlabelled = await page.$$eval('.table-wrap--stack tbody tr > :not(:first-child)', (cells) => cells.filter((c) => !c.getAttribute('data-label')).length)
        expect(unlabelled, 'stacked cells without a label').toBe(0)
      }
      expect(errors, 'console/network errors').toEqual([])
    })

    for (const theme of ['light', 'dark'] as const) {
      test(`${route.name} has no accessibility violations (${theme})`, async ({ page, request }) => {
        test.setTimeout(120_000)
        await openAs(page, request, MANAGER, hashOf(route), theme)
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(headingOf(route))
        await settle(page)
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
        const found = results.violations.map((v) => `${v.impact} ${v.id}: ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)
        expect(found).toEqual([])
        await loadAllImages(page)
        await page.screenshot({ path: `e2e/screenshots/admin-${test.info().project.name}-${route.name}-${theme}.png`, fullPage: true })
      })
    }
  }

  test('sign-in screen has no accessibility violations', async ({ page }) => {
    await page.goto('admin/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('เข้าสู่ระบบหลังร้าน')
    await settle(page)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})

test('a wrong PIN is refused and the right one signs in', async ({ page }) => {
  await page.goto('admin')
  await expect(page).toHaveURL(/\/admin\/$/)
  await page.getByLabel(new RegExp(STAFF.name)).check()
  await page.getByLabel(/^รหัส PIN/).fill('0000')
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
  await expect(page.getByRole('alert')).toHaveText('รหัส PIN ไม่ถูกต้อง')

  // The on-screen keypad types the PIN too
  const keypad = page.getByRole('group', { name: 'แป้นตัวเลข' })
  for (let i = 0; i < 4; i++) await keypad.getByRole('button', { name: '2', exact: true }).click()
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ภาพรวมโชว์รูม')
  await expect(page.getByRole('link', { name: /กะ #\d+ เปิดอยู่/ })).toBeVisible()

  await page.getByRole('button', { name: 'ออกจากระบบ' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('เข้าสู่ระบบหลังร้าน')
  await expect(page.getByRole('status').filter({ hasText: 'ออกจากระบบแล้ว' })).toBeVisible()
})

test('the phone menu opens as a drawer and navigates', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'mobile', 'the sidebar is always visible on desktop')
  await openAs(page, request, STAFF, '#/')
  await page.getByRole('button', { name: 'เปิดเมนู' }).click()
  const drawer = page.getByRole('dialog', { name: 'เมนูหลังร้าน' })
  await expect(drawer).toBeVisible()
  await drawer.getByRole('link', { name: 'รายงาน' }).click()
  await expect(drawer).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('รายงานยอดขาย')
  await page.getByRole('button', { name: 'เปิดเมนู' }).click()
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
})

async function addBySku(page: Page, sku: string) {
  await page.getByLabel('ค้นหาสินค้า').fill(sku)
  // The search matches SKUs, so exactly one tile is left
  const tile = page.locator('.tile')
  await expect(tile).toHaveCount(1)
  await tile.click()
}

async function payButton(page: Page) {
  const pay = page.getByRole('button', { name: /^ชำระเงิน .+ บาท$/ })
  await expect(pay).toBeEnabled()
  return pay
}

test('sells a robot with installation and a bill discount by card, then finds the bill', async ({ page, request }) => {
  const token = await tokenFor(request, MANAGER)
  const products = await apiAs<ProductRow[]>(request, token, 'GET', '/products')
  const robot = products.filter((p) => p.sku.startsWith('SV-UNG1') || p.sku.startsWith('SV-MANAO6')).sort((a, b) => b.stock - a.stock)[0]
  // Make sure there is one to sell whatever earlier runs did
  await apiAs(request, token, 'POST', `/products/${robot.id}/receive`, { qty: 1, note: 'e2e' })

  await openAs(page, request, STAFF, '#/pos')
  await addBySku(page, robot.sku)
  await addBySku(page, 'SV-SV-01')
  const bill = page.locator('.lines')
  await expect(bill.getByText(robot.name, { exact: true })).toBeVisible()
  await expect(bill.getByText('ติดตั้งและอบรมการใช้งาน')).toBeVisible()

  await page.locator('#bill-discount').fill('5000')
  const expected = robot.price + 25_000 - 5000
  const pay = await payButton(page)
  await expect(pay).toHaveText(`ชำระเงิน ${expected.toLocaleString('th-TH')} บาท`)
  await pay.click()

  const dialog = page.getByRole('dialog', { name: 'รับชำระเงิน' })
  await dialog.getByRole('radio', { name: 'บัตรเครดิต/เดบิต' }).check()
  await dialog.getByLabel('เลขท้ายบัตร 4 หลัก (ไม่บังคับ)').fill('4242')
  await dialog.getByRole('button', { name: 'รูดบัตรและชำระเงิน' }).click()

  const done = page.getByRole('dialog', { name: 'ชำระเงินเรียบร้อย' })
  await expect(done).toBeVisible({ timeout: 10_000 })
  const no = (await done.locator('.receipt__no').innerText()).trim()
  expect(no).toMatch(/^SV\d{6}-\d{4}$/)
  await expect(done.getByText('ใบเสร็จรับเงิน/ใบกำกับภาษีอย่างย่อ')).toBeVisible()
  await expect(done.getByText('**** 4242')).toBeVisible()
  await expect(done.getByText('ส่วนลดท้ายบิล')).toBeVisible()
  await expect(done.locator('.receipt__grand')).toContainText(`${expected.toLocaleString('th-TH')} บาท`)
  await done.getByRole('button', { name: 'บิลใหม่' }).click()
  await expect(page.locator('.slip__empty')).toBeVisible()

  await page.goto(`admin/#/orders?q=${no}`)
  const link = page.getByRole('link', { name: no, exact: true })
  await expect(link).toBeVisible()
  await link.click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`บิล ${no}`)
  await expect(page.getByText(robot.name, { exact: true }).first()).toBeVisible()
})

test('a cash sale works out the change', async ({ page, request }) => {
  await openAs(page, request, STAFF, '#/pos')
  await addBySku(page, 'SV-SV-05')
  const pay = await payButton(page)
  await expect(pay).toHaveText('ชำระเงิน 6,500 บาท')
  await pay.click()

  const dialog = page.getByRole('dialog', { name: 'รับชำระเงิน' })
  await expect(dialog.getByRole('radio', { name: 'เงินสด' })).toBeChecked()
  await dialog.getByLabel('รับเงินมา (บาท)').fill('6000')
  await expect(dialog.getByText('ยังขาดอีก 500 บาท')).toBeVisible()
  await dialog.getByRole('button', { name: '10,000', exact: true }).click()
  await expect(dialog.getByText('เงินทอน 3,500 บาท')).toBeVisible()
  await dialog.getByRole('button', { name: 'รับเงินสด 10,000 บาท' }).click()

  const done = page.getByRole('dialog', { name: 'ชำระเงินเรียบร้อย' })
  await expect(done.locator('.receipt__change')).toHaveText('3,500')
  await expect(done.locator('.receipt__no')).toHaveText(/^SV\d{6}-\d{4}$/)

  // The confirmation toast sits in the top layer, above the receipt dialog's backdrop
  const toast = page.locator('.toast').filter({ hasText: 'บันทึกการขาย' })
  await expect(toast).toBeVisible()
  const box = (await toast.boundingBox())!
  const topmost = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.toast')?.textContent ?? null, [box.x + box.width / 2, box.y + box.height / 2])
  expect(topmost, 'toast is the topmost element, not under the dialog backdrop').toContain('บันทึกการขาย')
})

test('POS tiles show prices in baht and fit on the narrowest phones', async ({ page, request }) => {
  await openAs(page, request, STAFF, '#/pos')
  await expect(page.locator('.tile').first()).toBeVisible()
  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 800 })
    await page.waitForTimeout(100)
    const report = await page.$$eval('.tile', (tiles) =>
      tiles.map((t) => {
        const box = t.getBoundingClientRect()
        const price = t.querySelector('.tile__price')!
        const stock = t.querySelector('.tile__stock')!
        const pb = price.getBoundingClientRect()
        const sb = stock.getBoundingClientRect()
        return {
          price: price.textContent ?? '',
          fits: pb.right <= box.right - 4 && sb.right <= box.right - 4 && t.scrollWidth <= t.clientWidth,
        }
      }),
    )
    expect(report.every((r) => /^[\d,]+ บาท$/.test(r.price.trim())), `prices with unit at ${width}px`).toBe(true)
    expect(report.filter((r) => !r.fits).map((r) => r.price), `tiles overflowing at ${width}px`).toEqual([])
    expect(report.some((r) => r.price.startsWith('3,562,500'))).toBe(true)
  }
})

test('a company buyer gets a full tax invoice', async ({ page, request }) => {
  await openAs(page, request, STAFF, '#/pos')
  await page.getByRole('button', { name: 'เลือกลูกค้า' }).click()
  const picker = page.getByRole('dialog', { name: 'เลือกลูกค้า' })
  await picker.getByLabel('ค้นหาลูกค้า').fill('ไทยโรโบติกส์')
  await picker.getByRole('button', { name: 'เลือก บริษัท ไทยโรโบติกส์ โซลูชั่น จำกัด' }).click()
  await expect(page.locator('.slip__customer')).toContainText('ออกใบกำกับภาษีเต็มรูป')

  await addBySku(page, 'SV-AC-05')
  await (await payButton(page)).click()
  const dialog = page.getByRole('dialog', { name: 'รับชำระเงิน' })
  await dialog.getByRole('radio', { name: 'โอนเงิน' }).check()
  await dialog.getByRole('button', { name: 'ยืนยันว่าได้รับเงินโอนแล้ว' }).click()

  const done = page.getByRole('dialog', { name: 'ชำระเงินเรียบร้อย' })
  const buyer = done.getByRole('region', { name: 'ข้อมูลผู้ซื้อ' })
  await expect(done.getByText('ใบกำกับภาษี/ใบเสร็จรับเงิน', { exact: true })).toBeVisible()
  await expect(buyer).toContainText('บริษัท ไทยโรโบติกส์ โซลูชั่น จำกัด')
  await expect(buyer).toContainText('0105561123401')
  await expect(buyer).toContainText('55 ถนนวิภาวดีรังสิต')
})

test('staff refund a bill with a manager PIN and the stock goes back', async ({ page, request }) => {
  const staffToken = await tokenFor(request, STAFF)
  const order = await apiAs<{ id: string; no: string }>(request, staffToken, 'POST', '/orders', {
    lines: [{ productId: 'svc-checkup', qty: 1 }],
    payment: { method: 'card', cardLast4: '1111' },
  })

  await openAs(page, request, STAFF, `#/orders/${order.id}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`บิล ${order.no}`)
  await page.getByRole('button', { name: 'คืนเงิน' }).click()
  const dialog = page.getByRole('dialog', { name: `คืนเงินบิล ${order.no}` })
  await dialog.getByRole('button', { name: 'ลูกค้าเปลี่ยนใจ' }).click()
  await dialog.getByLabel('รหัส PIN ผู้จัดการ').fill('2222')
  await dialog.getByRole('button', { name: 'ยืนยันคืนเงิน' }).click()
  await expect(dialog.getByRole('alert')).toContainText('ผู้จัดการ')

  await dialog.getByLabel('รหัส PIN ผู้จัดการ').fill('1111')
  await dialog.getByRole('button', { name: 'ยืนยันคืนเงิน' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator('.order-grid .badge').filter({ hasText: 'คืนเงินแล้ว' })).toBeVisible()
  const refund = page.getByRole('region', { name: 'การคืนเงิน' })
  await expect(refund).toContainText(`อนุมัติโดย${MANAGER.name}`)
  await expect(refund).toContainText('ลูกค้าเปลี่ยนใจ')
  await expect(page.getByRole('button', { name: 'คืนเงิน' })).toHaveCount(0)
})

test("receiving stock raises the product's stock", async ({ page, request }, info) => {
  // Each device project works on its own product so the two runs never race
  const id = info.project.name === 'desktop' ? 'acc-mat' : 'acc-case'
  const token = await tokenFor(request, MANAGER)
  const before = (await apiAs<{ product: ProductRow }>(request, token, 'GET', `/products/${id}`)).product.stock

  await openAs(page, request, STAFF, `#/products/${id}`)
  await page.getByLabel(/^จำนวนที่รับเข้า/).fill('2')
  await page.getByLabel('หมายเหตุ เช่น เลขใบส่งของ (ไม่บังคับ)').fill('ใบส่งของ e2e')
  await page.getByRole('button', { name: 'บันทึกรับเข้า' }).click()
  await expect(page.locator('.product-hero')).toContainText(`เหลือ ${before + 2} ชิ้น`)
  const firstMove = page.getByRole('region', { name: 'ตารางความเคลื่อนไหวสต็อก' }).locator('tbody tr').first()
  await expect(firstMove).toContainText('รับเข้า')
  await expect(firstMove).toContainText('+2')
  await expect(firstMove).toContainText('ใบส่งของ e2e')
})

test('adds a company customer, with the server checking the tax id', async ({ page, request }, info) => {
  // The worker's slot as the last digit: the desktop and mobile copies can start in the same millisecond,
  // and the shop allows one customer per phone number
  const tag = `${`${Date.now()}`.slice(-6)}${info.parallelIndex % 10}`
  const name = `บริษัท ทดสอบอีทูอี ${tag} จำกัด`
  await openAs(page, request, STAFF, '#/customers')
  await page.getByRole('button', { name: 'เพิ่มลูกค้า' }).click()
  const dialog = page.getByRole('dialog', { name: 'เพิ่มลูกค้า' })
  await dialog.getByRole('radio', { name: 'นิติบุคคล' }).check()
  await dialog.getByLabel('ชื่อบริษัทหรือหน่วยงาน').fill(name)
  await dialog.getByLabel('เบอร์โทร').fill(`02-${tag.slice(0, 3)}-${tag.slice(3)}`)
  await dialog.getByLabel('เลขประจำตัวผู้เสียภาษี 13 หลัก').fill('010556')
  await dialog.getByLabel('ที่อยู่สำหรับออกใบกำกับภาษี').fill('1 ถนนทดสอบ เขตบางนา กรุงเทพฯ 10260')
  await dialog.getByRole('button', { name: 'เพิ่มลูกค้า' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก')

  await dialog.getByLabel('เลขประจำตัวผู้เสียภาษี 13 หลัก').fill(`0105569${tag.slice(0, 6)}`)
  await dialog.getByRole('button', { name: 'เพิ่มลูกค้า' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
  await expect(page.getByText('นิติบุคคล').first()).toBeVisible()
})

test('reports show a table view and export the bills as CSV', async ({ page, request }) => {
  await openAs(page, request, MANAGER, '#/reports')
  await expect(page.getByText('กำไรขั้นต้น').first()).toBeVisible()
  const toggle = page.getByRole('button', { name: 'ดูเป็นตาราง' }).first()
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('region', { name: 'ยอดขายรายวัน (บาท รวม VAT) (ตาราง)' })).toBeVisible()

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'ส่งออกบิลเป็น CSV' }).click()])
  expect(download.suggestedFilename()).toMatch(/^servo-orders-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv$/)
  const path = await download.path()
  const { readFileSync } = await import('node:fs')
  const csv = readFileSync(path, 'utf8')
  expect(csv.split('\n')[0]).toContain('เลขที่บิล')
  expect(csv).toMatch(/SV\d{6}-\d{4}/)
})

test('a cash pay-out is recorded on the shift and the close form previews the count', async ({ page, request }) => {
  const reason = `ค่าน้ำดื่มลูกค้า e2e ${Date.now().toString().slice(-6)}`
  await openAs(page, request, STAFF, '#/shifts')
  await expect(page.getByRole('heading', { name: /กะ #\d+ เปิดอยู่/ })).toBeVisible()
  await page.getByLabel('จำนวนเงิน (บาท)').fill('120')
  await page.getByLabel('เหตุผล', { exact: true }).fill(reason)
  await page.getByRole('button', { name: 'บันทึกนำเงินออก' }).click()
  await expect(page.locator('.moves')).toContainText(reason)

  // The close form compares the count with the drawer's expected cash, live, without closing the shift
  const hint = await page.getByText(/ระบบคำนวณว่าควรมีเงินสด/).innerText()
  const expected = Number(hint.match(/ควรมีเงินสด ([\d,.]+) บาท/)![1].replace(/,/g, ''))
  await page.getByLabel('เงินสดที่นับได้ (บาท)').fill(String(expected - 20))
  await expect(page.getByTestId('close-preview')).toHaveText('ผลการนับ: เงินขาด 20 บาท')
  await page.getByLabel('เงินสดที่นับได้ (บาท)').fill(String(expected))
  await expect(page.getByTestId('close-preview')).toHaveText('ผลการนับ: ตรงยอด')
})

// ---------- Website contacts (leads, bookings, quotations, reviews, opening hours) ----------

const stamp = () => `${Date.now()}`.slice(-7)
const phoneFor = (tag: string) => `08${tag.padStart(8, '0').slice(-8)}`
const form = { consent: true, website: '' }

async function publicPost<T>(request: APIRequestContext, path: string, data: unknown): Promise<T> {
  const res = await request.post(`api/public${path}`, { data })
  expect(res.ok(), `POST /public${path}: ${await res.text()}`).toBeTruthy()
  return (await res.json()) as T
}

async function leadIdOf(request: APIRequestContext, token: string, no: string) {
  const found = await apiAs<{ rows: { id: string; no: string }[] }>(request, token, 'GET', `/leads?q=${encodeURIComponent(no)}`)
  return found.rows.find((r) => r.no === no)!.id
}

test('a website inquiry is followed up: status, owner and a note', async ({ page, request }) => {
  const tag = stamp()
  const name = `คุณทดสอบ ติดตาม${tag}`
  const { no } = await publicPost<{ no: string }>(request, '/leads', { ...form, name, phone: phoneFor(tag), message: 'สนใจ Unitree G1 สำหรับห้องแล็บ', refIds: ['unitree-g1'], page: '/contact' })
  const token = await tokenFor(request, MANAGER)
  const id = await leadIdOf(request, token, no)

  await openAs(page, request, STAFF, `#/leads/${id}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(name)
  await expect(page.getByRole('link', { name: /โทรหา 08/ })).toHaveAttribute('href', `tel:${phoneFor(tag)}`)
  await page.getByRole('radio', { name: 'ติดต่อแล้ว' }).check()
  await page.getByLabel('ผู้ดูแล').selectOption(STAFF.id)
  const note = `โทรแล้ว ขอใบเสนอราคา 2 เครื่อง ${tag}`
  await page.getByLabel('บันทึกการติดต่อ (ไม่บังคับ)').fill(note)
  await page.getByRole('button', { name: 'บันทึกการติดตาม' }).click()

  await expect(page.getByRole('list', { name: /บันทึกการติดต่อ/ })).toContainText(note)
  await expect(page.getByRole('region', { name: 'รายละเอียด' })).toContainText('ติดต่อแล้ว')
  const saved = await apiAs<{ lead: { status: string; assignedTo: string; notes: { text: string; staffName: string }[] } }>(request, token, 'GET', `/leads/${id}`)
  expect(saved.lead.status).toBe('contacted')
  expect(saved.lead.assignedTo).toBe(STAFF.id)
  expect(saved.lead.notes.at(-1)).toMatchObject({ text: note, staffName: STAFF.name })

  // The inbox finds it and shows its new status
  await page.goto(`admin/#/leads?q=${no}`)
  const row = page.locator('tbody tr').filter({ hasText: no })
  await expect(row).toContainText('ติดต่อแล้ว')
})

test('a manager wipes the personal data of a PDPA deletion request', async ({ page, request }) => {
  const tag = stamp()
  const name = `คุณขอลบ ข้อมูล${tag}`
  const { no } = await publicPost<{ no: string }>(request, '/privacy', { ...form, request: 'delete', name, phone: phoneFor(tag), details: 'ขอลบข้อมูลทั้งหมด' })
  const token = await tokenFor(request, MANAGER)
  const id = await leadIdOf(request, token, no)

  await openAs(page, request, MANAGER, `#/leads/${id}`)
  await expect(page.getByText('ขอลบข้อมูลส่วนบุคคล').first()).toBeVisible()
  await page.getByRole('button', { name: 'ลบข้อมูลส่วนบุคคลของรายนี้' }).click()
  const dialog = page.getByRole('dialog', { name: 'ลบข้อมูลส่วนบุคคล' })
  await expect(dialog).toContainText(name)
  await dialog.getByRole('button', { name: 'ลบข้อมูลถาวร' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('[ลบข้อมูลตามคำขอ]')
  await expect(page.getByText(/ลบข้อมูลส่วนบุคคลตามคำขอแล้วเมื่อ/)).toBeVisible()
  const wiped = await apiAs<{ lead: { phone: string; anonymisedAt: string | null } }>(request, token, 'GET', `/leads/${id}`)
  expect(wiped.lead.phone).toBe('')
  expect(wiped.lead.anonymisedAt).not.toBeNull()
})

test('a demo booked on the website is confirmed from the agenda', async ({ page, request }, info) => {
  const tag = stamp()
  const name = `คุณนัด สาธิต${tag}`
  // Each device project books on its own days so the two runs never want the same slot
  const store = await (await request.get('api/public/store')).json()
  let booked: { no: string; date: string; time: string } | null = null
  for (let offset = info.project.name === 'desktop' ? 3 : 4; offset <= 20 && !booked; offset += 2) {
    const date = new Date(Date.parse(`${store.booking.from}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10)
    const day = await (await request.get(`api/public/slots?date=${date}`)).json()
    for (const slot of day.slots.filter((s: { available: boolean }) => s.available)) {
      const res = await request.post('api/public/bookings', { data: { ...form, date, time: slot.time, refId: 'nao6', name, phone: phoneFor(tag) } })
      if (res.ok()) {
        booked = await res.json()
        break
      }
    }
  }
  expect(booked, 'found a free demo slot').not.toBeNull()

  await openAs(page, request, STAFF, `#/bookings?date=${booked!.date}`)
  const card = page.locator(`[data-booking="${booked!.no}"]`)
  await expect(card).toContainText(`${booked!.time}`)
  await expect(card).toContainText('รอยืนยัน')
  await card.getByRole('button', { name: new RegExp(`^ยืนยันนัด ${booked!.no}`) }).click()
  await expect(card).toContainText('ยืนยันแล้ว')

  const token = await tokenFor(request, MANAGER)
  const list = await apiAs<{ rows: { no: string; status: string; leadId: string }[] }>(request, token, 'GET', `/bookings?from=${booked!.date}&to=${booked!.date}`)
  const b = list.rows.find((r) => r.no === booked!.no)!
  expect(b.status).toBe('confirmed')
  const lead = await apiAs<{ lead: { status: string } }>(request, token, 'GET', `/leads/${b.leadId}`)
  expect(lead.lead.status).toBe('scheduled')
})

test('a quotation from the configurator is rung up at the till and marked converted', async ({ page, request }) => {
  const tag = stamp()
  const quote = await publicPost<{ id: string; no: string; totals: { total: number } }>(request, '/quotes', {
    ...form,
    lines: [
      { productId: 'svc-sdk', qty: 1 },
      { productId: 'svc-checkup', qty: 2 },
    ],
    customer: { name: `คุณขอราคา ทดสอบ${tag}`, phone: phoneFor(tag), company: `บริษัท อีทูอี ${tag} จำกัด` },
    financing: { mode: 'hire', downPct: 20, months: 24 },
  })
  expect(quote.totals.total).toBe(45_000 + 2 * 6500)

  await openAs(page, request, STAFF, `#/quotes/${quote.id}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`ใบเสนอราคา ${quote.no}`)
  await expect(page.getByRole('region', { name: 'การชำระเงินที่ลูกค้าเลือก' })).toContainText('เช่าซื้อ')
  await page.getByRole('button', { name: 'ลูกค้าตกลงแล้ว' }).click()
  await expect(page.getByRole('region', { name: 'สถานะ' })).toContainText('ลูกค้าตกลง')
  await page.getByRole('button', { name: 'เปิดในหน้าขาย' }).click()

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ขายหน้าร้าน')
  await expect(page.locator('.quote-ref')).toContainText(quote.no)
  await expect(page.locator('.lines').getByText('อบรมพัฒนาโปรแกรมด้วย SDK')).toBeVisible()
  const pay = await payButton(page)
  await expect(pay).toHaveText(`ชำระเงิน ${quote.totals.total.toLocaleString('th-TH')} บาท`)
  await pay.click()
  const dialog = page.getByRole('dialog', { name: 'รับชำระเงิน' })
  await dialog.getByRole('radio', { name: 'โอนเงิน' }).check()
  await dialog.getByRole('button', { name: 'ยืนยันว่าได้รับเงินโอนแล้ว' }).click()

  const done = page.getByRole('dialog', { name: 'ชำระเงินเรียบร้อย' })
  await expect(done.locator('.receipt__ref')).toHaveText(quote.no)
  const billNo = (await done.locator('.receipt__no').innerText()).trim()

  const token = await tokenFor(request, MANAGER)
  const after = await apiAs<{ quotation: { status: string; orderNo: string } }>(request, token, 'GET', `/quotes/${quote.id}`)
  expect(after.quotation).toMatchObject({ status: 'converted', orderNo: billNo })
  await done.getByRole('button', { name: 'บิลใหม่' }).click()
  await page.goto(`admin/#/quotes/${quote.id}`)
  await expect(page.getByRole('region', { name: 'สถานะ' })).toContainText('ออกบิลแล้ว')
  await expect(page.getByRole('link', { name: billNo })).toBeVisible()
})

test('a manager approves a website review and it shows on the public API', async ({ page, request }) => {
  const tag = stamp()
  const name = `ผู้รีวิว${tag}`
  await publicPost(request, '/reviews', { ...form, refId: 'unitree-g1', name, rating: 4, title: 'ใช้สอนนักศึกษาได้ดี', body: 'เดินได้มั่นคง SDK เข้าใจง่าย แบตเตอรี่อยู่ได้ราวสองชั่วโมง' })
  const before = await (await request.get('api/public/reviews?refId=unitree-g1')).json()
  expect(before.rows.some((r: { name: string }) => r.name === name)).toBe(false)

  await openAs(page, request, MANAGER, '#/reviews')
  const card = page.locator(`[data-review="${name}"]`)
  await expect(card).toContainText('รอตรวจ')
  await expect(card.getByRole('img', { name: '4 จาก 5 ดาว' })).toBeVisible()
  // exact: 'ไม่อนุมัติ …' contains 'อนุมัติ …' as a substring
  await card.getByRole('button', { name: `อนุมัติ รีวิวของ ${name}`, exact: true }).click()
  await expect(card).toHaveCount(0)

  const after = await (await request.get('api/public/reviews?refId=unitree-g1')).json()
  expect(after.rows.find((r: { name: string }) => r.name === name)).toMatchObject({ rating: 4, title: 'ใช้สอนนักศึกษาได้ดี' })
})

test('opening hours are saved from settings', async ({ page, request }, info) => {
  // Both projects saving the whole form at once would overwrite each other; one run is enough
  test.skip(info.project.name !== 'desktop', 'settings are shared; edited from one project only')
  const token = await tokenFor(request, MANAGER)
  const original = (await apiAs<{ hours: { day: number; open: string; close: string }[] }>(request, token, 'GET', '/settings')).hours
  try {
    await openAs(page, request, MANAGER, '#/settings')
    // Closing later on Sunday adds no 90-minute demo slot, so bookings elsewhere aren't affected
    await page.getByLabel('วันอาทิตย์ ปิด').selectOption('19:30')
    await page.getByRole('button', { name: 'บันทึกข้อมูลร้าน' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'บันทึกข้อมูลร้านแล้ว' })).toBeVisible()
    const saved = (await apiAs<{ hours: { day: number; close: string }[] }>(request, token, 'GET', '/settings')).hours
    expect(saved.find((h) => h.day === 0)?.close).toBe('19:30')
    const store = await (await request.get('api/public/store')).json()
    expect(store.hours.find((h: { day: number }) => h.day === 0).close).toBe('19:30')
  } finally {
    await apiAs(request, token, 'PATCH', '/settings', { hours: original })
  }
})

test('the dashboard links its website-contact tiles to the screens', async ({ page, request }) => {
  await openAs(page, request, MANAGER, '#/')
  const tiles = page.getByRole('region', { name: 'ลูกค้าจากเว็บไซต์' })
  await expect(tiles.getByRole('link')).toHaveCount(4)
  await tiles.getByRole('link', { name: /ใบเสนอราคาที่เปิดอยู่/ }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('ใบเสนอราคา')
  // New leads carry a count in the menu
  // includeHidden also counts the aria-hidden digit ("ลูกค้าที่สนใจ7 (…)"), so allow anything before the count
  await expect(page.getByRole('link', { name: /ลูกค้าที่สนใจ.*\(รายใหม่ \d+ ราย\)/, includeHidden: true }).first()).toBeAttached()
})