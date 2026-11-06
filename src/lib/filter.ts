import type { Category, Model } from './types'

export type SortKey = 'default' | 'priceAsc' | 'priceDesc' | 'dofDesc' | 'payloadDesc' | 'runtimeDesc' | 'name'
export type Budget = 'all' | 'under500k' | '500kto1500k' | 'over1500k'

export interface Filters {
  q: string
  category: 'all' | Category
  /** A brand name exactly as in the data, or 'all' */
  brand: string
  budget: Budget
  sort: SortKey
}

export const DEFAULT_FILTERS: Filters = { q: '', category: 'all', brand: 'all', budget: 'all', sort: 'default' }

export const SORT_LABEL: Record<SortKey, string> = {
  default: 'ยอดนิยม',
  priceAsc: 'ราคาต่ำไปสูง',
  priceDesc: 'ราคาสูงไปต่ำ',
  dofDesc: 'องศาอิสระมากที่สุด',
  payloadDesc: 'ยกน้ำหนักได้มากที่สุด',
  runtimeDesc: 'ใช้งานต่อการชาร์จนานที่สุด',
  name: 'ชื่อรุ่น A–Z',
}

/** Budget bands go by the starting price, which is what a buyer shortlists on. */
export const BUDGET_LABEL: Record<Budget, string> = {
  all: 'ทุกช่วงราคา',
  under500k: 'ต่ำกว่า 500,000 บาท',
  '500kto1500k': '500,000–1.5 ล้านบาท',
  over1500k: '1.5 ล้านบาทขึ้นไป',
}

const normalize = (s: string) => s.toLocaleLowerCase('th').normalize('NFC').trim()

function haystack(m: Model): string {
  return normalize([m.brand, m.nameEn, m.nameTh, m.segment, m.originCountry, m.tagline, ...m.useCases, ...m.trims.map((t) => t.name)].join(' '))
}

const startPrice = (m: Model) => m.span.price?.[0] ?? null

function inBudget(m: Model, b: Budget): boolean {
  if (b === 'all') return true
  const p = startPrice(m)
  if (p == null) return false
  if (b === 'under500k') return p < 500_000
  if (b === '500kto1500k') return p >= 500_000 && p < 1_500_000
  return p >= 1_500_000
}

function byNullableNumber(a: number | null, b: number | null, dir: 1 | -1) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return (a - b) * dir
}

export function applyFilters(models: Model[], f: Filters): Model[] {
  const terms = normalize(f.q).split(/\s+/).filter(Boolean)

  const matched = models.filter((m) => {
    if (f.category !== 'all' && m.category !== f.category) return false
    if (f.brand !== 'all' && m.brand !== f.brand) return false
    if (!inBudget(m, f.budget)) return false
    if (terms.length === 0) return true
    const text = haystack(m)
    return terms.every((t) => text.includes(t))
  })

  const sorted = [...matched]
  switch (f.sort) {
    case 'priceAsc':
      sorted.sort((a, b) => byNullableNumber(startPrice(a), startPrice(b), 1))
      break
    case 'priceDesc':
      sorted.sort((a, b) => byNullableNumber(startPrice(a), startPrice(b), -1))
      break
    case 'dofDesc':
      sorted.sort((a, b) => byNullableNumber(a.span.dof?.[1] ?? null, b.span.dof?.[1] ?? null, -1))
      break
    case 'payloadDesc':
      sorted.sort((a, b) => byNullableNumber(a.span.payloadKg?.[1] ?? null, b.span.payloadKg?.[1] ?? null, -1))
      break
    case 'runtimeDesc':
      sorted.sort((a, b) => byNullableNumber(a.span.runtimeH?.[1] ?? null, b.span.runtimeH?.[1] ?? null, -1))
      break
    case 'name':
      sorted.sort((a, b) => a.nameEn.localeCompare(b.nameEn, 'en'))
      break
    case 'default':
      break
  }
  return sorted
}

export function isFiltered(f: Filters): boolean {
  return f.q.trim() !== '' || f.category !== 'all' || f.brand !== 'all' || f.budget !== 'all'
}
