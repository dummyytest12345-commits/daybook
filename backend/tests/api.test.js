import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, connectSocket, hasDb, makeUser, startTestServer, stopTestServer, waitFor } from './helpers.js'
import { addDays, todayISO } from '../src/utils/dates.js'

const run = hasDb ? describe : describe.skip

run('API end to end (MongoDB Atlas test database)', () => {
  beforeAll(() => startTestServer())
  afterAll(() => stopTestServer())

  describe('health, auth and guards', () => {
    it('health and 404 / validation / auth errors share one JSON shape', async () => {
      expect((await api().get('/health')).body).toMatchObject({ status: 'ok', db: 'up' })
      expect((await api().get('/nope')).status).toBe(404)
      expect((await api().get('/api/tasks/x/y/z')).status).toBe(401) // private area needs a token first
      const r = await api().get('/api/tasks')
      expect(r.status).toBe(401)
      expect(r.body.error.message).toBeTruthy()
      expect((await api().get('/api/tasks').set('Authorization', 'Bearer garbage')).status).toBe(401)
      const bad = await api().post('/api/auth/register').send({ name: 'A', email: 'nope', password: '1' })
      expect(bad.status).toBe(400)
      expect(bad.body.error.details.length).toBeGreaterThan(0)
    })

    it('register, duplicate email, login, wrong password, me, profile, password change, delete', async () => {
      const u = await makeUser('auth')
      expect((await api().post('/api/auth/register').send({ name: 'Dup User', email: u.email.toUpperCase(), password: 'Passw0rd!x' })).status).toBe(409)
      expect((await api().post('/api/auth/login').send({ email: u.email, password: 'wrong-Pass1' })).status).toBe(401)
      const ok = await api().post('/api/auth/login').send({ email: u.email, password: u.password })
      expect(ok.status).toBe(200)
      expect(ok.body.user.passwordHash).toBeUndefined()
      expect((await api().get('/api/auth/me').set(u.h)).body.user.email).toBe(u.email)
      expect((await api().patch('/api/auth/me').set(u.h).send({ name: 'New Name' })).body.user.name).toBe('New Name')
      expect((await api().post('/api/auth/password').set(u.h).send({ current: 'bad', next: 'Another1pass' })).status).toBe(401)
      expect((await api().post('/api/auth/password').set(u.h).send({ current: u.password, next: 'Another1pass' })).status).toBe(200)
      expect((await api().post('/api/auth/login').send({ email: u.email, password: 'Another1pass' })).status).toBe(200)
      expect((await api().delete('/api/auth/me').set(u.h).send({ password: 'wrong' })).status).toBe(401)
      expect((await api().delete('/api/auth/me').set(u.h).send({ password: 'Another1pass' })).status).toBe(204)
      expect((await api().get('/api/auth/me').set(u.h)).status).toBe(401)
    })

    it('locks an account after repeated wrong passwords', async () => {
      const u = await makeUser('lock')
      for (let i = 0; i < 5; i++) await api().post('/api/auth/login').send({ email: u.email, password: 'wrong-Pass1' })
      const r = await api().post('/api/auth/login').send({ email: u.email, password: u.password })
      expect(r.status).toBe(429)
      expect(r.headers['retry-after']).toBeTruthy()
    })
  })

  describe('tasks and progress', () => {
    it('CRUD, validation, ownership isolation', async () => {
      const a = await makeUser('a')
      const b = await makeUser('b')
      const c = await api().post('/api/tasks').set(a.h).send({ title: 'Alice task', date: '2026-09-07', module: 'Profile', tags: ['x'] })
      expect(c.status).toBe(201)
      const id = c.body.task.id
      expect(c.body.task).toMatchObject({ status: 'pending', progress: 0, threadId: id })
      expect((await api().post('/api/tasks').set(a.h).send({ title: '', date: 'bad' })).status).toBe(400)
      expect((await api().get(`/api/tasks/${id}`).set(b.h)).status).toBe(404) // another user can't read it
      expect((await api().patch(`/api/tasks/${id}`).set(b.h).send({ title: 'hack' })).status).toBe(404)
      expect((await api().delete(`/api/tasks/${id}`).set(b.h)).status).toBe(404)
      const list = await api().get('/api/tasks?from=2026-09-01&to=2026-09-30&q=alice').set(a.h)
      expect(list.body.count).toBe(1)
      expect((await api().get('/api/tasks').set(b.h)).body.count).toBe(0)
      expect((await api().patch(`/api/tasks/${id}`).set(a.h).send({ title: 'Renamed', hours: 2 })).body.task).toMatchObject({ title: 'Renamed', hours: 2 })
      expect((await api().delete(`/api/tasks/${id}`).set(a.h)).status).toBe(200)
      expect((await api().get('/api/tasks').set(a.h)).body.count).toBe(0)
      expect((await api().post(`/api/tasks/${id}/restore`).set(a.h)).status).toBe(200)
      expect((await api().get('/api/tasks').set(a.h)).body.count).toBe(1)
    })

    it('progress: 0% when started, user updates, 100% on complete; 100 completes; leaving completed reopens', async () => {
      const u = await makeUser('prog')
      const { id } = (await api().post('/api/tasks').set(u.h).send({ title: 'P', date: '2026-09-07' })).body.task
      const patch = (b) => api().patch(`/api/tasks/${id}`).set(u.h).send(b)
      expect((await patch({ status: 'in_progress' })).body.task).toMatchObject({ status: 'in_progress', progress: 0 })
      expect((await api().put(`/api/tasks/${id}/progress`).set(u.h).send({ progress: 45 })).body.task.progress).toBe(45)
      expect((await api().put(`/api/tasks/${id}/progress`).set(u.h).send({ progress: 101 })).status).toBe(400)
      const done = (await patch({ status: 'completed' })).body.task
      expect(done).toMatchObject({ status: 'completed', progress: 100 })
      expect(done.completedAt).toBeTruthy()
      expect((await api().put(`/api/tasks/${id}/progress`).set(u.h).send({ progress: 60 })).body.task).toMatchObject({ status: 'in_progress', progress: 60, completedAt: null })
      expect((await api().put(`/api/tasks/${id}/progress`).set(u.h).send({ progress: 100 })).body.task.status).toBe('completed')
    })

    it('bulk create / patch / delete and the subtask + update (chat note) endpoints', async () => {
      const u = await makeUser('bulk')
      const r = await api().post('/api/tasks/bulk').set(u.h).send({ tasks: [{ title: 'One', date: '2026-09-07' }, { title: 'Two', date: '2026-09-07' }] })
      const ids = r.body.tasks.map((t) => t.id)
      expect(r.body.count).toBe(2)
      const p = await api().patch('/api/tasks/bulk').set(u.h).send({ ids, patch: { status: 'completed' } })
      expect(p.body.tasks.every((t) => t.status === 'completed' && t.progress === 100)).toBe(true)
      const up = await api().post(`/api/tasks/${ids[0]}/updates`).set(u.h).send({ text: ' waiting on design ' })
      expect(up.body.task.updates[0].text).toBe('waiting on design')
      const del = await api().delete(`/api/tasks/${ids[0]}/updates/${up.body.task.updates[0].id}`).set(u.h)
      expect(del.body.task.updates).toHaveLength(0)
      expect((await api().post('/api/tasks/bulk-delete').set(u.h).send({ ids })).body.removed).toHaveLength(2)
    })
  })

  describe('carry forward threads', () => {
    it('auto carry is idempotent, keeps progress, completing resolves earlier days, removing dismisses', async () => {
      const u = await makeUser('thread')
      const day1 = addDays(todayISO(), -3)
      const t = (await api().post('/api/tasks').set(u.h).send({ title: 'Long work', date: day1, status: 'in_progress' })).body.task
      await api().put(`/api/tasks/${t.id}/progress`).set(u.h).send({ progress: 60 })
      // run on a known working Monday after day1 for a deterministic result
      const monday = '2026-09-14'
      await api().patch(`/api/tasks/${t.id}`).set(u.h).send({ date: '2026-09-11' }) // Friday
      const first = await api().post('/api/tasks/carry-forward').set(u.h).send({ date: monday })
      expect(first.body.count).toBe(1)
      expect(first.body.created[0]).toMatchObject({ date: monday, progress: 60, carriedFrom: '2026-09-11', autoCarried: true, threadId: t.id })
      expect((await api().post('/api/tasks/carry-forward').set(u.h).send({ date: monday })).body.count).toBe(0)
      expect((await api().post('/api/tasks/carry-forward').set(u.h).send({ date: '2026-09-12' })).body.count).toBe(0) // Saturday
      const copy = first.body.created[0]
      const th = await api().get(`/api/tasks/${copy.id}/thread`).set(u.h)
      expect(th.body.days).toBe(2)
      const done = await api().patch(`/api/tasks/${copy.id}`).set(u.h).send({ status: 'completed' })
      expect(done.body.changed[0]).toMatchObject({ id: t.id, status: 'completed', progress: 100, resolvedBy: copy.id })
      // reopen reopens the day it resolved
      const re = await api().patch(`/api/tasks/${copy.id}`).set(u.h).send({ status: 'in_progress' })
      expect(re.body.changed[0]).toMatchObject({ id: t.id, status: 'pending', progress: 0 })
    })

    it('removing a carried copy stops it coming back; finish-on-another-day creates the row and trims later copies', async () => {
      const u = await makeUser('thread2')
      const t = (await api().post('/api/tasks').set(u.h).send({ title: 'Forgot', date: '2026-09-07' })).body.task
      const carried = (await api().post('/api/tasks/carry-forward').set(u.h).send({ date: '2026-09-08' })).body.created[0]
      await api().delete(`/api/tasks/${carried.id}`).set(u.h)
      expect((await api().get(`/api/tasks/${t.id}`).set(u.h)).body.task.carryDismissed).toBe(true)
      expect((await api().post('/api/tasks/carry-forward').set(u.h).send({ date: '2026-09-09' })).body.count).toBe(0)

      const x = (await api().post('/api/tasks').set(u.h).send({ title: 'Three days', date: '2026-09-07' })).body.task
      await api().post('/api/tasks/carry-forward').set(u.h).send({ date: '2026-09-08' })
      await api().post('/api/tasks/carry-forward').set(u.h).send({ date: '2026-09-09' })
      const fin = await api().post(`/api/tasks/${x.id}/finish`).set(u.h).send({ date: '2026-09-08' })
      expect(fin.status).toBe(200)
      expect(fin.body.task).toMatchObject({ date: '2026-09-08', status: 'completed', progress: 100 })
      expect(fin.body.removed).toHaveLength(1)
      expect((await api().post(`/api/tasks/${x.id}/finish`).set(u.h).send({ date: '2020-01-01' })).status).toBe(400)
    })
  })

  describe('projects', () => {
    it('keys, numbering, move between projects, WIP limits, archive, duplicate, delete keeps tasks', async () => {
      const u = await makeUser('proj')
      const web = (await api().post('/api/projects').set(u.h).send({ name: 'Website Redesign' })).body.project
      expect(web.key).toBe('WR')
      expect((await api().post('/api/projects').set(u.h).send({ name: 'Other', key: 'wr' })).status).toBe(409)
      const t1 = (await api().post('/api/tasks').set(u.h).send({ title: 'A', date: '2026-09-07', projectId: web.id })).body.task
      const t2 = (await api().post('/api/tasks').set(u.h).send({ title: 'B', date: '2026-09-07', projectId: web.id })).body.task
      expect([t1.number, t2.number]).toEqual([1, 2])
      expect((await api().post('/api/tasks').set(u.h).send({ title: 'C', date: '2026-09-07', projectId: 'nope' })).status).toBe(400)
      const api2 = (await api().post('/api/projects').set(u.h).send({ name: 'API', key: 'API' })).body.project
      const mv = await api().post('/api/tasks/move').set(u.h).send({ ids: [t1.id], projectId: api2.id })
      expect(mv.body.tasks[0]).toMatchObject({ projectId: api2.id, number: 1 })
      expect((await api().post('/api/tasks/move').set(u.h).send({ ids: [t1.id], projectId: null })).body.tasks[0].projectId).toBeNull()
      const wip = await api().patch(`/api/projects/${web.id}`).set(u.h).send({ wipLimits: { in_progress: 3 } })
      expect(wip.body.project.wipLimits).toEqual({ in_progress: 3 })
      await api().put(`/api/tasks/${t2.id}/progress`).set(u.h).send({ progress: 50 })
      const got = (await api().get(`/api/projects/${web.id}`).set(u.h)).body.project
      expect(got.stats).toMatchObject({ total: 1, inProgress: 1, avgProgress: 50 })
      expect((await api().post(`/api/projects/${web.id}/archive`).set(u.h)).body.project.archivedAt).toBeTruthy()
      expect((await api().post(`/api/projects/${web.id}/restore`).set(u.h)).body.project.archivedAt).toBeNull()
      const dup = await api().post(`/api/projects/${web.id}/duplicate`).set(u.h).send({ withTasks: true })
      expect(dup.body.project.key).not.toBe('WR')
      expect(dup.body.tasks).toBe(1)
      const del = await api().delete(`/api/projects/${web.id}?mode=unassign`).set(u.h)
      expect(del.body.tasks).toBe(1)
      expect((await api().get(`/api/tasks/${t2.id}`).set(u.h)).body.task.projectId).toBeNull()
      expect((await api().get(`/api/projects/${web.id}`).set(u.h)).status).toBe(404)
    })
  })

  describe('analytics, day logs, settings, sync', () => {
    it('analytics include progress statistics', async () => {
      const u = await makeUser('stats')
      for (const [title, status, progress] of [['a', 'completed'], ['b', 'in_progress', 40], ['c', 'in_progress', 80], ['d', 'pending']]) {
        const t = (await api().post('/api/tasks').set(u.h).send({ title, date: '2026-09-07', status })).body.task
        if (progress != null) await api().put(`/api/tasks/${t.id}/progress`).set(u.h).send({ progress })
      }
      const r = (await api().get('/api/analytics/summary?from=2026-09-01&to=2026-09-30').set(u.h)).body
      expect(r).toMatchObject({ total: 4, completed: 1, openCount: 3 })
      expect(r.avgProgress).toBe(55) // (100 + 40 + 80 + 0) / 4
      expect(r.avgOpenProgress).toBe(40) // (40 + 80 + 0) / 3
      expect(r.progressBuckets.find((b) => b.bucket === '0-24%').count).toBe(1)
      expect(r.byDay[0]).toMatchObject({ date: '2026-09-07', total: 4, completed: 1 })
      expect((await api().get('/api/analytics/summary').set(u.h)).status).toBe(400)
    })

    it('day logs and settings', async () => {
      const u = await makeUser('cfg')
      expect((await api().put('/api/day-logs/2026-09-08').set(u.h).send({ dayType: 'leave', note: 'Trip' })).body.dayLog).toMatchObject({ dayType: 'leave', note: 'Trip', capacityHours: 8 })
      expect((await api().put('/api/day-logs/2026-09-08').set(u.h).send({ dayType: null })).body.dayLog.dayType).toBeUndefined()
      expect((await api().put('/api/day-logs/bad-date').set(u.h).send({})).status).toBe(400)
      expect((await api().get('/api/day-logs?from=2026-09-01&to=2026-09-30').set(u.h)).body.dayLogs).toHaveLength(1)
      const s = await api().put('/api/settings').set(u.h).send({ dailyCapacity: 6, modules: ['A', 'B'], holidays: [{ date: '2026-09-09', name: 'Holiday' }] })
      expect(s.body.settings).toMatchObject({ dailyCapacity: 6, modules: ['A', 'B'], autoCarry: true, threadResolve: 'all' })
      expect((await api().put('/api/settings').set(u.h).send({ dailyCapacity: 99 })).status).toBe(400)
      expect((await api().put('/api/settings').set(u.h).send({ hack: 1 })).status).toBe(400)
      // a holiday blocks auto carry
      await api().post('/api/tasks').set(u.h).send({ title: 'x', date: '2026-09-08' })
      expect((await api().post('/api/tasks/carry-forward').set(u.h).send({ date: '2026-09-09' })).body.count).toBe(0)
    })

    it('export, import (merge and replace) and incremental sync', async () => {
      const u = await makeUser('sync')
      const p = (await api().post('/api/projects').set(u.h).send({ name: 'Data' })).body.project
      await api().post('/api/tasks').set(u.h).send({ title: 'Keep', date: '2026-09-07', projectId: p.id })
      const backup = (await api().get('/api/sync/export').set(u.h)).body
      expect(backup).toMatchObject({ app: 'daybook' })
      expect(backup.tasks).toHaveLength(1)
      const other = await makeUser('sync2')
      const imp = await api().post('/api/sync/import').set(other.h).send({ mode: 'replace', tasks: [...backup.tasks, { title: '', date: 'bad' }], projects: backup.projects, dayLogs: [], settings: backup.settings })
      expect(imp.status).toBe(200)
      expect(imp.body.skipped).toHaveLength(1)
      expect((await api().get('/api/tasks').set(other.h)).body.count).toBe(1)
      expect((await api().get('/api/tasks').set(u.h)).body.count).toBe(1) // original untouched
      const before = new Date().toISOString()
      await new Promise((r) => setTimeout(r, 20))
      const t = (await api().post('/api/tasks').set(u.h).send({ title: 'New', date: '2026-09-08' })).body.task
      await api().delete(`/api/tasks/${t.id}`).set(u.h)
      const pull = (await api().get(`/api/sync?since=${before}`).set(u.h)).body
      expect(pull.tasks.find((x) => x.id === t.id).deletedAt).toBeTruthy() // deletions are synced
      expect(pull.tasks.find((x) => x.title === 'Keep')).toBeUndefined()
    })
  })

  describe('real-time sockets', () => {
    it('rejects bad tokens, pushes changes to the user’s other devices, not to other users', async () => {
      await expect(connectSocket('garbage')).rejects.toThrow()
      const u = await makeUser('rt')
      const other = await makeUser('rt2')
      const phone = await connectSocket(u.token)
      const laptop = await connectSocket(u.token)
      const stranger = await connectSocket(other.token)
      let leaked = false
      stranger.socket.on('changes', () => (leaked = true))
      const got = waitFor(phone.socket, 'changes')
      const own = []
      laptop.socket.on('changes', (c) => own.push(c))
      const r = await api().post('/api/tasks').set({ ...u.h, 'x-socket-id': laptop.info.socketId }).send({ title: 'Live', date: '2026-09-07' })
      const change = await got
      expect(change.tasksUpserted[0]).toMatchObject({ id: r.body.task.id, title: 'Live' })
      await new Promise((r2) => setTimeout(r2, 300))
      expect(own).toHaveLength(0) // the sender is skipped
      expect(leaked).toBe(false)
      const prog = waitFor(phone.socket, 'changes')
      await api().put(`/api/tasks/${r.body.task.id}/progress`).set(u.h).send({ progress: 25 })
      expect((await prog).tasksUpserted[0]).toMatchObject({ progress: 25, status: 'in_progress' })
      ;[phone, laptop, stranger].forEach((s) => s.socket.close())
    })
  })
})
