import { addDays, diffDays, isWeekend } from '../utils/dates.js'

/**
 * Thread rules (one piece of work across several days), ported from the frontend and kept pure:
 * functions take plain task objects and return what to change, so they are easy to test.
 */
export const threadIdOf = (t) => t.threadId || String(t._id ?? t.id)
const idOf = (t) => String(t._id ?? t.id)
const byDate = (a, b) => a.date.localeCompare(b.date) || String(a.createdAt).localeCompare(String(b.createdAt))

export const sortThread = (rows) => rows.filter((r) => !r.deletedAt).sort(byDate)

/** Effective type of a day: explicit day log, then holiday list, then weekend. */
export function dayTypeOf(date, dayLogs = {}, settings = {}) {
  const explicit = dayLogs[date]?.dayType
  if (explicit) return explicit
  if (settings.holidays?.some((h) => h.date === date)) return 'holiday'
  return isWeekend(date) ? 'weekend' : 'work'
}

/**
 * After `changed` (a row that is now completed or no longer completed): which other rows of the
 * thread change. Returns { patches: Map(id -> patch), resolved, removed, reopened } (ids).
 *  - completed: earlier unfinished rows are completed (mode 'all'), later unfinished rows are removed
 *  - reopened:  rows this one had resolved go back to pending
 */
export function completionPatches(threadRows, changed, mode = 'all', now = new Date()) {
  const patches = new Map()
  const resolved = []
  const removed = []
  const reopened = []
  const rows = sortThread(threadRows)
  if (changed.status === 'completed') {
    for (const r of rows) {
      if (idOf(r) === idOf(changed) || r.status === 'completed') continue
      if (r.date <= changed.date) {
        if (mode === 'all') {
          patches.set(idOf(r), { status: 'completed', progress: 100, completedAt: now, resolvedBy: idOf(changed) })
          resolved.push(idOf(r))
        }
      } else {
        patches.set(idOf(r), { deletedAt: now })
        removed.push(idOf(r))
      }
    }
  } else {
    for (const r of rows) {
      if (r.resolvedBy === idOf(changed)) {
        patches.set(idOf(r), { status: 'pending', progress: 0, completedAt: null, resolvedBy: null })
        reopened.push(idOf(r))
      }
    }
  }
  return { patches, resolved, removed, reopened }
}

/** A copy of `source` for another date inside the same thread (id is deterministic, so retries are safe). */
export function forwardRow(source, date, order, { auto = true } = {}) {
  const s = typeof source.toObject === 'function' ? source.toObject() : source
  const completed = s.status === 'completed'
  return {
    _id: `${idOf(s)}~${date}`,
    userId: s.userId,
    date,
    title: s.title,
    notes: s.notes,
    status: completed ? 'pending' : s.status,
    progress: completed ? 0 : s.progress ?? 0, // continues from where it stopped
    estimateHours: s.estimateHours,
    ticketNo: s.ticketNo,
    projectId: s.projectId,
    number: s.number,
    dueDate: s.dueDate,
    module: s.module,
    tags: s.tags,
    priority: s.priority,
    subtasks: s.subtasks,
    order,
    carriedFrom: s.date,
    threadId: threadIdOf(s),
    autoCarried: auto,
  }
}

/**
 * Unfinished threads that should get a row on `today`. `tasks` = all live rows of the user.
 * Skips completed, dismissed, recurring, too-old threads and non-working days. Idempotent by id.
 */
export function planAutoCarry(tasks, today, { dayLogs = {}, settings = {} } = {}) {
  if (settings.autoCarry === false) return []
  if (dayTypeOf(today, dayLogs, settings) !== 'work') return []
  const max = settings.carryMaxDays ?? 21
  const have = new Set(tasks.map(idOf))
  const threads = new Map()
  for (const t of tasks) {
    if (t.deletedAt) continue
    const k = threadIdOf(t)
    if (!threads.has(k)) threads.set(k, [])
    threads.get(k).push(t)
  }
  const todayCount = tasks.filter((t) => t.date === today && !t.deletedAt).length
  const out = []
  for (const rows of threads.values()) {
    const tail = sortThread(rows).at(-1)
    if (!tail || tail.date >= today) continue
    if (tail.status === 'completed' || tail.carryDismissed || tail.recurringId) continue
    if (diffDays(today, tail.date) > max) continue
    if (have.has(`${idOf(tail)}~${today}`)) continue
    out.push({ source: tail, row: forwardRow(tail, today, todayCount + out.length), stamp: !tail.threadId })
  }
  return out
}

export { addDays }
