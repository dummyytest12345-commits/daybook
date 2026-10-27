import { Project } from '../models/Project.js'
import { Settings } from '../models/Settings.js'
import { DayLog } from '../models/DayLog.js'
import { Task } from '../models/Task.js'
import { newId } from '../models/_plugin.js'
import { badRequest, notFound } from '../utils/httpError.js'
import { addDays, diffDays, todayISO } from '../utils/dates.js'
import { withProgressRules } from './progress.js'
import { completionPatches, forwardRow, planAutoCarry, sortThread, threadIdOf } from './threads.js'

export const getSettings = async (userId) => (await Settings.findById(userId).lean()) || {}

async function liveProject(userId, projectId) {
  const p = await Project.findOne({ _id: projectId, userId, deletedAt: null })
  if (!p) throw badRequest('Project not found')
  return p
}

/** Next KEY-number for a project, allocated atomically so two devices never get the same one. */
async function nextNumber(userId, projectId) {
  const p = await Project.findOneAndUpdate({ _id: projectId, userId, deletedAt: null }, { $inc: { nextNumber: 1 } }, { returnDocument: 'before' })
  if (!p) throw badRequest('Project not found')
  return p.nextNumber
}

export async function createTask(userId, data) {
  const doc = { ...data, _id: data.id || newId(), userId }
  delete doc.id
  if (data.projectId) {
    await liveProject(userId, data.projectId)
    doc.number = await nextNumber(userId, data.projectId)
  } else doc.projectId = null
  if (!doc.order) doc.order = await Task.countDocuments({ userId, date: doc.date, deletedAt: null })
  if (doc.status === 'completed') {
    doc.progress = 100
    doc.completedAt = new Date()
  } else if (doc.status === 'in_progress' && doc.progress == null) doc.progress = 0
  doc.threadId = doc._id
  const task = await Task.create(doc)
  return task
}

/**
 * Update a task, applying progress rules, project (re)numbering and thread rules.
 * Returns { task, changed: [tasks touched besides this one], removed: [ids] }.
 */
export async function updateTask(userId, id, patch) {
  const task = await Task.findOne({ _id: id, userId, deletedAt: null })
  if (!task) throw notFound('Task')
  const before = { status: task.status }
  const p = withProgressRules(task.toObject(), patch)

  if ('projectId' in p && (p.projectId || null) !== (task.projectId || null)) {
    if (p.projectId) {
      await liveProject(userId, p.projectId)
      task.number = await nextNumber(userId, p.projectId)
    } else task.number = undefined
    task.projectId = p.projectId || null
  }
  delete p.projectId
  if ('dueDate' in p && p.dueDate === null) {
    task.dueDate = undefined
    delete p.dueDate
  }
  task.set(p)
  await task.save()

  const out = { task, changed: [], removed: [] }
  if ((before.status === 'completed') !== (task.status === 'completed')) {
    const settings = await getSettings(userId)
    Object.assign(out, await applyThreadRules(userId, task, settings.threadResolve || 'all'))
  }
  return out
}

/** Apply completion/reopen rules to the other rows of the task's thread. */
export async function applyThreadRules(userId, task, mode) {
  const rows = await Task.find({ userId, threadId: threadIdOf(task) }).lean()
  const { patches, removed } = completionPatches(rows, task.toObject ? task.toObject() : task, mode)
  const changed = []
  for (const [rid, patch] of patches) {
    const t = await Task.findOneAndUpdate({ _id: rid, userId }, { $set: patch }, { returnDocument: 'after' })
    if (t && !patch.deletedAt) changed.push(t)
  }
  return { changed, removed }
}

export async function deleteTasks(userId, ids) {
  const rows = await Task.find({ _id: { $in: ids }, userId, deletedAt: null })
  if (!rows.length) return { removed: [], dismissed: [] }
  await Task.updateMany({ _id: { $in: rows.map((r) => r._id) }, userId }, { $set: { deletedAt: new Date() } })
  // removing a carried copy stops its thread from re-creating it
  const dismissed = []
  for (const r of rows.filter((x) => x.carriedFrom)) {
    const live = sortThread(await Task.find({ userId, threadId: threadIdOf(r), deletedAt: null }).lean())
    const tail = live.at(-1)
    if (tail && tail.status !== 'completed' && tail.date < r.date) {
      await Task.updateOne({ _id: tail._id, userId }, { $set: { carryDismissed: true } })
      dismissed.push(String(tail._id))
    }
  }
  return { removed: rows.map((r) => String(r._id)), dismissed }
}

/** Move tasks into a project (renumbering) or out of any project with null. */
export async function moveToProject(userId, ids, projectId) {
  if (projectId) await liveProject(userId, projectId)
  const rows = await Task.find({ _id: { $in: ids }, userId, deletedAt: null }).sort({ date: 1, createdAt: 1 })
  const out = []
  for (const t of rows) {
    if ((t.projectId || null) === (projectId || null) && (t.number != null || !projectId)) {
      out.push(t)
      continue
    }
    if (projectId) t.number = await nextNumber(userId, projectId)
    else t.number = undefined
    t.projectId = projectId || null
    await t.save()
    out.push(t)
  }
  return out
}

/** Complete a thread on the day the work really finished (creating that day's row if needed). */
export async function finishOn(userId, id, date) {
  const row = await Task.findOne({ _id: id, userId, deletedAt: null })
  if (!row) throw notFound('Task')
  const thread = sortThread(await Task.find({ userId, threadId: threadIdOf(row) }).lean())
  if (!thread.length) throw notFound('Thread')
  if (date < thread[0].date || date > todayISO()) throw badRequest('That date is outside this task’s history')
  let target = thread.find((r) => r.date === date)
  let created = null
  if (!target) {
    const base = [...thread].reverse().find((r) => r.date < date) || thread[0]
    const order = await Task.countDocuments({ userId, date, deletedAt: null })
    created = await Task.findOneAndUpdate({ _id: `${base._id}~${date}`, userId }, { $setOnInsert: forwardRow({ ...base, userId }, date, order, { auto: false }) }, { upsert: true, returnDocument: 'after' })
    target = created
    if (!base.threadId) await Task.updateMany({ userId, _id: { $in: thread.map((r) => r._id) } }, { $set: { threadId: threadIdOf(row) } })
  }
  const done = await Task.findOneAndUpdate({ _id: target._id, userId }, { $set: { status: 'completed', progress: 100, completedAt: new Date() } }, { returnDocument: 'after' })
  const settings = await getSettings(userId)
  const rules = await applyThreadRules(userId, done, settings.threadResolve || 'all')
  return { task: done, created, changed: rules.changed, removed: rules.removed }
}

/** Create today's rows for unfinished threads. Safe to call repeatedly (deterministic ids). */
export async function runCarryForward(userId, date = todayISO()) {
  const [tasks, settings, logs] = await Promise.all([
    Task.find({ userId, deletedAt: null }).lean(),
    getSettings(userId),
    DayLog.find({ userId }).lean(),
  ])
  const dayLogs = Object.fromEntries(logs.map((l) => [l.date, l]))
  const plan = planAutoCarry(tasks, date, { dayLogs, settings })
  const created = []
  for (const { row, source, stamp } of plan) {
    if (stamp) await Task.updateOne({ _id: source._id, userId }, { $set: { threadId: String(source._id) } })
    const t = await Task.findOneAndUpdate({ _id: row._id, userId }, { $setOnInsert: row }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true })
    created.push(t)
  }
  return created
}

/** Continue one task on another day as a manual (not automatic) forward. */
export async function forwardTo(userId, id, to) {
  const row = await Task.findOne({ _id: id, userId, deletedAt: null })
  if (!row) throw notFound('Task')
  if (to <= row.date) throw badRequest('Choose a later date')
  if (diffDays(to, row.date) > 366) throw badRequest('Date is too far away')
  if (!row.threadId) await Task.updateOne({ _id: row._id, userId }, { $set: { threadId: String(row._id) } })
  const order = await Task.countDocuments({ userId, date: to, deletedAt: null })
  return Task.findOneAndUpdate({ _id: `${row._id}~${to}`, userId }, { $setOnInsert: forwardRow({ ...row.toObject(), threadId: threadIdOf(row) }, to, order, { auto: false }) }, { upsert: true, returnDocument: 'after' })
}

export { addDays }
