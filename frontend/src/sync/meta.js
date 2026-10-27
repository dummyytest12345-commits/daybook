import { nanoid } from 'nanoid'

/**
 * Per-user sync bookkeeping, stored next to the user's data:
 *   deviceId   identifies this browser
 *   cloudUserId which server account these changes belong to (a different account starts fresh)
 *   since      server time of the last successful sync (null = never synced)
 *   initialized everything that existed before sync was turned on has been marked for upload
 *   dirty      what changed since the last sync: { tasks: {id: ISO}, projects: {id: ISO}, dayLogs: {date: ISO}, settings: ISO|null }
 *   removed    ids that were hard-removed locally, to be sent as tombstones
 */
const key = (userId) => `worklog:v1:u:${userId}:syncmeta`
const empty = () => ({ deviceId: nanoid(10), cloudUserId: null, since: null, initialized: false, lastSyncedAt: null, dirty: { tasks: {}, projects: {}, dayLogs: {}, settings: null }, removed: { tasks: [], projects: [] } })

export function loadMeta(userId) {
  try {
    const raw = JSON.parse(localStorage.getItem(key(userId)))
    if (raw && raw.dirty) return { ...empty(), ...raw, dirty: { ...empty().dirty, ...raw.dirty }, removed: { ...empty().removed, ...(raw.removed || {}) } }
  } catch {
    /* corrupt or blocked: start fresh */
  }
  return empty()
}

export function saveMeta(userId, meta) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(meta))
    return true
  } catch {
    return false // storage full: the change stays in memory, tracked again on the next change
  }
}

export const clearMeta = (userId) => {
  try {
    localStorage.removeItem(key(userId))
  } catch {
    /* ignore */
  }
}

/** Read-modify-write so two tabs of the same user never overwrite each other's bookkeeping. */
export function updateMeta(userId, fn) {
  const m = loadMeta(userId)
  const next = fn(m) || m
  saveMeta(userId, next)
  return next
}

export const pendingCount = (m) =>
  Object.keys(m.dirty.tasks).length + Object.keys(m.dirty.projects).length + Object.keys(m.dirty.dayLogs).length + (m.dirty.settings ? 1 : 0)

export const resetForNewAccount = (m, cloudUserId) => ({ ...empty(), deviceId: m.deviceId, cloudUserId })
