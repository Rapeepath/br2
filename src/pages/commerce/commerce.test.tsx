import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { models } from '../../data'
import { resetLiveCache } from '../../lib/live'
import { renderAt } from '../../test/render'
import { faqFlat, faqLd } from './faqContent'
import { tie } from './PageStage'
import { matchModels } from './solutions'

const g1 = models.find((m) => m.id === 'unitree-g1')!

const CATALOG = [
  ...g1.trims.map((t, i) => ({
    id: `unitree-g1-${i}`,
    sku: `SV-UNG1-${i}`,
    refId: 'unitree-g1',
    variant: t.name,
    name: `Unitree ${t.name}`,
    subtitle: g1.nameTh,
    categoryId: 'robot',
    price: t.priceTHB,
    stockState: 'in',
    stock: 2,
    image: g1.image.srcSmall,
  })),
  { id: 'acc-gantry', sku: 'SV-AC-03', refId: null, variant: null, name: 'โครงแขวนกันล้ม (gantry)', subtitle: 'รอกไฟฟ้า', categoryId: 'accessory', price: 34900, stockState: 'in', stock: 6, image: null },
  { id: 'svc-install', sku: 'SV-SV-01', refId: null, variant: null, name: 'ติดตั้งและอบรมการใช้งาน', subtitle: 'วิศวกร 1 วัน', categoryId: 'service', price: 25000, stockState: 'service', stock: null, image: null },
]

type Call = { url: string; method: string; body: any }
let calls: Call[] = []

function mockApi(extra: (url: string, method: string, body: any) => unknown = () => undefined) {
  calls = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      const body = init?.body ? JSON.parse(String(init.body)) : null
      calls.push({ url, method, body })
      const custom = extra(url, method, body)
      const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
      if (custom !== undefined) return json(custom)
      if (url.startsWith('/api/public/catalog')) return json(CATALOG)
      if (url.startsWith('/api/public/store')) return json({ booking: { from: '2026-11-07', to: '2026-11-27', durationMin: 90, windowDays: 21 } })
      return json({ error: 'not mocked', code: 'NOT_FOUND' }, 404)
    }),
  )
}

beforeEach(() => resetLiveCache())
afterEach(() => vi.unstubAllGlobals())

describe('contact page', () => {
  it('shows what to fix next to each field and sends nothing', async () => {
    mockApi()
    const user = userEvent.setup()
    renderAt('/contact')
    await user.click(screen.getByRole('button', { name: 'ส่งข้อความ' }))
    expect(screen.getByText('กรอกชื่อ')).toBeInTheDocument()
    expect(screen.getByText('กรอกเบอร์โทรศัพท์ 9–10 หลัก')).toBeInTheDocument()
    expect(screen.getByText('เขียนข้อความถึงเราสั้นๆ')).toBeInTheDocument()
    expect(screen.getByText('ติ๊กยินยอมก่อนส่ง')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
    expect(screen.getByRole('textbox', { name: /ชื่อ–นามสกุล/ })).toHaveAttribute('aria-invalid', 'true')
  })

  it('sends the inquiry with the picked model and shows the reference', async () => {
    mockApi((url, method) => (url === '/api/public/leads' && method === 'POST' ? { no: 'LD691106-0007' } : undefined))
    const user = userEvent.setup()
    renderAt('/contact?model=unitree-g1')
    expect(screen.getByRole('checkbox', { name: 'Unitree G1' })).toBeChecked()
    await user.type(screen.getByRole('textbox', { name: /ชื่อ–นามสกุล/ }), 'ทดสอบ ระบบ')
    await user.type(screen.getByRole('textbox', { name: /เบอร์โทรศัพท์/ }), '081-234-5678')
    await user.type(screen.getByRole('textbox', { name: /ข้อความ/ }), 'ขอราคาสำหรับมหาวิทยาลัย 2 เครื่อง')
    await user.click(screen.getByRole('checkbox', { name: /ยินยอม/ }))
    await user.click(screen.getByRole('button', { name: 'ส่งข้อความ' }))
    expect(await screen.findByText('LD691106-0007')).toBeInTheDocument()
    const sent = calls.find((c) => c.url === '/api/public/leads')!
    expect(sent.body).toMatchObject({ refIds: ['unitree-g1'], consent: true, website: '', phone: '081-234-5678', lang: 'th' })
    expect(sent.body.message).toContain('ขอราคาสำหรับมหาวิทยาลัย')
  })

  it('shows the API error on the field it names, in English on /en', async () => {
    mockApi((url) => (url === '/api/public/leads' ? undefined : undefined))
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url === '/api/public/leads'
          ? new Response(JSON.stringify({ error: 'เบอร์โทรไม่ถูกต้อง', code: 'VALIDATION', errorEn: 'That phone number isn’t valid.', field: 'phone' }), { status: 400 })
          : new Response('null', { status: 200 }),
      ),
    )
    const user = userEvent.setup()
    renderAt('/en/contact')
    expect(screen.getByRole('heading', { level: 1, name: /Contact the showroom/ })).toBeInTheDocument()
    await user.type(screen.getByRole('textbox', { name: /Full name/ }), 'Test Person')
    await user.type(screen.getByRole('textbox', { name: /Phone number/ }), '0812345678')
    await user.type(screen.getByRole('textbox', { name: /Message/ }), 'Hello')
    await user.click(screen.getByRole('checkbox', { name: /I agree/ }))
    await user.click(screen.getByRole('button', { name: 'Send message' }))
    expect(await screen.findByText('That phone number isn’t valid.')).toBeInTheDocument()
  })
})

describe('configurator and quotation', () => {
  it('totals the trim and extras, then requests the quotation and opens it', async () => {
    const quote = {
      no: 'QT691106-0003',
      createdAt: '2026-11-06T05:00:00Z',
      validUntil: '2026-12-06T05:00:00Z',
      customer: { name: 'ทดสอบ ระบบ', company: 'บริษัท ทดสอบ จำกัด', taxId: '0105561123401', phone: '081-234-5678', email: null, address: null },
      lines: [{ productId: 'unitree-g1-0', sku: 'SV-UNG1-0', name: 'Unitree G1', qty: 1, unitPrice: g1.trims[0].priceTHB, discount: 0, total: g1.trims[0].priceTHB }],
      totals: { subtotal: g1.trims[0].priceTHB, lineDiscount: 0, billDiscount: 0, total: g1.trims[0].priceTHB, vat: 1, beforeVat: 1, vatRate: 7 },
      financing: null,
      note: null,
      status: 'sent',
      orderNo: null,
      store: { storeName: 'Servo Humanoid Showroom', branch: 'สำนักงานใหญ่ บางนา', address: 'x', phone: '02', email: 'e', taxId: '0105568054321', lineUrl: '#', lineId: '@x' },
    }
    mockApi((url, method) => {
      if (url === '/api/public/quotes' && method === 'POST') return { ...quote, token: 'tok123' }
      if (url.startsWith('/api/public/quotes/QT691106-0003')) return quote
      return undefined
    })
    const user = userEvent.setup()
    renderAt('/configure/unitree-g1')
    const summary = await screen.findByRole('complementary', { name: 'สรุปรายการ' })
    const first = g1.trims[0].priceTHB!
    await waitFor(() => expect(within(summary).getByText(`${first.toLocaleString('th-TH')} บาท`, { selector: 'dd' })).toBeInTheDocument())
    await user.click(screen.getByRole('checkbox', { name: /โครงแขวนกันล้ม/ }))
    expect(within(summary).getByText(`${(first + 34900).toLocaleString('th-TH')} บาท`, { selector: 'dd' })).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: /ชื่อผู้ติดต่อ/ }), 'ทดสอบ ระบบ')
    await user.type(screen.getByRole('textbox', { name: /เบอร์โทรศัพท์/ }), '081-234-5678')
    await user.type(screen.getByRole('textbox', { name: /เลขประจำตัวผู้เสียภาษี/ }), '123')
    await user.click(screen.getByRole('checkbox', { name: /ยินยอม/ }))
    await user.click(screen.getByRole('button', { name: 'ขอใบเสนอราคา' }))
    expect(screen.getByText('เลขประจำตัวผู้เสียภาษีต้องเป็นตัวเลข 13 หลัก')).toBeInTheDocument()

    await user.clear(screen.getByRole('textbox', { name: /เลขประจำตัวผู้เสียภาษี/ }))
    await user.type(screen.getByRole('textbox', { name: /เลขประจำตัวผู้เสียภาษี/ }), '0105561123401')
    await user.click(screen.getByRole('button', { name: 'ขอใบเสนอราคา' }))
    // The loading view carries a hidden h1 too, so wait for the document itself
    expect(await screen.findByText('QT691106-0003')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'ใบเสนอราคา' })).toBeInTheDocument()
    const post = calls.find((c) => c.url === '/api/public/quotes' && c.method === 'POST')!
    expect(post.body.lines).toEqual([
      { productId: 'unitree-g1-0', qty: 1 },
      { productId: 'acc-gantry', qty: 1 },
    ])
    expect(post.body.customer).toMatchObject({ taxId: '0105561123401', phone: '081-234-5678' })
    expect(calls.some((c) => c.url === '/api/public/quotes/QT691106-0003?t=tok123')).toBe(true)
  })

  it('says plainly when the showroom system is offline and keeps the catalogue estimate', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))))
    renderAt('/configure/unitree-g1')
    expect(await screen.findByText(/เชื่อมต่อระบบของโชว์รูมไม่ได้/)).toBeInTheDocument()
    expect(screen.getAllByRole('radio', { name: /G1/ }).length).toBeGreaterThan(0)
  })
})

describe('faq', () => {
  it('lists every question and the same ones in its structured data', () => {
    mockApi()
    renderAt('/faq')
    const items = faqFlat('th')
    for (const i of items) expect(screen.getByText(i.q)).toBeInTheDocument()
    expect((faqLd('th') as { mainEntity: unknown[] }).mainEntity).toHaveLength(items.length)
    expect(faqFlat('en').map((i) => i.id)).toEqual(items.map((i) => i.id))
  })
})

describe('solutions', () => {
  it('puts models built for the job first and quotes their own use cases', () => {
    const research = matchModels('research', 'th')
    expect(research.filter((m) => m.primary).map((m) => m.model.id)).toEqual(
      models.filter((m) => m.category === 'research').map((m) => m.id).sort((a, b) => research.findIndex((x) => x.model.id === a) - research.findIndex((x) => x.model.id === b)),
    )
    const industrial = matchModels('industrial', 'th')
    const galbot = industrial.find((m) => m.model.id === 'galbot-g1')
    expect(galbot?.reasons.some((r) => r.includes('คลังสินค้า') || r.includes('โรงงาน'))).toBe(true)
    for (const m of research) for (const r of m.reasons) expect([...m.model.useCases, ...m.model.idealFor]).toContain(r)
  })
})

describe('Thai line breaks', () => {
  it('keeps compounds on one line', () => {
    const { container } = render(<p>{tie('แล้วรับใบเสนอราคาทันที')}</p>)
    expect(container.querySelector('.nowrap')?.textContent).toBe('ใบเสนอราคา')
    expect(tie('No Thai here')).toBe('No Thai here')
  })
})
