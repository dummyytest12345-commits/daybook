import { DayLog } from '../models/DayLog.js'
import { Project } from '../models/Project.js'
import { Settings, createDefaultSettings } from '../models/Settings.js'
import { Task } from '../models/Task.js'
import { newId } from '../models/_plugin.js'
import { summary } from '../services/analyticsService.js'
import * as syncService from '../services/syncService.js'
import { emitChanges, emitToUser } from '../services/realtime.js'
import { isValidISO } from '../utils/dates.js'
import { badRequest } from '../utils/httpError.js'

const origin = (req) => req.get('x-socket-id') || undefined

// ---------- day logs ----------
export async function listDayLogs(req, res) {
  const { from, to } = req.valid.query
  const filter = { userId: req.userId }
  if (from || to) filter.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) }
  res.json({ dayLogs: (await DayLog.find(filter).sort({ date: 1 })).map((d) => d.toJSON()) })
}

export async function putDayLog(req, res) {
  const { date } = req.params
  if (!isValidISO(date)) throw badRequest('Invalid date')
  const set = { ...req.body }
  const unset = {}
  if ('dayType' in set && set.dayType === null) {
    delete set.dayType
    unset.dayType = 1
  }
  const log = await DayLog.findOneAndUpdate({ userId: req.userId, date }, { $set: set, ...(Object.keys(unset).length && { $unset: unset }), $setOnInsert: { userId: req.userId, date } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true })
  emitChanges(req.userId, origin(req), { dayLogsUpserted: [log.toJSON()] })
  res.json({ dayLog: log.toJSON() })
}

export async function deleteDayLog(req, res) {
  await DayLog.deleteOne({ userId: req.userId, date: req.params.date })
  emitChanges(req.userId, origin(req), { dayLogsRemoved: [req.params.date] })
  res.status(204).end()
}

// ---------- settings ----------
export async function getSettings(req, res) {
  const s = (await Settings.findById(req.userId)) || (await createDefaultSettings(req.userId))
  res.json({ settings: s.toJSON() })
}

export async function putSettings(req, res) {
  const s = await Settings.findByIdAndUpdate(req.userId, { $set: req.body }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true })
  emitToUser(req.userId, 'settings', s.toJSON(), origin(req))
  res.json({ settings: s.toJSON() })
}

// ---------- analytics ----------
export async function analytics(req, res) {
  res.json(await summary(req.userId, req.valid.query))
}

// ---------- sync / backup ----------
/** Everything the user owns (including deleted rows when `since` is used so other devices can remove them). */
export async function syncPull(req, res) {
  const since = req.query.since ? new Date(String(req.query.since)) : null
  if (since && Number.isNaN(since.getTime())) throw badRequest('Invalid since')
  const f = { userId: req.userId, ...(since && { updatedAt: { $gt: since } }) }
  const [tasks, projects, dayLogs, settings] = await Promise.all([
    Task.find(since ? f : { ...f, deletedAt: null }),
    Project.find(since ? f : { ...f, deletedAt: null }),
    DayLog.find(f),
    Settings.findById(req.userId),
  ])
  res.json({
    serverTime: new Date().toISOString(),
    tasks: tasks.map((t) => t.toJSON()), projects: projects.map((p) => p.toJSON()), dayLogs: dayLogs.map((d) => d.toJSON()), settings: settings?.toJSON() || null,
  })
}

/** Two-way delta sync (see services/syncService.js). Other devices of the user are told to sync too. */
export async function syncPush(req, res) {
  const result = await syncService.push(req.userId, req.body)
  const wrote = result.applied.tasks + result.applied.projects + result.applied.dayLogs + (result.applied.settings ? 1 : 0)
  if (wrote) emitToUser(req.userId, 'resync', { reason: 'sync' }, origin(req))
  res.json(result)
}
export async function syncSummary(req, res) {
  res.json(await syncService.summary(req.userId))
}

export async function exportAll(req, res) {
  const [tasks, projects, dayLogs, settings] = await Promise.all([
    Task.find({ userId: req.userId, deletedAt: null }), Project.find({ userId: req.userId, deletedAt: null }), DayLog.find({ userId: req.userId }), Settings.findById(req.userId),
  ])
  res.set('Content-Disposition', 'attachment; filename="daybook-backup.json"')
  res.json({ app: 'daybook', exportedAt: new Date().toISOString(), tasks: tasks.map((t) => t.toJSON()), projects: projects.map((p) => p.toJSON()), dayLogs: dayLogs.map((d) => d.toJSON()), settings: settings?.toJSON() || {} })
}

/**
 * Import a backup (also the way to upload the browser's local data once).
 * mode 'replace' wipes the user's data first; 'merge' upserts by id and keeps everything else.
 */
export async function importAll(req, res) {
  const { mode, tasks, projects, dayLogs, settings } = req.body
  const userId = req.userId
  if (mode === 'replace') await Promise.all([Task.deleteMany({ userId }), Project.deleteMany({ userId }), DayLog.deleteMany({ userId })])
  const skipped = []
  // ids are client generated; if another account already uses one (e.g. importing someone else's backup) give it a new id
  const idMap = new Map()
  for (const [model, rows] of [[Project, projects], [Task, tasks]]) {
    const ids = rows.map((r) => String(r.id || r._id || '')).filter(Boolean)
    const taken = new Set((await model.find({ _id: { $in: ids }, userId: { $ne: userId } }, '_id').lean()).map((d) => String(d._id)))
    ids.forEach((i) => taken.has(i) && idMap.set(i, newId()))
  }
  const remap = (v) => (v && idMap.has(String(v)) ? idMap.get(String(v)) : v)
  const ops = (rows, model, kind, valid) => {
    const list = []
    rows.forEach((r0, i) => {
      const r = { ...r0, projectId: remap(r0.projectId), threadId: remap(r0.threadId), resolvedBy: remap(r0.resolvedBy) }
      const id = String(remap(r.id || r._id) || newId())
      const { id: _a, _id: _b, userId: _c, ...rest } = r
      const err = valid(rest)
      if (err) return skipped.push({ kind, index: i, reason: err })
      list.push({ updateOne: { filter: { _id: id, userId }, update: { $set: { ...rest, userId }, $setOnInsert: { _id: id } }, upsert: true } })
    })
    return list.length ? model.bulkWrite(list, { ordered: false }) : null
  }
  await ops(projects, Project, 'project', (r) => (!r.name || !/^[A-Z][A-Z0-9]{1,5}$/.test(String(r.key || '').toUpperCase()) ? 'name/key invalid' : null))
  await ops(tasks, Task, 'task', (r) => (!r.title || !isValidISO(r.date) ? 'title/date invalid' : null))
  for (const d of dayLogs) {
    if (!isValidISO(d.date)) continue
    await DayLog.updateOne({ userId, date: d.date }, { $set: { dayType: d.dayType, capacityHours: d.capacityHours, note: d.note, mood: d.mood } }, { upsert: true })
  }
  if (settings && typeof settings === 'object') {
    const { schemaVersion: _v, theme: _t, ...clean } = settings
    await Settings.updateOne({ _id: userId }, { $set: clean }, { upsert: true })
  }
  emitToUser(userId, 'resync', { reason: 'import' }, origin(req))
  res.json({ imported: { tasks: tasks.length, projects: projects.length, dayLogs: dayLogs.length }, skipped })
}
