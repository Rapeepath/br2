import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { models } from './data'
import { CATEGORY_BRIEF } from './lib/format'
import { renderAt } from './test/render'

const grid = () => screen.getByRole('heading', { name: 'หุ่นยนต์ทั้งหมด' }).closest('section')!
// Filter on the first model's category, so the test follows the data whatever the lineup is
const category = models[0].category
const inCategory = models.filter((m) => m.category === category)
const cardHeadings = () => within(grid()).queryAllByRole('heading', { level: 3 })

describe('home page', () => {
  it('lists every model as a card, in catalogue order', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(cardHeadings().map((h) => h.textContent)).toEqual(models.map((m) => m.nameEn))
  })

  it('narrows the list as you type and announces the count', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const target = models[models.length - 1]
    await user.type(screen.getByRole('searchbox', { name: 'ค้นหาหุ่นยนต์' }), target.nameEn)
    expect(cardHeadings().map((h) => h.textContent)).toContain(target.nameEn)
    expect(screen.getByText(new RegExp(`^พบ \\d+ จาก ${models.length} รุ่น$`))).toBeInTheDocument()
  })

  it('shows an empty state with a reset that restores all models', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.type(screen.getByRole('searchbox', { name: 'ค้นหาหุ่นยนต์' }), 'zzzz')
    expect(screen.getByText('ไม่พบรุ่นที่ตรงกับเงื่อนไขนี้')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ล้างตัวกรองทั้งหมด' }))
    expect(cardHeadings()).toHaveLength(models.length)
  })

  it('filters by category with the segmented control', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('radio', { name: CATEGORY_BRIEF[category] }))
    expect(cardHeadings().map((h) => h.textContent)).toEqual(inCategory.map((m) => m.nameEn))
  })

  it('offers only the categories the lineup has', () => {
    renderAt('/')
    const offered = screen.getAllByRole('radio').map((r) => r.getAttribute('value'))
    // The control lists categories in the order CATEGORY_BRIEF defines them
    const present = (Object.keys(CATEGORY_BRIEF) as (keyof typeof CATEGORY_BRIEF)[]).filter((c) =>
      models.some((m) => m.category === c),
    )
    expect(offered).toEqual(['all', ...present])
  })

  it('reads filters from the URL so back-navigation keeps them', () => {
    renderAt(`/?category=${category}`)
    expect(screen.getByRole('radio', { name: CATEGORY_BRIEF[category] })).toBeChecked()
    expect(cardHeadings()).toHaveLength(inCategory.length)
  })

  it('marks converted prices as approximate and keeps the card to price and three figures', () => {
    renderAt('/')
    for (const m of models) {
      const card = within(grid()).getByRole('heading', { level: 3, name: m.nameEn }).closest('article')!
      const cheapest = m.trims.find((t) => t.priceTHB != null)
      if (cheapest?.priceBasis === 'converted') expect(within(card).getByText(/^ประมาณ/)).toBeInTheDocument()
      else expect(within(card).queryByText(/^ประมาณ/)).not.toBeInTheDocument()
      // The maker's own figure is on the model page, not the card
      expect(card.textContent).not.toContain('ราคาผู้ผลิต')
      expect(within(card).getByRole('list', { name: 'สเปกหลัก' })).toHaveTextContent(`${m.heightCm.toLocaleString('th-TH')} ซม.`)
    }
  })

  it('moves focus to the search box after clearing filters', async () => {
    const user = userEvent.setup()
    renderAt(`/?category=${category}`)
    await user.click(screen.getByRole('button', { name: 'ล้างตัวกรอง' }))
    await new Promise((r) => requestAnimationFrame(r))
    expect(screen.getByRole('searchbox', { name: 'ค้นหาหุ่นยนต์' })).toHaveFocus()
  })
})

describe('compare list', () => {
  it('caps the list at three; the rest say why and stay focusable', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const buttons = () => screen.getAllByRole('button', { name: /เพิ่มเพื่อเปรียบเทียบ/ })
    await user.click(buttons()[0])
    await user.click(buttons()[0])
    await user.click(buttons()[0])
    expect(screen.getAllByRole('button', { name: /อยู่ในรายการเปรียบเทียบ/ })).toHaveLength(3)

    const blocked = screen.getAllByRole('button', { name: /เลือกครบ 3 รุ่นแล้ว/ })
    expect(blocked).toHaveLength(models.length - 3)
    expect(blocked.every((b) => b.getAttribute('aria-disabled') === 'true' && !b.hasAttribute('disabled'))).toBe(true)
    await user.click(blocked[0])
    expect(screen.getAllByRole('button', { name: /อยู่ในรายการเปรียบเทียบ/ })).toHaveLength(3)
    expect(screen.getByRole('complementary', { name: 'รายการเปรียบเทียบ' })).toBeInTheDocument()
  })
})

describe('shell', () => {
  it('shows a not-found page for an unknown route', () => {
    renderAt('/nope')
    expect(screen.getByRole('heading', { name: 'ไม่พบหน้าที่ต้องการ' })).toBeInTheDocument()
    expect(document.title).toBe('ไม่พบหน้า – Servo')
  })

  it('marks the lineup in the menu on the home page', () => {
    renderAt('/')
    const nav = screen.getByRole('navigation', { name: 'เมนูหลัก' })
    expect(within(nav).getByRole('link', { name: 'หุ่นยนต์' })).toHaveClass('active')
  })
})
