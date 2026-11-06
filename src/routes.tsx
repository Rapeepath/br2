import type { ReactElement } from 'react'
import { getModel, modelIds, models } from './data'
import type { DictKey, Lang } from './i18n'
import { localized } from './i18n/content'
import { formatNumber } from './lib/format'
import { ComparePage } from './pages/ComparePage'
import { GuidePage } from './pages/GuidePage'
import { HomePage } from './pages/HomePage'
import { ModelPage } from './pages/ModelPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SourcesPage } from './pages/SourcesPage'
import { BookingPage } from './pages/commerce/BookingPage'
import { ConfigurePage } from './pages/commerce/ConfigurePage'
import { ContactPage } from './pages/commerce/ContactPage'
import { faqLd } from './pages/commerce/faqContent'
import { FaqPage } from './pages/commerce/FaqPage'
import { FinancePage } from './pages/commerce/FinancePage'
import { PrivacyPage } from './pages/commerce/PrivacyPage'
import { QuotePage } from './pages/commerce/QuotePage'
import { ServicePage } from './pages/commerce/ServicePage'
import { solutionOf } from './pages/commerce/solutions'
import { SolutionPage, SolutionsPage } from './pages/commerce/SolutionsPage'

/**
 * Every public page in one list: its route, what to prerender, and its SEO entry. The same tree serves
 * Thai at "/" and English under the router basename "/en", so paths here never carry a language prefix.
 *
 * To add a page: add an entry (path, element, prerender, meta) — App renders the route, the prerender
 * script writes its HTML for both languages, the sitemap lists it, and Layout applies its meta.
 */
export interface MetaInput {
  /** Page name; null gives the site's own title (home) */
  title: string | null
  description: string
  /** Site path of the share image (defaults to the cover photo) */
  image?: string
  /** Structured data objects (schema.org), added as JSON-LD */
  jsonLd?: object[]
  /** Add the showroom's Store/Organization JSON-LD (home, contact) */
  store?: boolean
  /** Kept out of search engines and the sitemap */
  noindex?: boolean
  /** Hero photo to preload in the prerendered HTML */
  preload?: { src: string; sizes: string }
  /** Thai/English crumbs for BreadcrumbList; the page itself last */
  breadcrumb?: { name: string; path: string }[]
}

export interface MetaContext {
  params: Record<string, string | undefined>
  lang: Lang
  t: (key: DictKey) => string
}

export interface PageDef {
  /** React Router path inside the language root ('' = index) */
  path: string
  element: ReactElement
  /** 'static' = this one path; a function lists concrete paths (one per model…); 'none' = client-only */
  prerender: 'static' | 'none' | (() => string[])
  meta: (ctx: MetaContext) => MetaInput
}

const cover = models[0]
const th = (lang: Lang, thai: string, english: string) => (lang === 'en' ? english : thai)

const HOME_TH = 'แค็ตตาล็อกหุ่นยนต์ฮิวแมนนอยด์ที่สั่งซื้อได้ในไทย พร้อมสเปก ราคา การจำหน่ายในไทย และคู่มือก่อนซื้อ'
const HOME_EN =
  'Humanoid robots you can order in Thailand: specs, prices for every trim, local dealers, warranty and a buyer’s guide.'

function modelMeta(id: string | undefined, lang: Lang): MetaInput {
  const base = getModel(id)
  if (!base) return { title: th(lang, 'ไม่พบหน้า', 'Page not found'), description: '', noindex: true }
  const m = localized(base, lang)
  const price = m.span.price
  const priceText = price ? formatNumber(price[0]) : null
  const description =
    lang === 'en'
      ? `${m.nameEn} humanoid robot by ${m.brand}${priceText ? `, from about THB ${priceText}` : ''}: ${m.heightCm} cm tall. Specs, every trim and price, warranty and how to buy in Thailand.`
      : `${m.nameEn} (${m.nameTh}) ${m.tagline}${priceText ? ` ราคาเริ่มต้นประมาณ ${priceText} บาท` : ''} ดูสเปก รุ่นย่อย การรับประกัน และช่องทางซื้อในไทย`
  return {
    title: m.nameEn,
    description,
    image: m.image.src,
    preload: { src: m.image.src, sizes: '(max-width: 960px) 100vw, 66vw' },
    breadcrumb: [
      { name: th(lang, 'หุ่นยนต์ทั้งหมด', 'All robots'), path: '/' },
      { name: m.nameEn, path: `/models/${m.id}` },
    ],
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: m.nameEn,
        alternateName: m.nameTh,
        brand: { '@type': 'Brand', name: m.brand },
        description: lang === 'en' ? description : m.summary,
        image: [m.image.src],
        category: 'Humanoid robot',
        ...(price
          ? {
              offers: {
                '@type': 'AggregateOffer',
                priceCurrency: 'THB',
                lowPrice: price[0],
                highPrice: price[1],
                offerCount: m.trims.filter((t) => t.priceTHB != null).length,
              },
            }
          : {}),
      },
    ],
  }
}

export const SOLUTION_SLUGS = ['research', 'education', 'service', 'industrial'] as const

export const PAGES: PageDef[] = [
  {
    path: '',
    element: <HomePage />,
    prerender: 'static',
    meta: ({ lang }) => ({
      title: null,
      description: th(lang, HOME_TH, HOME_EN),
      image: cover?.image.src,
      preload: cover ? { src: cover.image.src, sizes: '(max-width: 960px) 100vw, 66vw' } : undefined,
      store: true,
    }),
  },
  {
    path: 'models/:id',
    element: <ModelPage />,
    prerender: () => modelIds.map((id) => `/models/${id}`),
    meta: ({ params, lang }) => modelMeta(params.id, lang),
  },
  {
    path: 'compare',
    element: <ComparePage />,
    prerender: 'static',
    meta: ({ lang }) => ({
      title: th(lang, 'เปรียบเทียบรุ่น', 'Compare models'),
      description: th(
        lang,
        'วางราคา การเคลื่อนไหว พลังงาน ความสามารถ และการรับประกันของหุ่นยนต์ฮิวแมนนอยด์เทียบกันทีละแถว เลือกได้สูงสุด 3 รุ่น',
        'Put up to three humanoid robots side by side: price, movement, power, abilities and warranty, row by row.',
      ),
    }),
  },
  {
    path: 'guide',
    element: <GuidePage />,
    prerender: 'static',
    meta: ({ lang }) => ({
      title: th(lang, 'คู่มือก่อนซื้อหุ่นยนต์ฮิวแมนนอยด์', 'Humanoid robot buyer’s guide'),
      description: th(
        lang,
        'สิ่งที่ควรตรวจก่อนสั่งซื้อ การเตรียมพื้นที่และจุดชาร์จ ช่องทางซื้อในไทย ค่าไฟและค่าใช้จ่ายรายปี ราคาแต่ละรุ่น และกฎหมายที่เกี่ยวข้อง',
        'What to check before you order, preparing the space and charging, where to buy in Thailand, running costs, prices and the rules that apply.',
      ),
    }),
  },
  {
    path: 'sources',
    element: <SourcesPage />,
    prerender: 'static',
    meta: ({ lang }) => ({
      title: th(lang, 'แหล่งข้อมูล', 'Sources'),
      description: th(
        lang,
        'วิธีรวบรวมข้อมูล อันดับยอดส่งมอบของผู้ผลิต แหล่งอ้างอิงรายรุ่น แหล่งข้อมูลตลาด และเครดิตภาพ',
        'How the data was gathered, maker shipment rankings, references for every model, market sources and photo credits.',
      ),
    }),
  },
  {
    path: 'contact',
    element: <ContactPage />,
    prerender: 'static',
    meta: ({ lang }) => ({
      title: th(lang, 'ติดต่อโชว์รูม', 'Contact the showroom'),
      description: th(
        lang,
        'ที่อยู่ เบอร์โทร LINE อีเมล และเวลาทำการของโชว์รูมหุ่นยนต์ฮิวแมนนอยด์ Servo บางนา พร้อมฟอร์มสอบถามราคาและสเปก',
        'Address, phone, LINE, email and opening hours of the Servo humanoid robot showroom in Bang Na, with a form for prices and specs.',
      ),
      store: true,
    }),
  },
  {
    path: 'booking',
    element: <BookingPage />,
    prerender: 'static',
    meta: ({ lang }) => ({
      title: th(lang, 'นัดชมการสาธิต', 'Book a demonstration'),
      description: th(
        lang,
        'นัดดูหุ่นยนต์ฮิวแมนนอยด์ตัวจริงที่โชว์รูม ครั้งละ 90 นาที เลือกวันและเวลาว่างได้ล่วงหน้า 21 วัน ไม่มีค่าใช้จ่าย',
        'Book a free 90-minute demonstration of humanoid robots at the showroom; pick a free slot up to 21 days ahead.',
      ),
    }),
  },
  {
    path: 'faq',
    element: <FaqPage />,
    prerender: 'static',
    meta: ({ lang }) => ({
      title: th(lang, 'คำถามที่พบบ่อย', 'Frequently asked questions'),
      description: th(
        lang,
        'ราคารวม VAT ไหม ชำระและผ่อนอย่างไร ใช้เวลานำเข้านานเท่าไร รับประกันกี่ปี และนัดดูเครื่องจริงได้อย่างไร',
        'Whether prices include VAT, how to pay or finance, import lead times, warranty and how to see a robot for real.',
      ),
      jsonLd: [faqLd(lang)],
    }),
  },
  {
    path: 'privacy',
    element: <PrivacyPage />,
    prerender: 'static',
    meta: ({ lang }) => ({
      title: th(lang, 'นโยบายความเป็นส่วนตัว', 'Privacy policy'),
      description: th(
        lang,
        'ข้อมูลที่โชว์รูมเก็บจากแบบฟอร์ม เหตุผล ระยะเวลาเก็บ และสิทธิของคุณตามพ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พร้อมฟอร์มขอดูหรือลบข้อมูล',
        'What the showroom collects through its forms, why, for how long, and your rights under Thailand’s PDPA, with a form to see or delete your data.',
      ),
    }),
  },
  {
    path: 'service',
    element: <ServicePage />,
    prerender: 'static',
    meta: ({ lang }) => ({
      title: th(lang, 'บริการหลังการขาย', 'After-sales service'),
      description: th(
        lang,
        'ขั้นตอนแจ้งซ่อม การรับประกันของแต่ละรุ่น แผนบำรุงรักษา อะไหล่ แบตเตอรี่สำรอง และระดับบริการของโชว์รูม',
        'How repairs work, each model’s warranty, maintenance plans, spare parts and batteries, and the showroom’s service levels.',
      ),
    }),
  },
  {
    path: 'finance',
    element: <FinancePage />,
    prerender: 'static',
    meta: ({ lang }) => ({
      title: th(lang, 'คำนวณค่างวดและค่าใช้จ่าย', 'Financing and running costs'),
      description: th(
        lang,
        'คำนวณค่างวดเช่าซื้อ ลีสซิ่ง หรือเช่ารายเดือนของหุ่นยนต์ฮิวแมนนอยด์ และดูค่าใช้จ่ายรายปีหลังซื้อ',
        'Work out hire-purchase, leasing or rental payments for a humanoid robot, and the yearly costs after you buy.',
      ),
    }),
  },
  {
    path: 'configure/:id',
    element: <ConfigurePage />,
    prerender: () => modelIds.map((id) => `/configure/${id}`),
    meta: ({ params, lang }) => {
      const m = getModel(params.id)
      if (!m) return { title: th(lang, 'จัดสเปกและขอใบเสนอราคา', 'Configure and get a quote'), description: '', noindex: true }
      return {
        title: th(lang, `จัดสเปก ${m.nameEn}`, `Configure ${m.nameEn}`),
        description: th(
          lang,
          `เลือกรุ่นย่อย อุปกรณ์เสริม และบริการของ ${m.nameEn} ดูราคารวม VAT และค่างวด แล้วขอใบเสนอราคาได้ทันที`,
          `Choose the ${m.nameEn} trim, accessories and services, see the total with VAT and the monthly payment, and get a quotation at once.`,
        ),
        image: m.image.src,
        breadcrumb: [
          { name: th(lang, 'หุ่นยนต์ทั้งหมด', 'All robots'), path: '/' },
          { name: m.nameEn, path: `/models/${m.id}` },
          { name: th(lang, 'จัดสเปก', 'Configure'), path: `/configure/${m.id}` },
        ],
      }
    },
  },
  {
    path: 'quote/:no',
    element: <QuotePage />,
    prerender: 'none',
    meta: ({ lang }) => ({ title: th(lang, 'ใบเสนอราคา', 'Quotation'), description: '', noindex: true }),
  },
  {
    path: 'solutions',
    element: <SolutionsPage />,
    prerender: 'static',
    meta: ({ lang }) => ({
      title: th(lang, 'โซลูชันตามงาน', 'Solutions by use'),
      description: th(
        lang,
        'เลือกหุ่นยนต์ฮิวแมนนอยด์จากงานที่จะใช้: วิจัยและพัฒนา การศึกษา งานบริการและค้าปลีก และอุตสาหกรรม',
        'Choose a humanoid robot by the job: research, education, service and retail, or industry.',
      ),
    }),
  },
  {
    path: 'solutions/:slug',
    element: <SolutionPage />,
    prerender: () => SOLUTION_SLUGS.map((s) => `/solutions/${s}`),
    meta: ({ params, lang }) => {
      const s = solutionOf(params.slug)
      if (!s) return { title: th(lang, 'ไม่พบหน้า', 'Page not found'), description: '', noindex: true }
      const t = s[lang]
      return {
        title: t.title,
        description: `${t.short}. ${t.lede}`,
        breadcrumb: [
          { name: th(lang, 'โซลูชันตามงาน', 'Solutions'), path: '/solutions' },
          { name: t.title, path: `/solutions/${s.slug}` },
        ],
      }
    },
  },]

/** The catch-all; prerendered separately as 404.html */
export const NOT_FOUND: PageDef = {
  path: '*',
  element: <NotFoundPage />,
  prerender: 'none',
  meta: ({ t }) => ({ title: t('notFound.title'), description: t('notFound.body'), noindex: true }),
}
