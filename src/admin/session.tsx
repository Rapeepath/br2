import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { api } from './api'
import type { Meta, PublicStaff, ShiftView } from './types'

interface Session {
  staff: PublicStaff
  isManager: boolean
  meta: Meta | null
  /** The open shift, or null when none is open (undefined while loading) */
  shift: ShiftView | null | undefined
  refreshShift: () => void
  refreshMeta: () => void
  logout: () => void
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ staff, onLogout, children }: { staff: PublicStaff; onLogout: () => void; children: ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [shift, setShift] = useState<ShiftView | null | undefined>(undefined)

  const refreshMeta = useCallback(() => {
    api<Meta>('/meta').then(setMeta, () => {})
  }, [])
  const refreshShift = useCallback(() => {
    api<ShiftView | null>('/shifts/current').then(setShift, () => {})
  }, [])

  useEffect(() => {
    refreshMeta()
    refreshShift()
  }, [refreshMeta, refreshShift])

  const value = useMemo(
    () => ({ staff, isManager: staff.role === 'manager', meta, shift, refreshShift, refreshMeta, logout: onLogout }),
    [staff, meta, shift, refreshShift, refreshMeta, onLogout],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const s = useContext(SessionContext)
  if (!s) throw new Error('useSession outside SessionProvider')
  return s
}

// ---------- Toasts ----------

interface Toast {
  id: number
  message: string
  /** The open dialog's live region it is shown in, or null for the page's own */
  host: Element | null
}

/** The live region of the topmost open modal dialog, if any (everything outside a modal is inert). */
function dialogHost(): Element | null {
  const modals = Array.from(document.querySelectorAll('dialog[open]')).filter((d) => d.matches(':modal'))
  return modals.at(-1)?.querySelector('[data-toast-host]') ?? null
}

const ToastContext = createContext<(message: string) => void>(() => {})

/**
 * Short confirmations ("บันทึกการขาย SV… แล้ว"), announced politely to screen readers. While a modal
 * dialog is open the rest of the page is inert (not announced, not on top), so a toast raised then (the
 * receipt after a sale) goes into that dialog's own live region; otherwise into the page's. Both regions
 * exist before any message arrives, so screen readers announce the change.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const notify = useCallback((message: string) => {
    const id = Date.now() + Math.random()
    // Let dialogs opening or closing in the same update settle first, then speak where focus now is
    setTimeout(() => {
      setToasts((t) => [...t, { id, message, host: dialogHost() }])
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
    }, 80)
  }, [])

  const toast = (t: Toast) => (
    <p key={t.id} className="toast">
      {t.message}
    </p>
  )
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.filter((t) => !t.host).map(toast)}
      </div>
      {toasts.filter((t) => t.host?.isConnected).map((t) => createPortal(toast(t), t.host!, String(t.id)))}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
