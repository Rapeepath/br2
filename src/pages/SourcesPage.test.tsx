import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { market, models } from '../data'
import { CURRENCY_LABEL, formatMonthTh, formatNumber } from '../lib/format'
import { renderAt } from '../test/render'
import { groupSources, keep, licenceUrl, ranked, sameMaker, shipmentSource, splitSource } from './SourcesPage'

const section = (name: RegExp | string) => screen.getByRole('region', { name })
const runs = (el: HTMLElement) => [...el.querySelectorAll('.nowrap')].map((s) => s.textContent)

/** Each robot's price basis over its priced trims, counted as the page counts them */
const bases = models.map((m) => new Set(m.trims.map((t) => t.priceBasis).filter((b) => b != null)))
const dealerOnly = bases.filter((b) => b.size === 1 && b.has('dealer')).length
const convertedOnly = bases.filter((b) => b.size === 1 && b.has('converted')).length

describe('sources page', () => {
  it('has its own title, a cover heading and the data date in Buddhist Era', () => {
    renderAt('/sources')
    expect(document.title).toBe('แหล่งข้อมูล – Servo')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('แหล่งข้อมูลและเครดิตภาพ')
    expect(formatMonthTh(market.asOf)).toMatch(/25\d\d$/)
    expect(document.querySelector('.scover__meta')).toHaveTextContent(formatMonthTh(market.asOf))
    expect(document.querySelector('.sfigures')).toHaveTextContent(String(market.sources.length))
  })

  it('states the method: what was chosen, how prices were set, where specs came from, and the order', () => {
    renderAt('/sources')
    const method = section('วิธีการรวบรวมข้อมูล')
    const items = within(method).getAllByRole('listitem')
    expect(items).toHaveLength(6)
    expect(method).toHaveTextContent(`รวม ${models.length} รุ่น`)
    expect(method).toHaveTextContent('สั่งซื้อหรือสั่งจองได้')
    expect(method).toHaveTextContent('อันดับยอดส่งมอบ')
    // Locomotion counts come from the data
    const legs = models.filter((m) => m.locomotion === 'legs').length
    if (legs) expect(method).toHaveTextContent(`เดินสองขา ${legs} รุ่น`)
    // Famous robots not on sale are pointed to the guide
    if (market.notForSale.length) {
      expect(within(method).getByRole('link', { name: 'คู่มือก่อนซื้อ' })).toHaveAttribute('href', '/guide')
    }

    // Prices: dealer and converted robots counted, and the rate actually used quoted with its date
    if (dealerOnly) expect(method).toHaveTextContent(`ในไทยประกาศ ใช้กับรุ่นที่ตัวแทนประกาศราคา (${dealerOnly} รุ่น)`)
    if (convertedOnly) expect(method).toHaveTextContent(`ใช้ราคาของผู้ผลิตแปลงเป็นบาท (${convertedOnly} รุ่น)`)
    const converted = models.flatMap((m) => m.trims).filter((t) => t.priceBasis === 'converted')
    const rates = { USD: market.fx.usd, CNY: market.fx.cny, EUR: market.fx.eur } as const
    for (const c of ['USD', 'CNY', 'EUR'] as const) {
      const text = `1 ${CURRENCY_LABEL[c]} = ${formatNumber(rates[c])} บาท`
      if (converted.some((t) => t.listPrice?.currency === c)) expect(method).toHaveTextContent(text)
      else expect(method).not.toHaveTextContent(text)
    }
    if (converted.length) {
      expect(method).toHaveTextContent('ราคาที่แปลงยังไม่รวมค่าขนส่ง อากรขาเข้า และภาษีมูลค่าเพิ่ม')
      expect(within(method).getByRole('link', { name: /เปิดในแท็บใหม่/ })).toHaveAttribute('href', market.fx.source.url)
    }

    expect(method).toHaveTextContent('เอกสารข้อมูลจำเพาะและหน้าสินค้าของผู้ผลิตเป็นอันดับแรก')
    expect(method).toHaveTextContent('“ไม่ระบุ” โดยไม่ประมาณค่าขึ้นเอง')
    expect(method).toHaveTextContent('ราคาเริ่มต้นจากต่ำไปสูง')
    expect(method).toHaveTextContent(`ข้อมูลทั้งหมด ณ ${formatMonthTh(market.asOf)}`)
  })

  it('shows the shipment ranking as a table, ties as ties, each maker with its catalogue robots linked', () => {
    renderAt('/sources')
    const rank = section('ที่มาของลำดับผู้ผลิต')
    const table = within(rank).getByRole('table', { name: /อันดับยอดส่งมอบหุ่นยนต์ฮิวแมนนอยด์ทั่วโลก/ })
    const rows = within(table)
      .getAllByRole('row')
      .filter((r) => within(r).queryAllByRole('cell').length > 0)
    expect(rows).toHaveLength(market.shipments.length)

    // Equal shipments share a rank and the next rank is skipped; only tied rows say "ร่วม"
    rows.forEach((row, i) => {
      const r = market.shipments.find((s) => row.querySelector('.srank__brand')?.textContent === s.brand)!
      expect(r, `row ${i}`).toBeDefined()
      const expected = 1 + market.shipments.filter((o) => o.units > r.units).length
      expect(row.querySelector('.srank__badge')).toHaveTextContent(String(expected))
      const tied = market.shipments.some((o) => o !== r && o.units === r.units)
      expect(row.querySelector('.srank__tie') != null).toBe(tied)
      expect(row).toHaveTextContent(formatNumber(r.units))
    })

    // Every ranked robot is linked under its maker, on the row matching the data's own makerRank
    for (const m of models) {
      const link = within(table).queryByRole('link', { name: m.nameEn })
      if (m.makerRank == null) {
        expect(link, m.id).toBeNull()
        continue
      }
      expect(link, m.id).toHaveAttribute('href', `/models/${m.id}`)
      expect(link!.closest('tr')!.querySelector('.srank__badge')).toHaveTextContent(String(m.makerRank))
    }
    expect(within(table).getAllByRole('link')).toHaveLength(models.filter((m) => m.makerRank != null).length)

    // Robots from makers outside the ranking are named under the table, still linked
    const extra = rank.querySelector('.srank__extra')
    const unranked = models.filter((m) => m.makerRank == null)
    if (unranked.length) {
      for (const m of unranked) expect(within(extra as HTMLElement).getByRole('link', { name: m.nameEn })).toHaveAttribute('href', `/models/${m.id}`)
    } else {
      expect(extra).toBeNull()
    }

    // Makers split into the catalogue's and the rest of the ranking
    const inCatalogue = ranked.filter((r) => r.models.length > 0)
    if (inCatalogue.length) expect(within(table).getByRole('rowheader', { name: `ผู้ผลิตในแค็ตตาล็อก ${inCatalogue.length} ราย` })).toBeInTheDocument()
    if (inCatalogue.length < ranked.length) expect(within(table).getByRole('rowheader', { name: 'ผู้ผลิตอื่นในอันดับ' })).toBeInTheDocument()

    // The foot cites the analyst: its source when one is listed, else the note naming it
    const foot = rank.querySelector('.srank__foot')!
    expect(foot).toHaveTextContent(/^ที่มา:/)
    const analyst = shipmentSource(market.shipments[0]?.note ?? null, market.sources)
    if (analyst) expect(within(foot as HTMLElement).getByRole('link')).toHaveAttribute('href', analyst.url)
    else if (market.shipments[0]?.note) expect(foot).toHaveTextContent(market.shipments[0].note.replace(/^ที่มา\s*:?\s*/, ''))
  })

  it('places each robot on the same shipment row build-data ranked its maker on', () => {
    for (const m of models) {
      const row = ranked.find((r) => r.models.includes(m))
      expect(row?.rank ?? null, m.id).toBe(m.makerRank)
    }
    expect(ranked.flatMap((r) => r.models).length).toBe(models.filter((m) => m.makerRank != null).length)
  })

  it('matches maker names without case or punctuation, a suffix allowed either way', () => {
    expect(sameMaker('Unitree', 'Unitree')).toBe(true)
    expect(sameMaker('UBTech', 'UBTECH Robotics')).toBe(true)
    expect(sameMaker('Booster Robotics', 'Booster')).toBe(true)
    expect(sameMaker('Engine AI', 'EngineAI')).toBe(true)
    expect(sameMaker('AgiBot', 'Agility Robotics')).toBe(false)
    expect(sameMaker('', 'Unitree')).toBe(false)
  })

  it('finds the analyst source the first shipment note names, falling back to any shipments source', () => {
    const omdia = { title: 'Humanoid Robot Market Radar – Omdia', url: 'https://omdia.example/radar' }
    const press = { title: 'Omdia: Unitree leads humanoid shipments – SCMP', url: 'https://scmp.example/a' }
    const idc = { title: 'Humanoid robot shipments 2025 – IDC', url: 'https://idc.example/b' }
    const other = { title: 'Robot prices fall – Reuters', url: 'https://reuters.example/c' }
    expect(shipmentSource('ที่มา: Omdia', [other, press, omdia])).toBe(omdia)
    expect(shipmentSource('ที่มา: Omdia', [other, idc, press])).toBe(press)
    expect(shipmentSource('ที่มา: Omdia', [other, idc])).toBe(idc)
    expect(shipmentSource(null, [other])).toBeNull()
    // A maker named in the note is the subject, not the analyst
    const maker = { title: 'AGIBOT Brings APC 2026 to Thailand – AGIBOT', url: 'https://www.agibot.com/apc' }
    const omdiaPress = { title: 'Omdia Ranks AGIBOT No.1 in Humanoid Robot Shipments – PR Newswire', url: 'https://www.prnewswire.com/x' }
    expect(shipmentSource('ประมาณการโดย Omdia AgiBot มีส่วนแบ่งร้อยละ 39', [maker, omdiaPress], ['AgiBot'])).toBe(omdiaPress)
  })

  it('lists every model reference in an accordion, with the price terms where a robot has them', async () => {
    renderAt('/sources')
    const refs = section('แหล่งอ้างอิงรายรุ่น')
    const details = refs.querySelectorAll('details')
    expect(details).toHaveLength(models.length)

    models.forEach((m, i) => {
      const d = details[i]
      expect(d.querySelector('summary')).toHaveTextContent(m.nameEn)
      expect(d.querySelector('summary')).toHaveTextContent(`${m.sources.length} รายการ`)
      const anchors = [...d.querySelectorAll<HTMLAnchorElement>('ol a')]
      expect(anchors.map((a) => a.getAttribute('href'))).toEqual(m.sources.map((s) => s.url))
      anchors.forEach((a, j) => {
        expect(a).toHaveAttribute('target', '_blank')
        expect(a).toHaveAttribute('rel', 'noopener noreferrer')
        expect(a).toHaveTextContent(splitSource(m.sources[j].title).title)
      })
      expect(d.querySelector(`a[href="/models/${m.id}"]`)).not.toBeNull()
      const terms = d.querySelector('.sacc__terms')
      if (m.priceNote) {
        expect(terms).toHaveTextContent('เงื่อนไขราคา')
        expect(terms).toHaveTextContent(m.priceNote)
      } else {
        expect(terms).toBeNull()
      }
    })

    // A summary toggles its panel
    const user = userEvent.setup()
    const first = details[0]
    expect(first.open).toBe(false)
    await user.click(first.querySelector('summary')!)
    expect(first.open).toBe(true)
  })

  it('indexes every market source once, grouped by topic and numbered straight through', () => {
    renderAt('/sources')
    const list = section('แหล่งข้อมูลตลาดและคู่มือ')
    const anchors = [...list.querySelectorAll<HTMLAnchorElement>('a')]
    expect(anchors.map((a) => a.getAttribute('href')).sort()).toEqual(market.sources.map((s) => s.url).sort())
    for (const a of anchors) {
      expect(a).toHaveAttribute('target', '_blank')
      expect(a).toHaveAttribute('rel', 'noopener noreferrer')
    }
    expect(list).toHaveTextContent(`${market.sources.length} รายการ`)

    const groups = groupSources(market.sources)
    expect(groups.flatMap((g) => g.items.map((s) => s.n))).toEqual(market.sources.map((_, i) => i + 1))
    for (const g of groups) {
      expect(within(list).getByRole('heading', { level: 3, name: new RegExp(g.title) })).toBeInTheDocument()
    }
    // The topics cover nearly everything; a new kind of source shows up under "อื่น ๆ", never vanishes
    const other = groups.find((g) => g.id === 'other')?.items.length ?? 0
    expect(other).toBeLessThanOrEqual(Math.floor(market.sources.length / 4))
  })

  it('credits every photo with its author, licence and Commons page', () => {
    renderAt('/sources')
    const credits = section('เครดิตภาพถ่าย')
    const cards = within(credits).getAllByRole('listitem')
    expect(cards).toHaveLength(models.length)
    expect(credits).toHaveTextContent('ภาพหุ่นยนต์ทุกตัวจาก Wikimedia Commons')
    expect(credits).toHaveTextContent('ครอป')
    models.forEach((m, i) => {
      const card = cards[i]
      expect(card).toHaveTextContent(m.nameEn)
      expect(card).toHaveTextContent(m.image.author)
      expect(card).toHaveTextContent(m.image.license)
      const commons = within(card).getByRole('link', { name: /Wikimedia Commons/ })
      expect(commons).toHaveAttribute('href', m.image.page)
      expect(commons).toHaveAttribute('rel', 'noopener noreferrer')
      const deed = licenceUrl(m.image.license)
      if (deed) expect(within(card).getByRole('link', { name: new RegExp(m.image.license) })).toHaveAttribute('href', deed)
    })
  })

  it('says trademarks belong to their owners, the site is not affiliated, and leads back to the lineup', () => {
    renderAt('/sources')
    const notice = section(/เครื่องหมายการค้า/)
    expect(notice).toHaveTextContent('เครื่องหมายการค้าทั้งหมดเป็นของเจ้าของแต่ละราย')
    expect(notice).toHaveTextContent('ไม่มีความเกี่ยวข้องกับผู้ผลิตหรือผู้จัดจำหน่ายรายใด')
    expect(notice).toHaveTextContent(`ข้อมูล ณ ${formatMonthTh(market.asOf)}`)
    if (models.some((m) => m.trims.some((t) => t.priceBasis === 'converted'))) {
      expect(notice).toHaveTextContent('เป็นราคาโดยประมาณ')
    }
    expect(within(notice).getByRole('link', { name: /กลับไปดูหุ่นยนต์ทั้งหมด/ })).toHaveAttribute('href', '/')
  })

  it('opens every external link in a new tab without an opener', () => {
    renderAt('/sources')
    const external = [...document.querySelectorAll<HTMLAnchorElement>('main a[href^="http"]')]
    expect(external.length).toBeGreaterThan(market.sources.length)
    for (const a of external) {
      expect(a).toHaveAttribute('target', '_blank')
      expect(a.getAttribute('rel')).toBe('noopener noreferrer')
      expect(a).toHaveTextContent('(เปิดในแท็บใหม่)')
    }
  })
})

describe('sources helpers', () => {
  it('splits the publisher off a title at the last spaced en dash', () => {
    expect(splitSource('G1 Humanoid Agent – Unitree Robotics')).toEqual({ title: 'G1 Humanoid Agent', publisher: 'Unitree Robotics' })
    expect(splitSource('พิกัดอัตราศุลกากร – หมวด 84 – กรมศุลกากร')).toEqual({ title: 'พิกัดอัตราศุลกากร – หมวด 84', publisher: 'กรมศุลกากร' })
    expect(splitSource('ไม่มีผู้เผยแพร่')).toEqual({ title: 'ไม่มีผู้เผยแพร่', publisher: null })
  })

  it('links Creative Commons licences to their deeds and leaves others plain', () => {
    expect(licenceUrl('CC BY-SA 4.0')).toBe('https://creativecommons.org/licenses/by-sa/4.0/')
    expect(licenceUrl('CC BY 3.0')).toBe('https://creativecommons.org/licenses/by/3.0/')
    expect(licenceUrl('CC0')).toBe('https://creativecommons.org/publicdomain/zero/1.0/')
    expect(licenceUrl('Public domain')).toBeNull()
  })

  it('sorts sources into topics by the first rule that fits, settling the overlaps', () => {
    const topic = (title: string, url = 'https://source.invalid/page') => groupSources([{ title, url }])[0].id
    expect(topic('Humanoid robot shipments 2025 – Omdia')).toBe('market')
    expect(topic('ขนาดตลาดหุ่นยนต์ฮิวแมนนอยด์และราคาเฉลี่ย – TrendForce')).toBe('market')
    expect(topic('อัตราค่าไฟฟ้า รวมภาษีมูลค่าเพิ่ม – การไฟฟ้านครหลวง')).toBe('power')
    expect(topic('สิทธิประโยชน์ทางภาษีสำหรับระบบอัตโนมัติ – BOI')).toBe('incentive')
    expect(topic('พิกัดอัตราศุลกากรและอากรขาเข้า – กรมศุลกากร')).toBe('tax')
    expect(topic('ภาษีมูลค่าเพิ่มสินค้านำเข้า – กรมสรรพากร')).toBe('tax')
    expect(topic('การรับรองอุปกรณ์วิทยุคมนาคม – สำนักงาน กสทช.')).toBe('law')
    expect(topic('พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล – ราชกิจจานุเบกษา')).toBe('law')
    expect(topic('อัตราแลกเปลี่ยนเฉลี่ย – ธนาคารแห่งประเทศไทย', 'https://www.bot.or.th/th/statistics/exchange-rate.html')).toBe('price')
    expect(topic('ผู้นำเข้าและตัวแทนจำหน่ายหุ่นยนต์ – บริษัทตัวอย่าง')).toBe('seller')
    expect(topic('ค่าบำรุงรักษาและอะไหล่ – สื่อเทคโนโลยี')).toBe('upkeep')
    expect(topic('Notes – Nobody')).toBe('other')

    // Robots not yet on sale are known by name; Thai sellers by their own websites
    const upcoming = market.notForSale[0]
    if (upcoming) expect(topic(`${upcoming.name} – Newsroom`)).toBe('upcoming')
    const origin = market.sellers.map((s) => /^https?:\/\/[^/]+/.exec(s.url)?.[0]).find(Boolean)
    if (origin) expect(topic('เกี่ยวกับเรา – บริษัท', `${origin}/about`)).toBe('seller')

    // Display order is the guide's, and numbering runs on across the groups
    const grouped = groupSources([
      { title: 'อัตราค่าไฟฟ้า – การไฟฟ้าส่วนภูมิภาค', url: 'https://a.invalid/' },
      { title: 'Humanoid shipments – IDC', url: 'https://b.invalid/' },
      { title: 'อากรขาเข้า – กรมศุลกากร', url: 'https://c.invalid/' },
    ])
    expect(grouped.map((g) => g.id)).toEqual(['market', 'tax', 'power'])
    expect(grouped.flatMap((g) => g.items.map((s) => s.n))).toEqual([1, 2, 3])
  })

  it('keeps dates, figures and split-prone compounds on one line', () => {
    const { container } = render(
      <p>{keep('ราคานี้ยังไม่รวมค่าขนส่ง อากรขาเข้า และภาษีมูลค่าเพิ่ม ณ 24 ตุลาคม 2569 ช่วง 1–31 ต.ค. 2569 ส่งมอบ 5,500 ตัว')}</p>,
    )
    expect(runs(container)).toEqual(['ค่าขนส่ง', 'อากรขาเข้า', 'ภาษีมูลค่าเพิ่ม', '24 ตุลาคม 2569', '1–31 ต.ค. 2569', 'ส่งมอบ', '5,500 ตัว'])
    expect(container).toHaveTextContent('ราคานี้ยังไม่รวมค่าขนส่ง อากรขาเข้า และภาษีมูลค่าเพิ่ม ณ 24 ตุลาคม 2569 ช่วง 1–31 ต.ค. 2569 ส่งมอบ 5,500 ตัว')

    // Thai compounds the breaker would halve ("หุ่น / ยนต์"), and asides in brackets
    const robot = render(<p>{keep('หุ่นยนต์ฮิวแมนนอยด์จากผู้นำเข้า (อันดับ 1 ร่วม)')}</p>).container
    expect(runs(robot)).toEqual(['หุ่นยนต์', 'ฮิวแมนนอยด์', 'ผู้นำเข้า', '(อันดับ 1 ร่วม)'])

    // Robot names stay whole, the full name winning over its maker's name inside it
    const named = models.find((m) => market.shipments.some((r) => m.nameEn.startsWith(`${r.brand} `))) ?? models[0]
    const note = render(<p>{keep(`รุ่น ${named.nameEn} (ปี 2568)`)}</p>).container
    expect(runs(note)).toEqual([named.nameEn, '(ปี 2568)'])

    // A spaced price range keeps both ends and its unit together
    const price = render(<p>{keep('ราคา : 559,000 – 2,250,000 บาท (ราคาตัวแทน)')}</p>).container
    expect(price.querySelector('.nowrap')).toHaveTextContent('559,000 – 2,250,000 บาท')
  })
})
