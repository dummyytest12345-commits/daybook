import { diffDays } from '../utils/date'
import { dayTypeOf } from './common'

/**
 * Threads: one piece of work that spans several days. Each day it is worked on has its own row
 * (so day views, hours and reports stay per-day), and all rows share a threadId.
 * Everything here is pure: functions take tasks and return new arrays.
 */
export const threadIdOf = (t) => t.threadId || t.id

const byDate = (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)

/** Map threadId -> live rows sorted by date. Single-day tasks are one-row threads. */
export function buildThreadIndex(tasks) {
  const map = new Map()
  for (const t of tasks) {
    if (t.deletedAt) continue
    const id = threadIdOf(t)
    if (!map.has(id)) map.set(id, [])
    map.get(id).push(t)
  }
  for (const rows of map.values()) rows.sort(byDate)
  return map
}

/** Position of a row inside its thread. `inThread` is true once the work spans more than one row. */
export function threadInfo(task, index) {
  const rows = index.get(threadIdOf(task)) || [task]
  const i = Math.max(0, rows.findIndex((r) => r.id === task.id))
  const first = rows[0]
  const last = rows.at(-1)
  return {
    rows,
    inThread: rows.length > 1,
    position: i + 1,
    total: rows.length,
    isHead: i === 0,
    isTail: i === rows.length - 1,
    prev: rows[i - 1] || null,
    next: rows[i + 1] || null,
    firstDate: first.date,
    lastDate: last.date,
    spanDays: diffDays(last.date, first.date),
    done: last.status === 'completed',
  }
}

/** A copy of `source` for another date, in the same thread, keeping the project reference (KEY-n). */
export function makeForwardRow(source, date, tasks, now, { auto = true } = {}) {
  const order = tasks.filter((t) => t.date === date && !t.deletedAt).length
  return {
    ...source,
    id: `${source.id}~${date}`,
    threadId: threadIdOf(source),
    date,
    carriedFrom: source.date,
    autoCarried: auto,
    status: source.status === 'completed' ? 'pending' : source.status,
    // the work continues from where it stopped, so progress carries over
    progress: source.status === 'completed' ? 0 : source.progress,
    hours: undefined,
    timerStartedAt: null,
    timerElapsedMs: undefined,
    completedAt: undefined,
    resolvedBy: undefined,
    carryDismissed: undefined,
    updates: undefined,
    order,
    updatedAt: now,
    deletedAt: null,
  }
}

/**
 * Which unfinished tasks should be carried to `today`. Idempotent: the new row id is derived from
 * the source id and the date, so running twice (or in two tabs) never duplicates.
 * Returns { rows, stamps } where stamps lists source ids that need a threadId.
 */
export function planAutoCarry(tasks, today, { dayLogs = {}, settings = {} } = {}, now = new Date().toISOString()) {
  if (settings.autoCarry === false) return { rows: [], stamps: [] }
  if (dayTypeOf(today, dayLogs, settings) !== 'work') return { rows: [], stamps: [] }
  const max = settings.carryMaxDays ?? 21
  const have = new Set(tasks.map((t) => t.id))
  const rows = []
  const stamps = []
  for (const list of buildThreadIndex(tasks).values()) {
    const tail = list.at(-1)
    if (tail.date >= today) continue
    if (tail.status === 'completed' || tail.carryDismissed || tail.recurringId) continue
    if (diffDays(today, tail.date) > max) continue
    if (have.has(`${tail.id}~${today}`)) continue
    rows.push(makeForwardRow(tail, today, [...tasks, ...rows], now))
    if (!tail.threadId) stamps.push(tail.id)
  }
  return { rows, stamps }
}

/**
 * Keep a thread consistent after statuses changed. `tasks` already has the new statuses.
 *  - A row becomes completed: earlier unfinished rows are resolved (completed) when mode is 'all';
 *    later unfinished rows are removed, because the work was already finished.
 *  - A row stops being completed: rows it had resolved go back to their previous open state.
 * Returns { tasks, resolved, removed, reopened } (ids), without mutating the input.
 */
export function applyCompletionRules(tasks, changedIds, mode = 'all', now = new Date().toISOString()) {
  const index = buildThreadIndex(tasks)
  const patch = new Map()
  const resolved = []
  const removed = []
  const reopened = []

  for (const id of changedIds) {
    const t = tasks.find((x) => x.id === id)
    if (!t || t.deletedAt) continue
    if (t.status === 'completed') {
      for (const r of index.get(threadIdOf(t)) || []) {
        if (r.id === t.id || r.status === 'completed') continue
        if (r.date <= t.date) {
          if (mode === 'all') {
            patch.set(r.id, { status: 'completed', progress: 100, completedAt: now, resolvedBy: t.id, updatedAt: now })
            resolved.push(r.id)
          }
        } else {
          patch.set(r.id, { deletedAt: now, updatedAt: now })
          removed.push(r.id)
        }
      }
    } else {
      if (t.resolvedBy) patch.set(t.id, { ...(patch.get(t.id) || {}), resolvedBy: undefined })
      for (const r of tasks) {
        if (r.resolvedBy === t.id && !r.deletedAt) {
          patch.set(r.id, { status: 'pending', progress: 0, completedAt: undefined, resolvedBy: undefined, updatedAt: now })
          reopened.push(r.id)
        }
      }
    }
  }
  if (!patch.size) return { tasks, resolved, removed, reopened }
  return { tasks: tasks.map((t) => (patch.has(t.id) ? { ...t, ...patch.get(t.id) } : t)), resolved, removed, reopened }
}

/**
 * Make sure there is a row for `dateISO` in the thread of `rowId` (creating one from the nearest
 * earlier row) so it can be completed "on the day it was really finished".
 * Returns { tasks, targetId } or null when the date is outside the thread's range.
 */
export function ensureRowOnDate(tasks, rowId, dateISO, today, now = new Date().toISOString()) {
  const row = tasks.find((t) => t.id === rowId)
  if (!row) return null
  const rows = buildThreadIndex(tasks).get(threadIdOf(row)) || [row]
  if (dateISO < rows[0].date || dateISO > today) return null
  const existing = rows.find((r) => r.date === dateISO)
  if (existing) return { tasks, targetId: existing.id }
  const base = [...rows].reverse().find((r) => r.date < dateISO) || rows[0]
  const created = makeForwardRow(base, dateISO, tasks, now, { auto: false })
  const stamped = tasks.map((t) => (rows.some((r) => r.id === t.id) && !t.threadId ? { ...t, threadId: threadIdOf(row) } : t))
  return { tasks: [...stamped, created], targetId: created.id }
}

/** Unfinished tasks from earlier days that are NOT yet continued on a later day (e.g. auto carry is off). */
export function carryOverCandidates(tasks, date, maxDays = 21) {
  const index = buildThreadIndex(tasks)
  return tasks.filter((t) => {
    if (t.deletedAt || t.date >= date || t.status === 'completed' || t.carryDismissed || t.recurringId) return false
    if (diffDays(date, t.date) > maxDays) return false
    return index.get(threadIdOf(t))?.at(-1)?.id === t.id
  })
}
