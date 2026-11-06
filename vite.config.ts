import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { posApi } from './server/vite-plugin.ts'

// Real URLs ("/models/unitree-g1", "/en/compare") need absolute asset paths, so base is the site root.
// Two pages: the brochure (index.html, every route prerendered after the build by scripts/prerender.mjs)
// and the showroom's back office (admin/index.html → /admin), whose simulated POS API is mounted into the
// dev and preview servers by posApi().
// Ports 5174/4174 (the Maew site uses 5173/4173), so both sites can run side by side.
export default defineConfig({
  base: '/',
  plugins: [react(), posApi()],
  server: { port: 5174, strictPort: true, watch: { ignored: ['**/.pos-data/**', '**/dist-ssr/**'] } },
  build: {
    rollupOptions: {
      input: { main: 'index.html', admin: 'admin/index.html' },
    },
  },
})
