import { useId, useState, type CSSProperties } from 'react'
import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react'
import { BUDGET_LABEL, SORT_LABEL, type Budget, type Filters, type SortKey } from '../lib/filter'
import { useLang } from '../i18n'
import { labels, pick } from '../lib/bilingual'
import type { Category } from '../lib/types'
import './FilterBar.css'

interface Props {
  filters: Filters
  onChange: (patch: Partial<Filters>) => void
  categoryOptions: Category[]
  brandOptions: string[]
}

function SelectField<T extends string>(props: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  const id = useId()
  return (
    <div className="select">
      <label htmlFor={id} className="select__label">
        {props.label}
      </label>
      <select id={id} value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={16} aria-hidden className="select__icon" />
    </div>
  )
}

export function FilterBar({ filters, onChange, categoryOptions, brandOptions }: Props) {
  const lang = useLang()
  const tx = <T,>(th: T, en: T) => pick(lang, th, en)
  const L = labels(lang)
  const searchId = useId()
  const extrasId = useId()
  const extrasActive =
    (filters.brand !== 'all' ? 1 : 0) + (filters.budget !== 'all' ? 1 : 0) + (filters.sort !== 'default' ? 1 : 0)
  // Phones only: brand/budget/sort fold away behind one toggle (always visible on wider screens via CSS).
  const [open, setOpen] = useState(extrasActive > 0)

  const categories: { value: Filters['category']; label: string }[] = [
    { value: 'all', label: tx('ทั้งหมด', 'All') },
    ...categoryOptions.map((c) => ({ value: c, label: L.categoryBrief[c] })),
  ]

  return (
    <div className="toolbar" role="search" aria-label={tx('ค้นหาและกรองหุ่นยนต์', 'Search and filter robots')}>
      <div className="toolbar__search">
        <label htmlFor={searchId} className="visually-hidden">
          {tx('ค้นหาหุ่นยนต์', 'Search robots')}
        </label>
        <Search size={18} aria-hidden className="toolbar__search-icon" />
        <input
          id={searchId}
          data-model-search
          type="search"
          value={filters.q}
          placeholder={tx('ค้นหายี่ห้อ รุ่น หรืองานที่ใช้', 'Search by brand, model or use')}
          autoComplete="off"
          onChange={(e) => onChange({ q: e.target.value })}
        />
      </div>

      <fieldset className="segmented" style={{ '--segments': categories.length } as CSSProperties}>
        <legend className="visually-hidden">{tx('ประเภทการใช้งาน', 'Main use')}</legend>
        {categories.map((o) => (
          <label key={o.value} className="segmented__option">
            <input
              type="radio"
              name="category"
              value={o.value}
              checked={filters.category === o.value}
              onChange={() => onChange({ category: o.value })}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </fieldset>

      <button
        type="button"
        className="toolbar__more"
        aria-expanded={open}
        aria-controls={extrasId}
        onClick={() => setOpen((o) => !o)}
      >
        <SlidersHorizontal size={16} aria-hidden />
        {tx('ตัวกรองเพิ่มเติม', 'More filters')}
        {extrasActive > 0 ? ` (${extrasActive})` : ''}
      </button>

      <div className="toolbar__selects" id={extrasId} data-open={open || undefined}>
        <SelectField
          label={tx('ยี่ห้อ', 'Brand')}
          value={filters.brand}
          onChange={(brand) => onChange({ brand })}
          options={[{ value: 'all', label: tx('ทุกยี่ห้อ', 'All brands') }, ...brandOptions.map((b) => ({ value: b, label: b }))]}
        />
        <SelectField
          label={tx('ราคาเริ่มต้น', 'Starting price')}
          value={filters.budget}
          onChange={(budget) => onChange({ budget })}
          options={(Object.keys(BUDGET_LABEL) as Budget[]).map((k) => ({ value: k, label: L.budget[k] }))}
        />
        <SelectField
          label={tx('เรียงตาม', 'Sort by')}
          value={filters.sort}
          onChange={(sort) => onChange({ sort })}
          options={(Object.keys(SORT_LABEL) as SortKey[]).map((k) => ({ value: k, label: L.sort[k] }))}
        />
      </div>
    </div>
  )
}
