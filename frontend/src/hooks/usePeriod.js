import { useCallback, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { isValidISO, labelFor, rangeFor, shiftAnchor, todayISO } from '../utils/date'

export const LOG_VIEWS = ['day', 'week', 'month', 'board', 'table']
const DEFAULT_UNIT = { day: 'day', week: 'week', month: 'month', board: 'week', table: 'month' }

/** view + anchor + range, all synced to the URL (/log/:view?d=YYYY-MM-DD&u=unit). */
export function usePeriod() {
  const { view: viewParam } = useParams()
  const view = LOG_VIEWS.includes(viewParam) ? viewParam : 'day'
  const [sp, setSp] = useSearchParams()
  const navigate = useNavigate()
  const ws = useStore((s) => s.settings.weekStartsOn)

  const anchor = isValidISO(sp.get('d')) ? sp.get('d') : todayISO()
  const rawUnit = sp.get('u')
  const unit = ['day', 'week', 'month'].includes(rawUnit) ? rawUnit : DEFAULT_UNIT[view]

  const range = useMemo(() => rangeFor(unit, anchor, ws), [unit, anchor, ws])
  const label = useMemo(() => labelFor(unit, anchor, ws), [unit, anchor, ws])

  const update = useCallback(
    (patch) => {
      const next = new URLSearchParams(sp)
      Object.entries(patch).forEach(([k, v]) => (v == null ? next.delete(k) : next.set(k, v)))
      setSp(next, { replace: true })
    },
    [sp, setSp],
  )

  return {
    view, unit, anchor, range, label,
    isToday: range.start <= todayISO() && todayISO() <= range.end,
    next: () => update({ d: shiftAnchor(unit, anchor, 1) }),
    prev: () => update({ d: shiftAnchor(unit, anchor, -1) }),
    today: () => update({ d: null }),
    setAnchor: (d) => update({ d }),
    setUnit: (u) => update({ u }),
    setView: (v) => navigate({ pathname: `/log/${v}`, search: sp.toString() ? `?d=${anchor}` : '' }),
    openDay: (d) => navigate(`/log/day?d=${d}`),
  }
}
