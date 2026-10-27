import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { api, connectSocket, hasDb, makeUser, startTestServer, stopTestServer, waitFor } from './helpers.js'

const run = hasDb ? describe : describe.skip
const iso = (offsetMs = 0) => new Date(Date.now() + offsetMs).toISOString()
const task = (o = {}) => ({ id: `t${Math.random().toString(36).slice(2, 10)}`, date: '2026-09-07', title: 'Offline task', status: 'pending', order: 0, createdAt: iso(-5000), updatedAt: iso(-1000), deletedAt: null, ...o })

run('offline sync (delta push / pull, last write wins)', () => {
  beforeAll(() => startTestServer())
  afterAll(() => stopTestServer())

  const push = (u, body) => api().post('/api/sync/push').set(u.h).send({ since: null, ...body })

  it('requires auth and validates the body', async () => {
    expect((await api().post('/api/sync/push').send({})).status).toBe(401)
    const u = await makeUser('syncv')
    expect((await push(u, { since: 'not-a-date' })).status).toBe(400)
    expect((await push(u, { tasks: 'nope' })).status).toBe(400)
  })

  it('uploads tasks created offline and keeps their original timestamps and fields', async () => {
    const u = await makeUser('up')
    const t = task({ title: 'Written offline', progress: 40, status: 'in_progress', tags: ['a'], updates: [{ id: 'u1', at: iso(-3000), text: 'note' }], subtasks: [{ id: 's1', title: 'step', done: true }], threadId: 'th1', carriedFrom: '2026-09-04', autoCarried: true })
    const r = await push(u, { tasks: [t] })
    expect(r.status).toBe(200)
    expect(r.body.applied.tasks).toBe(1)
    expect(r.body.rejected).toEqual([])
    const got = (await api().get('/api/tasks').set(u.h)).body.tasks[0]
    expect(got).toMatchObject({ id: t.id, title: 'Written offline', progress: 40, status: 'in_progress', tags: ['a'], threadId: 'th1', carriedFrom: '2026-09-04', autoCarried: true })
    expect(got.updates[0]).toMatchObject({ id: 'u1', text: 'note' })
    expect(got.subtasks[0]).toMatchObject({ id: 's1', done: true })
    expect(new Date(got.createdAt).toISOString()).toBe(t.createdAt) // the device's createdAt is preserved
  })

  it('is idempotent: sending the same changes twice changes nothing and creates no duplicates', async () => {
    const u = await makeUser('idem')
    const t = task()
    await push(u, { tasks: [t] })
    const again = await push(u, { tasks: [t] })
    expect(again.body.applied.tasks).toBe(1)
    expect((await api().get('/api/tasks').set(u.h)).body.count).toBe(1)
  })

  it('last write wins: a newer device edit replaces the server copy, a stale one is ignored', async () => {
    const u = await makeUser('lww')
    const t = task({ title: 'v1', updatedAt: iso(-60000) })
    await push(u, { tasks: [t] })
    const newer = await push(u, { tasks: [{ ...t, title: 'v2 newer', updatedAt: iso(-30000) }] })
    expect(newer.body.applied.tasks).toBe(1)
    const stale = await push(u, { tasks: [{ ...t, title: 'v0 stale', updatedAt: iso(-50000) }] })
    expect(stale.body.applied.tasks).toBe(0)
    expect(stale.body.stale.tasks).toEqual([t.id])
    expect((await api().get(`/api/tasks/${t.id}`).set(u.h)).body.task.title).toBe('v2 newer')
  })

  it('a device clock running far ahead cannot win every future conflict', async () => {
    const u = await makeUser('skew')
    const t = task({ updatedAt: iso(10 * 24 * 3600 * 1000) }) // 10 days in the future
    await push(u, { tasks: [t] })
    const fix = await push(u, { tasks: [{ ...t, title: 'corrected', updatedAt: iso(60 * 1000) }] })
    expect(fix.body.applied.tasks).toBe(1)
  })

  it('deletions propagate to the other device as soft deletes', async () => {
    const u = await makeUser('del')
    const t = task()
    const first = await push(u, { tasks: [t] })
    await push(u, { since: first.body.serverTime, tasks: [{ ...t, deletedAt: iso(), updatedAt: iso() }] })
    const pull = await push(u, { since: first.body.serverTime }) // another device pulls
    expect(pull.body.changes.tasks.find((x) => x.id === t.id).deletedAt).toBeTruthy()
    expect((await api().get('/api/tasks').set(u.h)).body.count).toBe(0)
  })

  it('two devices: edits from device A reach device B and are not echoed back to A', async () => {
    const u = await makeUser('dev')
    const a = await push(u, { tasks: [task({ title: 'from A' })] })
    expect(a.body.changes.tasks).toEqual([])
    const b = await push(u, { since: null })
    expect(b.body.changes.tasks.map((t) => t.title)).toEqual(['from A'])
    const bPush = await push(u, { since: b.body.serverTime, tasks: [task({ title: 'from B' })] })
    const aPull = await push(u, { since: a.body.serverTime })
    expect(aPull.body.changes.tasks.map((t) => t.title)).toEqual(['from B'])
    expect(bPush.body.changes.tasks).toEqual([])
  })

  it('projects, day logs and settings sync too, with last write wins on settings', async () => {
    const u = await makeUser('all')
    const p = { id: 'proj1', name: 'Website', key: 'WEB', color: '#111111', icon: 'globe', status: 'active', nextNumber: 4, wipLimits: { in_progress: 2 }, createdAt: iso(-9000), updatedAt: iso(-5000) }
    const r = await push(u, {
      projects: [p], tasks: [task({ projectId: 'proj1', number: 3 })],
      dayLogs: [{ date: '2026-09-08', dayType: 'leave', capacityHours: 0, note: 'Trip', updatedAt: iso(-2000) }, { date: 'bad', dayType: 'work' }],
      settings: { dailyCapacity: 6, modules: ['A'], theme: 'dark', schemaVersion: 2, recurring: [{ id: 'r1', title: 'Standup', weekdays: [1, 2], active: true }] }, settingsUpdatedAt: iso(-3000),
    })
    expect(r.body.applied).toMatchObject({ projects: 1, tasks: 1, dayLogs: 1, settings: true })
    expect((await api().get('/api/projects/proj1').set(u.h)).body.project).toMatchObject({ key: 'WEB', nextNumber: 4, wipLimits: { in_progress: 2 } })
    expect((await api().get('/api/day-logs').set(u.h)).body.dayLogs[0]).toMatchObject({ date: '2026-09-08', dayType: 'leave', note: 'Trip' })
    const s = (await api().get('/api/settings').set(u.h)).body.settings
    expect(s).toMatchObject({ dailyCapacity: 6, modules: ['A'] })
    expect(s.recurring[0].title).toBe('Standup')
    const stale = await push(u, { settings: { dailyCapacity: 3 }, settingsUpdatedAt: iso(-20000) })
    expect(stale.body.applied.settings).toBe(false)
    expect(stale.body.stale.settings).toBe(true)
  })

  it('rejects bad items individually without failing the push and never touches another account', async () => {
    const owner = await makeUser('own')
    const other = await makeUser('oth')
    const mine = task({ title: 'Owner task' })
    await push(owner, { tasks: [mine] })
    const good = task({ title: 'Good one' })
    const r = await push(other, { tasks: [good, { id: 'bad1', date: 'nope', title: 'x' }, { id: 'bad2', date: '2026-09-07', title: '' }, { ...mine, title: 'hijack', updatedAt: iso() }, { title: 'no id', date: '2026-09-07' }] })
    expect(r.status).toBe(200)
    expect(r.body.applied.tasks).toBe(1)
    expect(r.body.rejected.map((x) => x.id)).toEqual(expect.arrayContaining(['bad1', 'bad2', mine.id]))
    expect(r.body.rejected.find((x) => x.id === mine.id).reason).toMatch(/another account/)
    expect((await api().get(`/api/tasks/${mine.id}`).set(owner.h)).body.task.title).toBe('Owner task')
    expect((await api().get('/api/tasks').set(other.h)).body.count).toBe(1)
  })

  it('summary reports what the server holds (used before the device clears its local copy)', async () => {
    const u = await makeUser('sum')
    const [a, b] = [task(), task()]
    await push(u, { tasks: [a, b, task({ deletedAt: iso(), updatedAt: iso() })], projects: [{ id: 'sp', name: 'P', key: 'PP', createdAt: iso(-100), updatedAt: iso(-50) }] })
    const s = (await api().get('/api/sync/summary').set(u.h)).body
    expect(s).toMatchObject({ tasks: 2, projects: 1, dayLogs: 0 })
    expect(s.taskIds.sort()).toEqual([a.id, b.id].sort())
    expect((await api().get('/api/sync/summary')).status).toBe(401)
  })

  it('tells the other connected devices to resync, but not the sender', async () => {
    const u = await makeUser('rs')
    const phone = await connectSocket(u.token)
    const laptop = await connectSocket(u.token)
    let echoed = false
    laptop.socket.on('resync', () => (echoed = true))
    const got = waitFor(phone.socket, 'resync')
    await api().post('/api/sync/push').set({ ...u.h, 'x-socket-id': laptop.info.socketId }).send({ tasks: [task()] })
    expect(await got).toMatchObject({ reason: 'sync' })
    await new Promise((r) => setTimeout(r, 250))
    expect(echoed).toBe(false)
    phone.socket.close()
    laptop.socket.close()
  })

  it('clearing a field on the device clears it on the server; a hard-removed item arrives as a tombstone; stale copies come back', async () => {
    const u = await makeUser('fields')
    const t = task({ dueDate: '2026-10-01', notes: 'keep?', updatedAt: iso(-40000) })
    await push(u, { tasks: [t] })
    const { dueDate, ...cleared } = { ...t, updatedAt: iso(-30000) }
    await push(u, { tasks: [cleared] })
    const got = (await api().get(`/api/tasks/${t.id}`).set(u.h)).body.task
    expect(got.dueDate).toBeUndefined()
    expect(got.notes).toBe('keep?')
    // tombstone: no other fields needed, an unknown id is ignored (never created)
    const r = await push(u, { tasks: [{ id: t.id, deleted: true, updatedAt: iso(-20000) }, { id: 'ghost', deleted: true, updatedAt: iso() }] })
    expect(r.status).toBe(200)
    expect((await api().get('/api/tasks').set(u.h)).body.count).toBe(0)
    expect((await api().get('/api/tasks?includeDeleted=true').set(u.h)).body.count).toBe(1)
    // a stale edit gets the server's newer copy back even when the device's `since` is very recent
    const v = task({ title: 'server newer', updatedAt: iso(-1000) })
    await push(u, { tasks: [v] })
    const stale = await push(u, { since: iso(60000), tasks: [{ ...v, title: 'old', updatedAt: iso(-90000) }] })
    expect(stale.body.stale.tasks).toEqual([v.id])
    expect(stale.body.changes.tasks.find((x) => x.id === v.id).title).toBe('server newer')
  })

  it('handles a large first upload (hundreds of tasks) in one push', async () => {
    const u = await makeUser('bulk')
    const tasks = Array.from({ length: 600 }, (_, i) => task({ title: `Task ${i}`, date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}` }))
    const r = await push(u, { tasks })
    expect(r.body.applied.tasks).toBe(600)
    expect((await api().get('/api/sync/summary').set(u.h)).body.tasks).toBe(600)
  })
})
