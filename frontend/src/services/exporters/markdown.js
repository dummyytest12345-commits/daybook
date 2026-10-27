import { addDaysISO, formatDate, todayISO, weekdayName } from '../../utils/date'
import { groupByDate } from '../../selectors/groupBy'
import { fmtHours } from '../../utils/format'
import { hoursMap, sum } from '../../selectors/common'
import { buildDailyRows, rangeText, statusLabel, taskLine } from './dataset'

const ICON = { completed: '✅', in_progress: '🔄', pending: '⏳', blocked: '🚫' }
const PLAIN = { completed: '[x]', in_progress: '[~]', pending: '[ ]', blocked: '[!]' }

/** Markdown (or plain text) report for a range, grouped by day. */
export function toMarkdown(tasks, range, ctx, { plain = false } = {}) {
  const { settings } = ctx
  const rows = buildDailyRows(tasks, range, ctx).filter((r) => r.count > 0)
  const by = groupByDate(tasks)
  const hours = hoursMap(tasks, ctx.dayLogs, settings)
  const lines = [plain ? `WORK LOG  ${rangeText(range, settings.dateFormat)}` : `# Work Log — ${rangeText(range, settings.dateFormat)}`, '']
  for (const r of rows) {
    const h = fmtHours(sum(by[r.date], (t) => hours.get(t.id) || 0))
    lines.push(plain ? `${r.day} ${r.dateText} (${r.count} tasks, ${h}h)` : `## ${r.day}, ${r.dateText} — ${r.count} tasks · ${h}h`)
    by[r.date].forEach((t) => {
      const mark = plain ? PLAIN[t.status] : ICON[t.status]
      lines.push(plain ? `  ${mark} ${taskLine(t, ctx.projectMap)}` : `- ${mark} ${taskLine(t, ctx.projectMap)}`)
    })
    lines.push('')
  }
  if (!rows.length) lines.push('No tasks in this range.')
  const done = tasks.filter((t) => t.status === 'completed').length
  lines.push(plain ? `Total: ${tasks.length} tasks, ${done} completed` : `**Total:** ${tasks.length} tasks · ${done} completed`)
  return lines.join('\n')
}

/** Previous working day before `date` (skips weekends unless data exists). */
export function previousWorkday(date, tasks) {
  let d = addDaysISO(date, -1)
  for (let i = 0; i < 7; i++) {
    const dow = new Date(`${d}T00:00:00`).getDay()
    if ((dow !== 0 && dow !== 6) || tasks.some((t) => t.date === d && !t.deletedAt)) return d
    d = addDaysISO(d, -1)
  }
  return d
}

/** Standup: Yesterday / Today / Blockers. */
export function standup(tasks, ctx, today = todayISO()) {
  const active = tasks.filter((t) => !t.deletedAt)
  const prev = previousWorkday(today, active)
  const yesterday = active.filter((t) => t.date === prev)
  const now = active.filter((t) => t.date === today)
  const blockers = active.filter((t) => t.status === 'blocked')
  const list = (arr, fmt = (t) => `- ${taskLine(t, ctx.projectMap)}`) => (arr.length ? arr.map(fmt).join('\n') : '- —')
  return [
    `**Yesterday** (${weekdayName(prev)} ${formatDate(prev, ctx.settings.dateFormat)})`,
    list(yesterday, (t) => `- ${taskLine(t, ctx.projectMap)} (${statusLabel(ctx.settings, t.status)})`),
    '',
    '**Today**',
    list(now),
    '',
    '**Blockers**',
    blockers.length ? blockers.map((t) => `- ${taskLine(t, ctx.projectMap)}`).join('\n') : '- None',
  ].join('\n')
}
