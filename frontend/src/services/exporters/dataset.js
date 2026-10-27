import { eachDayISO, formatDate, weekdayName } from '../../utils/date'
import { dayTypeOf, hoursMap, round2, sum } from '../../selectors/common'
import { groupByDate } from '../../selectors/groupBy'
import { fmtHours } from '../../utils/format'
import { projectOf, taskRef } from '../../selectors/projects'

export const statusLabel = (settings, id) => settings.statuses?.find((s) => s.id === id)?.label || id

/** Overall status of a day from its tasks. */
export function dayStatus(list) {
  if (!list.length) return ''
  if (list.every((t) => t.status === 'completed')) return 'completed'
  if (list.some((t) => t.status === 'blocked')) return 'blocked'
  if (list.some((t) => t.status === 'in_progress')) return 'in_progress'
  return 'pending'
}

/** One-line task text. With a project map the KEY-number reference replaces the free-form ticket. */
export const taskLine = (t, map) => {
  const ref = map ? taskRef(t, map) : t.ticketNo || ''
  return `${ref ? `${ref} ` : ''}${t.module ? `(${t.module}) ` : ''}${t.title}`.trim()
}

/**
 * Daily layout matching the original sheet:
 * Sr No, Date, Day, Tasks (one per line), No. of Tasks, Hours, Status.
 * Includes every day in range so weekends/leave show up greyed.
 */
export function buildDailyRows(tasks, range, ctx) {
  const { dayLogs, settings } = ctx
  const byDate = groupByDate(tasks)
  const hours = hoursMap(tasks, dayLogs, settings)
  let sr = 0
  return eachDayISO(range.start, range.end)
    .map((date) => {
      const list = byDate[date] || []
      const type = dayTypeOf(date, dayLogs, settings)
      const h = round2(sum(list, (t) => hours.get(t.id) || 0))
      return {
        sr: list.length || type !== 'work' ? ++sr : '',
        date,
        dateText: formatDate(date, settings.dateFormat),
        day: weekdayName(date, 'EEEE'),
        dayType: type,
        tasks: list.map((t) => taskLine(t, ctx.projectMap)),
        tasksText: list.map((t, i) => `${i + 1}. ${taskLine(t, ctx.projectMap)}`).join('\n'),
        count: list.length,
        hours: h,
        status: dayStatus(list),
        statusText: list.length ? statusLabel(settings, dayStatus(list)) : type === 'work' ? '' : type[0].toUpperCase() + type.slice(1),
      }
    })
    .filter(Boolean)
}

export const DAILY_COLUMNS = [
  { key: 'sr', header: 'Sr No', width: 7 },
  { key: 'dateText', header: 'Date', width: 13 },
  { key: 'day', header: 'Day', width: 12 },
  { key: 'tasksText', header: 'Tasks', width: 60 },
  { key: 'count', header: 'No. of Tasks', width: 12 },
  { key: 'hours', header: 'Hours', width: 9 },
  { key: 'statusText', header: 'Status', width: 14 },
]

export const TASK_COLUMNS = [
  { key: 'dateText', header: 'Date' },
  { key: 'day', header: 'Day' },
  { key: 'ref', header: 'ID' },
  { key: 'projectName', header: 'Project' },
  { key: 'title', header: 'Task' },
  { key: 'module', header: 'Module' },
  { key: 'statusText', header: 'Status' },
  { key: 'priority', header: 'Priority' },
  { key: 'hours', header: 'Hours' },
  { key: 'estimateHours', header: 'Estimate' },
  { key: 'dueText', header: 'Due' },
  { key: 'tagsText', header: 'Tags' },
  { key: 'notes', header: 'Notes' },
]

/** One row per task (flat), sorted by date then order. */
export function buildTaskRows(tasks, ctx) {
  const { dayLogs, settings } = ctx
  const hours = hoursMap(tasks, dayLogs, settings)
  return [...tasks]
    .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
    .map((t) => ({
      ...t,
      dateText: formatDate(t.date, settings.dateFormat),
      day: weekdayName(t.date, 'EEEE'),
      statusText: statusLabel(settings, t.status),
      hours: round2(hours.get(t.id) || 0),
      tagsText: (t.tags || []).join(', '),
      ref: taskRef(t, ctx.projectMap || new Map()),
      projectName: projectOf(t, ctx.projectMap || new Map())?.name || '',
      dueText: t.dueDate ? formatDate(t.dueDate, settings.dateFormat) : '',
    }))
}

export const rangeText = (range, fmt) =>
  range.start === range.end ? formatDate(range.start, fmt) : `${formatDate(range.start, fmt)} – ${formatDate(range.end, fmt)}`

export const fileStem = (range) => `daybook_${range.start}_${range.end}`

export { fmtHours }
