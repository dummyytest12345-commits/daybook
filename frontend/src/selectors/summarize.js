import { addDaysISO, diffDays, eachDayISO, todayISO } from '../utils/date'
import { progressOf } from './progress'
import { capacityOf, dayTypeOf, hoursMap, round2, sum, workingDays } from './common'

/**
 * Core KPI numbers for a set of tasks that are already restricted to `range`.
 * ctx = { dayLogs, settings, allTasks } (allTasks powers streak/carry-over lookups).
 */
export function summarize(tasks, range, ctx = {}) {
  const { dayLogs = {}, settings = {} } = ctx
  const count = (s) => tasks.filter((t) => t.status === s).length
  const total = tasks.length
  const completed = count('completed')
  const hoursByTask = hoursMap(tasks, dayLogs, settings)
  const hours = round2(sum(tasks, (t) => hoursByTask.get(t.id) || 0))
  const days = eachDayISO(range.start, range.end)
  const capacity = sum(days, (d) => capacityOf(d, dayLogs, settings))
  const wdays = workingDays(range, dayLogs, settings)
  const activeDays = new Set(tasks.map((t) => t.date))
  const weekendWorkDays = [...activeDays].filter((d) => dayTypeOf(d, dayLogs, settings) !== 'work')

  const withEstimate = tasks.filter((t) => t.status === 'completed' && t.estimateHours && t.hours != null)
  const onTime = withEstimate.filter((t) => t.hours <= t.estimateHours).length
  const cycles = tasks
    .filter((t) => t.completedAt)
    .map((t) => (Date.parse(t.completedAt) - Date.parse(t.createdAt)) / 86400000)
    .filter((x) => x >= 0)
  const carried = tasks.filter((t) => t.carriedFrom).length

  return {
    total,
    completed,
    inProgress: count('in_progress'),
    pending: count('pending'),
    blocked: count('blocked'),
    completionRate: total ? completed / total : 0,
    hours,
    capacity,
    utilisation: capacity ? hours / capacity : 0,
    workingDays: wdays.length,
    activeDays: activeDays.size,
    avgTasksPerDay: wdays.length ? round2(total / wdays.length) : 0,
    velocity: wdays.length ? round2(completed / wdays.length) : 0,
    blockedRatio: total ? count('blocked') / total : 0,
    carryOver: carried,
    carryOverRate: total ? carried / total : 0,
    onTimeRate: withEstimate.length ? onTime / withEstimate.length : null,
    cycleTimeDays: cycles.length ? round2(sum(cycles) / cycles.length) : null,
    weekendWorkDays,
    avgProgress: total ? round2(sum(tasks, progressOf) / total) : 0,
    avgOpenProgress: tasks.length - completed ? round2(sum(tasks.filter((t) => t.status !== 'completed'), progressOf) / (tasks.length - completed)) : 0,
    streak: streak(ctx.allTasks || tasks, dayLogs, settings),
  }
}

/**
 * A row counts as the user's activity on its day unless it was only carried forward automatically
 * (no note, no hours, not completed that day). Streaks must not grow by themselves.
 */
const isActivity = (t) =>
  !t.deletedAt && (!t.autoCarried || !!t.updates?.length || t.hours != null || t.completedAt?.slice(0, 10) === t.date)

/**
 * Current streak: consecutive working days (skipping weekends/leave/holidays)
 * with at least one task logged, ending today (or yesterday if today is empty).
 */
export function streak(allTasks, dayLogs = {}, settings = {}, today = todayISO()) {
  const days = new Set(allTasks.filter(isActivity).map((t) => t.date))
  let d = today
  let n = 0
  let guard = 0
  if (!days.has(d) && dayTypeOf(d, dayLogs, settings) === 'work') d = addDaysISO(d, -1)
  while (guard++ < 800) {
    const type = dayTypeOf(d, dayLogs, settings)
    if (days.has(d)) n++
    else if (type === 'work') break
    d = addDaysISO(d, -1)
  }
  return n
}

/** Longest gap-free run of working days with tasks (best streak) within all data. */
export function bestStreak(allTasks, dayLogs = {}, settings = {}) {
  const days = [...new Set(allTasks.filter(isActivity).map((t) => t.date))].sort()
  if (!days.length) return 0
  let best = 0
  let cur = 0
  for (const d of eachDayISO(days[0], days.at(-1))) {
    if (days.includes(d)) best = Math.max(best, ++cur)
    else if (dayTypeOf(d, dayLogs, settings) === 'work') cur = 0
  }
  return best
}

export { carryOverCandidates } from './threads'
