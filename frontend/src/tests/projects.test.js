import { beforeEach, describe, expect, it } from 'vitest'
import { T, ctx } from './helpers'
import { useStore } from '../store/useStore'
import { defaultSettings } from '../schemas/settings'
import { openRepository } from '../services/repository'
import { LocalStorageRepository } from '../services/repository/localStorageRepo'
import { assignProject, ensureProject, makeProject } from '../store/projectOps'
import { NO_PROJECT, isOverdue, projectBreakdown, projectStats, suggestKey, taskRef, projectMap } from '../selectors/projects'
import { filterTasks } from '../selectors/filter'
import { taskSchema } from '../schemas/task'
import { projectFormSchema } from '../schemas/project'
import { parseQuickAdd } from '../utils/quickAdd'
import { rowsToTasks } from '../services/importers/normalise'

const st = () => useStore.getState()

beforeEach(() => {
  localStorage.clear()
  openRepository('proj-user')
  useStore.setState({ userId: 'proj-user', tasks: [], projects: [], dayLogs: {}, settings: defaultSettings(), undoStack: [], redoStack: [], activity: [] })
})

describe('keys and numbering', () => {
  it('suggests unique readable keys', () => {
    expect(suggestKey('Website Redesign')).toBe('WR')
    expect(suggestKey('Payments')).toBe('PAY')
    expect(suggestKey('Payments', ['PAY'])).toBe('PAY2')
    expect(suggestKey('x')).toMatch(/^[A-Z][A-Z0-9]{1,5}$/)
  })

  it('numbers tasks per project and renumbers when moved', () => {
    const web = st().addProject({ name: 'Website', key: 'WEB' })
    const api = st().addProject({ name: 'API', key: 'API' })
    const a = st().addTask({ title: 'A', projectId: web.id })
    const b = st().addTask({ title: 'B', projectId: web.id })
    const c = st().addTask({ title: 'C', projectId: api.id })
    expect([a.number, b.number, c.number]).toEqual([1, 2, 1])
    st().moveTasksToProject([a.id], api.id)
    const moved = st().tasks.find((t) => t.id === a.id)
    expect(moved).toMatchObject({ projectId: api.id, number: 2 })
    expect(st().projects.find((p) => p.id === api.id).nextNumber).toBe(3)
    st().moveTasksToProject([a.id], null)
    expect(st().tasks.find((t) => t.id === a.id)).toMatchObject({ projectId: undefined, number: undefined })
  })

  it('references show KEY-n, falling back to the free-form ticket', () => {
    const p = makeProject({ name: 'Web', key: 'WEB' })
    const map = projectMap([p])
    expect(taskRef({ projectId: p.id, number: 7 }, map)).toBe('WEB-7')
    expect(taskRef({ ticketNo: 'FE-1' }, map)).toBe('FE-1')
  })
})

describe('project lifecycle', () => {
  it('keeps keys unique and ignores a clashing key edit', () => {
    const a = st().addProject({ name: 'Alpha', key: 'AAA' })
    const b = st().addProject({ name: 'Beta', key: 'AAA' })
    expect(b.key).not.toBe('AAA')
    st().updateProject(b.id, { key: 'AAA' })
    expect(st().projects.find((p) => p.id === b.id).key).toBe(b.key)
    st().updateProject(a.id, { key: 'zz9' })
    expect(st().projects.find((p) => p.id === a.id).key).toBe('ZZ9')
  })

  it('archives, restores and favourites', () => {
    const p = st().addProject({ name: 'Alpha' })
    st().archiveProject(p.id)
    expect(st().projects[0].archivedAt).toBeTruthy()
    st().restoreProject(p.id)
    expect(st().projects[0].archivedAt).toBeNull()
    st().toggleFavorite(p.id)
    expect(st().projects[0].favorite).toBe(true)
  })

  it('deleting a project can keep or delete its tasks, and is undoable', () => {
    const p = st().addProject({ name: 'Alpha' })
    const t = st().addTask({ title: 'Keep me', projectId: p.id })
    st().deleteProject(p.id, 'unassign')
    expect(st().tasks[0]).toMatchObject({ deletedAt: null, projectId: undefined })
    expect(st().projects[0].deletedAt).toBeTruthy()
    st().undo()
    expect(st().tasks.find((x) => x.id === t.id).projectId).toBe(p.id)
    st().deleteProject(p.id, 'delete')
    expect(st().tasks.find((x) => x.id === t.id).deletedAt).toBeTruthy()
  })

  it('duplicates a project with its tasks reset to pending and renumbered', () => {
    const p = st().addProject({ name: 'Alpha', key: 'ALP' })
    st().addTask({ title: 'One', projectId: p.id, status: 'completed' })
    st().addTask({ title: 'Two', projectId: p.id })
    const copy = st().duplicateProject(p.id, { withTasks: true })
    const copied = st().tasks.filter((t) => t.projectId === copy.id)
    expect(copied.map((t) => t.number)).toEqual([1, 2])
    expect(copied.every((t) => t.status === 'pending')).toBe(true)
    expect(copy.key).not.toBe('ALP')
  })

  it('WIP limits are set and cleared', () => {
    const p = st().addProject({ name: 'Alpha' })
    st().setWipLimit(p.id, 'in_progress', 3)
    expect(st().projects[0].wipLimits).toEqual({ in_progress: 3 })
    st().setWipLimit(p.id, 'in_progress', 0)
    expect(st().projects[0].wipLimits).toEqual({})
  })
})

describe('previous data keeps working', () => {
  it('tasks saved before projects existed still parse and count as "no project"', () => {
    const old = { id: 'x', date: '2026-09-01', title: 'Old task', status: 'completed', order: 0, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' }
    const parsed = taskSchema.parse(old)
    expect(parsed.projectId).toBeUndefined()
    expect(filterTasks([parsed], { project: [NO_PROJECT] }, {})).toHaveLength(1)
    expect(filterTasks([parsed], { project: ['p1'] }, {})).toHaveLength(0)
  })

  it('carriedFrom now survives a reload', async () => {
    const repo = new LocalStorageRepository({ userId: 'cf', debounceMs: 0 })
    await repo.saveTasks([T({ carriedFrom: '2026-09-01' })])
    repo.flush()
    expect((await repo.listTasks())[0].carriedFrom).toBe('2026-09-01')
  })

  it('tasks pointing at a deleted project are treated as unassigned', () => {
    const p = makeProject({ name: 'Gone' })
    const t = T({ projectId: p.id })
    const live = new Set()
    expect(filterTasks([t], { project: [NO_PROJECT] }, { projectIds: live })).toHaveLength(1)
    expect(taskRef(t, projectMap([{ ...p, deletedAt: 'x' }]))).toBe('')
  })

  it('old backups import without projects, new snapshots round-trip them', async () => {
    const repo = new LocalStorageRepository({ userId: 'bk', debounceMs: 0 })
    const res = await repo.importSnapshot({ tasks: [T()], dayLogs: [], settings: {} })
    expect(res.tasks).toBe(1)
    expect(await repo.getProjects()).toEqual([])
    const p = makeProject({ name: 'Alpha' })
    await repo.saveProjects([p])
    repo.flush()
    const snap = await repo.exportSnapshot()
    const other = new LocalStorageRepository({ userId: 'bk2', debounceMs: 0 })
    await other.importSnapshot(snap)
    expect((await other.getProjects())[0].name).toBe('Alpha')
  })
})

describe('stats, filters and parsing', () => {
  it('computes project health', () => {
    const p = makeProject({ name: 'A', targetDate: '2026-09-10' })
    const tasks = [T({ status: 'completed' }), T({ status: 'pending', dueDate: '2026-09-01' })]
    const s = projectStats(p, tasks, ctx(), '2026-09-05')
    expect(s).toMatchObject({ total: 2, done: 1, overdue: 1, health: 'bad', daysLeft: 5 })
    expect(isOverdue(tasks[1], '2026-09-05')).toBe(true)
    expect(projectStats(p, [T({ status: 'completed' })], ctx(), '2026-09-05').health).toBe('done')
  })

  it('breaks tasks down by project including "No project"', () => {
    const p = makeProject({ name: 'Alpha', key: 'ALP' })
    const rows = projectBreakdown([T({ projectId: p.id }), T()], [p], ctx())
    expect(rows.map((r) => r.name).sort()).toEqual(['Alpha', 'No project'])
  })

  it('search matches the KEY-number reference', () => {
    const p = makeProject({ name: 'Web', key: 'WEB' })
    const map = projectMap([p])
    const t = T({ projectId: p.id, number: 12 })
    expect(filterTasks([t], { q: 'web-12' }, { refOf: (x) => taskRef(x, map) })).toHaveLength(1)
  })

  it('quick add understands ~project and due dates', () => {
    const r = parseQuickAdd('Fix checkout ~web due:2026-10-01', { today: '2026-09-07', projects: [{ id: 'p1', key: 'WEB', name: 'Website' }] })
    expect(r).toMatchObject({ title: 'Fix checkout', projectId: 'p1', dueDate: '2026-10-01' })
  })

  it('validates the project form', () => {
    const base = { name: 'Alpha', key: 'alp', color: '#000', icon: 'rocket', status: 'active' }
    expect(projectFormSchema.safeParse(base).success).toBe(true)
    expect(projectFormSchema.safeParse({ ...base, key: '1x' }).success).toBe(false)
    expect(projectFormSchema.safeParse({ ...base, startDate: '2026-10-02', targetDate: '2026-10-01' }).success).toBe(false)
  })

  it('import resolves project column by name/key and creates missing ones', () => {
    const { tasks } = rowsToTasks([{ Date: '2026-09-01', Task: 'A', Project: 'Website' }], { date: 'Date', title: 'Task', project: 'Project' })
    expect(tasks[0].projectName).toBe('Website')
    st().importTasks(tasks, 'skip')
    expect(st().projects).toHaveLength(1)
    expect(st().tasks[0]).toMatchObject({ projectId: st().projects[0].id, number: 1 })
    // a second import reuses the project
    const again = rowsToTasks([{ Date: '2026-09-02', Task: 'B', Project: 'website' }], { date: 'Date', title: 'Task', project: 'Project' }).tasks
    st().importTasks(again, 'skip')
    expect(st().projects).toHaveLength(1)
    expect(st().tasks[1].number).toBe(2)
  })

  it('ensureProject and assignProject are pure', () => {
    const before = [makeProject({ name: 'Alpha' })]
    const r = ensureProject(before, 'Beta')
    expect(before).toHaveLength(1)
    expect(r.projects).toHaveLength(2)
    const a = assignProject(r.projects, T(), r.project.id)
    expect(a.task.number).toBe(1)
    expect(r.projects.find((p) => p.id === r.project.id).nextNumber).toBe(1)
  })
})
