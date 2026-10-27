import { create } from 'zustand'

/**
 * Device-wide colour theme: 'light' | 'dark' | 'system'. It is not tied to an account, so the
 * landing page, sign-in and the app all agree, and it is applied before first paint (see index.html).
 */
export const THEME_KEY = 'daybook:theme'

const read = () => {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  } catch {
    return 'system'
  }
}
const systemDark = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
export const resolveTheme = (pref) => (pref === 'system' ? (systemDark() ? 'dark' : 'light') : pref)

export function applyTheme(pref) {
  const resolved = resolveTheme(pref)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.dataset.theme = resolved
  root.style.colorScheme = resolved
  const meta = document.querySelector('meta[name="theme-color"]:not([media])')
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0b1120' : '#4f46e5')
  return resolved
}

export const useTheme = create((set, get) => ({
  pref: read(),
  resolved: resolveTheme(read()),
  setPref(pref) {
    try {
      localStorage.setItem(THEME_KEY, pref)
    } catch {
      /* storage blocked: the choice lasts for this visit */
    }
    set({ pref, resolved: applyTheme(pref) })
  },
  /** Flip between light and dark (leaves "system" behind, because the user made an explicit choice). */
  toggle() {
    get().setPref(get().resolved === 'dark' ? 'light' : 'dark')
  },
  /** Apply the stored theme and follow the OS while the preference is "system". Call once at startup. */
  init() {
    set({ resolved: applyTheme(get().pref) })
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const onChange = () => get().pref === 'system' && set({ resolved: applyTheme('system') })
    mq?.addEventListener?.('change', onChange)
    window.addEventListener('storage', (e) => {
      if (e.key === THEME_KEY) set({ pref: read(), resolved: applyTheme(read()) })
    })
  },
}))
