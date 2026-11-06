import { Link, useLocation } from 'react-router'
import { Check, Plus } from 'lucide-react'
import { useCompare } from '../lib/compare'
import { formatNumber } from '../lib/format'
import { useLang } from '../i18n'
import { labels, pick, units } from '../lib/bilingual'
import type { Model } from '../lib/types'
import { photoStyle } from '../lib/photo'
import { Picture } from './Picture'
import './ModelCard.css'

// Brief labels fit a half-width phone card: "เปรียบเทียบ" reads like a lineup's compare checkbox,
// with the icon and fill showing whether it is ticked.
const COMPARE_LABEL = {
  th: {
    add: { full: 'เพิ่มเพื่อเปรียบเทียบ', brief: 'เปรียบเทียบ' },
    selected: { full: 'อยู่ในรายการเปรียบเทียบ', brief: 'เปรียบเทียบ' },
    blocked: { full: 'เลือกครบ 3 รุ่นแล้ว', brief: 'ครบ 3 แล้ว' },
  },
  en: {
    add: { full: 'Add to compare', brief: 'Compare' },
    selected: { full: 'In your comparison', brief: 'Compare' },
    blocked: { full: 'Three models chosen', brief: '3 chosen' },
  },
}

/**
 * A lineup card kept quiet like a car maker's range page: the robot on a studio sweep, what it is for, its name,
 * the starting price (marked "ประมาณ" when converted from the maker's currency) and three figures in a row.
 */
export function ModelCard({ model }: { model: Model }) {
  const lang = useLang()
  const tx = <T,>(th: T, en: T) => pick(lang, th, en)
  const L = labels(lang)
  const u = units(lang)
  const { has, toggle, isFull } = useCompare()
  const { search } = useLocation()
  const selected = has(model.id)
  const blocked = !selected && isFull
  const to = `/models/${model.id}`
  // Remember the filtered list so the model page's "back" link returns to it.
  const state = { from: search }
  const label = COMPARE_LABEL[lang][selected ? 'selected' : blocked ? 'blocked' : 'add']
  const cheapest = model.trims.find((t) => t.priceTHB != null) ?? null
  const startPrice = cheapest?.priceTHB ?? null
  const converted = cheapest?.priceBasis === 'converted'
  const dof = model.span.dof?.[1] ?? null
  const runtime = model.span.runtimeH?.[1] ?? null

  return (
    <article className="plate" aria-labelledby={`plate-${model.id}`}>
      {/* The photo is an extra pointer target for the title link, so it stays out of the tab order */}
      <Link to={to} state={state} className="plate__media" tabIndex={-1} aria-hidden="true">
        <Picture src={model.image.srcSmall} alt="" sizes="(max-width: 560px) 50vw, (max-width: 960px) 50vw, 33vw" style={photoStyle(model.image)} />
      </Link>

      <div className="plate__body">
        <p className="plate__kind">{L.category[model.category]}</p>
        <h3 id={`plate-${model.id}`} className="plate__title" lang="en">
          <Link to={to} state={state}>
            {model.nameEn}
          </Link>
        </h3>

        {/* "ประมาณ" marks a price converted from the maker's currency; the maker's own figure is on the model page */}
        <p className="plate__price">
          {startPrice != null ? (
            <>
              <span className="plate__price-label">{tx('เริ่มต้น', 'From')} </span>
              {converted && <span className="plate__approx">{tx('ประมาณ ', 'about ')}</span>}
              <span className="plate__figure nowrap">{formatNumber(startPrice)}</span>
              <span className="plate__unit"> {u.baht}</span>
            </>
          ) : (
            tx('ยังไม่ประกาศราคา', 'Price not announced')
          )}
        </p>

        {/* Three figures in a row; the units say what each is, the hidden labels say it to screen readers */}
        <ul className="plate__specs" aria-label={tx('สเปกหลัก', 'Key specs')}>
          <li>
            <span className="visually-hidden">{tx('ความสูง', 'Height')} </span>
            {formatNumber(model.heightCm)} {u.cm}
          </li>
          {dof != null && (
            <li>
              <span className="visually-hidden">{tx('องศาอิสระ', 'Degrees of freedom')} </span>
              {formatNumber(dof)} <span lang="en">DoF</span>
            </li>
          )}
          {runtime != null && (
            <li>
              <span className="visually-hidden">{tx('ใช้งานต่อการชาร์จ', 'Runtime')} </span>
              {formatNumber(runtime)} {u.h}
            </li>
          )}
        </ul>
        {/* The label carries the state, so no aria-pressed; a full list keeps the button focusable.
            Phone cards show the brief label and keep the full one for screen readers. */}
        <button
          type="button"
          className="plate__compare"
          data-selected={selected || undefined}
          aria-disabled={blocked || undefined}
          onClick={() => !blocked && toggle(model.id)}
        >
          {selected ? <Check size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
          <span className="plate__label">{label.full}</span>
          <span className="plate__label-brief" aria-hidden="true">
            {label.brief}
          </span>
          <span className="visually-hidden"> {model.nameEn}</span>
        </button>
      </div>
    </article>
  )
}
