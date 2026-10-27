import { beforeEach, describe, expect, it } from 'vitest'
import { T, ctx } from './helpers'
import { useStore } from '../store/useStore'
import { defaultSettings } from '../schemas/settings'
import { openRepository } from '../services/repository'
import { applyCompletionRules, buildThreadIndex, carryOverCandidates, ensureRowOnDate, planAutoCarry, threadInfo } from '../selectors/threads'

const st = () => useStore.getState()
// 2026-09-07 is a Monday
const MON = '2026-09-07'
const TUE = '2026-09-08'
const WED = '2026-09-09'
const THU = '2026-09-10'

beforeEach(() => {
  localStorage.clear()
  openRepository('thread-user')
  useStore.setState({ userId: 'thread-user', ready: true, tasks: [], projects: [], dayLogs: {}, settings: defaultSettings(), undoStack: [], redoStack: [], activity: [] })
})

describe('planAutoCarry', () => {
  const c = ctx()
  it('carries an unfinished task to today with a stable id and thread', () => {
    const t = T({ date: MON, status: 'in_progress' })
    const { rows, stamps } = planAutoCarry([t], TUE, c)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: `${t.id}~${TUE}`, date: TUE, status: 'in_progress', carriedFrom: MON, autoCarried: true, threadId: t.id })
    expect(stamps).toEqual([t.id])
  })

  it('is idempotent and never duplicates', () => {
    const t = T({ date: MON })
    const first = planAutoCarry([t], TUE, c).rows
    expect(planAutoCarry([t, ...first], TUE, c).rows).toHaveLength(0)
  })

  it('skips completed, dismissed, recurring, deleted and too-old tasks', () => {
    const tasks = [
      T({ date: MON, status: 'completed' }),
      T({ date: MON, carryDismissed: true }),
      T({ date: MON, recurringId: 'r1' }),
      T({ date: MON, deletedAt: '2026-09-07T10:00:00Z' }),
      T({ date: '2026-08-01' }),
    ]
    expect(planAutoCarry(tasks, TUE, c).rows).toHaveLength(0)
  })

  it('waits for the next working day and honours the setting', () => {
    const t = T({ date: '2026-09-11' }) // Friday
    expect(planAutoCarry([t], '2026-09-12', c).rows).toHaveLength(0) // Saturday
    expect(planAutoCarry([t], '2026-09-14', c).rows).toHaveLength(1) // Monday
    expect(planAutoCarry([t], '2026-09-14', ctx({ autoCarry: false })).rows).toHaveLength(0)
  })

  it('keeps the project reference (same KEY-n) and starts a fresh status for pending tasks', () => {
    const t = T({ date: MON, projectId: 'p1', number: 12, hours: 3, status: 'pending' })
    const [row] = planAutoCarry([t], TUE, c).rows
    expect(row).toMatchObject({ projectId: 'p1', number: 12, status: 'pending' })
    expect(row.hours).toBeUndefined()
  })

  it('carries from the latest row of a thread, skipping days with no row (gap)', () => {
    const a = T({ date: MON, threadId: 'th' })
    const b = T({ date: TUE, threadId: 'th', carriedFrom: MON })
    const { rows } = planAutoCarry([a, b], THU, c)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ date: THU, carriedFrom: TUE })
  })
})

describe('completion rules', () => {
  const mk = () => {
    const a = T({ date: MON, threadId: 'th', status: 'pending' })
    const b = T({ date: TUE, threadId: 'th', status: 'in_progress', carriedFrom: MON })
    const c3 = T({ date: WED, threadId: 'th', status: 'in_progress', carriedFrom: TUE })
    return [a, b, c3]
  }

  it('completing the last day resolves every earlier day', () => {
    const [a, b, c3] = mk()
    const done = [a, b, { ...c3, status: 'completed' }]
    const r = applyCompletionRules(done, [c3.id], 'all', 'NOW')
    expect(r.resolved.sort()).toEqual([a.id, b.id].sort())
    expect(r.tasks.every((t) => t.status === 'completed')).toBe(true)
    expect(r.tasks.find((t) => t.id === a.id)).toMatchObject({ resolvedBy: c3.id, completedAt: 'NOW' })
  })

  it('completing an earlier day removes the later carried copies', () => {
    const [a, b, c3] = mk()
    const r = applyCompletionRules([{ ...a, status: 'completed' }, b, c3], [a.id], 'all')
    expect(r.removed.sort()).toEqual([b.id, c3.id].sort())
    expect(r.tasks.filter((t) => t.deletedAt)).toHaveLength(2)
  })

  it('does not delete later rows that are already completed', () => {
    const [a, b, c3] = mk()
    const r = applyCompletionRules([{ ...a, status: 'completed' }, b, { ...c3, status: 'completed' }], [a.id], 'all')
    expect(r.removed).toEqual([b.id])
  })

  it('mode "none" leaves earlier days as they were', () => {
    const [a, b, c3] = mk()
    const r = applyCompletionRules([a, b, { ...c3, status: 'completed' }], [c3.id], 'none')
    expect(r.resolved).toHaveLength(0)
    expect(r.tasks.find((t) => t.id === a.id).status).toBe('pending')
  })

  it('reopening the last day reopens the days it resolved', () => {
    const [a, b, c3] = mk()
    const resolved = applyCompletionRules([a, b, { ...c3, status: 'completed' }], [c3.id], 'all').tasks
    const reopened = applyCompletionRules(resolved.map((t) => (t.id === c3.id ? { ...t, status: 'in_progress' } : t)), [c3.id], 'all')
    expect(reopened.reopened.sort()).toEqual([a.id, b.id].sort())
    expect(reopened.tasks.find((t) => t.id === a.id)).toMatchObject({ status: 'pending', resolvedBy: undefined })
  })
})

describe('thread info and helpers', () => {
  it('describes position, span and neighbours', () => {
    const a = T({ date: MON, threadId: 'x' })
    const b = T({ date: WED, threadId: 'x' })
    const idx = buildThreadIndex([b, a])
    expect(threadInfo(b, idx)).toMatchObject({ inThread: true, position: 2, total: 2, isTail: true, spanDays: 2 })
    expect(threadInfo(a, idx)).toMatchObject({ isHead: true, next: b })
    expect(threadInfo(T(), buildThreadIndex([])).inThread).toBe(false)
  })

  it('candidates exclude tasks already continued later', () => {
    const a = T({ date: MON, threadId: 'x' })
    const b = T({ date: TUE, threadId: 'x' })
    const solo = T({ date: MON })
    expect(carryOverCandidates([a, b, solo], WED).map((t) => t.id).sort()).toEqual([b.id, solo.id].sort())
  })

  it('ensureRowOnDate creates a row in between and rejects out-of-range dates', () => {
    const a = T({ date: MON })
    const r = ensureRowOnDate([a], a.id, WED, WED, 'NOW')
    expect(r.tasks).toHaveLength(2)
    expect(r.tasks.find((t) => t.id === r.targetId)).toMatchObject({ date: WED, carriedFrom: MON, autoCarried: false })
    expect(ensureRowOnDate([a], a.id, '2026-09-01', WED)).toBeNull()
    expect(ensureRowOnDate([a], a.id, '2026-09-20', WED)).toBeNull()
  })
})

describe('store: forwarding, removing and finishing threads', () => {
  it('auto carry creates today’s row, then completing it resolves the earlier day', () => {
    const t = st().addTask({ title: 'Long task', date: MON, status: 'in_progress' })
    const rows = st().runAutoCarry(TUE)
    expect(rows).toHaveLength(1)
    expect(st().tasks).toHaveLength(2)
    expect(st().runAutoCarry(TUE)).toHaveLength(0) // idempotent
    const today = st().tasks.find((x) => x.date === TUE)
    st().updateTask(today.id, { status: 'completed' })
    expect(st().tasks.find((x) => x.id === t.id)).toMatchObject({ status: 'completed', resolvedBy: today.id })
  })

  it('completing the first day (forgot to tick it) removes the carried copy and the undo restores it', () => {
    const t = st().addTask({ title: 'Forgot', date: MON })
    st().runAutoCarry(TUE)
    st().updateTask(t.id, { status: 'completed' })
    expect(st().tasks.filter((x) => !x.deletedAt)).toHaveLength(1)
    st().undo()
    expect(st().tasks.filter((x) => !x.deletedAt)).toHaveLength(2)
    expect(st().tasks.find((x) => x.id === t.id).status).toBe('pending')
  })

  it('removing a carried copy stops the thread from re-creating it', () => {
    const t = st().addTask({ title: 'Remove me', date: MON })
    st().runAutoCarry(TUE)
    const copy = st().tasks.find((x) => x.date === TUE)
    st().removeCarried(copy.id)
    expect(st().tasks.find((x) => x.id === t.id).carryDismissed).toBe(true)
    expect(st().runAutoCarry(TUE)).toHaveLength(0)
    expect(st().runAutoCarry(WED)).toHaveLength(0)
  })

  it('stop and resume carrying', () => {
    const t = st().addTask({ title: 'Pause', date: MON })
    st().stopCarrying(t.id)
    expect(st().runAutoCarry(TUE)).toHaveLength(0)
    st().resumeCarrying(t.id)
    expect(st().runAutoCarry(TUE)).toHaveLength(1)
  })

  it('finish on an earlier date marks everything up to it completed and drops later copies', () => {
    const t = st().addTask({ title: 'Three days', date: MON })
    st().runAutoCarry(TUE)
    st().runAutoCarry(WED) // thread: Mon, Tue, Wed
    expect(st().tasks).toHaveLength(3)
    // finished on Tuesday, remembered on Wednesday
    const tue = st().tasks.find((x) => x.date === TUE)
    expect(st().finishThreadOn(tue.id, TUE)).toBe(true)
    const live = st().tasks.filter((x) => !x.deletedAt)
    expect(live.map((x) => x.date).sort()).toEqual([MON, TUE])
    expect(live.every((x) => x.status === 'completed')).toBe(true)
    expect(st().tasks.find((x) => x.id === t.id).resolvedBy).toBe(tue.id)
  })

  it('finish on a day that has no row creates it', () => {
    const t = st().addTask({ title: 'Gap', date: MON })
    expect(st().finishThreadOn(t.id, THU)).toBe(true)
    const thu = st().tasks.find((x) => x.date === THU)
    expect(thu).toMatchObject({ status: 'completed', carriedFrom: MON })
    expect(st().tasks.find((x) => x.id === t.id).status).toBe('completed')
    expect(st().finishThreadOn(t.id, '2020-01-01')).toBe(false)
  })

  it('the marking-all-complete setting can be switched off', () => {
    useStore.setState({ settings: { ...defaultSettings(), threadResolve: 'none' } })
    const t = st().addTask({ title: 'Keep history', date: MON })
    st().runAutoCarry(TUE)
    const today = st().tasks.find((x) => x.date === TUE)
    st().updateTask(today.id, { status: 'completed' })
    expect(st().tasks.find((x) => x.id === t.id).status).toBe('pending')
  })

  it('updates are stored per row and removable', () => {
    const t = st().addTask({ title: 'Chat', date: MON })
    st().addUpdate(t.id, '  waiting on design  ')
    const row = () => st().tasks.find((x) => x.id === t.id)
    expect(row().updates[0].text).toBe('waiting on design')
    st().deleteUpdate(t.id, row().updates[0].id)
    expect(row().updates).toHaveLength(0)
  })

  it('bulk "mark day complete" applies thread rules too', () => {
    st().addTask({ title: 'A', date: MON })
    st().runAutoCarry(TUE)
    st().markDayComplete(TUE)
    expect(st().tasks.every((x) => x.status === 'completed')).toBe(true)
  })
})

describe('streaks are not inflated by automatic carry-forward', () => {
  it('ignores rows that were only carried, counts them once the user adds a note or completes them', async () => {
    const { streak } = await import('../selectors/summarize')
    const s = defaultSettings()
    const worked = T({ date: MON })
    const carried = T({ date: TUE, autoCarried: true, carriedFrom: MON, threadId: worked.id })
    expect(streak([worked, carried], {}, s, TUE)).toBe(1)
    const noted = { ...carried, updates: [{ id: 'u', at: 'x', text: 'progress' }] }
    expect(streak([worked, noted], {}, s, TUE)).toBe(2)
    const done = { ...carried, status: 'completed', completedAt: `${TUE}T15:00:00.000Z` }
    expect(streak([worked, done], {}, s, TUE)).toBe(2)
  })
})
