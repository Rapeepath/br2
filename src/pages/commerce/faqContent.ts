// Frequently asked questions, written from the catalogue, the market data and the showroom's POS rules (payment
// methods, VAT, quotation validity, financing terms, booking window). Used by the FAQ page and its FAQPage
// JSON-LD, so the answers are plain text; `link` adds a next step on the page only.
import { market, models } from '../../data'
import type { Lang } from '../../i18n'
import { localized, localizedMarket } from '../../i18n/content'
import { FINANCE_TERMS } from '../../lib/finance'
import { hoursSummary } from '../../lib/localeFormat'
import { STATIC_STORE } from '../../lib/storeInfo'

export interface FaqItem {
  id: string
  q: string
  a: string
  link?: { to: string; label: string }
}

export interface FaqGroup {
  id: string
  title: string
  items: FaqItem[]
}

const QUOTE_DAYS = 30
const DEMO_MIN = 90
const WINDOW_DAYS = 21

const list = (xs: string[], lang: Lang) =>
  lang === 'en' ? (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : (xs[0] ?? '')) : xs.join(' ')

export function faqGroups(lang: Lang): FaqGroup[] {
  const L = lang === 'en'
  const ms = models.map((m) => localized(m, lang))
  const dealer = ms.filter((m) => m.availability === 'thai-dealer').map((m) => m.nameEn)
  const imported = ms.filter((m) => m.availability === 'import').map((m) => m.nameEn)
  const preorder = ms.filter((m) => m.availability === 'preorder').map((m) => m.nameEn)
  const mk = localizedMarket(market, lang)
  const dutyIdx = market.ownershipCost.oneTime.findIndex((c) => c.item.startsWith('อากรขาเข้า'))
  const vatIdx = market.ownershipCost.oneTime.findIndex((c) => c.item.startsWith('ภาษีมูลค่าเพิ่ม'))
  const duty = dutyIdx >= 0 ? mk.ownershipCost.oneTime[dutyIdx]?.item : null
  const vat = vatIdx >= 0 ? mk.ownershipCost.oneTime[vatIdx]?.item : null
  const hours = hoursSummary(STATIC_STORE.hours, lang) ?? ''
  const warranties = ms.map((m) => `${m.nameEn}: ${m.warranty.robot}`)
  const h = FINANCE_TERMS.hire
  const l = FINANCE_TERMS.lease

  return [
    {
      id: 'buying',
      title: L ? 'Buying and prices' : 'การซื้อและราคา',
      items: [
        {
          id: 'vat',
          q: L ? 'Do the prices on this site include VAT?' : 'ราคาบนเว็บรวม VAT แล้วหรือยัง',
          a: L
            ? 'Starting prices in the catalogue are estimates: a Thai dealer’s own price where one is published, otherwise the maker’s list price converted at the Bank of Thailand rate (marked “about”), before shipping and import costs. The showroom’s selling prices on a quotation include 7% VAT.'
            : 'ราคาเริ่มต้นในแค็ตตาล็อกเป็นราคาโดยประมาณ คือราคาของผู้แทนจำหน่ายในไทยเมื่อมีการประกาศ หรือราคาผู้ผลิตที่แปลงด้วยอัตราแลกเปลี่ยนของธนาคารแห่งประเทศไทย (ระบุว่า "ประมาณ") ยังไม่รวมค่าขนส่งและภาษีนำเข้า ส่วนราคาขายของโชว์รูมในใบเสนอราคารวม VAT 7% แล้ว',
        },
        {
          id: 'quote',
          q: L ? 'How do I get a quotation, and how long is it valid?' : 'ขอใบเสนอราคาได้อย่างไร มีอายุกี่วัน',
          a: L
            ? `Pick a model, then its trim, accessories and services on the configure page and send your details: the quotation appears straight away with its own number and link, valid for ${QUOTE_DAYS} days.`
            : `เลือกรุ่นในหน้าจัดสเปก แล้วเลือกรุ่นย่อย อุปกรณ์เสริม และบริการ จากนั้นกรอกข้อมูลผู้ขอ ใบเสนอราคาจะแสดงทันทีพร้อมเลขที่และลิงก์ของตัวเอง มีอายุ ${QUOTE_DAYS} วัน`,
          link: { to: `/configure/${models[0]?.id ?? ''}`, label: L ? 'Configure a robot' : 'จัดสเปกหุ่นยนต์' },
        },
        {
          id: 'pay',
          q: L ? 'How can I pay?' : 'ชำระเงินได้ช่องทางใดบ้าง',
          a: L
            ? 'Cash, PromptPay, credit or debit card, or bank transfer. Hire purchase and leasing can be estimated on the quotation.'
            : 'เงินสด พร้อมเพย์ บัตรเครดิตหรือเดบิต และโอนเงินเข้าบัญชี ส่วนการเช่าซื้อและลีสซิ่งประมาณค่างวดไว้ในใบเสนอราคาได้',
        },
        {
          id: 'finance',
          q: L ? 'Can I pay in instalments?' : 'ผ่อนชำระได้ไหม',
          a: L
            ? `Estimates are offered for hire purchase (${h.downPct.min}–${h.downPct.max}% down, ${h.months[0]}–${h.months.at(-1)} months, ${h.ratePct}% a year flat) and leasing (${l.downPct.min}–${l.downPct.max}% down, ${l.months[0]}–${l.months.at(-1)} months, ${l.ratePct}% a year flat). Actual approval and rates depend on the finance company.`
            : `ประมาณการได้ทั้งเช่าซื้อ (ดาวน์ ${h.downPct.min}–${h.downPct.max}% ผ่อน ${h.months[0]}–${h.months.at(-1)} เดือน ดอกเบี้ยคงที่ ${h.ratePct}% ต่อปี) และลีสซิ่ง (ดาวน์ ${l.downPct.min}–${l.downPct.max}% ${l.months[0]}–${l.months.at(-1)} เดือน ${l.ratePct}% ต่อปี) การอนุมัติและอัตราจริงขึ้นกับบริษัทลีสซิ่งหรือสถาบันการเงิน`,
          link: { to: '/finance', label: L ? 'Work out payments' : 'คำนวณค่างวด' },
        },
        {
          id: 'invoice',
          q: L ? 'Can you issue a full tax invoice for a company?' : 'ออกใบกำกับภาษีเต็มรูปในนามบริษัทได้ไหม',
          a: L
            ? 'Yes. Give the company name, its 13-digit tax ID and the billing address when you request the quotation, and the sale is invoiced in that name.'
            : 'ได้ ใส่ชื่อบริษัท เลขประจำตัวผู้เสียภาษี 13 หลัก และที่อยู่สำหรับออกใบกำกับภาษีตอนขอใบเสนอราคา แล้วการขายจะออกเอกสารในนามนั้น',
        },
      ],
    },
    {
      id: 'delivery',
      title: L ? 'Delivery and import' : 'การจัดส่งและการนำเข้า',
      items: [
        {
          id: 'lead',
          q: L ? 'How long does delivery take?' : 'ต้องรอสินค้านานแค่ไหน',
          a: L
            ? `Models with a Thai dealer (${list(dealer, lang)}) come from local stock when it is there. Imported models (${list(imported, lang)}) take about 2–6 weeks for shipping and customs, depending on the route.${preorder.length ? ` Pre-order models (${list(preorder, lang)}) follow the maker’s production schedule.` : ''}`
            : `รุ่นที่มีตัวแทนจำหน่ายในไทย (${list(dealer, lang)}) ส่งจากสต็อกในประเทศเมื่อมีของ รุ่นที่สั่งนำเข้า (${list(imported, lang)}) ใช้เวลาขนส่งและพิธีการศุลกากรประมาณ 2–6 สัปดาห์ตามเส้นทาง${preorder.length ? ` ส่วนรุ่นเปิดจอง (${list(preorder, lang)}) ขึ้นกับรอบการผลิตของผู้ผลิต` : ''}`,
        },
        {
          id: 'duty',
          q: L ? 'What import duty and tax apply?' : 'มีอากรขาเข้าและภาษีเท่าไร',
          a: [duty, vat].filter(Boolean).join(L ? '. ' : ' ') || (L ? 'See the buyer’s guide.' : 'ดูรายละเอียดในคู่มือก่อนซื้อ'),
          link: { to: '/guide', label: L ? 'Read the buyer’s guide' : 'อ่านคู่มือก่อนซื้อ' },
        },
      ],
    },
    {
      id: 'service',
      title: L ? 'Warranty and service' : 'การรับประกันและบริการ',
      items: [
        {
          id: 'warranty',
          q: L ? 'How long is the warranty?' : 'รับประกันนานเท่าไร',
          a: L
            ? `It follows each maker’s terms: ${warranties.join('; ')}.`
            : `เป็นไปตามเงื่อนไขของผู้ผลิตแต่ละรุ่น ได้แก่ ${warranties.join(' ')}`,
          link: { to: '/service', label: L ? 'After-sales service' : 'บริการหลังการขาย' },
        },
        {
          id: 'install',
          q: L ? 'Do you install the robot and train our staff?' : 'มีบริการติดตั้งและอบรมไหม',
          a: L
            ? 'Yes: installation and user training with an engineer on site for a day, a two-day SDK programming course, and a 12-month maintenance plan with a check-up every three months. Prices are on the service page.'
            : 'มี ได้แก่ ติดตั้งและอบรมการใช้งานโดยวิศวกรเข้าหน้างาน 1 วัน หลักสูตรพัฒนาโปรแกรมด้วย SDK 2 วัน และสัญญาบำรุงรักษา 12 เดือนพร้อมตรวจเช็กทุก 3 เดือน ดูราคาได้ในหน้าบริการหลังการขาย',
          link: { to: '/service', label: L ? 'See service plans' : 'ดูแผนบริการ' },
        },
      ],
    },
    {
      id: 'visit',
      title: L ? 'Visiting and contact' : 'การนัดชมและการติดต่อ',
      items: [
        {
          id: 'demo',
          q: L ? 'Can I see a robot working before I buy?' : 'ขอดูเครื่องจริงก่อนซื้อได้ไหม',
          a: L
            ? `Book a free ${DEMO_MIN}-minute demonstration at the showroom up to ${WINDOW_DAYS} days ahead. ${hours}.`
            : `นัดชมการสาธิตที่โชว์รูมได้ฟรี ครั้งละ ${DEMO_MIN} นาที จองล่วงหน้าได้ ${WINDOW_DAYS} วัน ${hours}`,
          link: { to: '/booking', label: L ? 'Book a demonstration' : 'นัดชมการสาธิต' },
        },
        {
          id: 'contact',
          q: L ? 'How can I reach you?' : 'ติดต่อทางไหนได้บ้าง',
          a: L
            ? `Phone ${STATIC_STORE.phone}, LINE ${STATIC_STORE.lineId}, email ${STATIC_STORE.email}, or the form on the contact page.`
            : `โทร ${STATIC_STORE.phone} LINE ${STATIC_STORE.lineId} อีเมล ${STATIC_STORE.email} หรือฝากข้อความผ่านฟอร์มในหน้าติดต่อ`,
          link: { to: '/contact', label: L ? 'Contact us' : 'ติดต่อเรา' },
        },
        {
          id: 'pdpa',
          q: L ? 'What happens to the details I send?' : 'ข้อมูลที่กรอกในฟอร์มนำไปใช้ทำอะไร',
          a: L
            ? 'Only to answer your request: replying, arranging the demonstration or preparing the quotation. You can ask to see, correct or delete it at any time.'
            : 'ใช้เพื่อตอบเรื่องที่ขอเท่านั้น เช่น ติดต่อกลับ จัดการนัดหมาย หรือออกใบเสนอราคา และขอดู แก้ไข หรือลบข้อมูลได้ทุกเมื่อ',
          link: { to: '/privacy', label: L ? 'Privacy policy' : 'นโยบายความเป็นส่วนตัว' },
        },
        {
          id: 'demo-shop',
          q: L ? 'Is this a real shop?' : 'โชว์รูมนี้ขายจริงไหม',
          a: L
            ? 'No. The catalogue data is researched from makers and dealers, but the showroom, its stock, prices on sale, bookings and quotations are a demonstration system. No sale or payment takes place.'
            : 'ไม่ใช่ ข้อมูลแค็ตตาล็อกค้นคว้าจากผู้ผลิตและผู้จัดจำหน่าย แต่โชว์รูม สต็อก ราคาขาย การนัดหมาย และใบเสนอราคาเป็นระบบจำลองเพื่อการสาธิต ไม่มีการซื้อขายหรือรับเงินจริง',
        },
      ],
    },
  ]
}

export const faqFlat = (lang: Lang) => faqGroups(lang).flatMap((g) => g.items)

/**
 * FAQPage structured data (schema.org), the same shape as seo.ts faqJsonLd. Built here because routes.tsx
 * imports this file, and importing seo.ts from routes would make a module cycle.
 */
export const faqLd = (lang: Lang): object => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqFlat(lang).map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a } })),
})
