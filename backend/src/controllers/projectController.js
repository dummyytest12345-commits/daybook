import { Project } from '../models/Project.js'
import { Task } from '../models/Task.js'
import { newId } from '../models/_plugin.js'
import { emitChanges } from '../services/realtime.js'
import { createTask } from '../services/taskService.js'
import { conflict, notFound } from '../utils/httpError.js'

const origin = (req) => req.get('x-socket-id') || undefined
const own = (req, id) => Project.findOne({ _id: id, userId: req.userId, deletedAt: null })

/** "Website Redesign" -> WR, "Payments" -> PAY; adds a number when taken. */
function suggestKey(name, taken) {
  const words = name.toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(Boolean)
  let base = words.length > 1 ? words.map((w) => w[0]).join('').slice(0, 4) : (words[0] || 'PRJ').slice(0, 3)
  if (base.length < 2) base = (base + 'XX').slice(0, 3)
  if (!/^[A-Z]/.test(base)) base = `P${base}`.slice(0, 6)
  let key = base
  for (let n = 2; taken.has(key); n++) key = `${base.slice(0, 5)}${n}`
  return key
}

async function statsFor(userId, ids) {
  const rows = await Task.aggregate([
    { $match: { userId, deletedAt: null, projectId: { $in: ids } } },
    {
      $group: {
        _id: '$projectId',
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
        blocked: { $sum: { $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0] } },
        avgProgress: { $avg: { $cond: [{ $eq: ['$status', 'completed'] }, 100, { $ifNull: ['$progress', 0] }] } },
      },
    },
  ])
  const map = new Map(rows.map((r) => [r._id, r]))
  return (id) => {
    const r = map.get(id) || { total: 0, completed: 0, inProgress: 0, blocked: 0, avgProgress: 0 }
    return { total: r.total, completed: r.completed, inProgress: r.inProgress, blocked: r.blocked, avgProgress: Math.round((r.avgProgress || 0) * 10) / 10, completion: r.total ? r.completed / r.total : 0 }
  }
}

export async function list(req, res) {
  const projects = await Project.find({ userId: req.userId, deletedAt: null }).sort({ favorite: -1, updatedAt: -1 })
  const stat = await statsFor(req.userId, projects.map((p) => String(p._id)))
  res.json({ projects: projects.map((p) => ({ ...p.toJSON(), stats: stat(String(p._id)) })) })
}

export async function get(req, res) {
  const p = await own(req, req.params.id)
  if (!p) throw notFound('Project')
  const stat = await statsFor(req.userId, [String(p._id)])
  res.json({ project: { ...p.toJSON(), stats: stat(String(p._id)) } })
}

export async function create(req, res) {
  const live = await Project.find({ userId: req.userId, deletedAt: null }, 'key').lean()
  const taken = new Set(live.map((p) => p.key))
  const key = req.body.key || suggestKey(req.body.name, taken)
  if (taken.has(key)) throw conflict(`The key ${key} is already used by another project`)
  const p = await Project.create({ ...req.body, key, userId: req.userId })
  emitChanges(req.userId, origin(req), { projectsUpserted: [p.toJSON()] })
  res.status(201).json({ project: p.toJSON() })
}

export async function patch(req, res) {
  const p = await own(req, req.params.id)
  if (!p) throw notFound('Project')
  const body = { ...req.body }
  if (body.key && body.key !== p.key && (await Project.exists({ userId: req.userId, key: body.key, deletedAt: null, _id: { $ne: p._id } }))) {
    throw conflict(`The key ${body.key} is already used by another project`)
  }
  if ('startDate' in body && body.startDate === null) body.startDate = undefined
  if ('targetDate' in body && body.targetDate === null) body.targetDate = undefined
  p.set(body)
  await p.save()
  emitChanges(req.userId, origin(req), { projectsUpserted: [p.toJSON()] })
  res.json({ project: p.toJSON() })
}

export async function setArchived(req, res) {
  const p = await own(req, req.params.id)
  if (!p) throw notFound('Project')
  p.archivedAt = req.path.endsWith('/archive') ? new Date() : null
  await p.save()
  emitChanges(req.userId, origin(req), { projectsUpserted: [p.toJSON()] })
  res.json({ project: p.toJSON() })
}

/** mode 'unassign' keeps the tasks (they become "no project"); 'delete' deletes them too. */
export async function remove(req, res) {
  const p = await own(req, req.params.id)
  if (!p) throw notFound('Project')
  const now = new Date()
  const ids = (await Task.find({ userId: req.userId, projectId: String(p._id), deletedAt: null }, '_id').lean()).map((t) => String(t._id))
  if (req.valid.query.mode === 'delete') await Task.updateMany({ _id: { $in: ids }, userId: req.userId }, { $set: { deletedAt: now } })
  else await Task.updateMany({ _id: { $in: ids }, userId: req.userId }, { $set: { projectId: null }, $unset: { number: 1 } })
  p.deletedAt = now
  await p.save()
  const tasks = req.valid.query.mode === 'delete' ? [] : (await Task.find({ _id: { $in: ids }, userId: req.userId })).map((t) => t.toJSON())
  emitChanges(req.userId, origin(req), { projectsRemoved: [String(p._id)], tasksRemoved: req.valid.query.mode === 'delete' ? ids : [], tasksUpserted: tasks })
  res.json({ removed: String(p._id), tasks: ids.length, mode: req.valid.query.mode })
}

export async function duplicate(req, res) {
  const src = await own(req, req.params.id)
  if (!src) throw notFound('Project')
  const taken = new Set((await Project.find({ userId: req.userId, deletedAt: null }, 'key').lean()).map((p) => p.key))
  const copy = await Project.create({
    userId: req.userId, name: `${src.name} (copy)`.slice(0, 60), key: suggestKey(src.name, taken), description: src.description,
    color: src.color, icon: src.icon, status: 'active', startDate: src.startDate, targetDate: src.targetDate, wipLimits: src.wipLimits,
  })
  const tasks = []
  if (req.body.withTasks) {
    const rows = await Task.find({ userId: req.userId, projectId: String(src._id), deletedAt: null }).sort({ number: 1 })
    for (const t of rows) {
      tasks.push(await createTask(req.userId, { id: newId(), title: t.title, date: t.date, notes: t.notes, projectId: String(copy._id), module: t.module, priority: t.priority, tags: t.tags, estimateHours: t.estimateHours }))
    }
  }
  emitChanges(req.userId, origin(req), { projectsUpserted: [copy.toJSON()], tasksUpserted: tasks.map((t) => t.toJSON()) })
  res.status(201).json({ project: copy.toJSON(), tasks: tasks.length })
}
