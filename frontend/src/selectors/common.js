import { eachDayISO, isWeekend } from '../utils/date'

export const activeTasks = (tasks) => tasks.filter((t) => !t.deletedAt)

export const inRange = (tasks, { start, end }) => tasks.filter((t) => t.date >= start && t.date <= end)

/** Effective day type: explicit log wins, then holiday list, then weekend. */
export function dayTypeOf(date, dayLogs = {}, settings = {}) {
  const explicit = dayLogs[date]?.dayType
  if (explicit) return explicit
  if (settings.holidays?.some((h) => h.date === date)) return 'holiday'
  return isWeekend(date) ? 'weekend' : 'work'
}

export const capacityOf = (date, dayLogs = {}, settings = {}) => {
  const type = dayTypeOf(date, dayLogs, settings)
  if (type !== 'work') return 0
  return dayLogs[date]?.capacityHours ?? settings.dailyCapacity ?? 8
}

/** Working days (capacity days) inside a range. */
export function workingDays(range, dayLogs, settings) {
  return eachDayISO(range.start, range.end).filter((d) => dayTypeOf(d, dayLogs, settings) === 'work')
}

/**
 * Hours per task id according to settings.hoursMode:
 * equal: the day's capacity is split across that day's tasks
 * manual: task.hours
 * timer: elapsed timer time (falls back to task.hours)
 */
export function hoursMap(tasks, dayLogs = {}, settings = {}) {
  const map = new Map()
  const mode = settings.hoursMode || 'equal'
  if (mode === 'equal') {
    const byDay = new Map()
    tasks.forEach((t) => byDay.set(t.date, [...(byDay.get(t.date) || []), t]))
    for (const [date, list] of byDay) {
      const type = dayTypeOf(date, dayLogs, settings)
      const cap = dayLogs[date]?.capacityHours ?? settings.dailyCapacity ?? 8
      // weekend/leave/holiday work still counts hours, split across that day's tasks
      const total = type === 'work' || list.length ? cap : 0
      list.forEach((t) => map.set(t.id, total / list.length))
    }
  } else if (mode === 'timer') {
    tasks.forEach((t) => map.set(t.id, (t.timerElapsedMs ? t.timerElapsedMs / 3600000 : t.hours) || 0))
  } else {
    tasks.forEach((t) => map.set(t.id, t.hours || 0))
  }
  return map
}

export const sum = (arr, fn = (x) => x) => arr.reduce((a, x) => a + fn(x), 0)
export const round2 = (n) => Math.round(n * 100) / 100
