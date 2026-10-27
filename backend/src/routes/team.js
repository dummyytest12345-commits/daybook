import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as c from '../controllers/teamController.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import * as v from '../validators/schemas.js'

const r = Router()
const id = validate({ params: v.idParam })
// searching accounts by email must not be a way to harvest who is registered
const searchLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: { message: 'Too many searches, try again later' } } })

// public: look at an invitation link before having an account
r.get('/invites/:token', c.previewInvite)

r.use(requireAuth)
r.get('/users/search', searchLimiter, validate({ query: v.team.search }), c.searchUsers)

r.get('/projects', c.listProjects)
r.post('/projects', validate({ body: v.team.project }), c.createProject)
r.get('/projects/:id', id, c.getProject)
r.patch('/projects/:id', id, validate({ body: v.team.projectPatch }), c.patchProject)
r.delete('/projects/:id', id, c.deleteProject)

r.post('/projects/:id/members', id, validate({ body: v.team.addMember }), c.addMember)
r.patch('/projects/:id/members/:userId', validate({ body: v.team.role }), c.setRole)
r.delete('/projects/:id/members/:userId', c.removeMember)
r.post('/projects/:id/invites/:inviteId/resend', c.resendInvite)
r.delete('/projects/:id/invites/:inviteId', c.revokeInvite)

r.get('/projects/:id/tasks', id, c.listTasks)
r.post('/projects/:id/tasks', id, validate({ body: v.team.task }), c.createTask)
r.patch('/tasks/:taskId', validate({ body: v.team.taskPatch }), c.patchTask)
r.put('/tasks/:taskId/my-progress', validate({ body: v.team.myProgress }), c.setMyProgress)
r.delete('/tasks/:taskId', c.deleteTask)

r.get('/projects/:id/messages', id, validate({ query: v.team.messages }), c.listMessages)
r.post('/projects/:id/messages', id, validate({ body: v.team.message }), c.postMessage)
r.post('/projects/:id/read', id, c.markRead)
r.patch('/messages/:messageId', validate({ body: v.team.messageEdit }), c.editMessage)
r.delete('/messages/:messageId', c.deleteMessage)
r.post('/messages/:messageId/reactions', validate({ body: v.team.reaction }), c.react)

r.get('/notifications', c.listNotifications)
r.post('/notifications/read', validate({ body: v.team.notifications }), c.readNotifications)

export default r
