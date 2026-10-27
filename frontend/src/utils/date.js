import {
  addDays, addMonths, differenceInCalendarDays, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isValid, parse, startOfMonth, startOfWeek, subDays,
} from 'date-fns'

export const ISO = 'yyyy-MM-dd'

/** 'YYYY-MM-DD' -> local Date (no UTC shift). */
export const fromISO = (s) => parse(s, ISO, new Date())
export const toISO = (d) => format(d, ISO)
export const todayISO = () => toISO(new Date())
export const isValidISO = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && isValid(fromISO(s))
export const addDaysISO = (s, n) => toISO(addDays(fromISO(s), n))
export const diffDays = (a, b) => differenceInCalendarDays(fromISO(a), fromISO(b))
export const isWeekend = (s) => [0, 6].includes(fromISO(s).getDay())
export const weekdayName = (s, fmt = 'EEE') => format(fromISO(s), fmt)

export const eachDayISO = (start, end) =>
  start > end ? [] : eachDayOfInterval({ start: fromISO(start), end: fromISO(end) }).map(toISO)

/** Range for a view anchored on a date. */
export function rangeFor(view, anchor, weekStartsOn = 1) {
  const d = fromISO(anchor)
  if (view === 'month') return { start: toISO(startOfMonth(d)), end: toISO(endOfMonth(d)) }
  if (view === 'week') {
    return { start: toISO(startOfWeek(d, { weekStartsOn })), end: toISO(endOfWeek(d, { weekStartsOn })) }
  }
  return { start: anchor, end: anchor }
}

export function shiftAnchor(view, anchor, dir) {
  const d = fromISO(anchor)
  if (view === 'month') return toISO(addMonths(d, dir))
  if (view === 'week') return toISO(addDays(d, 7 * dir))
  return toISO(addDays(d, dir))
}

export function labelFor(view, anchor, weekStartsOn = 1) {
  const d = fromISO(anchor)
  if (view === 'month') return format(d, 'MMMM yyyy')
  if (view === 'week') {
    const { start, end } = rangeFor('week', anchor, weekStartsOn)
    return `${format(fromISO(start), 'd MMM')} – ${format(fromISO(end), 'd MMM yyyy')}`
  }
  return format(d, 'EEEE, d MMM yyyy')
}

/** Previous period of equal length (for comparison). */
export function previousRange({ start, end }) {
  const len = diffDays(end, start) + 1
  return { start: addDaysISO(start, -len), end: addDaysISO(start, -1) }
}

export const PRESETS = [
  ['today', 'Today'], ['thisWeek', 'This week'], ['lastWeek', 'Last week'],
  ['thisMonth', 'This month'], ['lastMonth', 'Last month'], ['last30', 'Last 30 days'], ['custom', 'Custom'],
]

export function presetRange(id, weekStartsOn = 1, now = new Date()) {
  const t = toISO(now)
  switch (id) {
    case 'today': return { start: t, end: t }
    case 'thisWeek': return rangeFor('week', t, weekStartsOn)
    case 'lastWeek': return rangeFor('week', toISO(subDays(now, 7)), weekStartsOn)
    case 'thisMonth': return rangeFor('month', t)
    case 'lastMonth': return rangeFor('month', toISO(addMonths(now, -1)))
    case 'last30': return { start: toISO(subDays(now, 29)), end: t }
    default: return null
  }
}

const FORMATS = { 'dd/MM/yyyy': 'dd/MM/yyyy', 'yyyy-MM-dd': 'yyyy-MM-dd', 'MM/dd/yyyy': 'MM/dd/yyyy' }
export const formatDate = (s, fmt = 'dd/MM/yyyy') => format(fromISO(s), FORMATS[fmt] || fmt)

/** Parse text / Excel serial / Date to ISO using the configured format. Returns null on failure. */
export function parseFlexibleDate(value, fmt = 'dd/MM/yyyy') {
  if (value == null || value === '') return null
  if (value instanceof Date) return isValid(value) ? toISO(value) : null
  if (typeof value === 'number') {
    const ms = Math.round((value - 25569) * 86400 * 1000)
    const d = new Date(ms)
    return isValid(d) ? d.toISOString().slice(0, 10) : null
  }
  const s = String(value).trim()
  if (/^\d{5}$/.test(s)) return parseFlexibleDate(Number(s), fmt)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return isValidISO(s.slice(0, 10)) ? s.slice(0, 10) : null
  const norm = s.replace(/[.\-]/g, '/')
  const fmts = [fmt.replace(/-/g, '/'), 'd/M/yyyy', 'dd/MM/yy'].map((f) => f.replace(/-/g, '/'))
  for (const f of fmts) {
    const d = parse(norm, f, new Date())
    if (isValid(d)) return toISO(d)
  }
  return null
}
