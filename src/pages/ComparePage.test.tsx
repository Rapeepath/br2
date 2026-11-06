import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { getModel, market, models } from '../data'
import { formatListPrice, formatNumber, msToKmh } from '../lib/format'
import type { Model, Range } from '../lib/types'
import { renderAt } from '../test/render'

const nextFrame = () => new Promise((r) => requestAnimationFrame(r))
const setCompare = (ids: string[]) => localStorage.setItem('servo.compare', JSON.stringify(ids))
const name = (id: string) => getModel(id)!.nameEn

const table = () => screen.getByRole('table')
const columnNames = () => within(table()).getAllByRole('columnheader').map((h) => h.getAttribute('aria-label'))

/** The cells of a row, in column order. Free-text rows have a phone twin (one spanning cell) first. */
function cellsOf(label: string | RegExp) {
  const rows = within(table()).getAllByRole('rowheader', { name: label })
  return within(rows.at(-1)!.closest('tr')!).getAllByRole('cell')
}

const isMarked = (cell: HTMLElement) => cell.classList.contains('is-best')

/** The rule the sheet promises: the best figure wins, unless one is unpublished or they all tie. */
function expectedBest(values: (number | null)[], better: 'high' | 'low'): boolean[] {
  if (values.some((v) => v == null)) return values.map(() => false)
  const nums = values as number[]
  const target = better === 'high' ? Math.max(...nums) : Math.min(...nums)
  if (nums.every((v) => v === target)) return values.map(() => false)
  return nums.map((v) => v === target)
}

const hi = (r: Range | null) => r?.[1] ?? null
const startBasis = (m: Model) => m.trims.find((t) => t.priceTHB != null)?.priceBasis ?? null

// Every model, three to a sheet; a lone last model is compared with the first one.
const sheets: Model[][] = []
for (let i = 0; i < models.length; i += 3) {
  const sheet = models.slice(i, i + 3)
  if (sheet.length === 1 && models.length > 1) sheet.unshift(models[0])
  if (sheet.length > 1) sheets.push(sheet)
}

const dealer = models.filter((m) => startBasis(m) === 'dealer')
const converted = models.filter((m) => startBasis(m) === 'converted')
// Two converted prices that differ, so the cheaper one is marked
const convertedPair = converted.flatMap((a) =>
  converted.filter((b) => b.span.price![0] > a.span.price![0]).map((b) => [b, a] as const),
)[0]
const ranked = models.find((m) => m.makerRank != null)
const unranked = models.find((m) => m.makerRank == null)
const handsDiffer = models.find((m) => new Set(m.trims.map((t) => t.hand)).size > 1)

describe('compare page', () => {
  it('starts with quick picks and shows the table once two models are chosen', async () => {
    const user = userEvent.setup()
    renderAt('/compare')
    expect(document.title).toBe('เปรียบเทียบรุ่น – Servo')
    expect(screen.getByRole('heading', { level: 2, name: /เลือกอย่างน้อย 2 รุ่น/ })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ล้างรายการ' })).not.toBeInTheDocument()
    const start = screen.getByRole('region', { name: /เลือกอย่างน้อย 2 รุ่น/ })
    expect(within(start).getByRole('link', { name: 'หุ่นยนต์' })).toHaveAttribute('href', '/')

    // Each quick pick is named after its model and says whether it is chosen.
    const first = screen.getByRole('button', { name: models[0].nameEn })
    expect(first).toHaveAttribute('aria-pressed', 'false')
    await user.click(first)
    expect(screen.getByRole('button', { name: models[0].nameEn })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { level: 2, name: 'เลือกอีกอย่างน้อย 1 รุ่น' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: models[1].nameEn }))
    expect(columnNames()).toEqual([models[0].nameEn, models[1].nameEn])
    // The picks gave way to the table; focus lands on the add control, not <body>.
    await nextFrame()
    expect(screen.getByLabelText('เพิ่มรุ่น')).toHaveFocus()
  })

  it('adds a third model only on the button, then hands focus to the new column', async () => {
    const user = userEvent.setup()
    setCompare([models[0].id, models[1].id])
    renderAt('/compare')
    expect(columnNames()).toHaveLength(2)

    // Choosing an option alone must not add it (keyboard users browse options with the arrow keys).
    await user.selectOptions(screen.getByLabelText('เพิ่มรุ่น'), models[2].id)
    expect(columnNames()).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'เพิ่ม' }))
    expect(columnNames()).toEqual(models.slice(0, 3).map((m) => m.nameEn))

    // Full: the picker and its button disable themselves, so focus moves on to the new column.
    expect(screen.getByLabelText('เพิ่มรุ่น')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'เพิ่ม' })).toBeDisabled()
    await nextFrame()
    expect(within(table()).getByRole('link', { name: models[2].nameEn })).toHaveFocus()
    expect(JSON.parse(localStorage.getItem('servo.compare')!)).toEqual(models.slice(0, 3).map((m) => m.id))
  })

  it('removing columns keeps focus on a remove button, then on the quick pick to undo', async () => {
    const user = userEvent.setup()
    const [a, b, c] = models.slice(0, 3).map((m) => m.id)
    setCompare([a, b, c])
    renderAt('/compare')

    await user.click(screen.getByRole('button', { name: `นำ ${name(b)} ออกจากรายการเปรียบเทียบ` }))
    expect(columnNames()).toEqual([name(a), name(c)])
    await nextFrame()
    expect(screen.getByRole('button', { name: `นำ ${name(c)} ออกจากรายการเปรียบเทียบ` })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: `นำ ${name(a)} ออกจากรายการเปรียบเทียบ` }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await nextFrame()
    const undo = screen.getByRole('button', { name: name(a) })
    expect(undo).toHaveFocus()
    expect(undo).toHaveAttribute('aria-pressed', 'false')
  })

  it('clears the list from the cover and starts over at the first quick pick', async () => {
    const user = userEvent.setup()
    setCompare([models[0].id, models[1].id])
    renderAt('/compare')
    await user.click(screen.getByRole('button', { name: 'ล้างรายการ' }))
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await nextFrame()
    expect(screen.getByRole('button', { name: models[0].nameEn })).toHaveFocus()
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0)
  })

  it('sets out every group of rows', () => {
    setCompare(models.slice(0, 3).map((m) => m.id))
    renderAt('/compare')
    const labels: (string | RegExp)[] = [
      'ราคาเริ่มต้น',
      'ราคารุ่นย่อยสูงสุด',
      'รุ่นย่อยและราคา',
      'ที่มาของราคา',
      'เงื่อนไขราคา',
      'ความสูง',
      'น้ำหนัก',
      'การเคลื่อนที่',
      'ประเภทการใช้งาน',
      'องศาอิสระ',
      'มือหยิบจับ',
      'ความเร็วสูงสุด',
      'แรงบิดข้อต่อสูงสุด',
      'ความจุแบตเตอรี่',
      'เวลาใช้งานต่อการชาร์จ',
      'เวลาชาร์จ',
      'แบตเตอรี่ถอดเปลี่ยนได้',
      'น้ำหนักบรรทุก',
      'ระบบประมวลผล',
      'เซนเซอร์',
      'ซอฟต์แวร์และ SDK',
      'ระบบความปลอดภัย',
      'มาตรฐานที่ได้รับรอง',
      'รับประกันตัวหุ่นยนต์',
      'รับประกันแบตเตอรี่',
      'ช่องทางในไทย',
      'ผู้จัดจำหน่าย',
      /^อันดับผู้ผลิตตามยอดส่งมอบ/,
      'สัญชาติแบรนด์',
      'เริ่มวางจำหน่าย',
      'ข้อดี',
      'ข้อจำกัด',
      'เหมาะกับ',
    ]
    for (const label of labels) expect(cellsOf(label), String(label)).toHaveLength(3)
    // Each model's height, as published
    expect(cellsOf('ความสูง').map((c) => c.textContent)).toEqual(
      models.slice(0, 3).map((m) => `${formatNumber(m.heightCm)} ซม.`),
    )
  })

  it.each(sheets.map((s) => [s.map((m) => m.nameEn).join(', '), s] as const))(
    'marks the best figure only when every model publishes one (%s)',
    (_, sheet) => {
      setCompare(sheet.map((m) => m.id))
      renderAt('/compare')
      const rows: [string, (m: Model) => number | null, 'high' | 'low'][] = [
        ['องศาอิสระ', (m) => hi(m.span.dof), 'high'],
        // Ranked in km/h, as printed
        ['ความเร็วสูงสุด', (m) => (m.span.speedMs ? msToKmh(m.span.speedMs[1]) : null), 'high'],
        ['เวลาใช้งานต่อการชาร์จ', (m) => hi(m.span.runtimeH), 'high'],
        ['เวลาชาร์จ', (m) => m.charging.timeH, 'low'],
        ['น้ำหนักบรรทุก', (m) => hi(m.span.payloadKg), 'high'],
      ]
      for (const [label, get, better] of rows) {
        const cells = cellsOf(label)
        expect(cells.map(isMarked), label).toEqual(expectedBest(sheet.map(get), better))
        // An unpublished figure reads as such
        sheet.forEach((m, i) => get(m) == null && expect(cells[i]).toHaveTextContent('ไม่ระบุ'))
      }
      // A marked figure says why for screen readers
      for (const cell of cellsOf('องศาอิสระ').filter(isMarked)) {
        expect(within(cell).getByText(/มีองศาอิสระมากที่สุดในการเปรียบเทียบนี้/)).toBeInTheDocument()
      }
      sheet.forEach((m, i) => {
        if (m.trims.every((t) => t.jointTorqueNm == null)) expect(cellsOf('แรงบิดข้อต่อสูงสุด')[i]).toHaveTextContent('ไม่เปิดเผย')
      })
    },
  )

  it.runIf(dealer.length > 0 && converted.length > 0)(
    'never ranks a Thai dealer price against a converted list price, and says why',
    () => {
      const [d, c] = [dealer[0], converted[0]]
      setCompare([d.id, c.id])
      renderAt('/compare')

      const start = cellsOf('ราคาเริ่มต้น')
      expect(start.some(isMarked)).toBe(false)
      expect(screen.getAllByText('ราคามาจากต่างแหล่งกัน')).toHaveLength(1)

      // The converted figure reads as approximate and names the maker's own price; the dealer's doesn't.
      const list = c.trims.find((t) => t.priceTHB != null)!.listPrice!
      expect(start[1]).toHaveTextContent('ประมาณ')
      expect(start[1]).toHaveTextContent(formatListPrice(list))
      expect(start[0]).not.toHaveTextContent('ประมาณ')

      const basis = cellsOf('ที่มาของราคา')
      expect(basis[0]).toHaveTextContent('ตัวแทนในไทย')
      expect(basis[1]).toHaveTextContent(`แปลงจาก ${list.currency}`)

      // The notes give the rate and its date.
      const rate = { USD: market.fx.usd, CNY: market.fx.cny, EUR: market.fx.eur }[list.currency as 'USD']
      const notes = screen.getByRole('region', { name: 'หมายเหตุ' })
      expect(notes).toHaveTextContent(`${formatNumber(rate)} บาท`)
      expect(notes).toHaveTextContent(String(Number(market.fx.date.slice(0, 4)) + 543))
    },
  )

  it.runIf(convertedPair != null)('marks the cheaper of two converted starting prices', () => {
    const [dear, cheap] = convertedPair!
    setCompare([dear.id, cheap.id])
    renderAt('/compare')
    const start = cellsOf('ราคาเริ่มต้น')
    expect(start.map(isMarked)).toEqual([false, true])
    expect(start[1]).toHaveTextContent(formatNumber(cheap.span.price![0]))
    expect(within(start[1]).getByText(/ราคาเริ่มต้นต่ำที่สุดในการเปรียบเทียบนี้/)).toBeInTheDocument()
    expect(screen.queryByText('ราคามาจากต่างแหล่งกัน')).not.toBeInTheDocument()

    // Each trim in the price list keeps the maker's price beside its baht figure.
    const trims = cellsOf('รุ่นย่อยและราคา')[0]
    for (const t of dear.trims) {
      expect(trims).toHaveTextContent(t.name)
      if (t.priceBasis === 'converted') expect(trims).toHaveTextContent(formatListPrice(t.listPrice!))
    }
  })

  it('reads speeds in km/h with the maker’s m/s beneath', () => {
    const fast = models.find((m) => m.span.speedMs != null)!
    const other = models.find((m) => m.id !== fast.id)!
    setCompare([fast.id, other.id])
    renderAt('/compare')
    const cell = cellsOf('ความเร็วสูงสุด')[0]
    expect(cell).toHaveTextContent(`${formatNumber(msToKmh(fast.span.speedMs![1]))} กม./ชม.`)
    expect(cell).toHaveTextContent(`${formatNumber(fast.span.speedMs![1])} m/s`)
  })

  it.runIf(ranked != null && unranked != null)(
    'ranks makers by shipments in ตัว, and says when one is not listed',
    () => {
      setCompare([ranked!.id, unranked!.id])
      renderAt('/compare')
      const [listed, absent] = cellsOf(/^อันดับผู้ผลิตตามยอดส่งมอบ/)
      expect(listed).toHaveTextContent(`อันดับ ${ranked!.makerRank}`)
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
      const entry = market.shipments.find(
        (r) => norm(r.brand).startsWith(norm(ranked!.brand)) || norm(ranked!.brand).startsWith(norm(r.brand)),
      )
      if (entry) expect(listed).toHaveTextContent(`${formatNumber(entry.units)} ตัว`)
      expect(absent).toHaveTextContent('ไม่อยู่ในอันดับ')
      // A missing rank could be the best one, so nothing is marked.
      expect(isMarked(listed)).toBe(false)
    },
  )

  it.runIf(handsDiffer != null)('lists the hands trim by trim when they differ', () => {
    const other = models.find((m) => m.id !== handsDiffer!.id)!
    setCompare([handsDiffer!.id, other.id])
    renderAt('/compare')
    const cell = cellsOf('มือหยิบจับ')[0]
    for (const t of handsDiffer!.trims) expect(cell).toHaveTextContent(t.name)
  })
})
