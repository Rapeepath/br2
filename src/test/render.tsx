import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AppProviders, AppRoutes } from '../App'
import { EN_PREFIX, langOfPath } from '../i18n'

/** Renders the whole app (layout included) at a route, as the browser would after a deep link. */
export function renderAt(path: string) {
  const lang = langOfPath(path.split('?')[0])
  return render(
    <MemoryRouter initialEntries={[path]} basename={lang === 'en' ? EN_PREFIX : undefined}>
      <AppProviders lang={lang}>
        <AppRoutes />
      </AppProviders>
    </MemoryRouter>,
  )
}
