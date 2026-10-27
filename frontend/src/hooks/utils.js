import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

export function useDebounce(value, ms = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

export function useMediaQuery(query) {
  const subscribe = useCallback(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}

export function useClickOutside(ref, handler) {
  useEffect(() => {
    const fn = (e) => ref.current && !ref.current.contains(e.target) && handler(e)
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [ref, handler])
}

export function useOnlineStatus() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb)
      window.addEventListener('offline', cb)
      return () => {
        window.removeEventListener('online', cb)
        window.removeEventListener('offline', cb)
      }
    },
    () => navigator.onLine,
    () => true,
  )
}

/** Generic persisted state with cross-tab sync. Falls back to memory when storage is blocked. */
export function useLocalStorage(key, initial) {
  const read = () => {
    try {
      const raw = localStorage.getItem(key)
      return raw != null ? JSON.parse(raw) : initial
    } catch {
      return initial
    }
  }
  const [value, setValue] = useState(read)
  useEffect(() => {
    const fn = (e) => e.key === key && setValue(read())
    window.addEventListener('storage', fn)
    return () => window.removeEventListener('storage', fn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const set = useCallback(
    (next) => {
      setValue((prev) => {
        const v = typeof next === 'function' ? next(prev) : next
        try {
          localStorage.setItem(key, JSON.stringify(v))
        } catch {
          /* quota or blocked: keep in memory */
        }
        return v
      })
    },
    [key],
  )
  return [value, set]
}

/** Tick every `ms` while `active` (for timers). */
export function useTick(active, ms = 1000) {
  const [, setN] = useState(0)
  const ref = useRef()
  useEffect(() => {
    if (!active) return
    ref.current = setInterval(() => setN((n) => n + 1), ms)
    return () => clearInterval(ref.current)
  }, [active, ms])
}
