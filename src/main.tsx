import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/ibm-plex-sans-thai/400.css'
import '@fontsource/ibm-plex-sans-thai/500.css'
import '@fontsource/ibm-plex-sans-thai/600.css'
import '@fontsource/ibm-plex-sans-thai/700.css'
import '@fontsource/ibm-plex-sans-condensed/500.css'
import '@fontsource/ibm-plex-sans-condensed/600.css'
import './styles/tokens.css'
import './styles/base.css'
import App from './App'
import { langOfPath } from './i18n'

// Pages arrive prerendered (scripts/prerender.mjs) for search engines and link previews; the app then
// renders afresh over that markup rather than hydrating it, since stored preferences (theme, compare list,
// motion) legitimately differ from the build-time render.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App lang={langOfPath(window.location.pathname)} />
  </StrictMode>,
)
