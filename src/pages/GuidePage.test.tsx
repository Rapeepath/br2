import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AppRoutes } from '../App'
import { logPriceAxis, tickLabel } from '../components/PriceRangeChart'
import { market, modelIds, models } from '../data'
import { CompareProvider } from '../lib/compare'
import { formatMonthTh, formatNumber } from '../lib/format'
import type { Model, Trim } from '../lib/types'
import { renderAt } from '../test/render'
import { chargeCosts, splitAside, tie } from './GuidePage'

const nextFrame = () => new Promise((r) => requestAnimationFrame(r))
const SECTION_IDS = ['market', 'checklist', 'setup', 'buying', 'energy', 'costs', 'prices', 'law']
const section = (id: string) => document.getElementById(id)!

const satang = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const r100 = (n: number) => (Math.round(n / 100) * 100).toLocaleString('th-TH')
const sum = (xs: { min: number; max: number }[]) =>
  xs.reduce((a, c) => ({ min: a.min + c.min, max: a.max + c.max }), { min: 0, max: 0 })

/** The home page's links into the guide carry the section in router state, not in the URL. */
function renderWithState(state: string) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/guide', state: { section: state } }]}>
      <CompareProvider validIds={modelIds}>
        <AppRoutes />
      </CompareProvider>
    </MemoryRouter>,
  )
}

describe('guide page', () => {
  it('has its own title, a cover heading and the data date in Buddhist Era', () => {
    renderAt('/guide')
    expect(document.title).toBe('คู่มือก่อนซื้อหุ่นยนต์ฮิวแมนนอยด์ – Servo')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('คู่มือก่อนซื้อหุ่นยนต์ฮิวแมนนอยด์')
    expect(screen.getByText(formatMonthTh(market.asOf), { selector: '.gcover__meta span' })).toBeInTheDocument()
    expect(formatMonthTh(market.asOf)).toMatch(/25\d\d$/)
  })

  it('indexes every section and each one is a labelled region', () => {
    renderAt('/guide')
    const index = screen.getByRole('navigation', { name: 'หัวข้อในหน้านี้' })
    expect(within(index).getAllByRole('button')).toHaveLength(SECTION_IDS.length)
    for (const id of SECTION_IDS) {
      const el = section(id)
      expect(el.tagName).toBe('SECTION')
      expect(el).toHaveAttribute('tabindex', '-1')
      expect(within(el).getAllByRole('heading', { level: 2 })[0]).toBeInTheDocument()
      expect(screen.getByRole('region', { name: el.querySelector('h2')!.textContent! })).toBe(el)
    }
  })

  it('jumps to and focuses a section from the index', async () => {
    const user = userEvent.setup()
    renderAt('/guide')
    const index = screen.getByRole('navigation', { name: 'หัวข้อในหน้านี้' })
    await user.click(within(index).getByRole('button', { name: /ค่าใช้จ่ายรายปี/ }))
    expect(section('costs')).toHaveFocus()
    await user.click(within(index).getByRole('button', { name: /ช่องทางซื้อในไทย/ }))
    expect(section('buying')).toHaveFocus()
  })

  it.each(['checklist', 'setup', 'costs'])('opens at the "%s" section linked from the home page', async (id) => {
    renderWithState(id)
    await nextFrame()
    await nextFrame()
    expect(section(id)).toHaveFocus()
  })

  it('ignores an unknown section in the link state', async () => {
    renderWithState('charging')
    await nextFrame()
    await nextFrame()
    expect(document.activeElement?.tagName).not.toBe('SECTION')
  })

  it('ends with the way on: the whole catalogue and the comparison', () => {
    renderAt('/guide')
    expect(screen.getByRole('link', { name: /ดูหุ่นยนต์ทั้งหมด/ })).toHaveAttribute('href', '/')
    expect(screen.getAllByRole('link', { name: 'เปรียบเทียบรุ่น' }).some((l) => l.getAttribute('href') === '/compare')).toBe(true)
  })
})

describe('market overview', () => {
  const rows = () => within(screen.getByRole('table', { name: /ยอดส่งมอบ/ })).getAllByRole('row').slice(1)

  it('ranks every maker by shipments, most first, with ties sharing a place', () => {
    renderAt('/guide')
    const sorted = [...market.shipments].sort((a, b) => b.units - a.units)
    expect(rows()).toHaveLength(sorted.length)
    rows().forEach((row, i) => {
      const r = sorted[i]
      const rank = 1 + sorted.filter((o) => o.units > r.units).length
      expect(within(row).getByRole('rowheader')).toHaveTextContent(r.brand)
      expect(row.querySelector('.rank__pos')).toHaveTextContent(String(rank))
      expect(row.querySelector('.rank__fig')).toHaveTextContent(r.units.toLocaleString('th-TH'))
    })
  })

  it('links each ranked maker to its robots in the catalogue', () => {
    renderAt('/guide')
    const table = screen.getByRole('table', { name: /ยอดส่งมอบ/ })
    // build-data ranks a model only when its maker is in the shipments table
    for (const m of models.filter((x) => x.makerRank != null)) {
      expect(within(table).getByRole('link', { name: m.nameEn })).toHaveAttribute('href', `/models/${m.id}`)
    }
  })

  it('names its source and links to every source', () => {
    renderAt('/guide')
    const foot = section('market').querySelector('.gtable__foot')!
    expect(foot).toHaveTextContent(/^ที่มา:/)
    expect(within(foot as HTMLElement).getByRole('link', { name: 'ดูแหล่งข้อมูลทั้งหมด' })).toHaveAttribute('href', '/sources')
  })
})

describe('buyer checklist', () => {
  const items = () => within(section('checklist')).getAllByRole('checkbox')

  it('lists every item as a checkbox described by its detail', () => {
    renderAt('/guide')
    expect(items()).toHaveLength(market.buyerChecklist.length)
    const first = items()[0]
    expect(first).toHaveAccessibleName(market.buyerChecklist[0].title)
    expect(first).toHaveAccessibleDescription(market.buyerChecklist[0].detail)
  })

  it('counts ticks, remembers them under servo.checklist and restores them', async () => {
    const user = userEvent.setup()
    const { unmount } = renderAt('/guide')
    await user.click(items()[0])
    await user.click(items()[2])
    expect(screen.getByText(/ตรวจแล้ว/)).toHaveTextContent(`ตรวจแล้ว 2 จาก ${market.buyerChecklist.length} ข้อ`)
    const stored = JSON.parse(localStorage.getItem('servo.checklist')!)
    expect(stored).toEqual(expect.arrayContaining([market.buyerChecklist[0].title, market.buyerChecklist[2].title]))

    unmount()
    renderAt('/guide')
    expect(items()[0]).toBeChecked()
    expect(items()[1]).not.toBeChecked()
    expect(items()[2]).toBeChecked()
  })

  it('ignores corrupt or stale storage', () => {
    localStorage.setItem('servo.checklist', '{not json')
    const { unmount } = renderAt('/guide')
    expect(items().every((c) => !(c as HTMLInputElement).checked)).toBe(true)
    unmount()
    localStorage.setItem('servo.checklist', JSON.stringify(['an item that no longer exists', 42]))
    renderAt('/guide')
    expect(screen.getByText(/ตรวจแล้ว/)).toHaveTextContent('ตรวจแล้ว 0 จาก')
  })

  it('"เริ่มใหม่" clears every tick, disables itself and hands focus to the first item', async () => {
    const user = userEvent.setup()
    renderAt('/guide')
    const reset = screen.getByRole('button', { name: 'เริ่มใหม่' })
    expect(reset).toBeDisabled()
    await user.click(items()[1])
    expect(reset).toBeEnabled()
    await user.click(reset)
    await nextFrame()
    expect(items().some((c) => (c as HTMLInputElement).checked)).toBe(false)
    expect(reset).toBeDisabled()
    expect(items()[0]).toHaveFocus()
  })
})

describe('site preparation', () => {
  it('lists every step and totals the price list, optional items only at the top end', () => {
    renderAt('/guide')
    const el = section('setup')
    for (const s of market.setup.steps) expect(within(el).getByRole('heading', { name: s.title })).toBeInTheDocument()
    const table = within(el).getByRole('table')
    expect(within(table).getAllByRole('row').filter((r) => r.closest('tbody'))).toHaveLength(market.setup.costs.length)
    const required = market.setup.costs.filter((c) => !/ไม่บังคับ/.test(c.item))
    const total = within(table).getAllByRole('row').find((r) => r.closest('tfoot'))!
    const [lo, hi] = [sum(required).min, sum(market.setup.costs).max]
    expect(total).toHaveTextContent(lo === hi ? r100(lo) : `${r100(lo)}–${r100(hi)}`)
  })
})

describe('where to buy', () => {
  it('opens every seller in a new tab and says so', () => {
    renderAt('/guide')
    const el = section('buying')
    for (const s of market.sellers) {
      const link = within(el).getByRole('link', { name: new RegExp(splitAside(s.name)[0]) })
      expect(link).toHaveAttribute('href', s.url)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'))
      expect(link).toHaveTextContent('เปิดในแท็บใหม่')
    }
  })

  it('states the exchange rates, their date and source, and what a converted price leaves out', () => {
    renderAt('/guide')
    const box = section('buying').querySelector('.fx') as HTMLElement
    const used = new Set(models.flatMap((m) => m.trims.flatMap((t) => (t.listPrice ? [t.listPrice.currency] : []))))
    const rates = { USD: market.fx.usd, CNY: market.fx.cny, EUR: market.fx.eur }
    for (const [c, rate] of Object.entries(rates)) {
      if (used.size > 0 && !used.has(c as keyof typeof rates)) continue
      expect(box).toHaveTextContent(`1 ${c}`)
      expect(box).toHaveTextContent(rate.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 4 }))
    }
    const [y, m, d] = market.fx.date.split('-')
    expect(box).toHaveTextContent(`${Number(d)} ${formatMonthTh(`${y}-${m}`)}`)
    expect(box).toHaveTextContent(/ยังไม่รวมค่าขนส่ง อากรขาเข้า และภาษีมูลค่าเพิ่ม/)
    expect(within(box).getByRole('link')).toHaveAttribute('href', market.fx.source.url)
  })

  it('lists well-known robots that are not on sale yet, with their status', () => {
    renderAt('/guide')
    const el = section('buying')
    for (const u of market.notForSale) {
      const item = within(el).getByText(u.name, { selector: '.unlisted__name span' }).closest('li')!
      expect(item).toHaveTextContent(u.status)
    }
  })
})

describe('energy cost per charge', () => {
  const trim = (t: Partial<Trim>): Trim => ({
    name: 'T',
    priceTHB: null,
    listPrice: null,
    priceBasis: null,
    dof: null,
    handDof: null,
    hand: null,
    payloadKg: null,
    speedMs: null,
    runtimeH: null,
    batteryWh: null,
    compute: null,
    jointTorqueNm: null,
    ...t,
  })
  const robot = (id: string, trims: Trim[]) => ({ ...models[0], id, trims }) as Model
  const perUnit = market.electricity.filter((e) => /หน่วย|kWh/i.test(e.unit))
  const tariffs = perUnit.length > 0 ? perUnit : market.electricity

  it('prices a full charge from kWh at the cheapest and dearest rates, and per hour where runtime is known', () => {
    const rows = chargeCosts(
      [
        robot('big', [trim({ batteryWh: 1000, runtimeH: 2 }), trim({ batteryWh: 2000 })]),
        robot('none', [trim({})]),
        robot('small', [trim({ batteryWh: 500, runtimeH: 4 })]),
      ],
      [
        { min: 3, max: 4 },
        { min: 4, max: 5 },
      ],
    )
    expect(rows.map((r) => r.model.id)).toEqual(['small', 'big'])
    expect(rows[0].charge).toEqual({ min: 1.5, max: 2.5 })
    expect(rows[0].hour).toEqual({ min: 0.375, max: 0.625 })
    expect(rows[1].charge).toEqual({ min: 3, max: 10 })
    // Only the 1 kWh trim states a runtime: 3 ÷ 2 to 5 ÷ 2
    expect(rows[1].hour).toEqual({ min: 1.5, max: 2.5 })
    expect(chargeCosts(models, [])).toEqual([])
  })

  const expected = chargeCosts(models, tariffs)

  it.runIf(expected.length > 0)('charts every robot that states its battery, cheapest first, with its figures', () => {
    renderAt('/guide')
    const table = screen.getByRole('table', { name: /ค่าไฟชาร์จเต็มหนึ่งครั้ง/ })
    expect(within(table).getAllByRole('columnheader').length).toBeGreaterThanOrEqual(3)
    const heads = within(table).getAllByRole('rowheader')
    expect(heads.map((h) => h.querySelector('a')!.textContent)).toEqual(expected.map((r) => r.model.nameEn))
    const first = heads[0].closest('tr')!
    const { charge, hour } = expected[0]
    expect(first.querySelector('.energy__fig')).toHaveTextContent(`${satang(charge.min)}–${satang(charge.max)}`)
    if (hour) expect(first.querySelector('.energy__hour')).toHaveTextContent(satang(hour.min))
    expect(within(heads[0]).getByRole('link')).toHaveAttribute('href', `/models/${expected[0].model.id}`)
  })

  it.runIf(expected.length > 0)('sums it up: no full charge costs more than the dearest one, rounded up', () => {
    renderAt('/guide')
    const most = Math.ceil(Math.max(...expected.map((r) => r.charge.max)))
    expect(section('energy').querySelector('.callout')).toHaveTextContent(`ไม่เกิน ${most.toLocaleString('th-TH')} บาท`)
    expect(section('energy').querySelector('.basis')).toHaveTextContent(/1,000 × อัตราค่าไฟฟ้าต่อหน่วย/)
  })

  it('lists every tariff with its rate', () => {
    renderAt('/guide')
    const table = within(section('energy')).getByRole('table', { name: /อัตราค่าไฟฟ้า/ })
    expect(within(table).getAllByRole('rowheader')).toHaveLength(market.electricity.length)
  })
})

describe('costs', () => {
  const yearly = market.ownershipCost.yearly
  const power = yearly.filter((c) => /^ค่าไฟฟ้า/.test(c.item))

  it('totals the yearly costs, counting electricity tariffs as alternatives', () => {
    renderAt('/guide')
    const table = screen.getByRole('table', { name: 'ค่าใช้จ่ายรายปี' })
    const totals = within(table).getAllByRole('row').filter((r) => r.closest('tfoot'))
    if (power.length >= 2) {
      const base = sum(yearly.filter((c) => !power.includes(c)))
      expect(totals).toHaveLength(power.length)
      power.forEach((p, i) => expect(totals[i]).toHaveTextContent(`${r100(base.min + p.min)}–${r100(base.max + p.max)}`))
    } else {
      const all = sum(yearly)
      expect(totals).toHaveLength(1)
      expect(totals[0]).toHaveTextContent(`${r100(all.min)}–${r100(all.max)}`)
    }
    // No satang in a total
    for (const t of totals) expect(t.textContent).not.toMatch(/\.\d\d/)
  })

  it('quotes the same yearly figure as the home page, without the robot itself', () => {
    renderAt('/guide')
    const fixed = sum(yearly.filter((c) => !(power.length >= 2 && power.includes(c))))
    const low = r100(fixed.min + (power.length >= 2 ? Math.min(...power.map((p) => p.min)) : 0))
    const high = r100(fixed.max + (power.length >= 2 ? Math.max(...power.map((p) => p.max)) : 0))
    const intro = section('costs').querySelector('.gsec__intro')!
    expect(intro).toHaveTextContent(`ปีละประมาณ ${low}–${high} บาท ไม่รวมราคาหุ่นยนต์`)
  })

  it('counts optional one-time items only toward the top of the range', () => {
    renderAt('/guide')
    const items = market.ownershipCost.oneTime
    const table = screen.getByRole('table', { name: 'ค่าใช้จ่ายครั้งแรก' })
    const total = within(table).getAllByRole('row').find((r) => r.closest('tfoot'))!
    const lo = sum(items.filter((c) => !/ไม่บังคับ/.test(c.item))).min
    const hi = sum(items).max
    expect(total).toHaveTextContent(lo === hi ? r100(lo) : `${r100(lo)}–${r100(hi)}`)
  })
})

describe('price chart axis', () => {
  it('names round prices the way Thai buyers say them', () => {
    expect(tickLabel(50_000)).toBe('5 หมื่น')
    expect(tickLabel(100_000)).toBe('1 แสน')
    expect(tickLabel(250_000)).toBe('2.5 แสน')
    expect(tickLabel(1_000_000)).toBe('1 ล้าน')
    expect(tickLabel(2_500_000)).toBe('2.5 ล้าน')
    expect(tickLabel(10_000_000)).toBe('10 ล้าน')
  })

  it('runs on 1–2.5–5 steps just around the data, on a logarithmic scale', () => {
    const axis = logPriceAxis(40_000, 5_000_000)
    expect(axis.min).toBe(25_000)
    expect(axis.max).toBe(5_000_000)
    expect(axis.ticks.map((t) => t.value)).toEqual([
      25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000,
    ])
    expect(axis.ticks.filter((t) => t.major).map((t) => t.label)).toEqual(['1 แสน', '1 ล้าน'])
    expect(axis.at(axis.min)).toBe(0)
    expect(axis.at(axis.max)).toBe(1)
    // Equal ratios are equal distances
    expect(axis.at(1_000_000) - axis.at(100_000)).toBeCloseTo(axis.at(500_000) - axis.at(50_000), 10)
    expect(axis.at(10)).toBe(0)
  })

  it('names only the decades and the ends when the axis is crowded', () => {
    const axis = logPriceAxis(40_000, 5_000_000)
    expect(axis.ticks.filter((t) => t.labelled).map((t) => t.label)).toEqual(['2.5 หมื่น', '1 แสน', '1 ล้าน', '5 ล้าน'])
    const short = logPriceAxis(600_000, 3_000_000)
    expect(short.ticks.map((t) => t.value)).toEqual([500_000, 1_000_000, 2_500_000, 5_000_000])
    expect(short.ticks.every((t) => t.labelled)).toBe(true)
  })

  it('gives a single price an axis around it', () => {
    const axis = logPriceAxis(1_000_000, 1_000_000)
    expect(axis.min).toBeLessThan(1_000_000)
    expect(axis.max).toBeGreaterThan(1_000_000)
    expect(axis.at(1_000_000)).toBeGreaterThan(0)
    expect(axis.at(1_000_000)).toBeLessThan(1)
  })
})

describe('price chart', () => {
  const priced = models
    .filter((m) => m.span.price != null)
    .sort((a, b) => a.span.price![0] - b.span.price![0] || a.span.price![1] - b.span.price![1])
  const chart = () => screen.getByRole('table', { name: /ช่วงราคา/ })
  const rowOf = (m: Model) => within(chart()).getByRole('rowheader', { name: m.nameEn }).closest('tr')!
  const isConverted = (m: Model) => m.trims.some((t) => t.priceBasis === 'converted')

  it('is a table named for price ranges, one row per priced model, cheapest first', () => {
    renderAt('/guide')
    const heads = within(chart()).getAllByRole('columnheader').map((h) => h.textContent)
    expect(heads).toEqual(expect.arrayContaining(['รุ่น', 'ราคา (บาท)', 'ที่มาของราคา']))
    expect(within(chart()).getAllByRole('rowheader').map((h) => h.textContent)).toEqual(priced.map((m) => m.nameEn))
    expect(section('prices')).toHaveTextContent('แกนลอการิทึม')
  })

  it('links each model to its page and states the exact baht range', () => {
    renderAt('/guide')
    const m = priced[0]
    expect(within(rowOf(m)).getByRole('link', { name: m.nameEn })).toHaveAttribute('href', `/models/${m.id}`)
    const [lo, hi] = m.span.price!
    expect(rowOf(m)).toHaveTextContent(lo === hi ? formatNumber(lo) : `${formatNumber(lo)}–${formatNumber(hi)}`)
  })

  it.runIf(priced.some(isConverted))('marks converted prices approximate and names the maker’s own price', () => {
    renderAt('/guide')
    const m = priced.find(isConverted)!
    const t = m.trims.find((x) => x.priceBasis === 'converted' && x.listPrice)!
    expect(rowOf(m).querySelector('.prc__price')).toHaveTextContent(/^ประมาณ/)
    expect(rowOf(m).querySelector('.prc__basis')).toHaveTextContent(`แปลงจาก ${t.listPrice!.currency}`)
    expect(rowOf(m).querySelector('.prc__basis')).toHaveTextContent(formatNumber(t.listPrice!.amount))
    expect(section('prices').querySelector('.prc__foot')).toHaveTextContent(`1 ${t.listPrice!.currency} =`)
  })

  it.runIf(priced.some((m) => !isConverted(m)))('says a Thai dealer’s price is the dealer’s', () => {
    renderAt('/guide')
    const m = priced.find((x) => !isConverted(x))!
    expect(rowOf(m).querySelector('.prc__basis')).toHaveTextContent('ตัวแทนในไทย')
    expect(rowOf(m).querySelector('.prc__price')).not.toHaveTextContent('ประมาณ')
  })
})

describe('Thai line-breaking helpers', () => {
  it('splits a closing bracketed aside, nested brackets included', () => {
    expect(splitAside('ค่าไฟฟ้า TOU (มิเตอร์ไม่เกิน 15(45)A รวม VAT)')).toEqual([
      'ค่าไฟฟ้า TOU',
      '(มิเตอร์ไม่เกิน 15(45)A รวม VAT)',
    ])
    expect(splitAside('แบตเตอรี่สำรอง (ไม่บังคับ)')).toEqual(['แบตเตอรี่สำรอง', '(ไม่บังคับ)'])
    expect(splitAside('Unitree Robotics')).toEqual(['Unitree Robotics', null])
  })

  it('keeps numbers with units and compounds whole without changing the text', () => {
    const source = 'หุ่นยนต์ฮิวแมนนอยด์ 864 Wh ราคา 559,000–2,250,000 บาท ร้อยละ 7 ณ 24 ตุลาคม 2569 รองรับ ROS 2'
    const { container } = render(<p>{tie(source)}</p>)
    const text = container.textContent!
    expect(text.replace(/\xA0/g, ' ')).toBe(source)
    expect(text).toContain('864\xA0Wh')
    expect(text).toContain('ตุลาคม\xA02569')
    expect(text).toContain('ROS\xA02')
    const kept = [...container.querySelectorAll('.nowrap')].map((n) => n.textContent)
    expect(kept).toEqual(expect.arrayContaining(['หุ่นยนต์', 'ฮิวแมนนอยด์', '559,000–2,250,000']))
  })

  it('does not glue a unit to the next figure', () => {
    const { container } = render(<p>{tie('35 กก. 1,000 บาท')}</p>)
    expect(container.textContent).toContain('กก. 1,000')
  })
})
