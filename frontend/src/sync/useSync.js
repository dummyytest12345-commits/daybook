import { toast } from 'sonner'
import { create } from 'zustand'
import { goHome } from '../app/nav'
import { useAuth } from '../store/useAuth'
import { useStore } from '../store/useStore'
import { API_URL, ApiError, api } from '../team/api'
import { useTeam } from '../team/useTeam'
import { clearMeta, loadMeta, pendingCount, resetForNewAccount, saveMeta, updateMeta } from './meta'
import { markEverything, onPendingChange, startTracking } from './tracker'
import { dayLogToWire, projectToWire, settingsToWire, taskToWire, tombstone } from './wire'

/**
 * Offline-first sync. The app always works from the device (localStorage). When Daybook Cloud is connected:
 *  - every change is recorded (tracker.js) and uploaded when the connection allows it
 *  - on reconnect the session is re-verified FIRST: an expired/invalid session sends the user to the landing page
 *    (nothing is lost: the unsynced changes stay on the device and upload after the next sign-in)
 *  - the server's newer changes (from other devices) are merged in; the newest edit wins per item
 *  - once everything is on the server, the device copy can be cleared on sign-out or on demand
 */
const CHUNK = 1000
const DEBOUNCE_MS = 2500
const POLL_MS = 45_000
const RETRY_MS = 15_000
const TOMBSTONE_DAYS = 30

async function ping() {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 4000)
  try {
    const r = await fetch(`${API_URL}/health`, { cache: 'no-store', signal: ctrl.signal })
    return r.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

let userId = null
let timers = { debounce: null, poll: null, retry: null, banner: null }
let running = false
let rerun = false
let started = false
let unsubs = []

const cloud = () => useTeam.getState().cloud

export const useSync = create((set, get) => ({
  /** 'online' | 'offline' (browser has no network) | 'server-down' (network is up, the API is not reachable) */
  connection: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online',
  status: 'off', // 'off' (no cloud) | 'idle' | 'syncing' | 'error'
  pending: 0,
  lastSyncedAt: null,
  lastError: null,
  lastResult: null, // { pushed, pulled, rejected: [...] }
  justReconnected: false,
  clearOnLogout: false,

  // ------------------------------------------------------------------ lifecycle
  /** Start for the signed-in user (called by the app shell). Safe to call again. */
  start(uid) {
    if (userId === uid && started) return
    get().stop()
    userId = uid
    started = true
    startTracking()
    const meta = loadMeta(uid)
    set({ pending: pendingCount(meta), lastSyncedAt: meta.lastSyncedAt, clearOnLogout: !!meta.clearOnLogout, status: cloud() ? 'idle' : 'off', lastError: null })

    const onOnline = () => get().onBrowserOnline()
    const onOffline = () => get().onBrowserOffline()
    const onVisible = () => { if (!document.hidden) get().check('focus') }
    const onResync = () => get().syncNow({ reason: 'remote' })
    const onAuthLost = () => get().authLost()
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('daybook:resync', onResync)
    window.addEventListener('daybook:auth-lost', onAuthLost)
    unsubs = [
      () => window.removeEventListener('online', onOnline),
      () => window.removeEventListener('offline', onOffline),
      () => document.removeEventListener('visibilitychange', onVisible),
      () => window.removeEventListener('daybook:resync', onResync),
      () => window.removeEventListener('daybook:auth-lost', onAuthLost),
      // every local change: update the counter and sync soon (debounced)
      onPendingChange((n) => {
        set({ pending: n })
        get().schedule()
      }),
      // the cloud connection came or went
      (() => {
        let prev = cloud()
        return useTeam.subscribe((s) => {
          if (s.cloud === prev) return
          prev = s.cloud
          set({ status: s.cloud ? 'idle' : 'off' })
          if (s.cloud) get().syncNow({ reason: 'connect' })
        })
      })(),
    ]
    timers.poll = setInterval(() => get().check('poll'), POLL_MS)
    if (navigator.onLine === false) set({ connection: 'offline' })
    if (cloud()) get().check('start')
  },

  stop() {
    unsubs.forEach((u) => u())
    unsubs = []
    Object.values(timers).forEach((t) => t && (clearTimeout(t), clearInterval(t)))
    timers = { debounce: null, poll: null, retry: null, banner: null }
    started = false
    userId = null
    set({ status: 'off', pending: 0, lastSyncedAt: null, lastError: null, lastResult: null, justReconnected: false })
  },

  // ------------------------------------------------------------------ connectivity
  onBrowserOffline() {
    set({ connection: 'offline' })
    clearTimeout(timers.retry)
  },

  /** The browser says the network is back. Verify the session first, then sync. */
  async onBrowserOnline() {
    const was = get().connection
    set({ connection: 'online' })
    // 1) local session check (the same check the app always does)
    await useAuth.getState().sync()
    if (useAuth.getState().status !== 'authed') return
    // 2) server reachability + cloud session + sync
    if (was !== 'online') {
      set({ justReconnected: true })
      clearTimeout(timers.banner)
      timers.banner = setTimeout(() => set({ justReconnected: false }), 5000)
    }
    await get().check('reconnect')
  },

  /** Probe the connection and, if cloud sync is on, run a sync. */
  async check(reason = 'poll') {
    if (!userId) return
    if (navigator.onLine === false) {
      set({ connection: 'offline' })
      return
    }
    if (!cloud()) {
      set({ connection: 'online' })
      return
    }
    const ok = await ping()
    if (!ok) {
      set({ connection: 'server-down' })
      clearTimeout(timers.retry)
      timers.retry = setTimeout(() => get().check('retry'), RETRY_MS)
      return
    }
    set({ connection: 'online' })
    await get().syncNow({ reason })
  },

  schedule() {
    if (!cloud() || get().connection !== 'online') return
    clearTimeout(timers.debounce)
    timers.debounce = setTimeout(() => get().syncNow({ reason: 'change' }), DEBOUNCE_MS)
  },

  // ------------------------------------------------------------------ the sync itself
  async syncNow({ reason = 'manual' } = {}) {
    if (!userId || !cloud()) return { skipped: 'no-cloud' }
    if (get().connection !== 'online') return { skipped: 'offline' }
    if (running) {
      rerun = true
      return { skipped: 'busy' }
    }
    running = true
    set({ status: 'syncing', lastError: null })
    try {
      const run = () => doSync(userId, reason, set, get)
      const result = navigator.locks ? await navigator.locks.request(`daybook-sync-${userId}`, run) : await run()
      return result
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return { skipped: 'auth' } // authLost() already ran
      const offline = e instanceof ApiError && e.status === 0
      set({ status: offline ? 'idle' : 'error', lastError: e.message, connection: offline ? 'server-down' : get().connection })
      if (offline) {
        clearTimeout(timers.retry)
        timers.retry = setTimeout(() => get().check('retry'), RETRY_MS)
      }
      return { error: e.message }
    } finally {
      running = false
      if (rerun) {
        rerun = false
        setTimeout(() => get().syncNow({ reason: 'queued' }), 300)
      }
    }
  },

  /** The server no longer accepts this session. Go to the landing page; unsynced changes stay on the device. */
  async authLost() {
    if (!started) return
    const had = !!cloud()
    if (!had && useAuth.getState().status !== 'authed') return
    toast.error('Your session expired', { description: 'Sign in again. Changes made offline are kept on this device and will sync after you sign in.', duration: 9000 })
    useTeam.getState().signOutCloud()
    await useAuth.getState().logout({ expired: true })
    goHome()
  },

  // ------------------------------------------------------------------ sign-out and clearing the device copy
  setClearOnLogout(v) {
    if (!userId) return
    updateMeta(userId, (m) => ({ ...m, clearOnLogout: v }))
    set({ clearOnLogout: v })
  },

  /**
   * Called before sign-out. Uploads what is pending and, if the user chose "remove my data from this device",
   * clears it, but only when the server verifiably has everything.
   */
  async beforeLogout() {
    if (!userId || !cloud()) return { cleared: false }
    let ok = get().pending === 0
    if (get().connection === 'online') {
      const r = await get().syncNow({ reason: 'logout' })
      ok = !r?.error && !r?.skipped && get().pending === 0
    }
    if (get().clearOnLogout) {
      if (ok && (await verifyServerHasEverything())) {
        await useStore.getState().wipeLocal()
        clearMeta(userId)
        return { cleared: true }
      }
      toast.warning('Your data was kept on this device', { description: 'Some changes have not reached the server yet, so nothing was removed.' })
    }
    return { cleared: false }
  },

  /** Rebuild this device's copy from the server (drops old tombstones, snapshots and undo history). */
  async resetDeviceCopy() {
    if (!userId || !cloud()) throw new Error('Turn on sync first')
    if (get().connection !== 'online') throw new Error('You are offline. Try again when you are connected.')
    const r = await get().syncNow({ reason: 'before-reset' })
    if (r?.error || r?.skipped || get().pending > 0) throw new Error('Could not upload your latest changes first, so nothing was cleared.')
    if (!(await verifyServerHasEverything())) throw new Error('The server does not hold all of your data yet, so nothing was cleared.')
    await useStore.getState().wipeLocal()
    const keep = loadMeta(userId)
    saveMeta(userId, { ...resetForNewAccount(keep, cloud().user.id), initialized: true, clearOnLogout: keep.clearOnLogout })
    set({ pending: 0 })
    await get().syncNow({ reason: 'restore' }) // since = null: pulls everything back
    return { restored: useStore.getState().tasks.length }
  },
}))

async function verifyServerHasEverything() {
  try {
    const sum = await api.get('/api/sync/summary')
    const st = useStore.getState()
    const serverIds = new Set(sum.taskIds)
    const localLive = st.tasks.filter((t) => !t.deletedAt)
    return localLive.every((t) => serverIds.has(t.id)) && sum.projects >= st.projects.filter((p) => !p.deletedAt).length
  } catch {
    return false
  }
}

async function doSync(uid, reason, set, get) {
  const c = cloud()
  // 1) is the session still valid? (an invalid one triggers the sign-out + landing page through the 401 handler)
  const me = await api.get('/api/auth/me')
  if (me.user.id !== c.user.id) {
    window.dispatchEvent(new Event('daybook:auth-lost'))
    return { skipped: 'auth' }
  }

  // 2) which server account are these changes for? A different account starts from scratch.
  let meta = loadMeta(uid)
  if (meta.cloudUserId !== c.user.id) {
    meta = resetForNewAccount(meta, c.user.id)
    saveMeta(uid, meta)
  }
  if (!meta.initialized) meta = markEverything(uid)

  // 3) what to upload: a snapshot of everything marked as changed
  const snap = JSON.parse(JSON.stringify(meta.dirty))
  const st = useStore.getState()
  const tById = new Map(st.tasks.map((t) => [t.id, t]))
  const pById = new Map(st.projects.map((p) => [p.id, p]))
  const tasks = Object.entries(snap.tasks).map(([id, at]) => (tById.has(id) ? taskToWire(tById.get(id), at) : tombstone(id, at)))
  const projects = Object.entries(snap.projects).map(([id, at]) => (pById.has(id) ? projectToWire(pById.get(id), at) : tombstone(id, at)))
  const dayLogs = Object.entries(snap.dayLogs).filter(([d]) => st.dayLogs[d]).map(([d, at]) => dayLogToWire(st.dayLogs[d], at))
  const settings = snap.settings ? settingsToWire(st.settings, st.recurring, st.views) : undefined

  // 4) upload in chunks; keep the earliest server time as the next "since" so nothing from other devices is missed
  const merged = { tasks: new Map(), projects: new Map(), dayLogs: new Map(), settings: null }
  let serverTime = null
  let rejected = []
  const chunks = Math.max(1, Math.ceil(tasks.length / CHUNK))
  for (let i = 0; i < chunks; i++) {
    const first = i === 0
    const res = await api.post('/api/sync/push', {
      since: meta.since, deviceId: meta.deviceId,
      tasks: tasks.slice(i * CHUNK, (i + 1) * CHUNK),
      projects: first ? projects : [], dayLogs: first ? dayLogs : [],
      ...(first && settings ? { settings, settingsUpdatedAt: snap.settings } : {}),
    })
    serverTime ??= res.serverTime
    rejected = rejected.concat(res.rejected)
    res.changes.tasks.forEach((t) => merged.tasks.set(t.id, t))
    res.changes.projects.forEach((p) => merged.projects.set(p.id, p))
    res.changes.dayLogs.forEach((d) => merged.dayLogs.set(d.date, d))
    if (res.changes.settings) merged.settings = res.changes.settings
  }

  // 5) merge the server's newer data into the device; edits made DURING the request are kept as local
  const after = loadMeta(uid).dirty
  const editedDuring = (kind) => Object.fromEntries(Object.entries(after[kind]).filter(([k, v]) => snap[kind][k] !== v))
  const pending = { tasks: editedDuring('tasks'), projects: editedDuring('projects'), dayLogs: editedDuring('dayLogs'), settings: after.settings && after.settings !== snap.settings ? after.settings : null }
  const pulled = useStore.getState().applyRemote({ tasks: [...merged.tasks.values()], projects: [...merged.projects.values()], dayLogs: [...merged.dayLogs.values()], settings: merged.settings }, pending)

  // 6) what was uploaded is no longer "waiting" (anything changed again meanwhile stays marked)
  const next = updateMeta(uid, (m) => {
    for (const kind of ['tasks', 'projects', 'dayLogs']) for (const [k, v] of Object.entries(snap[kind])) if (m.dirty[kind][k] === v) delete m.dirty[kind][k]
    if (m.dirty.settings === snap.settings) m.dirty.settings = null
    const pushedT = new Set(Object.keys(snap.tasks))
    const pushedP = new Set(Object.keys(snap.projects))
    m.removed.tasks = m.removed.tasks.filter((id) => !pushedT.has(id))
    m.removed.projects = m.removed.projects.filter((id) => !pushedP.has(id))
    m.since = serverTime
    m.lastSyncedAt = new Date().toISOString()
    return m
  })
  if (pendingCount(next) === 0) useStore.getState().purgeTombstones(TOMBSTONE_DAYS)

  const pushed = tasks.length + projects.length + dayLogs.length + (settings ? 1 : 0)
  set({ status: 'idle', pending: pendingCount(next), lastSyncedAt: next.lastSyncedAt, lastError: null, connection: 'online', lastResult: { pushed, pulled, rejected } })
  if (rejected.length) console.warn('[sync] some items were rejected by the server and will not be retried:', rejected)
  if ((reason === 'reconnect' || reason === 'connect') && pushed + pulled > 0) {
    toast.success(`Synced ${pushed + pulled} change${pushed + pulled === 1 ? '' : 's'}`, { description: pushed ? `${pushed} uploaded${pulled ? `, ${pulled} downloaded` : ''}` : `${pulled} downloaded` })
  }
  return { pushed, pulled, rejected }
}
