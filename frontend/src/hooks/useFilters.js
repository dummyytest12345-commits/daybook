import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EMPTY_FILTERS, hasFilters } from '../selectors/filter'
import { useStore } from '../store/useStore'
import { newId } from '../utils/id'

const LIST_KEYS = ['status', 'module', 'tag', 'priority', 'dayType', 'project']

/** Filters live in the URL so a filtered view is a shareable link. Also exposes saved views. */
export function useFilters() {
  const [sp, setSp] = useSearchParams()
  const views = useStore((s) => s.views)
  const saveViews = useStore((s) => s.saveViews)

  const filters = useMemo(() => {
    const f = { ...EMPTY_FILTERS, q: sp.get('q') || '' }
    LIST_KEYS.forEach((k) => (f[k] = sp.get(k) ? sp.get(k).split(',') : []))
    return f
  }, [sp])

  const setFilters = useCallback(
    (patch) => {
      const next = new URLSearchParams(sp)
      Object.entries(patch).forEach(([k, v]) => {
        const val = Array.isArray(v) ? v.join(',') : v
        if (!val) next.delete(k)
        else next.set(k, val)
      })
      setSp(next, { replace: true })
    },
    [sp, setSp],
  )
  const clear = useCallback(() => {
    const next = new URLSearchParams(sp)
    ;['q', ...LIST_KEYS].forEach((k) => next.delete(k))
    setSp(next, { replace: true })
  }, [sp, setSp])

  return {
    filters, setFilters, clear, active: hasFilters(filters),
    views,
    saveView: (name) => saveViews([...views, { id: newId(), name, filters }]),
    deleteView: (id) => saveViews(views.filter((v) => v.id !== id)),
    applyView: (v) => {
      const next = new URLSearchParams(sp)
      ;['q', ...LIST_KEYS].forEach((k) => next.delete(k))
      Object.entries(v.filters).forEach(([k, val]) => {
        const s = Array.isArray(val) ? val.join(',') : val
        if (s) next.set(k, s)
      })
      setSp(next, { replace: true })
    },
  }
}
