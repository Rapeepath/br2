import { useCallback } from 'react'
import { useLang, type Lang } from '../i18n'
import {
  AVAILABILITY_LABEL,
  CATEGORY_BRIEF,
  CATEGORY_LABEL,
  CURRENCY_LABEL,
  LOCOMOTION_LABEL,
  ORIGIN_LABEL,
  formatMonthShortTh,
  formatMonthTh,
  formatNumber,
} from './format'
import type { Budget, SortKey } from './filter'
import { BUDGET_LABEL, SORT_LABEL } from './filter'
import type { Availability, Category, Currency, Locomotion, OriginGroup } from './types'

/**
 * Copy for the Thai and English pages side by side: `tx('ราคา', 'Price')`. Pages keep their own words in
 * place; the shell's strings live in the i18n dictionaries.
 */
export const pick = <T,>(lang: Lang, th: T, en: T): T => (lang === 'en' ? en : th)

export function useTx() {
  const lang = useLang()
  return useCallback(<T,>(th: T, en: T): T => (lang === 'en' ? en : th), [lang])
}

// ---------- Catalogue labels ----------

const CATEGORY_EN: Record<Category, string> = {
  research: 'Research and development',
  education: 'Education',
  home: 'Home assistant',
  industrial: 'Industrial',
  service: 'Service',
}

const CATEGORY_BRIEF_EN: Record<Category, string> = {
  research: 'Research',
  education: 'Education',
  home: 'Home',
  industrial: 'Industry',
  service: 'Service',
}

const LOCOMOTION_EN: Record<Locomotion, string> = { legs: 'Walks on two legs', wheels: 'Wheeled base' }

const ORIGIN_EN: Record<OriginGroup, string> = {
  china: 'China',
  japan: 'Japan',
  korea: 'South Korea',
  europe: 'Europe',
  usa: 'United States',
}

const AVAILABILITY_EN: Record<Availability, string> = {
  'thai-dealer': 'Thai dealer',
  import: 'Import to order',
  preorder: 'Pre-order',
}

const CURRENCY_EN: Record<Currency, string> = { THB: 'baht', USD: 'US dollars', CNY: 'yuan', EUR: 'euros' }

const SORT_EN: Record<SortKey, string> = {
  default: 'Most popular',
  priceAsc: 'Price, low to high',
  priceDesc: 'Price, high to low',
  dofDesc: 'Most degrees of freedom',
  payloadDesc: 'Highest payload',
  runtimeDesc: 'Longest runtime per charge',
  name: 'Model name A–Z',
}

const BUDGET_EN: Record<Budget, string> = {
  all: 'Any price',
  under500k: 'Under 500,000 baht',
  '500kto1500k': '500,000–1.5 million baht',
  over1500k: '1.5 million baht and over',
}

export function labels(lang: Lang) {
  return lang === 'en'
    ? {
        category: CATEGORY_EN,
        categoryBrief: CATEGORY_BRIEF_EN,
        locomotion: LOCOMOTION_EN,
        origin: ORIGIN_EN,
        availability: AVAILABILITY_EN,
        currency: CURRENCY_EN,
        sort: SORT_EN,
        budget: BUDGET_EN,
      }
    : {
        category: CATEGORY_LABEL,
        categoryBrief: CATEGORY_BRIEF,
        locomotion: LOCOMOTION_LABEL,
        origin: ORIGIN_LABEL,
        availability: AVAILABILITY_LABEL,
        currency: CURRENCY_LABEL,
        sort: SORT_LABEL,
        budget: BUDGET_LABEL,
      }
}

/** Units after a figure */
export function units(lang: Lang) {
  return lang === 'en'
    ? { cm: 'cm', kg: 'kg', h: 'h', kmh: 'km/h', baht: 'baht', robots: 'units', models: 'models', items: 'items' }
    : { cm: 'ซม.', kg: 'กก.', h: 'ชม.', kmh: 'กม./ชม.', baht: 'บาท', robots: 'ตัว', models: 'รุ่น', items: 'รายการ' }
}

// ---------- Dates (Buddhist era in Thai, Gregorian in English) ----------

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "2026-10" → "ตุลาคม 2569" / "October 2026"; `short` gives "ต.ค. 2569" / "Oct 2026". */
export function monthText(yyyyMm: string, lang: Lang, short = false): string {
  if (lang !== 'en') return short ? formatMonthShortTh(yyyyMm) : formatMonthTh(yyyyMm)
  const [y, m] = yyyyMm.split('-').map(Number)
  if (!y || !m) return yyyyMm
  const name = MONTHS_EN[m - 1]
  return `${short ? name.slice(0, 3) : name} ${y}`
}

/** "2026-10-24" → "24 ตุลาคม 2569" / "24 October 2026"; a bare "2026-10" reads as the month. */
export function dayText(iso: string, lang: Lang): string {
  const m = /^(\d{4}-\d{2})-(\d{2})/.exec(iso)
  return m ? `${Number(m[2])} ${monthText(m[1], lang)}` : monthText(iso.slice(0, 7), lang)
}

/** "16,000 ดอลลาร์สหรัฐ" / "16,000 US dollars" (or the currency code with `brief`). */
export function listPriceText(p: { amount: number; currency: Currency }, lang: Lang, brief = false): string {
  return `${formatNumber(p.amount)} ${brief ? p.currency : labels(lang).currency[p.currency]}`
}

/** True when a string contains Thai script (tests and the English pages' self-checks use it). */
export const hasThai = (s: string) => /[฀-๿]/.test(s)

/**
 * The lang attribute for text that may not be in the page's language (a Thai source title on an English
 * page, an English one on a Thai page), so screen readers switch voice (WCAG 3.1.2).
 */
export const langFor = (text: string, page: Lang): 'th' | 'en' | undefined =>
  hasThai(text) ? (page === 'en' ? 'th' : undefined) : page === 'th' ? 'en' : undefined
