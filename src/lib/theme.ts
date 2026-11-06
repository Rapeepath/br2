import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'servo.theme'

function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

/** Light showroom theme by default, whatever the OS uses; dark only when the visitor picks it, then remembered. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? 'light')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Not persisted; the toggle still applies for this visit.
      }
      return next
    })
  }, [])

  return { theme, toggle }
}
