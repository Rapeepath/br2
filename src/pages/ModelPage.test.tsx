import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '../App'
import { market, modelIds, models } from '../data'
import { COMPARE_LIMIT, CompareProvider } from '../lib/compare'
import {
  AVAILABILITY_LABEL,
  CATEGORY_BRIEF,
  CURRENCY_LABEL,
  formatListPrice,
  formatMonthTh,
  formatNumber,
  msToKmh,
} from '../lib/format'
import type { Currency, Model, Trim } from '../lib/types'
import { renderAt } from '../test/render'

const nextFrame = () => new Promise((r) => requestAnimationFrame(r))
/** The page keeps figures with their units (no-break spaces, word joiners); compare the words. */
const plain = (s: string | null | undefined) => (s ?? '').replace(/⁠/g, '').replace(/\s+/g, ' ').trim()

const FX: Record<Currency, number> = { THB: 1, USD: market.fx.usd, CNY: market.fx.cny, EUR: market.fx.eur }

/** A model page opened from the lineup, which passes the list's query string in router state. */
function renderFromList(id: string, from: string) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/models/${id}`, state: { from } }]}>
      <CompareProvider validIds={modelIds}>
        <AppRoutes />
      </CompareProvider>
    </MemoryRouter>,
  )
}

/** Trims with a baht price, cheapest first. */
const pricedTrims = (m: Model) =>
  m.trims.filter((t) => t.priceTHB != null).sort((a, b) => a.priceTHB! - b.priceTHB!)

const isConverted = (t: Trim) => t.priceBasis === 'converted' && t.listPrice != null

const byLabel = (m: Model) => [m.id, m] as const

describe('model page', () => {
  it('is named after the model: the h1, the document title, the brand and the Thai name', () => {
    const m = models[0]
    renderAt(`/models/${m.id}`)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.textContent).toBe(m.nameEn)
    expect(document.title).toBe(`${m.nameEn} – Servo`)
    expect(screen.getByText(m.nameTh)).toBeInTheDocument()
    expect(screen.getByText(m.brand, { selector: '.mp-brand' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: `หุ่นยนต์ ${m.nameEn}` })).toBeInTheDocument()
  })

  it('shows the not-found page for an id that is not in the catalogue', () => {
    renderAt('/models/no-such-robot')
    expect(screen.getByRole('heading', { name: 'ไม่พบหน้าที่ต้องการ' })).toBeInTheDocument()
    expect(document.title).toBe('ไม่พบหน้า – Servo')
  })

  it.each(models.map((m) => [m.id]))('renders %s and every one of its five tabs', async (id) => {
    const user = userEvent.setup()
    renderAt(`/models/${id}`)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.querySelector('.tabs__full')?.textContent ?? t.textContent)).toEqual([
      'ภาพรวม',
      'รุ่นย่อยและราคา',
      'ขนาดและระบบ',
      'ความปลอดภัยและการรับประกัน',
      'ก่อนตัดสินใจ',
    ])
    for (const tab of tabs) {
      await user.click(tab)
      expect(tab).toHaveAttribute('aria-selected', 'true')
      const panel = screen.getByRole('tabpanel')
      // Each panel is headed by its tab's full label (visually hidden) and has real content after it
      const heading = within(panel).getByRole('heading', { level: 2 })
      expect(tab).toHaveAccessibleName(heading.textContent!)
      expect(panel.textContent!.length).toBeGreaterThan(100)
    }
  })

  it('opens on ภาพรวม; arrow keys, Home and End move between tabs', async () => {
    const user = userEvent.setup()
    renderAt(`/models/${models[models.length - 1].id}`)
    const tabs = screen.getAllByRole('tab')
    const first = screen.getByRole('tab', { name: 'ภาพรวม' })
    expect(first).toBe(tabs[0])
    expect(first).toHaveAttribute('aria-selected', 'true')
    first.focus()
    await user.keyboard('{ArrowRight}')
    expect(tabs[1]).toHaveFocus()
    expect(tabs[1]).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{End}')
    expect(tabs[tabs.length - 1]).toHaveFocus()
    await user.keyboard('{Home}')
    expect(tabs[0]).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(tabs[tabs.length - 1]).toHaveFocus()
  })

  it('shows the overview: background, highlights and every use', () => {
    const m = models[0]
    renderAt(`/models/${m.id}`)
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByRole('heading', { name: 'งานที่ใช้' })).toBeInTheDocument()
    for (const u of m.useCases) expect(plain(panel.textContent)).toContain(plain(u))
    for (const h of m.highlights) expect(plain(panel.textContent)).toContain(plain(h))
    if (m.funFact) expect(within(panel).getByRole('note')).toHaveTextContent('รู้หรือไม่')
  })

  it.each(models.map(byLabel))('%s: the price tag says what its price is based on', (_, m) => {
    renderAt(`/models/${m.id}`)
    const tag = document.querySelector<HTMLElement>('.mp-price')!
    const figure = tag.querySelector('.mp-price__figure')!
    expect(within(tag).getByText(m.trims.length > 1 ? 'ราคาเริ่มต้น' : 'ราคา')).toBeInTheDocument()

    const priced = pricedTrims(m)
    if (!m.span.price) {
      expect(figure).toHaveTextContent('ยังไม่ประกาศราคา')
      return
    }
    // A conversion reads "ประมาณ"; a Thai dealer's price stands alone
    const approx = priced[0].priceBasis === 'converted'
    expect(plain(figure.textContent)).toBe(`${approx ? 'ประมาณ ' : ''}${formatNumber(m.span.price[0])} บาท`)

    const basis = tag.querySelector<HTMLElement>('.mp-price__basis')!
    const converted = priced.filter(isConverted)
    if (converted.length > 0) {
      // The maker's own price, and the rate it was converted at, sit right under the baht figure
      const list = converted[0].listPrice!
      expect(within(basis).getByText('ราคาผู้ผลิต')).toBeInTheDocument()
      expect(plain(basis.querySelector('.mp-price__list')?.textContent)).toContain(formatListPrice(list))
      const rate = plain(basis.querySelector('.mp-price__rate')?.textContent)
      expect(rate).toContain(`1 ${CURRENCY_LABEL[list.currency]} = ${formatNumber(FX[list.currency])} บาท`)
      expect(rate).toContain(formatMonthTh(market.fx.date.slice(0, 7)))
    } else {
      expect(within(basis).getByText('ราคาจากตัวแทนจำหน่ายในไทย')).toBeInTheDocument()
      expect(basis.querySelector('.mp-price__rate')).toBeNull()
    }
    if (m.priceNote) expect(plain(basis.querySelector('.mp-price__note')?.textContent)).toBe(plain(m.priceNote))
  })

  it.each(models.map(byLabel))('%s: tabulates every trim as a column, prices marked by their basis', async (_, m) => {
    const user = userEvent.setup()
    renderAt(`/models/${m.id}`)
    await user.click(screen.getByRole('tab', { name: 'รุ่นย่อยและราคา' }))
    const table = screen.getByRole('table', { name: /ราคาและสเปกทุกรุ่นย่อย/ })
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers).toEqual(['รุ่นย่อย', ...m.trims.map((t) => t.name)])

    const cells = (label: string) =>
      within(within(table).getByRole('rowheader', { name: label }).closest('tr')!).getAllByRole('cell')
    const price = cells('ราคา (บาท)')
    const list = cells('ราคาผู้ผลิต')
    const speed = cells('ความเร็วสูงสุด')
    m.trims.forEach((t, i) => {
      if (t.priceTHB == null) expect(price[i]).toHaveTextContent('ยังไม่ประกาศ')
      else
        expect(plain(price[i].textContent)).toBe(
          `${t.priceBasis === 'converted' ? 'ประมาณ ' : ''}${formatNumber(t.priceTHB)}`,
        )
      expect(plain(list[i].textContent)).toBe(t.listPrice ? formatListPrice(t.listPrice) : '–')
      // km/h first, the maker's m/s beside it
      if (t.speedMs != null)
        expect(plain(speed[i].textContent)).toBe(`${formatNumber(msToKmh(t.speedMs))} กม./ชม. (${formatNumber(t.speedMs)} m/s)`)
      else expect(speed[i]).toHaveTextContent('ไม่ระบุ')
    })
    for (const label of ['องศาอิสระ (DOF)', 'มือหยิบจับ', 'น้ำหนักบรรทุก', 'แรงบิดข้อต่อสูงสุด', 'ความจุแบตเตอรี่', 'เวลาใช้งานต่อการชาร์จ', 'ระบบประมวลผล']) {
      expect(cells(label)).toHaveLength(m.trims.length)
    }
    // The notes say how the prices were set
    const notes = document.querySelector<HTMLElement>('.mp-notes')!
    if (m.trims.some(isConverted)) expect(notes).toHaveTextContent('แปลงจากราคาผู้ผลิต')
    if (m.trims.some((t) => t.priceBasis === 'dealer')) expect(notes).toHaveTextContent('ตัวแทนจำหน่ายในไทย')
  })

  it.each(models.map(byLabel))('%s: the key figures band gives height, DOF, speed, payload and runtime', (_, m) => {
    renderAt(`/models/${m.id}`)
    const band = screen.getByRole('region', { name: 'สเปกหลัก' })
    const labels = within(band)
      .getAllByRole('term')
      .map((dt) => plain(dt.textContent))
    expect(labels).toEqual(['ความสูง', 'องศาอิสระ (DOF)', 'ความเร็วสูงสุด', 'น้ำหนักบรรทุก', 'เวลาใช้งานต่อการชาร์จ'])
    const item = (label: string) => within(band).getByText(label).closest('div')!
    expect(plain(item('ความสูง').textContent)).toContain(`${formatNumber(m.heightCm)} ซม.`)
    if (m.span.speedMs) {
      const [min, max] = m.span.speedMs
      const kmh = min === max ? formatNumber(msToKmh(min)) : `${formatNumber(msToKmh(min))}–${formatNumber(msToKmh(max))}`
      expect(plain(item('ความเร็วสูงสุด').textContent)).toContain(`${kmh} กม./ชม.`)
    }
    // The band stays to the figures: the per-trim detail lives in the trims tab
    expect(band.querySelectorAll('.mp-keyspecs__sub')).toHaveLength(0)
  })

  it.each(models.map(byLabel))('%s: the height diagram is to scale and says the same in words', async (_, m) => {
    const user = userEvent.setup()
    renderAt(`/models/${m.id}`)
    await user.click(screen.getByRole('tab', { name: 'ขนาดและระบบ' }))
    const panel = screen.getByRole('tabpanel')
    const figure = panel.querySelector<HTMLElement>('figure.mp-height')!
    // The drawing is decoration; the caption is its text equivalent
    const chart = figure.querySelector<HTMLElement>('.mp-height__chart')!
    expect(chart).toHaveAttribute('aria-hidden', 'true')
    const caption = plain(figure.querySelector('figcaption')?.textContent)
    expect(caption).toContain(`${m.nameEn} สูง ${formatNumber(m.heightCm)} ซม.`)
    expect(caption).toContain('ผู้ใหญ่ที่สูง 170 ซม.')
    const diff = Math.round(m.heightCm - 170)
    if (diff !== 0) expect(caption).toContain(`${diff < 0 ? 'เตี้ยกว่า' : 'สูงกว่า'}ผู้ใหญ่`)

    // Both figures on one scale: their heights keep the robot-to-adult ratio, with a rule every 50 cm
    const h = (sel: string) => parseFloat(chart.querySelector<HTMLElement>(sel)!.style.getPropertyValue('--h'))
    expect(h('.mp-height__figure--robot') / h('.mp-height__figure--adult')).toBeCloseTo(m.heightCm / 170, 5)
    const steps = [...chart.querySelectorAll('.mp-height__step')].map((s) => s.textContent)
    expect(steps.slice(0, 5)).toEqual(['0', '50', '100', '150', '200'])

    // Sensors, software and charging, with the way to the guide's electricity costs
    for (const s of m.sensors) expect(plain(panel.textContent)).toContain(plain(s))
    expect(within(panel).getByRole('link', { name: /ค่าไฟต่อการชาร์จ/ })).toHaveAttribute('href', '/guide')
  })

  it.each(models.map(byLabel))('%s: states the maker’s shipment rank only when it has one', (_, m) => {
    renderAt(`/models/${m.id}`)
    const rank = document.querySelector<HTMLElement>('.mp-rank')
    if (m.makerRank == null) {
      expect(rank).toBeNull()
      return
    }
    expect(plain(rank!.textContent)).toContain(`ผู้ผลิตยอดส่งมอบอันดับ ${m.makerRank} ของโลก`)
    // The units are the brand's, for every model it ships
    const atRank = market.shipments.filter(
      (r) => market.shipments.filter((x) => x.units > r.units).length + 1 === m.makerRank,
    )
    expect(atRank.some((r) => plain(rank!.textContent).includes(`${formatNumber(r.units)} ตัว`))).toBe(true)
    expect(rank).toHaveTextContent('ทุกรุ่นของแบรนด์')
  })

  it.each(models.map(byLabel))('%s: safety lists its certifications and the warranty', async (_, m) => {
    const user = userEvent.setup()
    renderAt(`/models/${m.id}`)
    await user.click(screen.getByRole('tab', { name: 'ความปลอดภัยและการรับประกัน' }))
    const panel = screen.getByRole('tabpanel')
    const certs = within(panel).getByRole('heading', { name: 'มาตรฐานและการรับรอง' }).closest('section')!
    if (m.safety.certifications.length === 0) expect(certs).toHaveTextContent('ไม่ได้ระบุการรับรอง')
    else expect(within(certs).getAllByRole('listitem').map((li) => li.textContent)).toEqual(m.safety.certifications)
    const warranty = within(panel).getByRole('heading', { name: 'การรับประกัน' }).closest('section')!
    expect(plain(warranty.textContent)).toContain(plain(m.warranty.robot))
  })

  it('says how to buy one in Thailand before you decide', async () => {
    const user = userEvent.setup()
    const m = models[0]
    renderAt(`/models/${m.id}`)
    await user.click(screen.getByRole('tab', { name: 'ก่อนตัดสินใจ' }))
    const sheet = screen.getByRole('heading', { name: 'การจำหน่ายในไทย' }).closest('section')!
    expect(sheet).toHaveTextContent(AVAILABILITY_LABEL[m.availability])
    expect(plain(sheet.textContent)).toContain(plain(m.availabilityNote))
    expect(plain(sheet.textContent)).toContain(formatMonthTh(m.launched))
    const links = within(sheet).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/guide', '/guide'])
  })

  it('lists its sources in a disclosure', () => {
    const m = models[0]
    renderAt(`/models/${m.id}`)
    const details = screen.getByText(/แหล่งอ้างอิงของหน้านี้/).closest('details')!
    expect(details).toHaveTextContent(`(${m.sources.length} รายการ)`)
    const links = within(details).getAllByRole('link', { hidden: true })
    expect(links.map((a) => a.getAttribute('href'))).toEqual(m.sources.map((s) => s.url))
  })
})

describe('model page compare toggle', () => {
  it('uses the lineup card labels and toggles in place', async () => {
    const user = userEvent.setup()
    const m = models[0]
    renderAt(`/models/${m.id}`)
    await user.click(screen.getByRole('button', { name: 'เพิ่มเพื่อเปรียบเทียบ' }))
    const selected = screen.getByRole('button', { name: 'อยู่ในรายการเปรียบเทียบ' })
    expect(selected).toHaveFocus()
    expect(JSON.parse(localStorage.getItem('servo.compare')!)).toEqual([m.id])
    // The way on to the comparison is the tray, not a second link on the stage
    expect(screen.getByRole('complementary', { name: 'รายการเปรียบเทียบ' })).toBeInTheDocument()
    await user.click(selected)
    expect(screen.getByRole('button', { name: 'เพิ่มเพื่อเปรียบเทียบ' })).toHaveFocus()
  })

  it.runIf(models.length > COMPARE_LIMIT)('says the list is full, explains why and stays focusable', async () => {
    const user = userEvent.setup()
    const m = models[0]
    localStorage.setItem('servo.compare', JSON.stringify(models.slice(1, COMPARE_LIMIT + 1).map((x) => x.id)))
    renderAt(`/models/${m.id}`)
    const blocked = screen.getByRole('button', { name: `เลือกครบ ${COMPARE_LIMIT} รุ่นแล้ว` })
    expect(blocked).toHaveAttribute('aria-disabled', 'true')
    expect(blocked).not.toBeDisabled()
    expect(blocked).toHaveAccessibleDescription(/นำรุ่นอื่นออกจากรายการก่อน/)
    await user.click(blocked)
    expect(JSON.parse(localStorage.getItem('servo.compare')!)).not.toContain(m.id)
  })
})

describe('model page navigation', () => {
  it('goes back to the filtered lineup and focuses the list', async () => {
    const user = userEvent.setup()
    const m = models[0]
    const query = `?category=${m.category}`
    renderFromList(m.id, query)
    const back = screen.getByRole('link', { name: 'หุ่นยนต์ทั้งหมด' })
    expect(back).toHaveAttribute('href', `/${query}`)
    await user.click(back)
    expect(screen.getByRole('radio', { name: CATEGORY_BRIEF[m.category] })).toBeChecked()
    await nextFrame()
    expect(document.getElementById('models')).toHaveFocus()
  })

  it('pages through the catalogue in order, wrapping at the ends, and keeps the way back', async () => {
    const user = userEvent.setup()
    const [first, second] = models
    const last = models[models.length - 1]
    const query = `?category=${first.category}`
    renderFromList(first.id, query)
    const pager = screen.getByRole('navigation', { name: 'รุ่นอื่นในแค็ตตาล็อก' })
    const prev = within(pager).getByRole('link', { name: /ก่อนหน้า/ })
    const next = within(pager).getByRole('link', { name: /ถัดไป/ })
    expect(prev).toHaveAttribute('href', `/models/${last.id}`)
    expect(prev).toHaveAccessibleName(new RegExp(last.nameEn))
    expect(next).toHaveAttribute('href', `/models/${second.id}`)
    // Each card quotes the starting price, "ประมาณ" when it is a conversion
    if (second.span.price) {
      const approx = pricedTrims(second)[0].priceBasis === 'converted'
      expect(plain(next.querySelector('.mp-pager__price')?.textContent)).toBe(
        `เริ่มต้น${approx ? 'ประมาณ' : ''} ${formatNumber(second.span.price[0])} บาท`,
      )
    }

    // Opened on another tab, the next model starts again at ภาพรวม
    await user.click(screen.getAllByRole('tab')[2])
    await user.click(next)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(second.nameEn)
    expect(screen.getByRole('tab', { name: 'ภาพรวม' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('link', { name: 'หุ่นยนต์ทั้งหมด' })).toHaveAttribute('href', `/${query}`)
  })
})
