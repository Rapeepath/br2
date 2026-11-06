import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Bot, ChevronLeft, ChevronRight, CircleAlert, Package, Wrench, X } from 'lucide-react'
import { models } from '../data'
import { photoStyle } from '../lib/photo'
import { addDays, baht, initial, STATUS_LABEL, todayKey } from './format'
import type { OrderStatus, Product } from './types'

export function PageHead({ title, lead, actions, back }: { title: ReactNode; lead?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <header className="page-head">
      <div className="page-head__text">
        {back && (
          <Link className="page-head__back" to={back.to}>
            <ChevronLeft size={16} aria-hidden />
            {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {lead && <p className="page-head__lead">{lead}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </header>
  )
}

export function Card({ title, actions, children, className = '', id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  const headingId = useId()
  return (
    <section className={`card ${className}`} aria-labelledby={title ? headingId : undefined} id={id}>
      {(title || actions) && (
        <div className="card__head">
          {title && <h2 id={headingId}>{title}</h2>}
          {actions && <div className="card__actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className={`stat ${tone ? `tone-${tone}` : ''}`}>
      <p className="stat__label">{label}</p>
      <p className="stat__value">{value}</p>
      {sub && <p className="stat__sub">{sub}</p>}
    </div>
  )
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge ${status === 'paid' ? 'badge--ok' : 'badge--warn'}`}>{STATUS_LABEL[status]}</span>
}

export function StockBadge({ product, unit }: { product: Pick<Product, 'trackStock' | 'stock' | 'reorderLevel'>; unit: string }) {
  if (!product.trackStock) return <span className="badge badge--quiet">ไม่นับสต็อก</span>
  if (product.stock <= 0) return <span className="badge badge--bad">หมด</span>
  if (product.stock <= product.reorderLevel)
    return (
      <span className="badge badge--warn">
        ใกล้หมด เหลือ {product.stock} {unit}
      </span>
    )
  return (
    <span className="badge badge--ok">
      เหลือ {product.stock} {unit}
    </span>
  )
}

const imageOf = new Map(models.map((m) => [m.id, m.image]))

/** A product's photo on the studio-grey stage, or an icon square for items without one. */
export function ProductThumb({ product, size = 'sm' }: { product: Pick<Product, 'image' | 'refId' | 'categoryId'>; size?: 'sm' | 'md' | 'lg' }) {
  const framing = product.refId ? imageOf.get(product.refId) : undefined
  if (product.image) {
    return (
      <span className={`thumb thumb--${size}`}>
        <img src={`/${product.image}`} alt="" loading="lazy" decoding="async" style={framing ? photoStyle(framing) : undefined} />
      </span>
    )
  }
  const Icon = product.categoryId === 'service' ? Wrench : product.categoryId === 'robot' ? Bot : Package
  return (
    <span className={`thumb thumb--${size} thumb--icon`} aria-hidden="true">
      <Icon size={size === 'sm' ? 18 : 28} strokeWidth={1.75} />
    </span>
  )
}

export function Loading({ label = 'กำลังโหลดข้อมูล' }: { label?: string }) {
  return (
    <p className="state state--loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </p>
  )
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <CircleAlert size={18} aria-hidden />
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
          ลองอีกครั้ง
        </button>
      )}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="state state--empty">{children}</p>
}

/** Copies each column's header text onto its cells (data-label), for the stacked phone layout. */
function labelCells(wrap: HTMLElement) {
  for (const table of wrap.querySelectorAll('table')) {
    const heads = Array.from(table.querySelectorAll('thead th'), (th) => th.textContent?.trim() ?? '')
    for (const row of table.querySelectorAll('tbody tr, tfoot tr')) {
      let col = 0
      for (const cell of Array.from(row.children) as HTMLTableCellElement[]) {
        const label = heads[col] ?? ''
        if (cell.getAttribute('data-label') !== label) cell.setAttribute('data-label', label)
        col += cell.colSpan || 1
      }
    }
  }
}

/**
 * A table on desktop; on phones each row becomes a card of labelled fields (labels come from the header
 * row, so cells need no extra markup). The frame is focusable so keyboards can scroll a wide table.
 */
export function TableWrap({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const wrap = ref.current
    if (!wrap) return
    labelCells(wrap)
    // Rows change as filters and pages change; relabel whatever React renders next
    const mo = new MutationObserver(() => labelCells(wrap))
    mo.observe(wrap, { childList: true, subtree: true, characterData: true })
    return () => mo.disconnect()
  }, [])
  return (
    <div ref={ref} className="table-wrap table-wrap--stack" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  )
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  const first = page * pageSize + 1
  const last = Math.min(total, (page + 1) * pageSize)
  return (
    <nav className="pager" aria-label="เลือกหน้า">
      <p>
        รายการที่ {first.toLocaleString('th-TH')}–{last.toLocaleString('th-TH')} จาก {total.toLocaleString('th-TH')}
      </p>
      <div className="pager__btns">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPage(page - 1)} disabled={page === 0}>
          <ChevronLeft size={16} aria-hidden />
          ก่อนหน้า
        </button>
        <span className="pager__page">
          หน้า {page + 1}/{pages}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPage(page + 1)} disabled={page >= pages - 1}>
          ถัดไป
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
    </nav>
  )
}

/** A labelled form control; pass the control as a render function to receive its id. */
export function Field({ label, hint, error, children, className = '' }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: (id: string, describedBy: string | undefined) => ReactNode; className?: string }) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-err` : undefined
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {children(id, describedBy)}
      {hint && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={errId} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/** A segmented single choice built from real radio buttons. */
export function Segmented<T extends string>({ legend, options, value, onChange, hideLegend = false }: { legend: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; hideLegend?: boolean }) {
  const name = useId()
  return (
    <fieldset className="seg">
      <legend className={hideLegend ? 'visually-hidden' : 'seg__legend'}>{legend}</legend>
      <div className="seg__options">
        {options.map((o) => (
          <label key={o.value} className="seg__option">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export type RangePreset = 'today' | '7' | '30' | 'custom'

export function rangeOf(preset: RangePreset, custom: { from: string; to: string }) {
  const today = todayKey()
  if (preset === 'today') return { from: today, to: today }
  if (preset === '7') return { from: addDays(today, -6), to: today }
  if (preset === '30') return { from: addDays(today, -29), to: today }
  return custom
}

/** Date presets plus a custom from–to pair, for the filter row above lists and reports. */
export function RangeFilter({ preset, from, to, onChange }: { preset: RangePreset; from: string; to: string; onChange: (preset: RangePreset, from: string, to: string) => void }) {
  return (
    <div className="range">
      <Segmented<RangePreset>
        legend="ช่วงวันที่"
        value={preset}
        onChange={(p) => {
          const r = rangeOf(p, { from, to })
          onChange(p, r.from, r.to)
        }}
        options={[
          { value: 'today', label: 'วันนี้' },
          { value: '7', label: '7 วัน' },
          { value: '30', label: '30 วัน' },
          { value: 'custom', label: 'กำหนดเอง' },
        ]}
      />
      {preset === 'custom' && (
        <div className="range__custom">
          <Field label="ตั้งแต่">{(id) => <input id={id} type="date" value={from} max={to} onChange={(e) => e.target.value && onChange('custom', e.target.value, to)} />}</Field>
          <Field label="ถึง">{(id) => <input id={id} type="date" value={to} min={from} onChange={(e) => e.target.value && onChange('custom', from, e.target.value)} />}</Field>
        </div>
      )}
    </div>
  )
}

/**
 * A modal on the native <dialog>: focus is trapped, Esc closes, the page behind is inert. Children
 * mount only while it is open, so each opening starts with a fresh form.
 */
export function Dialog({ open, onClose, title, children, size = 'md', className = '' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className={`dialog dialog--${size} ${className}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      {open && (
        <>
          <div className="dialog__head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="ปิดหน้าต่าง">
              <X size={20} aria-hidden />
            </button>
          </div>
          <div className="dialog__body">{children}</div>
          {/* Toasts raised while this dialog is open land here (see ToastProvider) */}
          <div className="toasts" role="status" aria-live="polite" data-toast-host="" />
        </>
      )}
    </dialog>
  )
}

const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('th', { granularity: 'word' }) : null

/** Longer than this (in characters) a space-free run is a phrase of Thai words ("โรงเรียนสาธิต…"), not one name */
const LONG = 12

/** Dictionary words of a long space-free run; punctuation sticks to the word beside it. */
function thaiWords(token: string): string[] {
  if (!segmenter) return [token]
  const out: string[] = []
  let lead = ''
  for (const s of segmenter.segment(token)) {
    if (!s.isWordLike) {
      if (out.length) out[out.length - 1] += s.segment
      else lead += s.segment
    } else {
      out.push(lead + s.segment)
      lead = ''
    }
  }
  if (lead) out.push(lead)
  return out.length ? out : [token]
}

/**
 * A name that breaks only at its spaces: Thai otherwise wraps mid-word in narrow table cells. Short runs are
 * names (often transliterations the dictionary splits wrongly) and stay whole; a long space-free run such as a
 * Thai institution's name may break between its dictionary words, so it never pushes a phone card wider.
 */
export function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\s+)/).map((part, i) => {
        if (/^\s+$/.test(part) || !part) return part
        if ([...part].length <= LONG) {
          return (
            <span key={i} className="nowrap">
              {part}
            </span>
          )
        }
        return (
          <Fragment key={i}>
            {thaiWords(part).map((w, j) => (
              <Fragment key={j}>
                {j > 0 && <wbr />}
                <span className="nowrap">{w}</span>
              </Fragment>
            ))}
          </Fragment>
        )
      })}
    </>
  )
}

export function Avatar({ name, tone }: { name: string; tone: string }) {
  return (
    <span className={`avatar tone-${tone}`} aria-hidden="true">
      {initial(name)}
    </span>
  )
}

/** Baht with the unit in a quieter weight: "1,234,500 บาท". */
export function Baht({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`baht ${className}`}>
      {baht(value)} <span className="baht__unit">บาท</span>
    </span>
  )
}

/** Reads a number typed with or without thousands separators. */
export const parseAmount = (s: string): number => {
  const n = Number(s.replace(/[,\s]/g, ''))
  return Number.isFinite(n) ? n : NaN
}

export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
