import { dayLogSchema } from '../../schemas/dayLog'
import { defaultSettings, recurringSchema, savedViewSchema, settingsSchema, SCHEMA_VERSION } from '../../schemas/settings'
import { taskSchema } from '../../schemas/task'
import { projectSchema } from '../../schemas/project'
import { todayISO } from '../../utils/date'

export const ROOT = 'worklog:v1:'
const NAMES = ['tasks', 'daylogs', 'settings', 'recurring', 'views', 'snapshots']
// keys that exist in a user's namespace (pre-accounts data never had projects)
const keysFor = (prefix) => ({
  tasks: `${prefix}tasks`,
  dayLogs: `${prefix}daylogs`,
  settings: `${prefix}settings`,
  recurring: `${prefix}recurring`,
  views: `${prefix}views`,
  projects: `${prefix}projects`,
  snapshots: `${prefix}snapshots`,
})
/** Storage prefix for one user's data: each account is fully separated by id. */
export const userPrefix = (userId) => `${ROOT}u:${userId}:`

/** Move pre-accounts data (worklog:v1:tasks ...) into a user's namespace. Returns true if anything moved. */
export function adoptLegacyData(userId) {
  let moved = false
  try {
    for (const n of NAMES) {
      const old = `${ROOT}${n}`
      const v = localStorage.getItem(old)
      if (v != null) {
        localStorage.setItem(`${userPrefix(userId)}${n}`, v)
        localStorage.removeItem(old)
        moved = true
      }
    }
  } catch {
    /* ignore */
  }
  return moved
}
export const hasLegacyData = () => {
  try {
    return NAMES.some((n) => localStorage.getItem(`${ROOT}${n}`) != null)
  } catch {
    return false
  }
}

/** Remove every key belonging to a user (used when deleting an account). */
export function purgeUserData(userId) {
  try {
    const prefix = userPrefix(userId)
    Object.keys(localStorage).filter((k) => k.startsWith(prefix)).forEach((k) => localStorage.removeItem(k))
  } catch {
    /* ignore */
  }
}
const MAX_SNAPSHOTS = 5
const QUOTA = 5 * 1024 * 1024

/** Migrate persisted settings between schema versions. Add cases as the schema evolves. */
export function migrate(settings) {
  const s = { ...settings }
  // v1 -> v2: projects were added. Tasks without projectId simply stay "no project", so no rewrite is needed.
  s.schemaVersion = SCHEMA_VERSION
  return s
}

/** Parse an array with a zod schema, dropping (and counting) invalid rows. */
export function parseList(schema, raw) {
  if (!Array.isArray(raw)) return { items: [], dropped: 0 }
  const items = []
  let dropped = 0
  for (const r of raw) {
    const res = schema.safeParse(r)
    if (res.success) items.push(res.data)
    else dropped++
  }
  return { items, dropped }
}

/**
 * WorkLogRepository implementation on top of localStorage.
 * Falls back to an in-memory map when storage is unavailable (private mode).
 * Writes are debounced; `flush()` forces them out.
 */
export class LocalStorageRepository {
  constructor({ userId, onError, debounceMs = 250 } = {}) {
    if (!userId) throw new Error('A user id is required to open the repository')
    this.userId = userId
    this.prefix = userPrefix(userId)
    this.KEYS = keysFor(this.prefix)
    this.onError = onError || (() => {})
    this.debounceMs = debounceMs
    this.memory = new Map()
    this.pending = new Map()
    this.timer = null
    this.listeners = new Set()
    this.available = this.#probe()
    this.dropped = 0

    if (typeof window !== 'undefined') {
      this.onStorage = (e) => {
        if (e.key && e.key.startsWith(this.prefix)) this.listeners.forEach((fn) => fn(e.key))
      }
      this.onLeave = () => this.flush()
      this.onHide = () => document.hidden && this.flush()
      window.addEventListener('storage', this.onStorage)
      window.addEventListener('beforeunload', this.onLeave)
      window.addEventListener('pagehide', this.onLeave)
      document.addEventListener('visibilitychange', this.onHide)
    }
  }

  /** Flush and detach listeners (called on logout / user switch). */
  dispose() {
    this.flush()
    this.listeners.clear()
    if (typeof window === 'undefined') return
    window.removeEventListener('storage', this.onStorage)
    window.removeEventListener('beforeunload', this.onLeave)
    window.removeEventListener('pagehide', this.onLeave)
    document.removeEventListener('visibilitychange', this.onHide)
  }

  #probe() {
    try {
      const k = `${this.prefix}probe`
      localStorage.setItem(k, '1')
      localStorage.removeItem(k)
      return true
    } catch {
      return false
    }
  }

  #read(key, fallback) {
    try {
      const raw = this.available ? localStorage.getItem(key) : this.memory.get(key)
      return raw ? JSON.parse(raw) : fallback
    } catch {
      return fallback
    }
  }

  #queue(key, value) {
    this.pending.set(key, JSON.stringify(value))
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), this.debounceMs)
  }

  flush() {
    clearTimeout(this.timer)
    for (const [key, json] of this.pending) {
      try {
        if (this.available) localStorage.setItem(key, json)
        else this.memory.set(key, json)
      } catch (err) {
        this.memory.set(key, json)
        this.onError(err?.name === 'QuotaExceededError' ? 'quota' : 'write', err)
      }
    }
    this.pending.clear()
  }

  /** Subscribe to cross-tab changes. Returns unsubscribe. */
  subscribe(fn) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  usage() {
    if (!this.available) return { used: 0, quota: QUOTA, ratio: 0, available: false }
    let used = 0
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(this.prefix) && !k.endsWith(':probe')) used += (k.length + (localStorage.getItem(k)?.length || 0)) * 2
    }
    return { used, quota: QUOTA, ratio: used / QUOTA, available: true }
  }

  async listTasks() {
    const { items, dropped } = parseList(taskSchema, this.#read(this.KEYS.tasks, []))
    this.dropped = dropped
    return items
  }
  async saveTask(task) {
    const all = await this.listTasks()
    const i = all.findIndex((t) => t.id === task.id)
    if (i >= 0) all[i] = task
    else all.push(task)
    this.#queue(this.KEYS.tasks, all)
  }
  async saveTasks(tasks) {
    this.#queue(this.KEYS.tasks, tasks)
  }
  async deleteTask(id) {
    const all = await this.listTasks()
    this.#queue(this.KEYS.tasks, all.filter((t) => t.id !== id))
  }
  async bulkUpsert(tasks) {
    const map = new Map((await this.listTasks()).map((t) => [t.id, t]))
    tasks.forEach((t) => map.set(t.id, t))
    this.#queue(this.KEYS.tasks, [...map.values()])
  }

  async getDayLogs() {
    return parseList(dayLogSchema, this.#read(this.KEYS.dayLogs, [])).items
  }
  async saveDayLogs(logs) {
    this.#queue(this.KEYS.dayLogs, logs)
  }
  async saveDayLog(log) {
    const all = (await this.getDayLogs()).filter((l) => l.date !== log.date)
    all.push(log)
    this.#queue(this.KEYS.dayLogs, all)
  }

  async getSettings() {
    const raw = this.#read(this.KEYS.settings, null)
    if (!raw) return defaultSettings()
    const res = settingsSchema.safeParse(migrate(raw))
    return res.success ? res.data : defaultSettings()
  }
  async saveSettings(settings) {
    this.#queue(this.KEYS.settings, settings)
  }

  async getProjects() {
    return parseList(projectSchema, this.#read(this.KEYS.projects, [])).items
  }
  async saveProjects(list) {
    this.#queue(this.KEYS.projects, list)
  }

  async getRecurring() {
    return parseList(recurringSchema, this.#read(this.KEYS.recurring, [])).items
  }
  async saveRecurring(list) {
    this.#queue(this.KEYS.recurring, list)
  }
  async getViews() {
    return parseList(savedViewSchema, this.#read(this.KEYS.views, [])).items
  }
  async saveViews(list) {
    this.#queue(this.KEYS.views, list)
  }

  async exportSnapshot() {
    return {
      app: 'work-log-pro',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      tasks: await this.listTasks(),
      dayLogs: await this.getDayLogs(),
      settings: await this.getSettings(),
      recurring: await this.getRecurring(),
      views: await this.getViews(),
      projects: await this.getProjects(),
    }
  }

  /** Validate and replace all data from a snapshot. Returns counts. */
  async importSnapshot(snap) {
    if (!snap || typeof snap !== 'object') throw new Error('Not a valid backup file')
    const tasks = parseList(taskSchema, snap.tasks)
    const dayLogs = parseList(dayLogSchema, snap.dayLogs)
    const settings = settingsSchema.safeParse(migrate(snap.settings || {}))
    this.#queue(this.KEYS.tasks, tasks.items)
    this.#queue(this.KEYS.dayLogs, dayLogs.items)
    this.#queue(this.KEYS.settings, settings.success ? settings.data : defaultSettings())
    this.#queue(this.KEYS.recurring, parseList(recurringSchema, snap.recurring).items)
    this.#queue(this.KEYS.views, parseList(savedViewSchema, snap.views).items)
    // older backups (schema 1) have no projects: import them as "no project" tasks
    const projects = parseList(projectSchema, snap.projects)
    this.#queue(this.KEYS.projects, projects.items)
    this.flush()
    return { tasks: tasks.items.length, dropped: tasks.dropped + dayLogs.dropped }
  }

  /** Rolling automatic snapshot: at most one per day, keep the last 5. */
  async autoSnapshot() {
    const snaps = this.#read(this.KEYS.snapshots, [])
    const today = todayISO()
    if (snaps.some((s) => s.day === today)) return
    const tasks = this.#read(this.KEYS.tasks, [])
    if (!tasks.length) return
    snaps.push({ day: today, at: new Date().toISOString(), data: await this.exportSnapshot() })
    this.#queue(this.KEYS.snapshots, snaps.slice(-MAX_SNAPSHOTS))
  }
  listSnapshots() {
    return this.#read(this.KEYS.snapshots, []).map(({ day, at, data }) => ({ day, at, count: data?.tasks?.length || 0 }))
  }
  getSnapshot(day) {
    return this.#read(this.KEYS.snapshots, []).find((s) => s.day === day)?.data
  }

  async clearAll({ snapshots = false } = {}) {
    this.pending.clear()
    for (const k of Object.values(this.KEYS)) {
      if (k === this.KEYS.snapshots && !snapshots) continue
      try {
        if (this.available) localStorage.removeItem(k)
        else this.memory.delete(k)
      } catch {
        /* ignore */
      }
    }
  }
}
