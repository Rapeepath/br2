import { useEffect, useMemo, useState } from 'react'
import { STATIC_STORE, type StoreInfo } from './storeInfo'

/**
 * Live shop data from the POS (`/api/public/catalog`, `/api/public/store`). Each is fetched once per page
 * load and shared. When the API can't be reached (static hosting, prerender, offline) the brochure keeps
 * showing its own catalogue and the static store details — callers treat `null` as "no live data".
 */

export type StockState = 'in' | 'low' | 'out' | 'service'

export interface LiveItem {
  id: string
  sku: string
  refId: string | null
  variant: string | null
  name: string
  subtitle: string
  categoryId: string
  /** Selling price including VAT, baht */
  price: number
  stockState: StockState
  /** Units on hand; null for services */
  stock: number | null
  image: string | null
  /** Maew: kittens currently available for this breed */
  kittensAvailable?: number
}

export type LiveStatus = 'loading' | 'live' | 'offline'

const TIMEOUT_MS = 6000

async function getJson<T>(url: string): Promise<T | null> {
  if (typeof fetch === 'undefined' || typeof window === 'undefined') return null
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = setTimeout(() => ctrl?.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl?.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Accepts either a bare array or `{ items: [...] }` (with optional extras merged onto items by refId). */
function normalizeCatalog(raw: unknown): LiveItem[] | null {
  if (Array.isArray(raw)) return raw as LiveItem[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)) {
    const { items, kittensAvailable } = raw as { items: LiveItem[]; kittensAvailable?: Record<string, number> }
    if (!kittensAvailable) return items
    return items.map((i) => (i.refId && i.refId in kittensAvailable ? { ...i, kittensAvailable: kittensAvailable[i.refId] } : i))
  }
  return null
}

interface Cached<T> {
  promise: Promise<T | null> | null
  value: T | null
  done: boolean
}

const catalogCache: Cached<LiveItem[]> = { promise: null, value: null, done: false }
const storeCache: Cached<Partial<StoreInfo>> = { promise: null, value: null, done: false }

function load<T>(cache: Cached<T>, url: string, parse: (raw: unknown) => T | null): Promise<T | null> {
  cache.promise ??= getJson<unknown>(url).then((raw) => {
    cache.value = raw == null ? null : parse(raw)
    cache.done = true
    return cache.value
  })
  return cache.promise
}

function useCached<T>(cache: Cached<T>, url: string, parse: (raw: unknown) => T | null) {
  const [state, setState] = useState<{ value: T | null; status: LiveStatus }>(() =>
    cache.done ? { value: cache.value, status: cache.value ? 'live' : 'offline' } : { value: null, status: 'loading' },
  )
  useEffect(() => {
    if (cache.done) return
    let alive = true
    load(cache, url, parse).then((value) => {
      if (alive) setState({ value, status: value ? 'live' : 'offline' })
    })
    return () => {
      alive = false
    }
  }, [cache, url, parse])
  return state
}

/** Live prices and stock. `byRef('unitree-g1')` gives that model's POS products (trims), `byId` one product. */
export function useLiveCatalog() {
  const { value, status } = useCached(catalogCache, '/api/public/catalog', normalizeCatalog)
  return useMemo(() => {
    const items = value
    return {
      items,
      status,
      byId: (id: string) => items?.find((i) => i.id === id),
      byRef: (refId: string) => items?.filter((i) => i.refId === refId) ?? [],
    }
  }, [value, status])
}

const parseStore = (raw: unknown) => (raw && typeof raw === 'object' ? (raw as Partial<StoreInfo>) : null)

/** The showroom's contact details: live from the POS settings when available, the static copy otherwise. */
export function useStoreInfo(): StoreInfo & { status: LiveStatus } {
  const { value, status } = useCached(storeCache, '/api/public/store', parseStore)
  return useMemo(() => {
    const live = value ?? {}
    const merged = { ...STATIC_STORE } as StoreInfo
    for (const [k, v] of Object.entries(live)) {
      if (v != null && v !== '' && !(Array.isArray(v) && v.length === 0)) (merged as unknown as Record<string, unknown>)[k] = v
    }
    return { ...merged, status }
  }, [value, status])
}

/** Test helper: forget cached responses between tests. */
export function resetLiveCache() {
  for (const c of [catalogCache, storeCache] as Cached<unknown>[]) {
    c.promise = null
    c.value = null
    c.done = false
  }
}
