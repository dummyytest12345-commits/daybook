import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const SITE = 'Daybook'
const SITE_URL = (import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '')

function setMeta(selector, attr, value) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement(selector.startsWith('link') ? 'link' : 'meta')
    const m = /\[(\w+(?::\w+)?)="([^"]+)"\]/.exec(selector)
    el.setAttribute(m[1], m[2])
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
}

/**
 * Per-route SEO: document title, description, canonical, Open Graph and robots.
 * Signed-in app screens are `noindex` (private data); login/register pages are indexable.
 */
export function useSeo({ title, description, index = false, jsonLd, fullTitle }) {
  const { pathname } = useLocation()
  useEffect(() => {
    const full = fullTitle || (title ? `${title} · ${SITE}` : `${SITE} – Daily work diary, task log and report generator`)
    document.title = full
    if (description) {
      setMeta('meta[name="description"]', 'content', description)
      setMeta('meta[property="og:description"]', 'content', description)
      setMeta('meta[name="twitter:description"]', 'content', description)
    }
    setMeta('meta[property="og:title"]', 'content', full)
    setMeta('meta[name="twitter:title"]', 'content', full)
    setMeta('meta[name="robots"]', 'content', index ? 'index, follow, max-image-preview:large' : 'noindex, nofollow')
    if (SITE_URL) {
      const url = `${SITE_URL}${pathname === '/' ? '/' : pathname}`
      setMeta('link[rel="canonical"]', 'href', url)
      setMeta('meta[property="og:url"]', 'content', url)
    }
    // structured data for this page (removed again on navigation)
    const scripts = (jsonLd || []).map((obj) => {
      const el = document.createElement('script')
      el.type = 'application/ld+json'
      el.dataset.seo = 'page'
      el.textContent = JSON.stringify(obj)
      document.head.appendChild(el)
      return el
    })
    return () => scripts.forEach((el) => el.remove())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, fullTitle, description, index, pathname, JSON.stringify(jsonLd || [])])
}
