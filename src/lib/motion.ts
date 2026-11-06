import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * True when motion is welcome: index.html sets html.motion-ok before first paint unless the visitor
 * prefers reduced motion. Tests (jsdom) and no-JS visitors never get it, so they see final states.
 */
export function motionOk(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('motion-ok')
}

/**
 * Reveals every [data-reveal] inside `root` as it scrolls into view, once. Re-scans when `key` changes
 * (a filtered list renders new items). Without IntersectionObserver or motion, everything shows at once.
 */
export function useReveal(root: RefObject<HTMLElement | null>, key?: unknown) {
  useEffect(() => {
    const el = root.current
    if (!el) return
    const items = [...el.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-in)')]
    if (!items.length) return
    if (!motionOk() || typeof IntersectionObserver === 'undefined') {
      items.forEach((i) => i.classList.add('is-in'))
      return
    }
    // Items that enter together stagger by their order in the batch, not their order on the page
    const io = new IntersectionObserver(
      (entries) => {
        let n = 0
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const t = e.target as HTMLElement
          t.style.setProperty('--reveal-i', String(n++))
          t.classList.add('is-in')
          io.unobserve(t)
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.08 },
    )
    items.forEach((i) => io.observe(i))
    return () => io.disconnect()
  }, [root, key])
}

/** Becomes true the first time `ref` is in view (immediately when motion is off). */
export function useInView(ref: RefObject<Element | null>, threshold = 0.3): boolean {
  const [seen, setSeen] = useState(() => !motionOk())
  useEffect(() => {
    if (seen) return
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setSeen(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true)
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref, seen, threshold])
  return seen
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

/**
 * Animates a number from where it last was to `target` (from 0 the first time) once `play` is true,
 * like a spec readout settling. Returns `target` unchanged when motion is off.
 */
export function useCountUp(target: number, play: boolean, duration = 1100): number {
  const animate = motionOk()
  const [value, setValue] = useState(animate ? 0 : target)
  const from = useRef(animate ? 0 : target)
  const shown = useRef(value)
  shown.current = value

  useEffect(() => {
    if (!animate) {
      setValue(target)
      return
    }
    if (!play) return
    const start = performance.now()
    const begin = from.current
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setValue(begin + (target - begin) * easeOutExpo(t))
      if (t < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      // Interrupted mid-count: carry on from the figure on screen
      from.current = shown.current
    }
  }, [target, play, duration, animate])

  return animate ? value : target
}

/** True once the page has scrolled past `offset` pixels. */
export function useScrolled(offset = 8): boolean {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [offset])
  return scrolled
}
