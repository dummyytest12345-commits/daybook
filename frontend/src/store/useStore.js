import { create } from 'zustand'
import { closeRepository, getRepository, openRepository } from '../services/repository'
import { defaultSettings } from '../schemas/settings'
import { newId } from '../utils/id'
import { taskHash } from '../utils/hash'
import { todayISO } from '../utils/date'
import { assignProject, ensureProject, makeProject } from './projectOps'
import { withProgressRules } from '../selectors/progress'
import { untracked } from '../sync/suppress'
import { dayLogFromWire, projectFromWire, settingsFromWire, taskFromWire } from '../sync/wire'
import { applyCompletionRules, buildThreadIndex, ensureRowOnDate, makeForwardRow, planAutoCarry, threadIdOf } from '../selectors/threads'

const MAX_UNDO = 50
const nowISO = () => new Date().toISOString()

/** Rows whose status really changed between two task arrays (ids). */
const statusChanged = (before, after) => {
  const old = new Map(before.map((t) => [t.id, t.status]))
  return after.filter((t) => old.has(t.id) && old.get(t.id) !== t.status).map((t) => t.id)
}

/**
 * After a delete: if the user removed a carried-forward copy, stop the thread from re-creating it
 * (the previous row becomes the tail again and is marked "carry dismissed").
 */
const dismissAfterRemoval = (tasks, removedIds) => {
  const removed = new Set(removedIds)
  const gone = tasks.filter((t) => removed.has(t.id) && t.carriedFrom)
  if (!gone.length) return tasks
  const index = buildThreadIndex(tasks)
  const dismiss = new Set()
  for (const g of gone) {
    const tail = index.get(threadIdOf(g))?.at(-1)
    if (tail && tail.status !== 'completed' && tail.date < g.date) dismiss.add(tail.id)
  }
  return dismiss.size ? tasks.map((t) => (dismiss.has(t.id) ? { ...t, carryDismissed: true } : t)) : tasks
}

export function makeTask(partial = {}) {
  const now = nowISO()
  return {
    id: newId(),
    date: todayISO(),
    title: '',
    status: 'pending',
    order: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...partial,
  }
}

const snap = (s) => ({ tasks: s.tasks, dayLogs: s.dayLogs, projects: s.projects })

export const useStore = create((set, get) => {
  const repo = () => getRepository()

  /** Apply a data change, record undo state, persist. */
  const commit = (recipe, label) => {
    const before = snap(get())
    const next = recipe({ ...before, settings: get().settings, dayLogs: before.dayLogs })
    set((s) => ({
      ...next,
      undoStack: [...s.undoStack, { ...before, label }].slice(-MAX_UNDO),
      redoStack: [],
      activity: [{ at: nowISO(), text: label }, ...s.activity].slice(0, 200),
    }))
    persist()
  }
  const persist = () => {
    if (!get().userId) return // signed out: nothing to write
    const { tasks, dayLogs, projects } = get()
    repo().saveProjects(projects)
    repo().saveTasks(tasks)
    repo().saveDayLogs(Object.values(dayLogs))
  }

  return {
    ready: false,
    userId: null,
    tasks: [],
    projects: [],
    dayLogs: {},
    settings: defaultSettings(),
    recurring: [],
    views: [],
    storageError: null,
    droppedRows: 0,
    undoStack: [],
    redoStack: [],
    activity: [],

    /** Open the signed-in user's storage and load their data. */
    async init(userId) {
      set({ ready: false, userId })
      const r = openRepository(userId, (kind) => set({ storageError: kind }))
      const [tasks, logs, settings, recurring, views, projects] = await Promise.all([
        r.listTasks(), r.getDayLogs(), r.getSettings(), r.getRecurring(), r.getViews(), r.getProjects(),
      ])
      set({
        tasks, projects,
        dayLogs: Object.fromEntries(logs.map((l) => [l.date, l])),
        settings, recurring, views,
        droppedRows: r.dropped,
        ready: true,
        storageError: r.available ? null : 'unavailable',
      })
      r.autoSnapshot()
      r.subscribe(() => get().reloadFromStorage())
    },

    /** Called on cross-tab storage events. */
    async reloadFromStorage() {
      const r = repo()
      const [tasks, logs, settings, recurring, views, projects] = await Promise.all([
        r.listTasks(), r.getDayLogs(), r.getSettings(), r.getRecurring(), r.getViews(), r.getProjects(),
      ])
      untracked(() => set({ tasks, projects, dayLogs: Object.fromEntries(logs.map((l) => [l.date, l])), settings, recurring, views }))
    },

    // ---- sync (data from the server) ----
    /**
     * Merge changes that came from the server. `pending` = ids edited locally while the request was in flight:
     * those stay as they are (they upload on the next sync). Not recorded as local edits, not undoable.
     */
    applyRemote({ tasks = [], projects = [], dayLogs = [], settings = null } = {}, pending = {}) {
      const kept = (kind, id) => !!pending?.[kind]?.[id]
      const mergeList = (local, remote, kind, conv) => {
        const map = new Map(local.map((x) => [x.id, x]))
        let n = 0
        for (const r of remote) {
          if (kept(kind, r.id)) continue
          const had = map.has(r.id)
          if (!had && r.deletedAt) continue // deleted elsewhere and never seen here
          map.set(r.id, conv(r))
          n++
        }
        return { list: [...map.values()], n }
      }
      let count = 0
      untracked(() => {
        const t = mergeList(get().tasks, tasks, 'tasks', taskFromWire)
        const p = mergeList(get().projects, projects, 'projects', projectFromWire)
        const logs = { ...get().dayLogs }
        for (const l of dayLogs) {
          if (kept('dayLogs', l.date)) continue
          logs[l.date] = dayLogFromWire(l)
          count++
        }
        count += t.n + p.n
        const patch = { ...(t.n && { tasks: t.list }), ...(p.n && { projects: p.list }), ...(dayLogs.length && { dayLogs: logs }) }
        const s = settingsFromWire(settings)
        if (s && !pending?.settings) {
          patch.settings = { ...get().settings, ...s.settings }
          patch.recurring = s.recurring
          patch.views = s.views
          count++
        }
        if (!Object.keys(patch).length) return
        set({ ...patch, undoStack: [], redoStack: [] }) // undoing could silently revert somebody else's change
        persist()
        if (patch.settings) {
          repo().saveSettings(patch.settings)
          repo().saveRecurring(patch.recurring)
          repo().saveViews(patch.views)
        }
      })
      return count
    },

    /** Drop soft-deleted rows older than `days` (already synced) so the device store does not grow forever. */
    purgeTombstones(days = 30) {
      const cutoff = Date.now() - days * 864e5
      const old = (x) => x.deletedAt && Date.parse(x.deletedAt) < cutoff
      const { tasks, projects } = get()
      if (!tasks.some(old) && !projects.some(old)) return 0
      untracked(() => {
        set({ tasks: tasks.filter((t) => !old(t)), projects: projects.filter((p) => !old(p)) })
        persist()
      })
      return tasks.filter(old).length + projects.filter(old).length
    },

    /** Remove this user's data from the device (used only after the server was verified to hold it). */
    async wipeLocal() {
      await repo().clearAll({ snapshots: true })
      untracked(() => set({ tasks: [], projects: [], dayLogs: {}, recurring: [], views: [], undoStack: [], redoStack: [], activity: [] }))
    },

    // ---- tasks ----
    addTask(partial) {
      const date = partial.date || todayISO()
      const order = get().tasks.filter((t) => t.date === date && !t.deletedAt).length
      const task = makeTask({ order, ...partial, date })
      if (task.status === 'completed') { task.progress = 100; if (!task.completedAt) task.completedAt = nowISO() }
      else if (task.status === 'in_progress' && task.progress == null) task.progress = 0
      let saved = task
      commit((s) => {
        // a project number is assigned here so it is computed from the latest project state
        const r = assignProject(s.projects, { ...task, projectId: undefined }, task.projectId)
        saved = r.task
        return { tasks: [...s.tasks, r.task], projects: r.projects }
      }, `Added “${task.title}”`)
      return saved
    },
    updateTask(id, patch, label) {
      commit(
        (s) => {
          let projects = s.projects
          let tasks = s.tasks.map((t) => {
            if (t.id !== id) return t
            const { projectId, ...rest } = withProgressRules(t, patch)
            let u = { ...t, ...rest, updatedAt: nowISO() }
            if (u.status !== t.status) {
              u.completedAt = u.status === 'completed' ? nowISO() : undefined
            }
            if ('projectId' in patch) {
              const r = assignProject(projects, u, projectId || null)
              u = r.task
              projects = r.projects
            }
            return u
          })
          const changed = statusChanged(s.tasks, tasks)
          if (changed.length) tasks = applyCompletionRules(tasks, changed, s.settings.threadResolve, nowISO()).tasks
          return { tasks, projects }
        },
        label || 'Updated task',
      )
    },
    removeTask(id) {
      const t = get().tasks.find((x) => x.id === id)
      commit(
        (s) => ({ tasks: dismissAfterRemoval(s.tasks.map((x) => (x.id === id ? { ...x, deletedAt: nowISO() } : x)), [id]) }),
        `Deleted “${t?.title}”`,
      )
    },
    removeTasks(ids) {
      const set_ = new Set(ids)
      commit(
        (s) => ({ tasks: dismissAfterRemoval(s.tasks.map((x) => (set_.has(x.id) ? { ...x, deletedAt: nowISO() } : x)), ids) }),
        `Deleted ${ids.length} tasks`,
      )
    },
    duplicateTask(id) {
      const t = get().tasks.find((x) => x.id === id)
      if (!t) return
      return get().addTask({ ...t, id: newId(), title: `${t.title} (copy)`, status: 'pending', progress: 0, completedAt: undefined, hours: t.hours, timerStartedAt: null, timerElapsedMs: 0, createdAt: nowISO(), updatedAt: nowISO() })
    },
    bulkUpdate(ids, patch, label) {
      const set_ = new Set(ids)
      commit(
        (s) => {
          let projects = s.projects
          let tasks = s.tasks.map((t) => {
            if (!set_.has(t.id)) return t
            const { projectId, ...rest } = withProgressRules(t, patch)
            let u = { ...t, ...rest, updatedAt: nowISO() }
            if (u.status !== t.status) u.completedAt = u.status === 'completed' ? nowISO() : undefined
            if ('projectId' in patch) {
              const r = assignProject(projects, u, projectId || null)
              u = r.task
              projects = r.projects
            }
            return u
          })
          const changed = statusChanged(s.tasks, tasks)
          if (changed.length) tasks = applyCompletionRules(tasks, changed, s.settings.threadResolve, nowISO()).tasks
          return { tasks, projects }
        },
        label || `Updated ${ids.length} tasks`,
      )
    },
    /** Reorder within a day, or move to another day at index. */
    moveTask(id, date, index) {
      commit((s) => {
        const moving = s.tasks.find((t) => t.id === id)
        if (!moving) return {}
        const rest = s.tasks.filter((t) => t.id !== id)
        const target = rest.filter((t) => t.date === date && !t.deletedAt).sort((a, b) => a.order - b.order)
        target.splice(index ?? target.length, 0, { ...moving, date, updatedAt: nowISO() })
        const orderMap = new Map(target.map((t, i) => [t.id, { ...t, order: i }]))
        return { tasks: [...rest.filter((t) => !orderMap.has(t.id)), ...orderMap.values()] }
      }, 'Moved task')
    },
    /**
     * Carry unfinished tasks forward to today (next working day). Safe to call repeatedly:
     * copies get deterministic ids, so nothing is duplicated. Returns the new rows.
     */
    runAutoCarry(today = todayISO()) {
      const s0 = get()
      if (!s0.ready || !s0.userId) return []
      const { rows } = planAutoCarry(s0.tasks, today, { dayLogs: s0.dayLogs, settings: s0.settings }, nowISO())
      if (!rows.length) return []
      commit((s) => {
        const plan = planAutoCarry(s.tasks, today, { dayLogs: s.dayLogs, settings: s.settings }, nowISO())
        const stamp = new Set(plan.stamps)
        const stamped = s.tasks.map((t) => (stamp.has(t.id) ? { ...t, threadId: t.id } : t))
        return { tasks: [...stamped, ...plan.rows] }
      }, `Carried ${rows.length} unfinished task${rows.length === 1 ? '' : 's'} forward`)
      return rows
    },
    /** Manually continue tasks on another day (same thread, keeps the project reference). */
    carryOver(ids, to) {
      commit((s) => {
        const stamp = new Set(ids)
        const tasks = s.tasks.map((t) => (stamp.has(t.id) && !t.threadId ? { ...t, threadId: t.id } : t))
        const add = []
        for (const id of ids) {
          const src = tasks.find((t) => t.id === id)
          if (!src || tasks.some((t) => t.id === `${src.id}~${to}`)) continue
          add.push(makeForwardRow(src, to, [...tasks, ...add], nowISO(), { auto: false }))
        }
        return { tasks: [...tasks, ...add] }
      }, `Carried over ${ids.length} tasks`)
    },
    /** "Remove from this day": delete a carried copy and stop carrying that work forward. */
    removeCarried(id) {
      get().removeTask(id)
    },
    /** Stop carrying a task forward without removing anything. */
    stopCarrying(id) {
      commit((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, carryDismissed: true, updatedAt: nowISO() } : t)) }), 'Stopped carrying task forward')
    },
    resumeCarrying(id) {
      commit((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, carryDismissed: undefined, updatedAt: nowISO() } : t)) }), 'Resumed carrying task forward')
    },
    /**
     * Complete a thread on the day the work was really finished (any day from its first row to today).
     * Earlier days are resolved as completed (per settings), later copies are removed.
     */
    finishThreadOn(rowId, dateISO) {
      const s0 = get()
      if (!ensureRowOnDate(s0.tasks, rowId, dateISO, todayISO(), nowISO())) return false
      commit((s) => {
        const f = ensureRowOnDate(s.tasks, rowId, dateISO, todayISO(), nowISO())
        let tasks = f.tasks.map((t) => (t.id === f.targetId ? { ...t, status: 'completed', progress: 100, completedAt: nowISO(), updatedAt: nowISO() } : t))
        tasks = applyCompletionRules(tasks, [f.targetId], s.settings.threadResolve, nowISO()).tasks
        return { tasks }
      }, `Completed on ${dateISO}`)
      return true
    },
    /** Add a progress note to a row; shown as a message in the thread conversation. */
    addUpdate(rowId, text) {
      const clean = text.trim()
      if (!clean) return
      commit((s) => ({
        tasks: s.tasks.map((t) => (t.id === rowId ? { ...t, updates: [...(t.updates || []), { id: newId(), at: nowISO(), text: clean.slice(0, 1000) }], updatedAt: nowISO() } : t)),
      }), 'Added a thread update')
    },
    deleteUpdate(rowId, updateId) {
      commit((s) => ({
        tasks: s.tasks.map((t) => (t.id === rowId ? { ...t, updates: (t.updates || []).filter((u) => u.id !== updateId), updatedAt: nowISO() } : t)),
      }), 'Removed a thread update')
    },
    /** mode: 'merge' (upsert), 'skip' (skip duplicates), 'replace' (wipe first). */
    importTasks(list, mode = 'skip', opts = {}) {
      commit((s) => {
        let projects = s.projects
        const base = mode === 'replace' ? [] : s.tasks
        const seen = new Set(base.filter((t) => !t.deletedAt).map(taskHash))
        const out = [...base]
        for (const t of list) {
          const h = taskHash(t)
          if (mode === 'skip' && seen.has(h)) continue
          // project: forced choice wins, otherwise a "Project" column value (found by name/key or created)
          const { projectName, ...clean } = t
          let target = opts.projectId || null
          if (!target && projectName) {
            const r = ensureProject(projects, projectName)
            projects = r.projects
            target = r.project.id
          }
          if (mode === 'merge' && seen.has(h)) {
            const i = out.findIndex((x) => !x.deletedAt && taskHash(x) === h)
            let u = { ...out[i], ...clean, id: out[i].id, updatedAt: nowISO() }
            if (target) {
              const r = assignProject(projects, u, target)
              u = r.task
              projects = r.projects
            }
            out[i] = u
            continue
          }
          seen.add(h)
          let nt = clean
          if (target) {
            const r = assignProject(projects, { ...clean, projectId: undefined }, target)
            nt = r.task
            projects = r.projects
          }
          out.push(nt)
        }
        return { tasks: out, projects }
      }, `Imported ${list.length} rows (${mode})`)
    },
    startTimer(id) {
      // one timer at a time: pause any running
      const now = Date.now()
      commit((s) => ({
        tasks: s.tasks.map((t) => {
          if (t.timerStartedAt && t.id !== id) {
            return { ...t, timerElapsedMs: (t.timerElapsedMs || 0) + (now - Date.parse(t.timerStartedAt)), timerStartedAt: null }
          }
          return t.id === id ? { ...t, timerStartedAt: new Date(now).toISOString(), status: t.status === 'pending' ? 'in_progress' : t.status } : t
        }),
      }), 'Started timer')
    },
    /** Stop timer; optionally write elapsed hours into task.hours. */
    stopTimer(id, { writeHours = true } = {}) {
      const now = Date.now()
      commit((s) => ({
        tasks: s.tasks.map((t) => {
          if (t.id !== id) return t
          const ms = (t.timerElapsedMs || 0) + (t.timerStartedAt ? now - Date.parse(t.timerStartedAt) : 0)
          const hours = Math.round((ms / 3600000) * 100) / 100
          return { ...t, timerStartedAt: null, timerElapsedMs: ms, hours: writeHours ? hours : t.hours, updatedAt: nowISO() }
        }),
      }), 'Stopped timer')
    },
    discardTimer(id) {
      commit((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, timerStartedAt: null } : t)) }), 'Discarded timer')
    },

    // ---- projects ----
    addProject(data) {
      let project
      commit((s) => {
        project = makeProject(data, s.projects.filter((p) => !p.deletedAt))
        return { projects: [...s.projects, project] }
      }, `Created project “${data.name}”`)
      return project
    },
    updateProject(id, patch, label) {
      commit(
        (s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== id) return p
            const u = { ...p, ...patch, updatedAt: nowISO() }
            if (patch.key) {
              // keys stay unique among live projects
              const clash = s.projects.some((x) => x.id !== id && !x.deletedAt && x.key === patch.key.toUpperCase())
              u.key = clash ? p.key : patch.key.toUpperCase()
            }
            return u
          }),
        }),
        label || 'Updated project',
      )
    },
    toggleFavorite(id) {
      const p = get().projects.find((x) => x.id === id)
      get().updateProject(id, { favorite: !p?.favorite }, p?.favorite ? 'Removed favourite' : 'Added favourite')
    },
    archiveProject(id) {
      get().updateProject(id, { archivedAt: nowISO() }, 'Archived project')
    },
    restoreProject(id) {
      get().updateProject(id, { archivedAt: null }, 'Restored project')
    },
    setWipLimit(id, statusId, limit) {
      const p = get().projects.find((x) => x.id === id)
      if (!p) return
      const wip = { ...p.wipLimits }
      if (!limit) delete wip[statusId]
      else wip[statusId] = limit
      get().updateProject(id, { wipLimits: wip }, 'Changed WIP limit')
    },
    /**
     * Delete a project. mode 'unassign' keeps its tasks (they become "no project"),
     * mode 'delete' also deletes the tasks. Both are undoable.
     */
    deleteProject(id, mode = 'unassign') {
      const p = get().projects.find((x) => x.id === id)
      commit(
        (s) => ({
          projects: s.projects.map((x) => (x.id === id ? { ...x, deletedAt: nowISO() } : x)),
          tasks: s.tasks.map((t) => {
            if (t.projectId !== id) return t
            return mode === 'delete'
              ? { ...t, deletedAt: nowISO() }
              : { ...t, projectId: undefined, number: undefined, updatedAt: nowISO() }
          }),
        }),
        `Deleted project “${p?.name}”`,
      )
    },
    /** Copy a project (and optionally its open/all tasks) under a new key. */
    duplicateProject(id, { withTasks = false } = {}) {
      const src = get().projects.find((x) => x.id === id)
      if (!src) return null
      let copy
      commit((s) => {
        copy = makeProject({ ...src, name: `${src.name} (copy)`, key: undefined }, s.projects.filter((p) => !p.deletedAt))
        copy = { ...copy, wipLimits: { ...src.wipLimits }, favorite: false }
        let projects = [...s.projects, copy]
        let tasks = s.tasks
        if (withTasks) {
          const add = []
          s.tasks
            .filter((t) => t.projectId === id && !t.deletedAt)
            .sort((a, b) => (a.number || 0) - (b.number || 0))
            .forEach((t) => {
              const r = assignProject(projects, { ...t, id: newId(), projectId: undefined, status: 'pending', progress: 0, completedAt: undefined, timerStartedAt: null, timerElapsedMs: 0, createdAt: nowISO(), updatedAt: nowISO() }, copy.id)
              projects = r.projects
              add.push(r.task)
            })
          tasks = [...s.tasks, ...add]
        }
        return { projects, tasks }
      }, `Duplicated project “${src.name}”`)
      return copy
    },
    /** Move tasks into a project, or out of any project with null. Renumbers into the target. */
    moveTasksToProject(ids, projectId) {
      const target = projectId ? get().projects.find((p) => p.id === projectId) : null
      get().bulkUpdate(ids, { projectId: projectId || undefined }, target ? `Moved ${ids.length} tasks to ${target.name}` : `Removed ${ids.length} tasks from their project`)
    },

    // ---- day logs ----
    setDayLog(date, patch) {
      commit((s) => {
        const cur = s.dayLogs[date] || { date, capacityHours: s.settings.dailyCapacity }
        return { dayLogs: { ...s.dayLogs, [date]: { ...cur, ...patch } } }
      }, 'Updated day settings')
    },
    markDayComplete(date) {
      const ids = get().tasks.filter((t) => t.date === date && !t.deletedAt && t.status !== 'completed').map((t) => t.id)
      if (ids.length) get().bulkUpdate(ids, { status: 'completed' }, `Marked ${ids.length} tasks complete`)
    },
    deleteDay(date) {
      commit((s) => ({ tasks: s.tasks.map((t) => (t.date === date ? { ...t, deletedAt: nowISO() } : t)) }), `Cleared ${date}`)
    },

    // ---- undo / redo ----
    undo() {
      const { undoStack, redoStack } = get()
      const last = undoStack.at(-1)
      if (!last) return false
      set({
        tasks: last.tasks, dayLogs: last.dayLogs, projects: last.projects,
        undoStack: undoStack.slice(0, -1),
        redoStack: [...redoStack, { ...snap(get()), label: last.label }],
      })
      persist()
      return true
    },
    redo() {
      const { undoStack, redoStack } = get()
      const last = redoStack.at(-1)
      if (!last) return false
      set({
        tasks: last.tasks, dayLogs: last.dayLogs, projects: last.projects,
        redoStack: redoStack.slice(0, -1),
        undoStack: [...undoStack, { ...snap(get()), label: last.label }],
      })
      persist()
      return true
    },

    // ---- settings & misc ----
    async saveSettings(patch) {
      const settings = { ...get().settings, ...patch }
      set({ settings })
      await repo().saveSettings(settings)
    },
    renameModule(from, to) {
      const { settings } = get()
      get().saveSettings({ modules: settings.modules.map((m) => (m === from ? to : m)) })
      commit((s) => ({ tasks: s.tasks.map((t) => (t.module === from ? { ...t, module: to, updatedAt: nowISO() } : t)) }), `Renamed module ${from} → ${to}`)
    },
    renameStatus(id, label) {
      get().saveSettings({ statuses: get().settings.statuses.map((s) => (s.id === id ? { ...s, label } : s)) })
    },
    async saveRecurring(list) {
      set({ recurring: list })
      await repo().saveRecurring(list)
    },
    async saveViews(list) {
      set({ views: list })
      await repo().saveViews(list)
    },
    /** Create tasks for today from active recurring templates (idempotent per day). */
    applyRecurring(date = todayISO()) {
      const { recurring, tasks } = get()
      const dow = new Date(`${date}T00:00:00`).getDay()
      const toAdd = recurring.filter(
        (r) => r.active && r.weekdays.includes(dow) && !tasks.some((t) => t.recurringId === r.id && t.date === date && !t.deletedAt),
      )
      toAdd.forEach((r) => get().addTask({ title: r.title, module: r.module, hours: r.hours, recurringId: r.id, date }))
      return toAdd.length
    },
    async restoreSnapshot(data) {
      const res = await repo().importSnapshot(data)
      await get().reloadFromStorage()
      set({ undoStack: [], redoStack: [] })
      return res
    },
    async clearAll() {
      await repo().clearAll()
      set({ tasks: [], projects: [], dayLogs: {}, settings: defaultSettings(), recurring: [], views: [], undoStack: [], redoStack: [] })
    },
    /** Sign-out: flush writes, drop the repository and wipe in-memory data so nothing leaks to the next user. */
    reset() {
      closeRepository()
      set({
        ready: false, userId: null, tasks: [], projects: [], dayLogs: {}, settings: defaultSettings(), recurring: [], views: [],
        storageError: null, droppedRows: 0, undoStack: [], redoStack: [], activity: [],
      })
    },
    setStorageError: (storageError) => set({ storageError }),
  }
})
