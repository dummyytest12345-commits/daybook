import { useStore } from '../store/useStore'
import { pendingCount, updateMeta } from './meta'
import { isSuppressed } from './suppress'

/**
 * Notices every change to tasks, projects, day logs and settings (add, edit, delete, undo, import...)
 * by diffing object references after each store update, and records it as "waiting to sync".
 * Changes that came FROM the server (or another tab) are applied inside `untracked()` and are not recorded.
 */
export { isSuppressed, untracked } from './suppress'

const byKey = (list, k) => new Map(list.map((x) => [x[k], x]))

let started = false
let listeners = new Set()
export const onPendingChange = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Everything that exists right now counts as unsynced (used the first time sync is turned on). */
export function markEverything(userId) {
  const s = useStore.getState()
  const now = new Date().toISOString()
  return updateMeta(userId, (m) => {
    s.tasks.forEach((t) => (m.dirty.tasks[t.id] = now))
    s.projects.forEach((p) => (m.dirty.projects[p.id] = now))
    Object.keys(s.dayLogs).forEach((d) => (m.dirty.dayLogs[d] = now))
    m.dirty.settings = now
    m.initialized = true
    return m
  })
}

export function startTracking() {
  if (started) return
  started = true
  const snap = (s) => ({ userId: s.userId, tasks: s.tasks, projects: s.projects, dayLogs: s.dayLogs, settings: s.settings, recurring: s.recurring, views: s.views })
  const s0 = useStore.getState()
  let prev = s0.ready && s0.userId ? snap(s0) : null // baseline, so the very first edit is noticed
  useStore.subscribe((s) => {
    if (!s.ready || !s.userId) {
      prev = null
      return
    }
    const cur = snap(s)
    const before = prev
    prev = cur
    if (!before || before.userId !== cur.userId || isSuppressed()) return
    const now = new Date().toISOString()
    let changed = false
    const meta = updateMeta(cur.userId, (m) => {
      if (cur.tasks !== before.tasks) {
        const old = byKey(before.tasks, 'id')
        const next = byKey(cur.tasks, 'id')
        for (const [id, t] of next) if (old.get(id) !== t) { m.dirty.tasks[id] = now; changed = true }
        for (const id of old.keys()) if (!next.has(id)) { m.removed.tasks.push(id); m.dirty.tasks[id] = now; changed = true } // hard removal -> tombstone
      }
      if (cur.projects !== before.projects) {
        const old = byKey(before.projects, 'id')
        const next = byKey(cur.projects, 'id')
        for (const [id, p] of next) if (old.get(id) !== p) { m.dirty.projects[id] = now; changed = true }
        for (const id of old.keys()) if (!next.has(id)) { m.removed.projects.push(id); m.dirty.projects[id] = now; changed = true }
      }
      if (cur.dayLogs !== before.dayLogs) {
        for (const [d, l] of Object.entries(cur.dayLogs)) if (before.dayLogs[d] !== l) { m.dirty.dayLogs[d] = now; changed = true }
      }
      if (cur.settings !== before.settings || cur.recurring !== before.recurring || cur.views !== before.views) {
        m.dirty.settings = now
        changed = true
      }
      return changed ? m : null
    })
    if (changed) listeners.forEach((fn) => fn(pendingCount(meta)))
  })
}
