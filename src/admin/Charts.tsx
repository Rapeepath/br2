import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Table2 } from 'lucide-react'
import { axisFormatter, niceTicks } from './format'
import './charts.css'

export interface ColumnPoint {
  key: string
  /** Axis label ("6 พ.ย.", "14:00") */
  label: string
  /** Full label for the tooltip and table ("ศ. 6 พ.ย. 2569") */
  long: string
  value: number
  /** Second line in the tooltip and a table column ("3 บิล") */
  detail?: string
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** "ดูเป็นตาราง" switch every chart carries, so no value is reachable by hover alone. */
function TableToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="chart__toggle" aria-pressed={on} onClick={onToggle}>
      <Table2 size={16} aria-hidden />
      ดูเป็นตาราง
    </button>
  )
}

/**
 * One-series column chart (inline SVG). Thin columns with a rounded data end grow from one baseline;
 * hairline grid on clean round ticks; hover or arrow keys show a tooltip; a table view holds every value.
 */
export function ColumnChart({
  title,
  points,
  format,
  valueHeader,
  detailHeader,
  height = 220,
  empty = 'ยังไม่มียอดขายในช่วงนี้',
}: {
  title: string
  points: ColumnPoint[]
  format: (v: number) => string
  valueHeader: string
  detailHeader?: string
  height?: number
  empty?: string
}) {
  const [asTable, setAsTable] = useState(false)
  const [active, setActive] = useState<number | null>(null)
  const [ref, width] = useWidth<HTMLDivElement>()
  const liveId = useId()

  const max = Math.max(0, ...points.map((p) => p.value))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const axis = axisFormatter(top)
  const padL = Math.max(36, Math.max(...ticks.map((t) => axis(t).length)) * 7.4 + 10)
  const padR = 8
  const padT = 14
  const padB = 30
  const plotW = Math.max(0, width - padL - padR)
  const plotH = height - padT - padB
  const band = points.length ? plotW / points.length : 0
  const barW = Math.max(2, Math.min(24, band * 0.62))
  const y = (v: number) => padT + plotH - (v / top) * plotH
  // Label every nth column so axis text never collides (about 64px per label)
  const every = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(plotW / 64))))
  const allZero = max === 0

  const onKey = (e: KeyboardEvent) => {
    if (!points.length) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setActive((i) => {
        const cur = i ?? points.length - 1
        if (e.key === 'Home') return 0
        if (e.key === 'End') return points.length - 1
        return Math.min(points.length - 1, Math.max(0, cur + (e.key === 'ArrowRight' ? 1 : -1)))
      })
    }
  }

  const a = active !== null ? points[active] : null

  return (
    <figure className="chart">
      <div className="chart__bar">
        <figcaption className="chart__title">{title}</figcaption>
        <TableToggle on={asTable} onToggle={() => setAsTable((v) => !v)} />
      </div>
      {asTable ? (
        <div className="table-wrap" role="region" aria-label={`${title} (ตาราง)`} tabIndex={0}>
          <table className="table table--compact">
            <thead>
              <tr>
                <th scope="col">รายการ</th>
                <th scope="col" className="num">
                  {valueHeader}
                </th>
                {detailHeader && (
                  <th scope="col" className="num">
                    {detailHeader}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.key}>
                  <th scope="row">{p.long}</th>
                  <td className="num">{format(p.value)}</td>
                  {detailHeader && <td className="num">{p.detail}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={ref}
          className="chart__plot"
          style={{ height }}
          role="group"
          tabIndex={0}
          aria-label={`${title} กดลูกศรซ้ายหรือขวาเพื่ออ่านค่าทีละแท่ง หรือเลือกดูเป็นตาราง`}
          aria-describedby={liveId}
          onKeyDown={onKey}
          onFocus={() => setActive((i) => i ?? points.length - 1)}
          onBlur={() => setActive(null)}
          onMouseLeave={() => setActive(null)}
        >
          {width > 0 && (
            <svg width={width} height={height} aria-hidden="true" focusable="false">
              {ticks.map((t) => (
                <g key={t}>
                  <line className="chart__grid" x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} />
                  <text className="chart__tick" x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end">
                    {axis(t)}
                  </text>
                </g>
              ))}
              {points.map((p, i) => {
                const cx = padL + band * i + band / 2
                const h = Math.max(0, y(0) - y(p.value))
                const r = Math.min(4, barW / 2, h)
                const x0 = cx - barW / 2
                const yTop = y(0) - h
                const d =
                  h > 0
                    ? `M${x0},${y(0)} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + barW - r} Q${x0 + barW},${yTop} ${x0 + barW},${yTop + r} V${y(0)} Z`
                    : ''
                return (
                  <g key={p.key}>
                    {d && <path className={`chart__col ${active === i ? 'is-active' : ''}`} d={d} />}
                    {i % every === 0 && (
                      <text className="chart__xlabel" x={cx} y={height - 8} textAnchor="middle">
                        {p.label}
                      </text>
                    )}
                    {/* Hit area: the whole band, taller than the mark */}
                    <rect x={padL + band * i} y={padT} width={band} height={plotH} fill="transparent" onMouseEnter={() => setActive(i)} />
                  </g>
                )
              })}
              <line className="chart__base" x1={padL} x2={width - padR} y1={y(0)} y2={y(0)} />
            </svg>
          )}
          {allZero && <p className="chart__empty">{empty}</p>}
          {a && active !== null && (
            <div
              className="chart__tip"
              style={{
                left: Math.min(Math.max(padL + band * active + band / 2, 80), Math.max(80, width - 80)),
                top: Math.max(0, y(a.value) - 8),
              }}
            >
              <span className="chart__tip-label">{a.long}</span>
              <strong>{format(a.value)}</strong>
              {a.detail && <span>{a.detail}</span>}
            </div>
          )}
          <p id={liveId} className="visually-hidden" aria-live="polite">
            {a ? `${a.long} ${format(a.value)} ${a.detail ?? ''}` : ''}
          </p>
        </div>
      )}
    </figure>
  )
}

export interface BarRow {
  key: string
  label: ReactNode
  value: number
  /** Right-hand second figure ("12 บิล") */
  note?: string
  to?: string
}

/** Horizontal bars with every value written at the tip: a ranked list that doubles as its own table. */
export function BarList({ rows, format, empty = 'ยังไม่มีข้อมูลในช่วงนี้', label }: { rows: BarRow[]; format: (v: number) => string; empty?: string; label: string }) {
  const max = Math.max(0, ...rows.map((r) => r.value))
  if (!rows.length || max === 0) return <p className="state state--empty">{empty}</p>
  return (
    <ul className="barlist" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} className="barlist__row">
          <div className="barlist__head">
            <span className="barlist__label">
              {r.to ? <Link to={r.to}>{r.label}</Link> : r.label}
              {r.note && <span className="barlist__note">{r.note}</span>}
            </span>
            <span className="barlist__value">{format(r.value)}</span>
          </div>
          <span className="barlist__track" aria-hidden="true">
            <span className="barlist__fill" style={{ width: r.value > 0 ? `${Math.max(1.5, (r.value / max) * 100)}%` : 0 }} />
          </span>
        </li>
      ))}
    </ul>
  )
}
