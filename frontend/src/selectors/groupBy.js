import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import { eachDayISO, fromISO, toISO, weekdayName } from '../utils/date'
import { progressOf } from './progress'
import { capacityOf, hoursMap, round2, sum } from './common'

export function groupByDate(tasks) {
  const out = {}
  for (const t of tasks) (out[t.date] ||= []).push(t)
  for (const d of Object.keys(out)) out[d].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt))
  return out
}

const emptyBucket = () => ({ total: 0, completed: 0, in_progress: 0, pending: 0, blocked: 0, hours: 0, capacity: 0 })

function bucketKey(date, groupBy, weekStartsOn) {
  const d = fromISO(date)
  if (groupBy === 'week') {
    const s = startOfWeek(d, { weekStartsOn })
    return { key: toISO(s), label: `${format(s, 'd MMM')}` }
  }
  if (groupBy === 'month') {
    const s = startOfMonth(d)
    return { key: toISO(s), label: format(s, 'MMM yyyy') }
  }
  return { key: date, label: format(d, 'd MMM') }
}

/**
 * Time series of counts by status, hours and capacity.
 * Returns one bucket per day/week/month across the range (empty buckets included).
 */
export function trend(tasks, range, groupBy = 'day', ctx = {}) {
  const { dayLogs = {}, settings = {} } = ctx
  const ws = settings.weekStartsOn ?? 1
  const hours = hoursMap(tasks, dayLogs, settings)
  const buckets = new Map()
  for (const d of eachDayISO(range.start, range.end)) {
    const { key, label } = bucketKey(d, groupBy, ws)
    if (!buckets.has(key)) buckets.set(key, { key, label, ...emptyBucket() })
    buckets.get(key).capacity += capacityOf(d, dayLogs, settings)
  }
  for (const t of tasks) {
    const b = buckets.get(bucketKey(t.date, groupBy, ws).key)
    if (!b) continue
    b.total++
    b[t.status] = (b[t.status] || 0) + 1
    b.hours += hours.get(t.id) || 0
  }
  return [...buckets.values()].map((b) => ({ ...b, hours: round2(b.hours) }))
}

export function moduleBreakdown(tasks, ctx = {}) {
  const hours = hoursMap(tasks, ctx.dayLogs, ctx.settings)
  const m = new Map()
  for (const t of tasks) {
    const k = t.module || 'Unassigned'
    const cur = m.get(k) || { module: k, count: 0, hours: 0, completed: 0 }
    cur.count++
    cur.hours += hours.get(t.id) || 0
    if (t.status === 'completed') cur.completed++
    m.set(k, cur)
  }
  return [...m.values()].map((x) => ({ ...x, hours: round2(x.hours) })).sort((a, b) => b.count - a.count)
}

export function weekdayPattern(tasks) {
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const counts = Object.fromEntries(names.map((n) => [n, { day: n, count: 0, days: new Set() }]))
  for (const t of tasks) {
    const n = weekdayName(t.date)
    counts[n].count++
    counts[n].days.add(t.date)
  }
  return names.map((n) => ({ day: n, count: counts[n].count, avg: counts[n].days.size ? round2(counts[n].count / counts[n].days.size) : 0 }))
}

/** Cumulative planned (all tasks) vs completed across the range. */
export function burnUp(tasks, range) {
  let planned = 0
  let done = 0
  return eachDayISO(range.start, range.end).map((d) => {
    const dayTasks = tasks.filter((t) => t.date === d)
    planned += dayTasks.length
    done += dayTasks.filter((t) => t.status === 'completed').length
    return { date: d, label: format(fromISO(d), 'd MMM'), planned, completed: done }
  })
}

/** Task aging: how long unfinished tasks have been open (days since their date). */
export function taskAging(tasks, today) {
  const open = tasks.filter((t) => t.status === 'in_progress' || t.status === 'blocked' || t.status === 'pending')
  const bins = [
    { bin: '0-1 d', min: 0, max: 1, count: 0 },
    { bin: '2-3 d', min: 2, max: 3, count: 0 },
    { bin: '4-7 d', min: 4, max: 7, count: 0 },
    { bin: '8-14 d', min: 8, max: 14, count: 0 },
    { bin: '15+ d', min: 15, max: Infinity, count: 0 },
  ]
  const t0 = fromISO(today).getTime()
  for (const t of open) {
    const age = Math.max(0, Math.round((t0 - fromISO(t.date).getTime()) / 86400000))
    const b = bins.find((x) => age >= x.min && age <= x.max)
    if (b) b.count++
  }
  return bins.map(({ bin, count }) => ({ bin, count }))
}

/** Open (unfinished) tasks grouped by how far along they are. */
export function progressDistribution(tasks) {
  const bins = [
    { bin: '0-24%', min: 0, max: 24, count: 0 }, { bin: '25-49%', min: 25, max: 49, count: 0 },
    { bin: '50-74%', min: 50, max: 74, count: 0 }, { bin: '75-99%', min: 75, max: 99, count: 0 },
  ]
  for (const t of tasks) {
    if (t.status === 'completed') continue
    const p = progressOf(t)
    const b = bins.find((x) => p >= x.min && p <= x.max)
    if (b) b.count++
  }
  return bins.map(({ bin, count }) => ({ bin, count }))
}

export const totalHours = (tasks, ctx) => {
  const h = hoursMap(tasks, ctx.dayLogs, ctx.settings)
  return round2(sum(tasks, (t) => h.get(t.id) || 0))
}

export { addDays, endOfMonth, endOfWeek }
