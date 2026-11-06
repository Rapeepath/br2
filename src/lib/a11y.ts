import { useEffect } from 'react'

const SITE = 'Servo'

/** Per-route document title, so tabs, history and screen readers name the page. */
export function useTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} – ${SITE}` : `${SITE} แค็ตตาล็อกหุ่นยนต์ฮิวแมนนอยด์`
  }, [title])
}

type Target = string | (() => HTMLElement | null | undefined)

/**
 * Moves focus after React has committed the next render — used when the control the user
 * pressed removes itself (clear filters, remove from compare) so focus never falls to <body>.
 * Targets are tried in order; the first one that exists and is focusable wins.
 */
export function focusSoon(...targets: Target[]) {
  focusFirst(targets, false)
}

/** Same as focusSoon, but never scrolls — for fallbacks far from where the user is reading. */
export function focusSoonQuietly(...targets: Target[]) {
  focusFirst(targets, true)
}

function focusFirst(targets: Target[], preventScroll: boolean) {
  requestAnimationFrame(() => {
    for (const t of targets) {
      const el = typeof t === 'string' ? document.querySelector<HTMLElement>(t) : t()
      if (el && !(el as HTMLButtonElement).disabled) {
        if (el.tabIndex < 0 && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
        el.focus({ preventScroll })
        return
      }
    }
  })
}

/** English-only strings get lang="en" so screen readers switch voice (WCAG 3.1.2). */
export const langOf = (s: string): 'en' | undefined => (/[\u0E00-\u0E7F]/.test(s) ? undefined : 'en')
