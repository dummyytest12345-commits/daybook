import { format } from 'date-fns'
import { fromISO, todayISO, diffDays } from '../utils/date'
import { fmtHours, fmtPct, pluralize } from '../utils/format'
import { weekdayPattern } from './groupBy'

/**
 * Rule-based, offline insights. Each insight: { id, tone, text, filter? }
 * where filter is a partial filter object that can be applied to open the list behind it.
 */
export function insights(tasks, summary, comparison, ctx = {}) {
  const out = []
  if (!tasks.length) return [{ id: 'empty', tone: 'neutral', text: 'No tasks in this period yet. Add one to see insights.' }]

  const perDay = {}
  tasks.forEach((t) => (perDay[t.date] = (perDay[t.date] || 0) + 1))
  const [bestDate, bestCount] = Object.entries(perDay).sort((a, b) => b[1] - a[1])[0]
  out.push({
    id: 'best-day', tone: 'good',
    text: `Busiest day: ${format(fromISO(bestDate), 'EEEE, d MMM')} with ${pluralize(bestCount, 'task')}.`,
    filter: { date: bestDate },
  })

  const wp = weekdayPattern(tasks).sort((a, b) => b.avg - a.avg)[0]
  if (wp?.avg) out.push({ id: 'weekday', tone: 'neutral', text: `${wp.day} is your heaviest weekday (${wp.avg} tasks on average).` })

  if (comparison?.completed && comparison.completionRate.previous) {
    const c = comparison.completionRate
    const diff = Math.round((c.current - c.previous) * 100)
    if (diff !== 0) {
      out.push({
        id: 'completion-delta', tone: diff > 0 ? 'good' : 'bad',
        text: `Completion is ${diff > 0 ? 'up' : 'down'} ${Math.abs(diff)} points versus the previous period (${fmtPct(c.current)} vs ${fmtPct(c.previous)}).`,
      })
    }
  }

  const today = ctx.today || todayISO()
  const stale = tasks.filter((t) => t.status === 'in_progress' && diffDays(today, t.date) > 3)
  if (stale.length) {
    out.push({
      id: 'stale', tone: 'bad',
      text: `${pluralize(stale.length, 'task')} ${stale.length === 1 ? 'has' : 'have'} been In Progress for over 3 days.`,
      filter: { status: ['in_progress'] },
    })
  }
  if (summary.blocked) {
    out.push({ id: 'blocked', tone: 'bad', text: `${pluralize(summary.blocked, 'task')} blocked right now.`, filter: { status: ['blocked'] } })
  }
  if (summary.capacity) {
    out.push({
      id: 'util', tone: summary.utilisation >= 0.9 ? 'good' : 'neutral',
      text: `You logged ${fmtHours(summary.hours)} of ${fmtHours(summary.capacity)} hours (${fmtPct(summary.utilisation)} utilisation).`,
    })
  }
  if (summary.weekendWorkDays.length) {
    out.push({
      id: 'weekend', tone: 'bad',
      text: `Non-working-day work detected on ${pluralize(summary.weekendWorkDays.length, 'day')}.`,
      filter: { dayType: ['weekend', 'holiday', 'leave'] },
    })
  }
  if (summary.streak >= 3) out.push({ id: 'streak', tone: 'good', text: `${summary.streak}-day logging streak. Keep it going!` })
  if (summary.completionRate === 1 && summary.total >= 3) out.push({ id: 'all-done', tone: 'good', text: 'Everything in this period is completed. 🎉' })
  return out
}
