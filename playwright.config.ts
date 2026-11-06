import { defineConfig, devices } from '@playwright/test'

// Runs against the production build (`npm run build` first) using the locally installed Chrome.
// PW_PORT / PW_DIST let a second run use its own preview of its own build, e.g.
//   npx vite build --outDir .dist-b && … && PW_PORT=4184 PW_DIST=.dist-b npx playwright test
const port = Number(process.env.PW_PORT ?? 4174)
const dist = process.env.PW_DIST ?? 'dist'
const baseURL = `http://localhost:${port}/`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Full-page screenshots of the long pages at phone pixel density are memory-hungry; more workers
  // than this ran a worker out of memory on a 16 GB machine with other apps open.
  workers: 2,
  reporter: [['list']],
  timeout: 45_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
    locale: 'th-TH',
    // Screens settle in their final state (no reveals mid-fade under axe or in screenshots); the
    // showroom motion has its own test that turns motion back on.
    reducedMotion: 'reduce',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1366, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: 'chrome' } },
  ],
  webServer: {
    command: `npx vite preview --port ${port} --strictPort --outDir ${dist}`,
    url: baseURL,
    // The admin tests ring up real sales: give them their own freshly seeded database. The public forms'
    // rate limit is lifted, since every test posts from the same address.
    env: { POS_DB: port === 4174 ? '.pos-data/e2e.json' : `.pos-data/e2e-${port}.json`, POS_FRESH: '1', POS_RATE_LIMIT: '100000' },
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
