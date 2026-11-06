import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// The POS server's tests run in node, without a DOM; everything here is for the jsdom app tests.
if (typeof window !== 'undefined') {
  afterEach(() => {
    cleanup()
    localStorage.clear()
    window.location.hash = ''
  })

  // jsdom lacks these browser APIs that the app calls.
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList
  }
  window.scrollTo = (() => {}) as typeof window.scrollTo
  Element.prototype.scrollIntoView = function () {}
}
