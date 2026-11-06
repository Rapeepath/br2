import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export const COMPARE_LIMIT = 3
const STORAGE_KEY = 'servo.compare'

interface CompareState {
  ids: string[]
  has: (id: string) => boolean
  toggle: (id: string) => void
  remove: (id: string) => void
  clear: () => void
  isFull: boolean
}

const CompareContext = createContext<CompareState | null>(null)

function readStored(validIds: Set<string>): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && validIds.has(id)).slice(0, COMPARE_LIMIT)
  } catch {
    return []
  }
}

export function CompareProvider({ children, validIds }: { children: ReactNode; validIds: string[] }) {
  const valid = useMemo(() => new Set(validIds), [validIds])
  const [ids, setIds] = useState<string[]>(() => readStored(valid))

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    } catch {
      // Storage can be unavailable (private mode); comparison still works for this visit.
    }
  }, [ids])

  const toggle = useCallback((id: string) => {
    setIds((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id)
      if (cur.length >= COMPARE_LIMIT) return cur
      return [...cur, id]
    })
  }, [])

  const remove = useCallback((id: string) => setIds((cur) => cur.filter((x) => x !== id)), [])
  const clear = useCallback(() => setIds([]), [])

  const value = useMemo<CompareState>(
    () => ({ ids, has: (id) => ids.includes(id), toggle, remove, clear, isFull: ids.length >= COMPARE_LIMIT }),
    [ids, toggle, remove, clear],
  )

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
}

export function useCompare(): CompareState {
  const ctx = useContext(CompareContext)
  if (!ctx) throw new Error('useCompare must be used inside <CompareProvider>')
  return ctx
}
