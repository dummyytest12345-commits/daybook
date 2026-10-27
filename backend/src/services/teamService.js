import crypto from 'node:crypto'
import { Invite, Message, Notification, TeamProject, TeamTask } from '../models/Team.js'
import { User } from '../models/User.js'
import { addedToProject, inviteNewUser } from '../templates/emailTemplates.js'
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError.js'
import { sendMail } from './email.js'
import { withProgressRules } from './progress.js'
import { emitToTeam, emitToUser } from './realtime.js'

const INVITE_DAYS = 14
const ROLE_RANK = { viewer: 1, editor: 2, owner: 3 }

export const memberOf = (project, userId) => project.members.find((m) => m.userId === userId)

/** Loads a live project the user belongs to with at least `min` role, or throws 404/403. */
export async function requireProject(userId, projectId, min = 'viewer') {
  const project = await TeamProject.findOne({ _id: projectId, deletedAt: null, 'members.userId': userId })
  if (!project) throw notFound('Project') // also hides projects the user is not part of
  if (ROLE_RANK[memberOf(project, userId).role] < ROLE_RANK[min]) throw forbidden(min === 'owner' ? 'Only the project owner can do this' : 'You have view-only access')
  return project
}

const suggestKey = (name, taken) => {
  const words = name.toUpperCase().replace(/[^A-Z0-9\s]/g, '').split(/\s+/).filter(Boolean)
  let base = words.length > 1 ? words.map((w) => w[0]).join('').slice(0, 4) : (words[0] || 'PRJ').slice(0, 3)
  if (base.length < 2) base = (base + 'XX').slice(0, 3)
  if (!/^[A-Z]/.test(base)) base = `P${base}`.slice(0, 6)
  let key = base
  for (let n = 2; taken.has(key); n++) key = `${base.slice(0, 5)}${n}`
  return key
}

/** Public profile of members (never the email of someone the viewer didn't search for). */
export async function memberProfiles(project) {
  const users = await User.find({ _id: { $in: project.members.map((m) => m.userId) } }, 'name email').lean()
  const byId = new Map(users.map((u) => [String(u._id), u]))
  return project.members.map((m) => ({
    userId: m.userId, role: m.role, addedAt: m.addedAt,
    name: byId.get(m.userId)?.name || 'Former member', email: byId.get(m.userId)?.email || '',
  }))
}

export async function notify(userId, { type, title, body, link }) {
  const n = await Notification.create({ userId, type, title, body, link })
  emitToUser(userId, 'notification', n.toJSON())
  return n
}

/** A short system line in the project's chat, e.g. "Alice set progress to 60%". */
export async function systemMessage(project, { text, taskId = null, userId, meta }) {
  const m = await Message.create({ teamProjectId: String(project._id), taskId, userId, type: 'system', text, meta })
  emitToTeam(String(project._id), 'chat:message', m.toJSON())
  return m
}

// ---------------------------------------------------------------- projects
export async function createProject(userId, data) {
  const mine = await TeamProject.find({ 'members.userId': userId, deletedAt: null }, 'key').lean()
  const taken = new Set(mine.map((p) => p.key))
  const key = data.key || suggestKey(data.name, taken)
  if (taken.has(key)) throw conflict(`You already have a team project with the key ${key}`)
  return TeamProject.create({ ...data, key, ownerId: userId, members: [{ userId, role: 'owner', addedBy: userId }] })
}

export async function listProjects(userId) {
  const projects = await TeamProject.find({ deletedAt: null, 'members.userId': userId }).sort({ updatedAt: -1 })
  const ids = projects.map((p) => String(p._id))
  const [stats, unread] = await Promise.all([
    TeamTask.aggregate([
      { $match: { teamProjectId: { $in: ids }, deletedAt: null } },
      { $group: { _id: '$teamProjectId', total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, avgProgress: { $avg: '$progress' } } },
    ]),
    Promise.all(projects.map(async (p) => [String(p._id), await Message.countDocuments({ teamProjectId: String(p._id), type: 'user', userId: { $ne: userId }, createdAt: { $gt: memberOf(p, userId).lastReadAt }, deletedAt: null })])),
  ])
  const st = new Map(stats.map((s) => [s._id, s]))
  const un = new Map(unread)
  return projects.map((p) => {
    const s = st.get(String(p._id))
    return { ...p.toJSON(), myRole: memberOf(p, userId).role, memberCount: p.members.length, stats: { total: s?.total || 0, completed: s?.completed || 0, avgProgress: Math.round(s?.avgProgress || 0) }, unread: un.get(String(p._id)) || 0 }
  })
}

// ---------------------------------------------------------------- members and invitations
/** What a search for an email address finds (the caller asked for exactly this address). */
export async function searchUser(email, projectId, viewerId) {
  const e = email.trim().toLowerCase()
  const user = await User.findOne({ email: e }, 'name email')
  let state = 'none'
  if (projectId) {
    const project = await requireProject(viewerId, projectId)
    if (user && memberOf(project, String(user._id))) state = 'member'
    else if (await Invite.exists({ teamProjectId: projectId, email: e, status: 'pending' })) state = 'invited'
  }
  return { email: e, exists: !!user, user: user ? { id: String(user._id), name: user.name, email: user.email } : null, state }
}

const projectInfo = (p) => ({ id: String(p._id), name: p.name, key: p.key, color: p.color })

/**
 * Add somebody by email. Existing account: added right away + "you were added" email.
 * No account yet: a pending invitation + "create an account" email; they join automatically when they register.
 */
export async function addMember(actor, projectId, { email, role = 'editor' }) {
  const project = await requireProject(String(actor._id), projectId, 'editor')
  if (role === 'owner') throw badRequest('There is one owner per project')
  const e = email.trim().toLowerCase()
  if (e === actor.email) throw badRequest('You are already in this project')
  const user = await User.findOne({ email: e })

  if (user) {
    if (memberOf(project, String(user._id))) return { result: 'already_member', project }
    project.members.push({ userId: String(user._id), role, addedBy: String(actor._id) })
    await project.save()
    await Invite.updateMany({ teamProjectId: projectId, email: e, status: 'pending' }, { $set: { status: 'accepted', acceptedBy: String(user._id) } })
    const mail = await sendMail({ to: e, ...addedToProject({ toName: user.name, by: actor.name, project: projectInfo(project), role }) })
    await notify(String(user._id), { type: 'added', title: `${actor.name} added you to ${project.name}`, body: `Role: ${role}`, link: `/team/${projectId}` })
    await systemMessage(project, { text: `${actor.name} added ${user.name} to the project`, userId: String(actor._id), meta: { kind: 'member' } })
    emitToTeam(projectId, 'team:changes', { projectId, membersChanged: true })
    emitToUser(String(user._id), 'team:projects-changed', { projectId })
    return { result: 'added', project, member: { userId: String(user._id), name: user.name, email: user.email, role }, email: mail }
  }

  let invite = await Invite.findOne({ teamProjectId: projectId, email: e, status: 'pending' })
  if (invite) return { result: 'already_invited', invite, project }
  invite = await Invite.create({ email: e, teamProjectId: projectId, invitedBy: String(actor._id), role, token: crypto.randomBytes(24).toString('hex'), expiresAt: new Date(Date.now() + INVITE_DAYS * 864e5) })
  const mail = await sendMail({ to: e, ...inviteNewUser({ email: e, by: actor.name, project: projectInfo(project), role, token: invite.token }) })
  await systemMessage(project, { text: `${actor.name} invited ${e} to join`, userId: String(actor._id), meta: { kind: 'invite' } })
  emitToTeam(projectId, 'team:changes', { projectId, invitesChanged: true })
  return { result: 'invited', invite, project, email: mail }
}

export async function resendInvite(actor, projectId, inviteId) {
  const project = await requireProject(String(actor._id), projectId, 'editor')
  const invite = await Invite.findOne({ _id: inviteId, teamProjectId: projectId, status: 'pending' })
  if (!invite) throw notFound('Invitation')
  invite.expiresAt = new Date(Date.now() + INVITE_DAYS * 864e5)
  invite.sentCount += 1
  await invite.save()
  const mail = await sendMail({ to: invite.email, ...inviteNewUser({ email: invite.email, by: actor.name, project: projectInfo(project), role: invite.role, token: invite.token, reminder: true }) })
  return { invite, email: mail }
}

export async function revokeInvite(actor, projectId, inviteId) {
  await requireProject(String(actor._id), projectId, 'editor')
  const invite = await Invite.findOneAndUpdate({ _id: inviteId, teamProjectId: projectId, status: 'pending' }, { $set: { status: 'revoked' } }, { returnDocument: 'after' })
  if (!invite) throw notFound('Invitation')
  emitToTeam(projectId, 'team:changes', { projectId, invitesChanged: true })
  return invite
}

/** Called when somebody registers or logs in: joins every project they were invited to by email. */
export async function acceptPendingInvites(user) {
  const invites = await Invite.find({ email: user.email, status: 'pending', expiresAt: { $gt: new Date() } })
  const joined = []
  for (const inv of invites) {
    const project = await TeamProject.findOne({ _id: inv.teamProjectId, deletedAt: null })
    inv.status = 'accepted'
    inv.acceptedBy = String(user._id)
    await inv.save()
    if (!project || memberOf(project, String(user._id))) continue
    project.members.push({ userId: String(user._id), role: inv.role, addedBy: inv.invitedBy })
    await project.save()
    joined.push(project)
    await notify(String(user._id), { type: 'joined', title: `You joined ${project.name}`, body: 'You were invited by email.', link: `/team/${project._id}` })
    const inviter = await User.findById(inv.invitedBy, 'name')
    await notify(inv.invitedBy, { type: 'accepted', title: `${user.name} accepted your invitation`, body: project.name, link: `/team/${project._id}` })
    await systemMessage(project, { text: `${user.name} joined the project`, userId: String(user._id), meta: { kind: 'member' } })
    emitToTeam(String(project._id), 'team:changes', { projectId: String(project._id), membersChanged: true, invitesChanged: true })
    void inviter
  }
  return joined
}

/** Public preview of an invitation link (no account needed): shows the project name and who invited. */
export async function previewInvite(token) {
  const inv = await Invite.findOne({ token })
  if (!inv || inv.status !== 'pending' || inv.expiresAt < new Date()) throw notFound('Invitation')
  const [project, by] = await Promise.all([TeamProject.findById(inv.teamProjectId), User.findById(inv.invitedBy, 'name')])
  if (!project || project.deletedAt) throw notFound('Invitation')
  return { email: inv.email, role: inv.role, project: projectInfo(project), invitedBy: by?.name || 'A teammate', expiresAt: inv.expiresAt, accountExists: !!(await User.exists({ email: inv.email })) }
}

export async function removeMember(actor, projectId, targetId) {
  const project = await requireProject(String(actor._id), projectId)
  const self = targetId === String(actor._id)
  if (!self && memberOf(project, String(actor._id)).role !== 'owner') throw forbidden('Only the owner can remove other members')
  const target = memberOf(project, targetId)
  if (!target) throw notFound('Member')
  if (target.role === 'owner') throw badRequest('The owner cannot leave. Delete the project or transfer ownership first')
  project.members = project.members.filter((m) => m.userId !== targetId)
  await project.save()
  await TeamTask.updateMany({ teamProjectId: projectId }, { $pull: { assignees: targetId, contributions: { userId: targetId } } })
  await recomputeAll(project)
  const name = (await User.findById(targetId, 'name'))?.name || 'A member'
  await systemMessage(project, { text: self ? `${name} left the project` : `${name} was removed from the project`, userId: String(actor._id), meta: { kind: 'member' } })
  emitToTeam(projectId, 'team:changes', { projectId, membersChanged: true, tasksChanged: true })
  emitToUser(targetId, 'team:projects-changed', { projectId, removed: true })
  return { removed: targetId }
}

export async function setRole(actor, projectId, targetId, role) {
  const project = await requireProject(String(actor._id), projectId, 'owner')
  const m = memberOf(project, targetId)
  if (!m) throw notFound('Member')
  if (m.role === 'owner') throw badRequest('The owner’s role cannot change')
  m.role = role
  await project.save()
  emitToTeam(projectId, 'team:changes', { projectId, membersChanged: true })
  return m
}

// ---------------------------------------------------------------- tasks and progress
const mean = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0)

/** Overall progress of a task: mean of the assignees' own progress (missing = 0). */
export function overallFrom(task) {
  if (!task.assignees.length) return task.progress
  const by = new Map(task.contributions.map((c) => [c.userId, c.progress]))
  return mean(task.assignees.map((a) => by.get(a) ?? 0))
}

/** Apply a new overall progress to a task, running the status rules (0% start, 100% completes). */
function applyOverall(task, overall) {
  const patch = withProgressRules({ status: task.status, progress: task.progress }, { progress: overall })
  task.set(patch)
  return task
}

async function recomputeAll(project) {
  const tasks = await TeamTask.find({ teamProjectId: String(project._id), deletedAt: null, 'assignees.0': { $exists: true } })
  for (const t of tasks) {
    applyOverall(t, overallFrom(t))
    await t.save()
  }
}

export async function createTask(actor, projectId, data) {
  const project = await requireProject(String(actor._id), projectId, 'editor')
  const assignees = [...new Set(data.assignees || [])]
  for (const a of assignees) if (!memberOf(project, a)) throw badRequest('Assignees must be project members')
  const bumped = await TeamProject.findOneAndUpdate({ _id: projectId }, { $inc: { nextNumber: 1 } }, { returnDocument: 'before' })
  const count = await TeamTask.countDocuments({ teamProjectId: projectId, deletedAt: null })
  const task = await TeamTask.create({ ...data, assignees, teamProjectId: projectId, number: bumped.nextNumber, order: count, createdBy: String(actor._id) })
  for (const a of assignees.filter((x) => x !== String(actor._id))) {
    await notify(a, { type: 'assigned', title: `${actor.name} assigned you “${task.title}”`, body: project.name, link: `/team/${projectId}?task=${task._id}` })
  }
  await systemMessage(project, { text: `${actor.name} created ${project.key}-${task.number} “${task.title}”`, taskId: String(task._id), userId: String(actor._id), meta: { kind: 'task' } })
  emitToTeam(projectId, 'team:changes', { projectId, tasksChanged: true, task: task.toJSON() })
  return task
}

export async function updateTask(actor, taskId, patch) {
  const task = await TeamTask.findOne({ _id: taskId, deletedAt: null })
  if (!task) throw notFound('Task')
  const project = await requireProject(String(actor._id), task.teamProjectId, 'editor')
  const before = { status: task.status, assignees: [...task.assignees] }
  const { assignees, progress, status, ...rest } = patch
  task.set(rest)
  if (assignees) {
    const next = [...new Set(assignees)]
    for (const a of next) if (!memberOf(project, a)) throw badRequest('Assignees must be project members')
    task.assignees = next
    task.contributions = task.contributions.filter((c) => next.includes(c.userId))
    for (const a of next.filter((x) => !before.assignees.includes(x) && x !== String(actor._id))) {
      await notify(a, { type: 'assigned', title: `${actor.name} assigned you “${task.title}”`, body: project.name, link: `/team/${project._id}?task=${task._id}` })
    }
  }
  if (assignees) applyOverall(task, overallFrom(task))
  if (status || progress != null) {
    // direct status/progress edits are for unassigned tasks, or an explicit status change (e.g. blocked)
    const p = withProgressRules({ status: task.status, progress: task.progress }, { ...(status && { status }), ...(progress != null && !task.assignees.length && { progress }) })
    task.set(p)
  }
  await task.save()
  if (before.status !== task.status) {
    await systemMessage(project, { text: `${actor.name} moved ${project.key}-${task.number} to ${task.status.replace('_', ' ')}`, taskId: String(task._id), userId: String(actor._id), meta: { kind: 'status' } })
  }
  emitToTeam(String(project._id), 'team:changes', { projectId: String(project._id), tasksChanged: true, task: task.toJSON() })
  return task
}

/** A member sets THEIR OWN progress on a task they are assigned to; the task's overall progress follows. */
export async function setMyProgress(actor, taskId, { progress, note }) {
  const task = await TeamTask.findOne({ _id: taskId, deletedAt: null })
  if (!task) throw notFound('Task')
  const project = await requireProject(String(actor._id), task.teamProjectId, 'editor')
  const me = String(actor._id)
  if (task.assignees.length && !task.assignees.includes(me)) throw forbidden('This task is assigned to other people')
  if (!task.assignees.length) task.assignees = [me] // first contributor claims an unassigned task
  const mine = task.contributions.find((c) => c.userId === me)
  const prev = mine?.progress ?? 0
  if (mine) Object.assign(mine, { progress, at: new Date(), ...(note != null && { note }) })
  else task.contributions.push({ userId: me, progress, note, at: new Date() })
  const wasStatus = task.status
  applyOverall(task, overallFrom(task))
  await task.save()
  const verb = progress === 100 ? 'finished their part of' : `set progress to ${progress}% on`
  await systemMessage(project, { text: `${actor.name} ${verb} ${project.key}-${task.number}${note ? `: ${note}` : ''}`, taskId: String(task._id), userId: me, meta: { kind: 'progress', progress, previous: prev, overall: task.progress } })
  if (wasStatus !== 'completed' && task.status === 'completed') {
    for (const m of project.members.filter((x) => x.userId !== me)) {
      await notify(m.userId, { type: 'completed', title: `${project.key}-${task.number} is complete`, body: task.title, link: `/team/${project._id}?task=${task._id}` })
    }
  }
  emitToTeam(String(project._id), 'team:changes', { projectId: String(project._id), tasksChanged: true, task: task.toJSON() })
  return task
}

export async function deleteTask(actor, taskId) {
  const task = await TeamTask.findOne({ _id: taskId, deletedAt: null })
  if (!task) throw notFound('Task')
  const project = await requireProject(String(actor._id), task.teamProjectId, 'editor')
  task.deletedAt = new Date()
  await task.save()
  emitToTeam(String(project._id), 'team:changes', { projectId: String(project._id), tasksChanged: true, removedTaskId: String(task._id) })
  return task
}

/** Per-member and overall progress for the project dashboard. */
export async function projectStats(project) {
  const tasks = await TeamTask.find({ teamProjectId: String(project._id), deletedAt: null }).lean()
  const profiles = await memberProfiles(project)
  const members = profiles.map((m) => {
    const mine = tasks.filter((t) => t.assignees.includes(m.userId))
    const prog = mine.map((t) => t.contributions.find((c) => c.userId === m.userId)?.progress ?? 0)
    return { ...m, assigned: mine.length, avgProgress: mean(prog), finished: prog.filter((p) => p === 100).length }
  })
  const byStatus = { pending: 0, in_progress: 0, blocked: 0, completed: 0 }
  tasks.forEach((t) => (byStatus[t.status] += 1))
  return { total: tasks.length, byStatus, avgProgress: mean(tasks.map((t) => t.progress)), members }
}

// ---------------------------------------------------------------- chat
export async function postMessage(actor, projectId, { text, taskId }) {
  const project = await requireProject(String(actor._id), projectId, 'viewer') // viewers may chat
  if (taskId && !(await TeamTask.exists({ _id: taskId, teamProjectId: projectId, deletedAt: null }))) throw badRequest('Task not found in this project')
  const m = await Message.create({ teamProjectId: projectId, taskId: taskId || null, userId: String(actor._id), text })
  emitToTeam(projectId, 'chat:message', m.toJSON())
  // @mentions notify the person: "@Alice" or "@alice@example.com"
  const mentioned = project.members.filter((mem) => mem.userId !== String(actor._id))
  const users = await User.find({ _id: { $in: mentioned.map((x) => x.userId) } }, 'name email').lean()
  for (const u of users) {
    const first = u.name.split(' ')[0].toLowerCase()
    if (new RegExp(`@(${first}|${u.email.split('@')[0].toLowerCase()})\\b`, 'i').test(text)) {
      await notify(String(u._id), { type: 'mention', title: `${actor.name} mentioned you in ${project.name}`, body: text.slice(0, 140), link: `/team/${projectId}` })
    }
  }
  return m
}

export async function listMessages(userId, projectId, { taskId, before, limit = 50 }) {
  await requireProject(userId, projectId)
  // main chat = project messages + every system line (progress, status, joins) as an activity feed; a task thread = that task only
  const filter = taskId && taskId !== 'all' ? { teamProjectId: projectId, taskId } : taskId === 'all' ? { teamProjectId: projectId } : { teamProjectId: projectId, $or: [{ taskId: null }, { type: 'system' }] }
  if (before) filter.createdAt = { $lt: new Date(before) }
  const rows = await Message.find(filter).sort({ createdAt: -1 }).limit(limit + 1)
  const hasMore = rows.length > limit
  const page = rows.slice(0, limit).reverse()
  const users = await User.find({ _id: { $in: [...new Set(page.map((m) => m.userId))] } }, 'name').lean()
  const names = new Map(users.map((u) => [String(u._id), u.name]))
  return { messages: page.map((m) => ({ ...m.toJSON(), author: names.get(m.userId) || 'Former member' })), hasMore }
}

export async function editMessage(actor, messageId, text) {
  const m = await Message.findOne({ _id: messageId, deletedAt: null })
  if (!m || m.type !== 'user') throw notFound('Message')
  await requireProject(String(actor._id), m.teamProjectId)
  if (m.userId !== String(actor._id)) throw forbidden('You can only edit your own messages')
  m.text = text
  m.editedAt = new Date()
  await m.save()
  emitToTeam(m.teamProjectId, 'chat:updated', m.toJSON())
  return m
}

export async function deleteMessage(actor, messageId) {
  const m = await Message.findOne({ _id: messageId, deletedAt: null })
  if (!m) throw notFound('Message')
  const project = await requireProject(String(actor._id), m.teamProjectId)
  if (m.userId !== String(actor._id) && memberOf(project, String(actor._id)).role !== 'owner') throw forbidden('You can only delete your own messages')
  m.deletedAt = new Date()
  await m.save()
  emitToTeam(m.teamProjectId, 'chat:updated', m.toJSON())
  return m
}

export async function toggleReaction(actor, messageId, emoji) {
  const m = await Message.findOne({ _id: messageId, deletedAt: null })
  if (!m) throw notFound('Message')
  await requireProject(String(actor._id), m.teamProjectId)
  const me = String(actor._id)
  let r = m.reactions.find((x) => x.emoji === emoji)
  if (!r) m.reactions.push((r = { emoji, userIds: [] })), (r = m.reactions.at(-1))
  r.userIds = r.userIds.includes(me) ? r.userIds.filter((u) => u !== me) : [...r.userIds, me]
  m.reactions = m.reactions.filter((x) => x.userIds.length)
  await m.save()
  emitToTeam(m.teamProjectId, 'chat:updated', m.toJSON())
  return m
}

export async function markRead(userId, projectId) {
  await TeamProject.updateOne({ _id: projectId, 'members.userId': userId }, { $set: { 'members.$.lastReadAt': new Date() } })
}
