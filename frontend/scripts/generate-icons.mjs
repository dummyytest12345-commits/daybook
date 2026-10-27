// Renders the PNG icons and social image from the SVG sources. Run: node scripts/generate-icons.mjs
import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

const svg = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const jobs = [
  ['../public/favicon.svg', '../public/icons/icon-192.png', 192, 192],
  ['../public/favicon.svg', '../public/icons/icon-512.png', 512, 512],
  ['../public/favicon.svg', '../public/icons/apple-touch-icon.png', 180, 180],
  ['../public/favicon.svg', '../public/icons/favicon-32.png', 32, 32],
  ['./icons/maskable.svg', '../public/icons/icon-maskable-512.png', 512, 512],
  ['./icons/og.svg', '../public/og-image.png', 1200, 630],
]
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [src, out, w, h] of jobs) {
  await page.setViewportSize({ width: w, height: h })
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${w}px;height:${h}px}</style>${svg(src)}`)
  await page.screenshot({ path: new URL(out, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), omitBackground: true })
  console.log('wrote', out)
}
await browser.close()
