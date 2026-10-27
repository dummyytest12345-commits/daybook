import { beforeEach, describe, expect, it, vi } from 'vitest'
import { T } from './helpers'
import { defaultSettings } from '../schemas/settings'
import { openRepository } from '../services/repository'
import { useStore } from '../store/useStore'
import { clearMeta, loadMeta, pendingCount, saveMeta, updateMeta } from '../sync/meta'
import { markEverything, startTracking } from '../sync/tracker'
import { taskFromWire, taskToWire, tombstone, projectFromWire, settingsFromWire } from '../sync/wire'

const UID = 'sync-user'
const st = () => useStore.getState()
const reset = () => {
  localStorage.clear()
  openRepository(UID)
  useStore.setState({ userId: UID, ready: true, tasks: [], projects: [], dayLogs: {}, settings: defaultSettings(), recurring: [], views: [], undoStack: [], redoStack: [], activity: [] })
}

describe('wire conversion', () => {
  it('local -> server: the later of the record time and the time the change was noticed wins', () => {
    expect(taskToWire({ id: 'a', updatedAt: '2026-01-01T00:00:00.000Z' }, '2026-02-01T00:00:00.000Z').updatedAt).toBe('2026-02-01T00:00:00.000Z')
    expect(taskToWire({ id: 'a', updatedAt: '2026-03-01T00:00:00.000Z' }, '2026-02-01T00:00:00.000Z').updatedAt).toBe('2026-03-01T00:00:00.000Z')
    expect(tombstone('x', 'T')).toEqual({ id: 'x', deleted: true, updatedAt: 'T' })
  })
  it('server -> local: nulls become missing so the local schemas accept the record', () => {
    const t = taskFromWire({ id: 'a', title: 'x', projectId: null, dueDate: null, completedAt: null, deletedAt: null, timerStartedAt: null, updatedAt: '2026-01-01T00:00:00.000Z' })
    expect(t).not.toHaveProperty('projectId')
    expect(t).not.toHaveProperty('dueDate')
    expect(t.deletedAt).toBeNull()
    const p = projectFromWire({ id: 'p', description: null, archivedAt: null, deletedAt: '2026-01-01T00:00:00.000Z' })
    expect(p).not.toHaveProperty('description')
    expect(p.deletedAt).toBe('2026-01-01T00:00:00.000Z')
    const s = settingsFromWire({ dailyCapacity: 6, recurring: [{ id: 'r' }], views: [], createdAt: 'x', updatedAt: '2026-01-01T00:00:00.000Z' })
    expect(s.settings).toEqual({ dailyCapacity: 6 })
    expect(s.recurring).toHaveLength(1)
  })
})

describe('change tracker', () => {
  beforeEach(() => {
    reset()
    startTracking()
    // the tracker keeps the previous state; give it a baseline
    useStore.setState({ tasks: [] })
    clearMeta(UID) // drop what the baseline reset itself recorded
  })

  it('records adds, edits, deletes, undo and settings as waiting to sync', () => {
    const t = st().addTask({ title: 'A', date: '2026-09-07' })
    let m = loadMeta(UID)
    expect(Object.keys(m.dirty.tasks)).toEqual([t.id])
    updateMeta(UID, (x) => ({ ...x, dirty: { ...x.dirty, tasks: {} } })) // pretend synced
    st().updateTask(t.id, { title: 'B' })
    expect(Object.keys(loadMeta(UID).dirty.tasks)).toEqual([t.id])
    updateMeta(UID, (x) => ({ ...x, dirty: { ...x.dirty, tasks: {} } }))
    st().removeTask(t.id) // soft delete = an edit of the record
    expect(Object.keys(loadMeta(UID).dirty.tasks)).toEqual([t.id])
    updateMeta(UID, (x) => ({ ...x, dirty: { ...x.dirty, tasks: {} } }))
    st().undo()
    expect(Object.keys(loadMeta(UID).dirty.tasks)).toEqual([t.id])
    st().saveSettings({ dailyCapacity: 6 })
    m = loadMeta(UID)
    expect(m.dirty.settings).toBeTruthy()
    expect(pendingCount(m)).toBe(2)
  })

  it('a hard removal becomes a tombstone entry', () => {
    const t = st().addTask({ title: 'A', date: '2026-09-07' })
    updateMeta(UID, (x) => ({ ...x, dirty: { ...x.dirty, tasks: {} } }))
    useStore.setState({ tasks: [] }) // e.g. an import in "replace" mode
    const m = loadMeta(UID)
    expect(m.removed.tasks).toEqual([t.id])
    expect(m.dirty.tasks[t.id]).toBeTruthy()
  })

  it('data coming from the server or another tab is not recorded as a local edit', () => {
    st().applyRemote({ tasks: [{ id: 'srv1', date: '2026-09-07', title: 'From server', status: 'pending', order: 0, createdAt: '2026-09-07T00:00:00.000Z', updatedAt: '2026-09-07T00:00:00.000Z', deletedAt: null, projectId: null }] })
    expect(st().tasks.map((t) => t.id)).toEqual(['srv1'])
    expect(pendingCount(loadMeta(UID))).toBe(0)
  })

  it('markEverything marks the whole existing local dataset (first time sync is turned on)', () => {
    useStore.setState({ tasks: [T({ id: 'x1' }), T({ id: 'x2' })], projects: [], dayLogs: { '2026-09-07': { date: '2026-09-07', capacityHours: 8 } } })
    clearMeta(UID)
    const m = markEverything(UID)
    expect(Object.keys(m.dirty.tasks).sort()).toEqual(['x1', 'x2'])
    expect(m.dirty.dayLogs['2026-09-07']).toBeTruthy()
    expect(m.initialized).toBe(true)
  })
})

describe('merging the server data (applyRemote)', () => {
  beforeEach(reset)
  const remote = (o) => ({ id: 'r1', date: '2026-09-07', title: 'remote', status: 'pending', order: 0, createdAt: '2026-09-07T00:00:00.000Z', updatedAt: '2026-09-08T00:00:00.000Z', deletedAt: null, projectId: null, ...o })

  it('adds new tasks, replaces known ones, skips deletions of tasks it never had', () => {
    st().applyRemote({ tasks: [remote(), remote({ id: 'gone', deletedAt: '2026-09-08T00:00:00.000Z' })] })
    expect(st().tasks.map((t) => t.id)).toEqual(['r1'])
    st().applyRemote({ tasks: [remote({ title: 'edited elsewhere' })] })
    expect(st().tasks[0].title).toBe('edited elsewhere')
    st().applyRemote({ tasks: [remote({ deletedAt: '2026-09-09T00:00:00.000Z' })] })
    expect(st().tasks[0].deletedAt).toBeTruthy() // the delete arrives as a soft delete
  })

  it('keeps a local edit made while the request was in flight', () => {
    st().applyRemote({ tasks: [remote()] })
    st().applyRemote({ tasks: [remote({ title: 'server version' })] }, { tasks: { r1: '2026-09-09T00:00:00.000Z' } })
    expect(st().tasks[0].title).toBe('remote') // pending local change wins and uploads next time
  })

  it('merges projects, day logs and settings (with recurring and views)', () => {
    st().applyRemote({
      projects: [{ id: 'p1', name: 'Web', key: 'WEB', color: '#111', icon: 'globe', status: 'active', favorite: false, wipLimits: {}, nextNumber: 2, archivedAt: null, deletedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', description: null }],
      dayLogs: [{ date: '2026-09-08', dayType: 'leave', capacityHours: 0, updatedAt: '2026-09-08T00:00:00.000Z' }],
      settings: { dailyCapacity: 6, recurring: [{ id: 'r', title: 'Standup', weekdays: [1], active: true }], views: [], updatedAt: '2026-09-08T00:00:00.000Z' },
    })
    expect(st().projects[0]).toMatchObject({ key: 'WEB' })
    expect(st().dayLogs['2026-09-08'].dayType).toBe('leave')
    expect(st().settings.dailyCapacity).toBe(6)
    expect(st().recurring[0].title).toBe('Standup')
  })

  it('clears the undo history (undo must not silently revert somebody else’s change)', () => {
    st().addTask({ title: 'mine', date: '2026-09-07' })
    expect(st().undoStack.length).toBe(1)
    st().applyRemote({ tasks: [remote()] })
    expect(st().undoStack).toHaveLength(0)
  })

  it('purges old tombstones but keeps recent ones', () => {
    const old = new Date(Date.now() - 40 * 864e5).toISOString()
    useStore.setState({ tasks: [T({ id: 'o', deletedAt: old }), T({ id: 'n', deletedAt: new Date().toISOString() }), T({ id: 'l' })] })
    expect(st().purgeTombstones(30)).toBe(1)
    expect(st().tasks.map((t) => t.id).sort()).toEqual(['l', 'n'])
  })

  it('wipeLocal clears this user’s stored data', async () => {
    st().addTask({ title: 'x', date: '2026-09-07' })
    st().flushForTest?.()
    await st().wipeLocal()
    expect(st().tasks).toHaveLength(0)
    expect(Object.keys(localStorage).filter((k) => k.endsWith(':tasks') && localStorage.getItem(k) !== '[]' && localStorage.getItem(k))).toEqual([])
  })
})

// ------------------------------------------------------------------ the engine with a mocked server
const calls = []
let serverReply
let meUser = { id: 'cloud-1' }
vi.mock('../team/api', () => ({
  API_URL: 'http://api.test',
  ApiError: class ApiError extends Error { constructor(m, status) { super(m); this.status = status } },
  loadCloud: () => null,
  saveCloud: () => {},
  setCloudScope: () => {},
  setSocketId: () => {},
  api: {
    get: vi.fn(async (path) => { calls.push(['GET', path]); if (path === '/api/auth/me') return { user: meUser }; if (path === '/api/sync/summary') return serverReply.summary; throw new Error(path) }),
    post: vi.fn(async (path, body) => { calls.push(['POST', path, body]); return serverReply.push(body) }),
  },
}))

describe('sync engine', () => {
  beforeEach(async () => {
    reset()
    calls.length = 0
    meUser = { id: 'cloud-1' }
    serverReply = { push: () => ({ serverTime: '2026-09-10T00:00:00.000Z', applied: {}, stale: {}, rejected: [], changes: { tasks: [], projects: [], dayLogs: [], settings: null } }), summary: { taskIds: [], projects: 0 } }
    const { useTeam } = await import('../team/useTeam')
    useTeam.setState({ cloud: { token: 't', user: { id: 'cloud-1', name: 'C', email: 'c@x.co' } } })
  })

  it('first sync uploads everything that exists, then only what changed', async () => {
    const { useSync } = await import('../sync/useSync')
    const a = st().addTask({ title: 'Existing', date: '2026-09-07' })
    useSync.getState().start(UID)
    useSync.setState({ connection: 'online' })
    await useSync.getState().syncNow({ reason: 'connect' })
    const first = calls.find((c) => c[1] === '/api/sync/push')[2]
    expect(first.tasks.map((t) => t.id)).toEqual([a.id])
    expect(first.since).toBeNull()
    expect(useSync.getState().pending).toBe(0)
    expect(loadMeta(UID).since).toBe('2026-09-10T00:00:00.000Z')

    calls.length = 0
    st().updateTask(a.id, { title: 'Edited' })
    await useSync.getState().syncNow({ reason: 'change' })
    const second = calls.find((c) => c[1] === '/api/sync/push')[2]
    expect(second.since).toBe('2026-09-10T00:00:00.000Z')
    expect(second.tasks).toHaveLength(1)
    expect(second.tasks[0].title).toBe('Edited')
    useSync.getState().stop()
  })

  it('does nothing offline, keeps the changes, and uploads them after reconnecting', async () => {
    const { useSync } = await import('../sync/useSync')
    useSync.getState().start(UID)
    useSync.setState({ connection: 'offline' })
    st().addTask({ title: 'Offline 1', date: '2026-09-07' })
    st().addTask({ title: 'Offline 2', date: '2026-09-07' })
    expect(await useSync.getState().syncNow()).toEqual({ skipped: 'offline' })
    expect(calls).toHaveLength(0)
    expect(useSync.getState().pending).toBeGreaterThanOrEqual(2)
    useSync.setState({ connection: 'online' })
    await useSync.getState().syncNow({ reason: 'reconnect' })
    const body = calls.find((c) => c[1] === '/api/sync/push')[2]
    expect(body.tasks.map((t) => t.title).sort()).toEqual(['Offline 1', 'Offline 2'])
    expect(useSync.getState().pending).toBe(0)
    useSync.getState().stop()
  })

  it('checks the session first on every sync (before sending any data)', async () => {
    const { useSync } = await import('../sync/useSync')
    useSync.getState().start(UID)
    useSync.setState({ connection: 'online' })
    st().addTask({ title: 'x', date: '2026-09-07' })
    await useSync.getState().syncNow()
    const order = calls.map((c) => c[1])
    expect(order.indexOf('/api/auth/me')).toBeGreaterThanOrEqual(0)
    expect(order.indexOf('/api/auth/me')).toBeLessThan(order.indexOf('/api/sync/push'))
    useSync.getState().stop()
  })

  it('a session for a different server account is rejected without uploading', async () => {
    const { useSync } = await import('../sync/useSync')
    const lost = vi.fn()
    window.addEventListener('daybook:auth-lost', lost)
    meUser = { id: 'someone-else' }
    useSync.getState().start(UID)
    useSync.setState({ connection: 'online' })
    st().addTask({ title: 'x', date: '2026-09-07' })
    const r = await useSync.getState().syncNow()
    expect(r).toEqual({ skipped: 'auth' })
    expect(calls.some((c) => c[1] === '/api/sync/push')).toBe(false)
    expect(lost).toHaveBeenCalled()
    window.removeEventListener('daybook:auth-lost', lost)
    useSync.getState().stop()
  })

  it('merges what the server returns and records rejected items', async () => {
    const { useSync } = await import('../sync/useSync')
    serverReply.push = () => ({
      serverTime: '2026-09-11T00:00:00.000Z', applied: {}, stale: {}, rejected: [{ kind: 'task', id: 'bad', reason: 'invalid' }],
      changes: { tasks: [{ id: 'from-other-device', date: '2026-09-07', title: 'Other device', status: 'pending', order: 0, createdAt: '2026-09-07T00:00:00.000Z', updatedAt: '2026-09-10T00:00:00.000Z', deletedAt: null, projectId: null }], projects: [], dayLogs: [], settings: null },
    })
    useSync.getState().start(UID)
    useSync.setState({ connection: 'online' })
    await useSync.getState().syncNow({ reason: 'manual' })
    expect(st().tasks.map((t) => t.title)).toContain('Other device')
    expect(useSync.getState().lastResult.rejected).toHaveLength(1)
    expect(useSync.getState().pending).toBe(0) // pulling does not create a pending change
    useSync.getState().stop()
  })

  it('a different cloud account starts from scratch (everything is uploaded to it)', async () => {
    const { useSync } = await import('../sync/useSync')
    st().addTask({ title: 'Mine', date: '2026-09-07' })
    saveMeta(UID, { ...loadMeta(UID), cloudUserId: 'old-account', since: '2026-01-01T00:00:00.000Z', initialized: true })
    useSync.getState().start(UID)
    useSync.setState({ connection: 'online' })
    await useSync.getState().syncNow()
    const body = calls.find((c) => c[1] === '/api/sync/push')[2]
    expect(body.since).toBeNull()
    expect(body.tasks).toHaveLength(1)
    useSync.getState().stop()
  })

  it('clearing the device copy is refused unless the server verifiably holds everything', async () => {
    const { useSync } = await import('../sync/useSync')
    const a = st().addTask({ title: 'Only local', date: '2026-09-07' })
    useSync.getState().start(UID)
    useSync.setState({ connection: 'online' })
    serverReply.summary = { taskIds: [], projects: 0 } // the server does NOT have it
    await expect(useSync.getState().resetDeviceCopy()).rejects.toThrow(/does not hold all/)
    expect(st().tasks.some((t) => t.id === a.id)).toBe(true) // nothing was removed
    serverReply.summary = { taskIds: [a.id], projects: 0 }
    serverReply.push = () => ({ serverTime: '2026-09-12T00:00:00.000Z', applied: {}, stale: {}, rejected: [], changes: { tasks: [{ id: a.id, date: '2026-09-07', title: 'Only local', status: 'pending', order: 0, createdAt: '2026-09-07T00:00:00.000Z', updatedAt: '2026-09-07T00:00:00.000Z', deletedAt: null, projectId: null }], projects: [], dayLogs: [], settings: null } })
    const r = await useSync.getState().resetDeviceCopy()
    expect(r.restored).toBe(1) // wiped, then pulled back from the server
    useSync.getState().stop()
  })
})
