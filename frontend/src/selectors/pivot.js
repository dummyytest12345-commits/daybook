import { format, startOfMonth, startOfWeek } from 'date-fns'
import { fromISO } from '../utils/date'
import { hoursMap, round2 } from './common'

const rowKey = {
  project: (t, ctx) => ctx?.projectMap?.get(t.projectId)?.name || 'No project',
  module: (t) => t.module || 'Unassigned',
  status: (t) => t.status,
  priority: (t) => t.priority || 'none',
  ticket: (t) => t.ticketNo || '—',
}

function colKey(t, col, ws) {
  const d = fromISO(t.date)
  if (col === 'week') return format(startOfWeek(d, { weekStartsOn: ws }), 'yyyy-MM-dd')
  if (col === 'month') return format(startOfMonth(d), 'yyyy-MM')
  if (col === 'weekday') return format(d, 'EEE')
  return t.status
}

/**
 * Pivot: rows (module|status|priority) x cols (week|month|weekday|status), value count|hours.
 */
export function pivot(tasks, { rows = 'module', cols = 'week', value = 'count' } = {}, ctx = {}) {
  const ws = ctx.settings?.weekStartsOn ?? 1
  const hours = hoursMap(tasks, ctx.dayLogs, ctx.settings)
  const cells = new Map()
  const colSet = new Set()
  const rowSet = new Set()
  for (const t of tasks) {
    const r = (rowKey[rows] || rowKey.module)(t, ctx)
    const c = colKey(t, cols, ws)
    rowSet.add(r)
    colSet.add(c)
    const k = `${r}\u0000${c}`
    cells.set(k, (cells.get(k) || 0) + (value === 'hours' ? hours.get(t.id) || 0 : 1))
  }
  const order = cols === 'weekday' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : null
  const columns = order ? order.filter((c) => colSet.has(c)) : [...colSet].sort()
  const rowList = [...rowSet].sort()
  const data = rowList.map((r) => {
    const values = columns.map((c) => round2(cells.get(`${r}\u0000${c}`) || 0))
    return { row: r, values, total: round2(values.reduce((a, b) => a + b, 0)) }
  })
  const colTotals = columns.map((_, i) => round2(data.reduce((a, r) => a + r.values[i], 0)))
  return { columns, rows: data, colTotals, grandTotal: round2(colTotals.reduce((a, b) => a + b, 0)) }
}
