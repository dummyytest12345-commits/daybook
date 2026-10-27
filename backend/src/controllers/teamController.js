import { Invite, Notification, TeamProject, TeamTask } from '../models/Team.js'
import { User } from '../models/User.js'
import * as svc from '../services/teamService.js'
import { notFound } from '../utils/httpError.js'

const actorOf = async (req) => {
  const u = await User.findById(req.userId)
  if (!u) throw notFound('Account')
  return u
}
const me = (req) => req.userId

// ---------- projects ----------
export const listProjects = async (req, res) => res.json({ projects: await svc.listProjects(me(req)) })

export async function createProject(req, res) {
  const p = await svc.createProject(me(req), req.body)
  res.status(201).json({ project: p.toJSON() })
}

export async function getProject(req, res) {
  const p = await svc.requireProject(me(req), req.params.id)
  const [members, invites, stats] = await Promise.all([
    svc.memberProfiles(p),
    Invite.find({ teamProjectId: String(p._id), status: 'pending' }).sort({ createdAt: -1 }),
    svc.projectStats(p),
  ])
  res.json({ project: { ...p.toJSON(), myRole: svc.memberOf(p, me(req)).role }, members, invites: invites.map((i) => i.toJSON()), stats })
}

export async function patchProject(req, res) {
  const p = await svc.requireProject(me(req), req.params.id, 'owner')
  p.set(req.body)
  await p.save()
  res.json({ project: p.toJSON() })
}

export async function deleteProject(req, res) {
  const p = await svc.requireProject(me(req), req.params.id, 'owner')
  p.deletedAt = new Date()
  await p.save()
  res.status(204).end()
}

// ---------- members ----------
export async function searchUsers(req, res) {
  res.json(await svc.searchUser(req.valid.query.email, req.valid.query.projectId, me(req)))
}

export async function addMember(req, res) {
  const r = await svc.addMember(await actorOf(req), req.params.id, req.body)
  const status = r.result === 'added' || r.result === 'invited' ? 201 : 200
  res.status(status).json({ result: r.result, member: r.member, invite: r.invite?.toJSON(), email: r.email })
}

export const removeMember = async (req, res) => res.json(await svc.removeMember(await actorOf(req), req.params.id, req.params.userId))
export async function setRole(req, res) {
  const m = await svc.setRole(await actorOf(req), req.params.id, req.params.userId, req.body.role)
  res.json({ member: { userId: m.userId, role: m.role } })
}
export async function resendInvite(req, res) {
  const r = await svc.resendInvite(await actorOf(req), req.params.id, req.params.inviteId)
  res.json({ invite: r.invite.toJSON(), email: r.email })
}
export async function revokeInvite(req, res) {
  await svc.revokeInvite(await actorOf(req), req.params.id, req.params.inviteId)
  res.status(204).end()
}
export const previewInvite = async (req, res) => res.json(await svc.previewInvite(req.params.token))

// ---------- tasks ----------
export async function listTasks(req, res) {
  await svc.requireProject(me(req), req.params.id)
  const tasks = await TeamTask.find({ teamProjectId: req.params.id, deletedAt: null }).sort({ order: 1, createdAt: 1 })
  res.json({ tasks: tasks.map((t) => t.toJSON()) })
}
export async function createTask(req, res) {
  const t = await svc.createTask(await actorOf(req), req.params.id, req.body)
  res.status(201).json({ task: t.toJSON() })
}
export async function patchTask(req, res) {
  res.json({ task: (await svc.updateTask(await actorOf(req), req.params.taskId, req.body)).toJSON() })
}
export async function setMyProgress(req, res) {
  res.json({ task: (await svc.setMyProgress(await actorOf(req), req.params.taskId, req.body)).toJSON() })
}
export async function deleteTask(req, res) {
  await svc.deleteTask(await actorOf(req), req.params.taskId)
  res.status(204).end()
}

// ---------- chat ----------
export async function listMessages(req, res) {
  res.json(await svc.listMessages(me(req), req.params.id, req.valid.query))
}
export async function postMessage(req, res) {
  const actor = await actorOf(req)
  const m = await svc.postMessage(actor, req.params.id, req.body)
  res.status(201).json({ message: { ...m.toJSON(), author: actor.name } })
}
export async function editMessage(req, res) {
  const actor = await actorOf(req)
  res.json({ message: { ...(await svc.editMessage(actor, req.params.messageId, req.body.text)).toJSON(), author: actor.name } })
}
export async function deleteMessage(req, res) {
  await svc.deleteMessage(await actorOf(req), req.params.messageId)
  res.status(204).end()
}
export async function react(req, res) {
  res.json({ message: (await svc.toggleReaction(await actorOf(req), req.params.messageId, req.body.emoji)).toJSON() })
}
export async function markRead(req, res) {
  await svc.markRead(me(req), req.params.id)
  res.status(204).end()
}

// ---------- notifications ----------
export async function listNotifications(req, res) {
  const [items, unread] = await Promise.all([
    Notification.find({ userId: me(req) }).sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ userId: me(req), read: false }),
  ])
  res.json({ notifications: items.map((n) => n.toJSON()), unread })
}
export async function readNotifications(req, res) {
  const filter = { userId: me(req), ...(req.body.all ? {} : { _id: { $in: req.body.ids || [] } }) }
  await Notification.updateMany(filter, { $set: { read: true } })
  res.json({ unread: await Notification.countDocuments({ userId: me(req), read: false }) })
}

export { TeamProject }
