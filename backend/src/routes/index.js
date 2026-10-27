import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import teamRoutes from './team.js'
import * as authC from '../controllers/authController.js'
import * as misc from '../controllers/miscControllers.js'
import * as projectC from '../controllers/projectController.js'
import * as taskC from '../controllers/taskController.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import * as v from '../validators/schemas.js'

const api = Router()

// brute-force protection on credential endpoints
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: { message: 'Too many requests, try again later' } } })

// ---- auth ----
const auth = Router()
auth.post('/register', authLimiter, validate({ body: v.auth.register }), authC.register)
auth.post('/login', authLimiter, validate({ body: v.auth.login }), authC.login)
auth.get('/me', requireAuth, authC.me)
auth.patch('/me', requireAuth, validate({ body: v.auth.profile }), authC.updateProfile)
auth.post('/password', requireAuth, authLimiter, validate({ body: v.auth.password }), authC.changePassword)
auth.delete('/me', requireAuth, authLimiter, validate({ body: v.auth.remove }), authC.deleteAccount)
api.use('/auth', auth)

// collaboration (team projects, invites, chat). Has its own auth rules (invite preview is public)
api.use('/team', teamRoutes)

// everything below needs a signed-in user
api.use(requireAuth)

// ---- tasks (static paths first, then :id) ----
const tasks = Router()
const id = validate({ params: v.idParam })
tasks.get('/', validate({ query: v.task.list }), taskC.list)
tasks.post('/', validate({ body: v.task.create }), taskC.create)
tasks.post('/bulk', validate({ body: v.task.bulkCreate }), taskC.bulkCreate)
tasks.patch('/bulk', validate({ body: v.task.bulkPatch }), taskC.bulkPatch)
tasks.post('/bulk-delete', validate({ body: v.task.bulkDelete }), taskC.bulkDelete)
tasks.post('/move', validate({ body: v.task.move }), taskC.move)
tasks.post('/carry-forward', validate({ body: v.task.carryForward }), taskC.carryForward)
tasks.get('/:id', id, taskC.get)
tasks.patch('/:id', id, validate({ body: v.task.patch }), taskC.patch)
tasks.delete('/:id', id, taskC.remove)
tasks.post('/:id/restore', id, taskC.restore)
tasks.put('/:id/progress', id, validate({ body: v.task.progress }), taskC.setProgress)
tasks.post('/:id/finish', id, validate({ body: v.task.finish }), taskC.finish)
tasks.post('/:id/forward', id, validate({ body: v.task.forward }), taskC.forward)
tasks.get('/:id/thread', id, taskC.thread)
tasks.post('/:id/updates', id, validate({ body: v.task.update }), taskC.addUpdate)
tasks.delete('/:id/updates/:updateId', taskC.deleteUpdate)
api.use('/tasks', tasks)

// ---- projects ----
const projects = Router()
projects.get('/', projectC.list)
projects.post('/', validate({ body: v.project.create }), projectC.create)
projects.get('/:id', id, projectC.get)
projects.patch('/:id', id, validate({ body: v.project.patch }), projectC.patch)
projects.post('/:id/archive', id, projectC.setArchived)
projects.post('/:id/restore', id, projectC.setArchived)
projects.post('/:id/duplicate', id, validate({ body: v.project.duplicate }), projectC.duplicate)
projects.delete('/:id', id, validate({ query: v.project.remove }), projectC.remove)
api.use('/projects', projects)

// ---- day logs, settings, analytics, sync ----
api.get('/day-logs', validate({ query: v.dayLog.range }), misc.listDayLogs)
api.put('/day-logs/:date', validate({ params: v.dateParam, body: v.dayLog.put }), misc.putDayLog)
api.delete('/day-logs/:date', validate({ params: v.dateParam }), misc.deleteDayLog)
api.get('/settings', misc.getSettings)
api.put('/settings', validate({ body: v.settings.put }), misc.putSettings)
api.get('/analytics/summary', validate({ query: v.analytics }), misc.analytics)
api.get('/sync', misc.syncPull)
api.post('/sync/push', validate({ body: v.syncPush }), misc.syncPush)
api.get('/sync/summary', misc.syncSummary)
api.get('/sync/export', misc.exportAll)
api.post('/sync/import', validate({ body: v.syncImport }), misc.importAll)

export default api
