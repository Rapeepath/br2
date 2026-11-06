import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import './Tabs.css'

export interface TabItem {
  id: string
  label: string
  /** Shorter label for narrow screens; the full label stays the accessible name. */
  shortLabel?: string
  content: ReactNode
}

interface TabsProps {
  items: TabItem[]
  active: string
  onChange: (id: string) => void
  label: string
  id?: string
}

/** WAI-ARIA tabs with roving tabindex: arrows/Home/End move and activate. */
export function Tabs({ items, active, onChange, label, id }: TabsProps) {
  const base = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const activeIndex = Math.max(0, items.findIndex((t) => t.id === active))

  // Keep the active tab visible if the strip ever scrolls sideways (only with enlarged text; phones
  // show every tab in a grid). Scroll only the tab strip: scrollIntoView would also scroll the page
  // and move the browser's Tab-key starting point.
  useEffect(() => {
    const list = listRef.current
    const tab = refs.current[activeIndex]
    if (!list || !tab) return
    const left = tab.offsetLeft
    const right = left + tab.offsetWidth
    const margin = 16
    if (left < list.scrollLeft + margin) list.scrollLeft = left - margin
    else if (right > list.scrollLeft + list.clientWidth - margin) list.scrollLeft = right - list.clientWidth + margin
  }, [activeIndex])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const last = items.length - 1
    let next: number | null = null
    if (e.key === 'ArrowRight') next = activeIndex === last ? 0 : activeIndex + 1
    else if (e.key === 'ArrowLeft') next = activeIndex === 0 ? last : activeIndex - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = last
    if (next == null) return
    e.preventDefault()
    onChange(items[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div className="tabs" id={id}>
      <div className="tabs__list" role="tablist" aria-label={label} onKeyDown={onKeyDown} ref={listRef}>
        {items.map((t, i) => {
          const selected = i === activeIndex
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              className="tabs__tab"
              onClick={() => onChange(t.id)}
            >
              {t.shortLabel ? (
                <>
                  <span className="tabs__full">{t.label}</span>
                  <span className="tabs__short" aria-hidden="true">
                    {t.shortLabel}
                  </span>
                </>
              ) : (
                t.label
              )}
            </button>
          )
        })}
      </div>
      {items.map((t, i) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={i !== activeIndex}
          tabIndex={0}
          className="tabs__panel"
        >
          {i === activeIndex && (
            <>
              <h2 className="visually-hidden">{t.label}</h2>
              {t.content}
            </>
          )}
        </div>
      ))}
    </div>
  )
}
