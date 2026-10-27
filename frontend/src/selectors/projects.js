import { diffDays, todayISO } from '../utils/date'
import { progressOf } from './progress'
import { hoursMap, round2, sum } from './common'

export const NO_PROJECT = 'none'

export const liveProjects = (projects) => projects.filter((p) => !p.deletedAt)
export const activeProjects = (projects) => liveProjects(projects).filter((p) => !p.archivedAt)
export const projectMap = (projects) => new Map(liveProjects(projects).map((p) => [p.id, p]))

/** The task's project, or null. A task pointing at a deleted/unknown project counts as "no project". */
export const projectOf = (task, map) => (task.projectId ? map.get(task.projectId) || null : null)

/** Display reference: "WEB-12" for project tasks, the free-form ticket otherwise. */
export function taskRef(task, map) {
  const p = projectOf(task, map)
  if (p && task.number) return `${p.key}-${task.number}`
  return task.ticketNo || ''
}

/** Suggest a unique 2-6 char key from a name ("Website Redesign" -> "WR", "Payments" -> "PAY"). */
export function suggestKey(name, taken = []) {
  const words = name.toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(Boolean)
  let base = words.length > 1 ? words.map((w) => w[0]).join('').slice(0, 4) : (words[0] || 'PRJ').slice(0, 3)
  if (base.length < 2) base = (base + (words[0] || 'PRJ') + 'XX').slice(0, 3)
  if (!/^[A-Z]/.test(base)) base = `P${base}`.slice(0, 6)
  let key = base
  let n = 2
  const set = new Set(taken.map((k) => k.toUpperCase()))
  while (set.has(key)) key = `${base.slice(0, 5)}${n++}`
  return key
}

export const isOverdue = (t, today = todayISO()) => !!t.dueDate && t.dueDate < today && t.status !== 'completed'

/** Health numbers for one project's tasks. */
export function projectStats(project, tasks, ctx = {}, today = todayISO()) {
  const total = tasks.length
  const done = tasks.filter((t) => t.status === 'completed').length
  const hm = hoursMap(tasks, ctx.dayLogs, ctx.settings)
  const hours = round2(sum(tasks, (t) => hm.get(t.id) || 0))
  const overdue = tasks.filter((t) => isOverdue(t, today)).length
  const blocked = tasks.filter((t) => t.status === 'blocked').length
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length
  const daysLeft = project?.targetDate ? diffDays(project.targetDate, today) : null
  const dates = tasks.map((t) => t.date).sort()
  const lastActivity = dates.at(-1) || null
  // Simple, explainable health: red if overdue work or past target, amber if blocked or target <= 7 days and <80% done.
  let health = 'good'
  const pct = total ? done / total : 0
  if (overdue > 0 || (daysLeft != null && daysLeft < 0 && pct < 1)) health = 'bad'
  else if (blocked > 0 || (daysLeft != null && daysLeft <= 7 && pct < 0.8 && total > 0)) health = 'warn'
  if (total > 0 && pct === 1) health = 'done'
  const avgProgress = meanProgress(tasks)
  return { avgProgress, total, done, open: total - done, inProgress, blocked, overdue, hours, progress: pct, daysLeft, lastActivity, health }
}

/** Per-project totals for charts: tasks, completed and hours, including a "No project" row. */
/** Mean progress of a set of tasks (completed count as 100). */
export const meanProgress = (tasks) => (tasks.length ? Math.round(tasks.reduce((a, t) => a + progressOf(t), 0) / tasks.length) : 0)

export function projectBreakdown(tasks, projects, ctx = {}) {
  const map = projectMap(projects)
  const hm = hoursMap(tasks, ctx.dayLogs, ctx.settings)
  const out = new Map()
  for (const t of tasks) {
    const p = projectOf(t, map)
    const id = p?.id || NO_PROJECT
    const row = out.get(id) || { id, name: p?.name || 'No project', key: p?.key || '—', color: p?.color || '#94a3b8', count: 0, completed: 0, hours: 0, progressSum: 0 }
    row.count++
    row.progressSum += progressOf(t)
    if (t.status === 'completed') row.completed++
    row.hours += hm.get(t.id) || 0
    out.set(id, row)
  }
  return [...out.values()].map(({ progressSum, ...r }) => ({ ...r, hours: round2(r.hours), avgProgress: r.count ? Math.round(progressSum / r.count) : 0 })).sort((a, b) => b.count - a.count)
}

/** Sort helper for the projects page. */
export function sortProjects(list, by = 'recent', statsById = new Map()) {
  const arr = [...list]
  const fav = (p) => (p.favorite ? 0 : 1)
  if (by === 'name') return arr.sort((a, b) => fav(a) - fav(b) || a.name.localeCompare(b.name))
  if (by === 'progress') return arr.sort((a, b) => fav(a) - fav(b) || (statsById.get(b.id)?.progress || 0) - (statsById.get(a.id)?.progress || 0))
  if (by === 'target') return arr.sort((a, b) => fav(a) - fav(b) || (a.targetDate || '9999').localeCompare(b.targetDate || '9999'))
  return arr.sort((a, b) => fav(a) - fav(b) || b.updatedAt.localeCompare(a.updatedAt))
}
