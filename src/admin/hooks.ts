import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'
import { errorMessage } from './api'

export interface Loaded<T> {
  data: T | undefined
  error: string | null
  /** True while (re)loading; the previous data stays on screen meanwhile */
  loading: boolean
  reload: () => void
}

/** Loads data for a screen and reloads when `deps` change, keeping the last result visible while it refetches. */
export function useLoad<T>(load: (signal: AbortSignal) => Promise<T>, deps: DependencyList): Loaded<T> {
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const loadRef = useRef(load)
  loadRef.current = load

  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    loadRef.current(ctrl.signal).then(
      (d) => {
        if (ctrl.signal.aborted) return
        setData(d)
        setError(null)
        setLoading(false)
      },
      (err) => {
        if (ctrl.signal.aborted) return
        setError(errorMessage(err))
        setLoading(false)
      },
    )
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload }
}

/** A value that only settles after `ms` without changes (search boxes, the live quote). */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return settled
}

/** Matches a CSS media query (phone layouts that change behaviour, not only looks). */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false))
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatches(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return matches
}
