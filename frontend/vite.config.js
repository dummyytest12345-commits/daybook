import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

const PUBLIC_PATHS = ['/', '/login', '/register']
const PRIVATE_PATHS = ['/log/', '/analytics', '/reports', '/data', '/settings']

/** Emits sitemap.xml and robots.txt with absolute URLs from VITE_SITE_URL. Only public pages are listed. */
function seoFiles(siteUrl) {
  const base = siteUrl.replace(/\/$/, '')
  return {
    name: 'seo-files',
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10)
      const urls = PUBLIC_PATHS.map(
        (p) => `  <url><loc>${base}${p}</loc><lastmod>${today}</lastmod><priority>${p === '/' ? '1.0' : '0.6'}</priority></url>`,
      ).join('\n')
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n` })
      const robots = ['User-agent: *', 'Allow: /$', 'Allow: /login', 'Allow: /register', ...PRIVATE_PATHS.map((p) => `Disallow: ${p}`), '', `Sitemap: ${base}/sitemap.xml`, ''].join('\n')
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
    },
  }
}

/** Injects environment variables directly into index.html to prevent builder asset-path resolution errors */
function htmlEnvPlugin(env) {
  return {
    name: 'html-env-transform',
    transformIndexHtml(html) {
      const siteUrl = env.VITE_SITE_URL || 'http://localhost:5173'
      // Strip trailing slash if present to avoid dual slash bugs (e.g. http://localhost//og-image.png)
      const cleanUrl = siteUrl.replace(/\/$/, '')
      return html.replace(/%VITE_SITE_URL%/g, cleanUrl)
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const siteUrl = env.VITE_SITE_URL || 'http://localhost:5173'

  return {
    plugins: [
      react(),
      tailwindcss(),
      htmlEnvPlugin(env), // Triggers BEFORE asset path resolution
      seoFiles(siteUrl),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png', 'og-image.png'],
        manifest: {
          id: '/',
          name: 'Daybook',
          short_name: 'WorkLog',
          description: 'Personal work diary that turns daily notes into reports.',
          lang: 'en',
          categories: ['productivity', 'business'],
          theme_color: '#4f46e5',
          background_color: '#f8fafc',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          ],
          shortcuts: [
            { name: 'Add today’s tasks', url: '/', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
            { name: 'Analytics', url: '/analytics', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
            { name: 'Reports', url: '/reports', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          ],
        },
        workbox: { navigateFallbackDenylist: [/^\/sitemap\.xml$/, /^\/robots\.txt$/] },
      }),
    ],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/tests/setup.js'],
      include: ['src/**/*.test.{js,jsx}'],
    },
  }
})
