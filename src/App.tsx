import type { ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { modelIds } from './data'
import { EN_PREFIX, LangProvider, type Lang } from './i18n'
import { CompareProvider } from './lib/compare'
import { NOT_FOUND, PAGES } from './routes'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {PAGES.map((p) =>
          p.path === '' ? <Route key="index" index element={p.element} /> : <Route key={p.path} path={p.path} element={p.element} />,
        )}
        <Route path={NOT_FOUND.path} element={NOT_FOUND.element} />
      </Route>
    </Routes>
  )
}

/** Everything around the routes that the browser, the prerender and the tests share. */
export function AppProviders({ lang, children }: { lang: Lang; children: ReactNode }) {
  return (
    <LangProvider lang={lang}>
      <CompareProvider validIds={modelIds}>{children}</CompareProvider>
    </LangProvider>
  )
}

// Real URLs ("/models/unitree-g1"), with English as the same tree under the basename "/en"; the language
// comes from the URL the page loaded with. Old "#/…" links are rewritten in index.html before this runs.
// No transitions: the filters live in the URL, and a transition-wrapped update lets React revert a
// clicked radio (or a typed character) for a frame before the new URL commits. Nothing here suspends.
export default function App({ lang }: { lang: Lang }) {
  return (
    <BrowserRouter basename={lang === 'en' ? EN_PREFIX : undefined} useTransitions={false}>
      <AppProviders lang={lang}>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  )
}
