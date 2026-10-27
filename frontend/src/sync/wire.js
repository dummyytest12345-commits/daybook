/**
 * Conversion between the app's local records and the server's sync format.
 * Local -> server: `updatedAt` is the later of the record's own updatedAt and the moment the change was noticed,
 *                  so edits that forgot to bump updatedAt (e.g. a delete) still win the last-write-wins comparison.
 * Server -> local: nulls become "missing" because the local schemas use optional fields, not null.
 */
const later = (a, b) => (a && b ? (a > b ? a : b) : a || b)
const NULL_OK = new Set(['deletedAt', 'timerStartedAt', 'archivedAt'])

const dropNulls = (o) => Object.fromEntries(Object.entries(o).filter(([k, v]) => v !== null || NULL_OK.has(k)))

export const taskToWire = (t, dirtyAt) => ({ ...t, updatedAt: later(t.updatedAt, dirtyAt) })
export const projectToWire = (p, dirtyAt) => ({ ...p, updatedAt: later(p.updatedAt, dirtyAt) })
export const dayLogToWire = (l, dirtyAt) => ({ ...l, updatedAt: later(l.updatedAt, dirtyAt) })
/** A hard-removed item has no body: just its id and a delete marker. */
export const tombstone = (id, dirtyAt) => ({ id, deleted: true, updatedAt: dirtyAt })

export function taskFromWire(t) {
  const o = dropNulls(t)
  o.deletedAt = t.deletedAt ?? null
  if (typeof o.updatedAt !== 'string') o.updatedAt = new Date(o.updatedAt).toISOString()
  return o
}
export const projectFromWire = (p) => {
  const o = dropNulls(p)
  o.deletedAt = p.deletedAt ?? null
  o.archivedAt = p.archivedAt ?? null
  return o
}
export const dayLogFromWire = (l) => {
  const { createdAt, ...rest } = dropNulls(l)
  return { ...rest, updatedAt: l.updatedAt ? new Date(l.updatedAt).toISOString() : undefined }
}

/** Server settings document -> { settings (device keys kept by the caller), recurring, views }. */
export function settingsFromWire(s) {
  if (!s) return null
  const { recurring = [], views = [], createdAt, updatedAt, ...settings } = dropNulls(s)
  return { settings, recurring, views, updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null }
}

/** Local settings + recurring + views as one document (device-only keys are stripped by the server). */
export const settingsToWire = (settings, recurring, views) => ({ ...settings, recurring, views })
