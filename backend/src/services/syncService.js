import { DayLog } from '../models/DayLog.js'
import { Project } from '../models/Project.js'
import { Settings } from '../models/Settings.js'
import { Task } from '../models/Task.js'
import { isValidISO } from '../utils/dates.js'
import { settings as settingsSchemas } from '../validators/schemas.js'

/**
 * Two-way sync for the web app's offline-first storage.
 *  - The client sends only what it changed since the last sync (tasks, projects, day logs, settings).
 *  - Per item the newest edit wins (last-write-wins by the editing device's `updatedAt`); a stale edit is
 *    ignored and the server's newer version comes back in `changes`.
 *  - Deletions are soft (`deletedAt`) so they propagate to other devices.
 *  - Items are applied independently: one bad item is reported in `rejected`, it never fails the whole push.
 *  - Re-sending the same push is harmless (idempotent).
 */
const MAX_SKEW_MS = 5 * 60 * 1000
const SETTINGS_KEYS = Object.keys(settingsSchemas.put.shape)

const toDate = (v) => {
  const d = v ? new Date(v) : null
  return d && !Number.isNaN(d.getTime()) ? d : null
}
/** A device clock running ahead must not win every future conflict, so cap it at "now + 5 min". */
const editTime = (v, now) => {
  const d = toDate(v)
  if (!d) return now
  return d.getTime() > now.getTime() + MAX_SKEW_MS ? now : d
}
/** When the stored copy was last edited. Falls back to the server time for documents that predate this field. */
const lww = (doc) => (doc.clientUpdatedAt ?? doc.updatedAt)?.getTime?.() ?? 0
const withTimes = (obj) => ({ ...obj, updatedAt: new Date() })

function taskDoc(raw, userId) {
  const r = raw
  return {
    _id: String(r.id), userId, date: r.date, title: r.title, notes: r.notes, status: r.status, progress: r.progress ?? (r.status === 'completed' ? 100 : 0),
    hours: r.hours, estimateHours: r.estimateHours, ticketNo: r.ticketNo, projectId: r.projectId || null, number: r.number, dueDate: r.dueDate,
    module: r.module, tags: r.tags, priority: r.priority, order: r.order ?? 0,
    subtasks: (r.subtasks || []).map((s) => ({ _id: String(s.id || s._id), title: s.title, done: !!s.done })),
    timerStartedAt: toDate(r.timerStartedAt), timerElapsedMs: r.timerElapsedMs, recurringId: r.recurringId, completedAt: toDate(r.completedAt),
    carriedFrom: r.carriedFrom, threadId: r.threadId, autoCarried: r.autoCarried, carryDismissed: r.carryDismissed, resolvedBy: r.resolvedBy,
    updates: (r.updates || []).map((u) => ({ _id: String(u.id || u._id), at: toDate(u.at) || new Date(), text: u.text })),
    deletedAt: toDate(r.deletedAt),
  }
}
const projectDoc = (r, userId) => ({
  _id: String(r.id), userId, name: r.name, key: String(r.key || '').toUpperCase(), description: r.description, color: r.color, icon: r.icon, status: r.status,
  favorite: !!r.favorite, startDate: r.startDate, targetDate: r.targetDate, wipLimits: r.wipLimits || {}, nextNumber: r.nextNumber || 1,
  archivedAt: toDate(r.archivedAt), deletedAt: toDate(r.deletedAt),
})
const dayLogDoc = (r, userId) => ({ userId, date: r.date, dayType: r.dayType, capacityHours: r.capacityHours ?? 8, note: r.note, mood: r.mood })

/** Optional fields: if the device's copy no longer has them (e.g. a due date was cleared) they are removed on the server too. */
const OPTIONAL = {
  task: ['notes', 'hours', 'estimateHours', 'ticketNo', 'number', 'dueDate', 'module', 'priority', 'timerStartedAt', 'timerElapsedMs', 'recurringId', 'completedAt', 'carriedFrom', 'threadId', 'autoCarried', 'carryDismissed', 'resolvedBy'],
  project: ['description', 'startDate', 'targetDate'],
  dayLog: ['dayType', 'note', 'mood'],
}

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

/** Validate with the Mongoose model (types, enums, limits). Returns { error } or { doc } as a plain object. */
function validated(Model, doc) {
  const m = new Model(clean(doc))
  const err = m.validateSync()
  if (err) return { error: Object.values(err.errors).map((e) => e.message).join('; ') }
  const o = m.toObject({ depopulate: true })
  delete o.__v
  return { doc: o }
}

async function applyItems({ Model, kind, items, build, key, userId, now, out }) {
  if (!items.length) return new Set()
  const ids = items.map((i) => key(i))
  const existing = new Map((await Model.find(kind === 'dayLog' ? { userId, date: { $in: ids } } : { _id: { $in: ids } }, `_id userId date updatedAt clientUpdatedAt`).lean()).map((d) => [kind === 'dayLog' ? d.date : String(d._id), d]))
  const ops = []
  const accepted = new Set()
  for (const raw of items) {
    const id = key(raw)
    if (!id) { out.rejected.push({ kind, id: null, reason: 'missing id' }); continue }
    const ex = existing.get(id)
    if (ex && ex.userId !== userId) { out.rejected.push({ kind, id, reason: 'id belongs to another account' }); continue }
    const at = editTime(raw.updatedAt, now)
    if (ex && lww(ex) > at.getTime()) { out.stale[kind].push(id); continue } // the server copy is newer
    if (raw.deleted === true) {
      // tombstone from a device that hard-removed the item: soft-delete the existing copy, never create one
      if (ex) ops.push({ updateOne: { filter: kind === 'dayLog' ? { userId, date: id } : { _id: id, userId }, update: { $set: { deletedAt: now, clientUpdatedAt: at, updatedAt: now } } } })
      accepted.add(id)
      continue
    }
    const { doc, error } = validated(Model, build(raw, userId))
    if (error) { out.rejected.push({ kind, id, reason: error }); continue }
    const { _id, userId: _u, createdAt: _c, updatedAt: _up, ...fields } = doc
    if (fields.wipLimits instanceof Map) fields.wipLimits = Object.fromEntries(fields.wipLimits) // native writes need plain objects
    const createdAt = toDate(raw.createdAt) || now
    const filter = kind === 'dayLog' ? { userId, date: id } : { _id: id, userId }
    const unset = Object.fromEntries(OPTIONAL[kind].filter((f) => !(f in fields) || fields[f] === null).map((f) => [f, '']))
    for (const f of Object.keys(unset)) delete fields[f]
    ops.push({ updateOne: { filter, update: { $set: { ...fields, clientUpdatedAt: at, updatedAt: now }, ...(Object.keys(unset).length && { $unset: unset }), $setOnInsert: { ...(kind === 'dayLog' ? { userId } : { _id: id, userId }), createdAt } }, upsert: true } })
    accepted.add(id)
  }
  if (ops.length) {
    // native bulkWrite: keeps the client's createdAt/updatedAt exactly (Mongoose timestamps would overwrite them)
    try {
      await Model.collection.bulkWrite(ops, { ordered: false })
    } catch (err) {
      // a duplicate key means the id exists under another account (race): report it, keep the rest
      for (const e of err.writeErrors || []) {
        const id = ids[e.index] ?? null
        accepted.delete(id)
        out.rejected.push({ kind, id, reason: e.code === 11000 ? 'duplicate (id or project key already used)' : e.errmsg || 'write failed' })
      }
      if (!err.writeErrors) throw err
    }
  }
  out.applied[kind] = accepted.size
  return accepted
}

const wire = (doc) => {
  const j = doc.toJSON()
  j.updatedAt = new Date(lww(doc))
  delete j.clientUpdatedAt
  return j
}

/**
 * body: { since?: ISO (server time of the previous sync), tasks, projects, dayLogs, settings? }
 * returns: { serverTime, applied, stale, rejected, changes: { tasks, projects, dayLogs, settings } }
 */
export async function push(userId, body) {
  const now = new Date()
  const since = toDate(body.since)
  const out = { applied: { tasks: 0, projects: 0, dayLogs: 0, settings: false }, stale: { task: [], project: [], dayLog: [] }, rejected: [] }

  // projects first so tasks that reference them are consistent
  const projects = await applyItems({ Model: Project, kind: 'project', items: body.projects || [], build: projectDoc, key: (i) => (i.id ? String(i.id) : ''), userId, now, out })
  const tasks = await applyItems({ Model: Task, kind: 'task', items: body.tasks || [], build: taskDoc, key: (i) => (i.id ? String(i.id) : ''), userId, now, out })
  const dayLogs = await applyItems({ Model: DayLog, kind: 'dayLog', items: (body.dayLogs || []).filter((d) => isValidISO(d.date)), build: dayLogDoc, key: (i) => i.date, userId, now, out })
  out.applied.projects = projects.size
  out.applied.tasks = tasks.size
  out.applied.dayLogs = dayLogs.size

  if (body.settings && typeof body.settings === 'object') {
    const incoming = Object.fromEntries(Object.entries(body.settings).filter(([k]) => SETTINGS_KEYS.includes(k)))
    const parsed = settingsSchemas.put.safeParse(incoming)
    if (!parsed.success) out.rejected.push({ kind: 'settings', id: 'settings', reason: parsed.error.issues.map((i) => i.message).join('; ') })
    else {
      const at = editTime(body.settingsUpdatedAt, now)
      const ex = await Settings.findById(userId).lean()
      if (ex && lww(ex) > at.getTime()) out.stale.settings = true
      else {
        await Settings.collection.updateOne({ _id: userId }, { $set: { ...parsed.data, clientUpdatedAt: at, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true })
        out.applied.settings = true
      }
    }
  }

  // What changed on the server since the client's last sync (from other devices), excluding what was just applied.
  // The newer server copies of everything rejected as stale are returned too, whatever their age.
  const since_ = since ? { updatedAt: { $gt: since } } : {}
  const live = since ? {} : { deletedAt: null }
  const [ct, cp, cd, cs, st, sp, sd] = await Promise.all([
    Task.find({ userId, ...since_, ...live, _id: { $nin: [...tasks] } }),
    Project.find({ userId, ...since_, ...live, _id: { $nin: [...projects] } }),
    DayLog.find({ userId, ...since_, date: { $nin: [...dayLogs] } }),
    out.applied.settings ? null : Settings.findOne({ _id: userId, ...(out.stale.settings === true ? {} : since_) }),
    out.stale.task.length ? Task.find({ userId, _id: { $in: out.stale.task } }) : [],
    out.stale.project.length ? Project.find({ userId, _id: { $in: out.stale.project } }) : [],
    out.stale.dayLog.length ? DayLog.find({ userId, date: { $in: out.stale.dayLog } }) : [],
  ])
  const merge = (a, b, key) => [...new Map([...a, ...b].map((d) => [key(d), d])).values()]
  const settingsJson = cs ? { ...cs.toJSON(), updatedAt: new Date(lww(cs)) } : null
  if (settingsJson) delete settingsJson.clientUpdatedAt
  return {
    serverTime: now.toISOString(),
    applied: out.applied,
    stale: { tasks: out.stale.task, projects: out.stale.project, dayLogs: out.stale.dayLog, settings: out.stale.settings === true },
    rejected: out.rejected,
    changes: {
      tasks: merge(ct, st, (d) => String(d._id)).map(wire),
      projects: merge(cp, sp, (d) => String(d._id)).map(wire),
      dayLogs: merge(cd, sd, (d) => d.date).map((d) => ({ ...d.toJSON(), updatedAt: new Date(lww(d)) })),
      settings: settingsJson,
    },
  }
}

/** Live counts, so a client can verify the server holds everything before it clears its local copy. */
export async function summary(userId) {
  const [tasks, projects, dayLogs] = await Promise.all([
    Task.countDocuments({ userId, deletedAt: null }), Project.countDocuments({ userId, deletedAt: null }), DayLog.countDocuments({ userId }),
  ])
  const ids = (await Task.find({ userId, deletedAt: null }, '_id').lean()).map((t) => String(t._id))
  return { serverTime: new Date().toISOString(), tasks, projects, dayLogs, taskIds: ids }
}
