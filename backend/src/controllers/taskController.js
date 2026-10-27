import { Task } from '../models/Task.js'
import { newId } from '../models/_plugin.js'
import { emitChanges } from '../services/realtime.js'
import * as svc from '../services/taskService.js'
import { sortThread, threadIdOf } from '../services/threads.js'
import { badRequest, notFound } from '../utils/httpError.js'

const origin = (req) => req.get('x-socket-id') || undefined
const json = (docs) => (Array.isArray(docs) ? docs.map((d) => d.toJSON()) : docs.toJSON())

export async function list(req, res) {
  const { from, to, status, projectId, q, threadId, updatedSince, includeDeleted, limit = 1000 } = req.valid.query
  const filter = { userId: req.userId }
  if (includeDeleted !== 'true') filter.deletedAt = null
  if (from || to) filter.date = { ...(from && { $gte: from }), ...(to && { $lte: to }) }
  if (status) filter.status = { $in: status.split(',') }
  if (projectId) filter.projectId = projectId === 'none' ? null : projectId
  if (threadId) filter.threadId = threadId
  if (updatedSince) filter.updatedAt = { $gt: new Date(updatedSince) }
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = [{ title: rx }, { notes: rx }, { ticketNo: rx }, { module: rx }, { tags: rx }]
  }
  const tasks = await Task.find(filter).sort({ date: 1, order: 1, createdAt: 1 }).limit(limit)
  res.json({ tasks: json(tasks), count: tasks.length })
}

export async function get(req, res) {
  const t = await Task.findOne({ _id: req.params.id, userId: req.userId })
  if (!t) throw notFound('Task')
  res.json({ task: t.toJSON() })
}

export async function create(req, res) {
  const task = await svc.createTask(req.userId, req.body)
  emitChanges(req.userId, origin(req), { tasksUpserted: [task.toJSON()] })
  res.status(201).json({ task: task.toJSON() })
}

export async function bulkCreate(req, res) {
  const tasks = []
  for (const t of req.body.tasks) tasks.push(await svc.createTask(req.userId, t))
  emitChanges(req.userId, origin(req), { tasksUpserted: json(tasks) })
  res.status(201).json({ tasks: json(tasks), count: tasks.length })
}

export async function patch(req, res) {
  const { task, changed, removed } = await svc.updateTask(req.userId, req.params.id, req.body)
  emitChanges(req.userId, origin(req), { tasksUpserted: [task.toJSON(), ...json(changed)], tasksRemoved: removed })
  res.json({ task: task.toJSON(), changed: json(changed), removed })
}

export async function setProgress(req, res) {
  const { task, changed, removed } = await svc.updateTask(req.userId, req.params.id, { progress: req.body.progress })
  emitChanges(req.userId, origin(req), { tasksUpserted: [task.toJSON(), ...json(changed)], tasksRemoved: removed })
  res.json({ task: task.toJSON(), changed: json(changed), removed })
}

export async function bulkPatch(req, res) {
  const out = []
  const changed = []
  const removed = []
  for (const id of req.body.ids) {
    try {
      const r = await svc.updateTask(req.userId, id, req.body.patch)
      out.push(r.task)
      changed.push(...r.changed)
      removed.push(...r.removed)
    } catch (e) {
      if (e.status !== 404) throw e // ids that vanished are skipped
    }
  }
  emitChanges(req.userId, origin(req), { tasksUpserted: [...json(out), ...json(changed)], tasksRemoved: removed })
  res.json({ tasks: json(out), changed: json(changed), removed })
}

export async function remove(req, res) {
  const r = await svc.deleteTasks(req.userId, [req.params.id])
  if (!r.removed.length) throw notFound('Task')
  const dismissed = r.dismissed.length ? json(await Task.find({ _id: { $in: r.dismissed }, userId: req.userId })) : []
  emitChanges(req.userId, origin(req), { tasksRemoved: r.removed, tasksUpserted: dismissed })
  res.json({ removed: r.removed, dismissed: r.dismissed })
}

export async function bulkDelete(req, res) {
  const r = await svc.deleteTasks(req.userId, req.body.ids)
  emitChanges(req.userId, origin(req), { tasksRemoved: r.removed })
  res.json(r)
}

export async function restore(req, res) {
  const t = await Task.findOneAndUpdate({ _id: req.params.id, userId: req.userId, deletedAt: { $ne: null } }, { $set: { deletedAt: null } }, { returnDocument: 'after' })
  if (!t) throw notFound('Deleted task')
  emitChanges(req.userId, origin(req), { tasksUpserted: [t.toJSON()] })
  res.json({ task: t.toJSON() })
}

export async function move(req, res) {
  const tasks = await svc.moveToProject(req.userId, req.body.ids, req.body.projectId)
  emitChanges(req.userId, origin(req), { tasksUpserted: json(tasks) })
  res.json({ tasks: json(tasks) })
}

export async function finish(req, res) {
  const r = await svc.finishOn(req.userId, req.params.id, req.body.date)
  emitChanges(req.userId, origin(req), { tasksUpserted: [r.task.toJSON(), ...json(r.changed)], tasksRemoved: r.removed })
  res.json({ task: r.task.toJSON(), changed: json(r.changed), removed: r.removed })
}

export async function thread(req, res) {
  const t = await Task.findOne({ _id: req.params.id, userId: req.userId })
  if (!t) throw notFound('Task')
  const rows = sortThread(await Task.find({ userId: req.userId, threadId: threadIdOf(t), deletedAt: null }))
  res.json({ threadId: threadIdOf(t), days: rows.length, tasks: json(rows) })
}

export async function carryForward(req, res) {
  const created = await svc.runCarryForward(req.userId, req.body.date)
  emitChanges(req.userId, origin(req), { tasksUpserted: json(created) })
  res.json({ created: json(created), count: created.length })
}

export async function forward(req, res) {
  const t = await svc.forwardTo(req.userId, req.params.id, req.body.to)
  emitChanges(req.userId, origin(req), { tasksUpserted: [t.toJSON()] })
  res.status(201).json({ task: t.toJSON() })
}

export async function addUpdate(req, res) {
  const t = await Task.findOneAndUpdate({ _id: req.params.id, userId: req.userId, deletedAt: null }, { $push: { updates: { _id: newId(), at: new Date(), text: req.body.text } } }, { returnDocument: 'after' })
  if (!t) throw notFound('Task')
  emitChanges(req.userId, origin(req), { tasksUpserted: [t.toJSON()] })
  res.status(201).json({ task: t.toJSON() })
}

export async function deleteUpdate(req, res) {
  const t = await Task.findOneAndUpdate({ _id: req.params.id, userId: req.userId, deletedAt: null }, { $pull: { updates: { _id: req.params.updateId } } }, { returnDocument: 'after' })
  if (!t) throw notFound('Task')
  emitChanges(req.userId, origin(req), { tasksUpserted: [t.toJSON()] })
  res.json({ task: t.toJSON() })
}

export { badRequest }
