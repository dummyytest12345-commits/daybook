import { describe, expect, it } from 'vitest'
import { withProgressRules } from '../src/services/progress.js'
import { completionPatches, dayTypeOf, forwardRow, planAutoCarry } from '../src/services/threads.js'
import { addDays, diffDays, isValidISO, isWeekend } from '../src/utils/dates.js'
import * as v from '../src/validators/schemas.js'

const T = (o = {}) => ({ _id: `t${Math.random().toString(36).slice(2, 8)}`, userId: 'u', date: '2026-09-07', title: 'x', status: 'pending', progress: 0, createdAt: '2026-09-07T09:00:00Z', deletedAt: null, ...o })

describe('progress rules (same as the frontend)', () => {
  it('In Progress starts at 0, Completed 100, Pending 0, Blocked keeps', () => {
    expect(withProgressRules(T(), { status: 'in_progress' })).toMatchObject({ status: 'in_progress', progress: 0 })
    expect(withProgressRules(T({ status: 'in_progress', progress: 40 }), { status: 'completed' })).toMatchObject({ progress: 100 })
    expect(withProgressRules(T({ status: 'in_progress', progress: 40 }), { status: 'pending' }).progress).toBe(0)
    expect(withProgressRules(T({ status: 'blocked', progress: 60 }), { status: 'in_progress' }).progress).toBe(60)
  })
  it('progress edits start or complete the task and stamp completedAt', () => {
    expect(withProgressRules(T(), { progress: 30 })).toMatchObject({ status: 'in_progress', progress: 30 })
    const done = withProgressRules(T({ status: 'in_progress', progress: 30 }), { progress: 100 })
    expect(done.status).toBe('completed')
    expect(done.completedAt).toBeInstanceOf(Date)
    expect(withProgressRules(T({ status: 'completed', progress: 100 }), { progress: 70 })).toMatchObject({ status: 'in_progress', completedAt: null })
    expect(withProgressRules(T({ status: 'in_progress', progress: 40 }), { status: 'completed', progress: 40 })).toMatchObject({ status: 'completed', progress: 100 })
  })
})

describe('thread rules', () => {
  it('completing the last day completes earlier days; completing an earlier day removes later copies', () => {
    const a = T({ date: '2026-09-07', threadId: 'th' })
    const b = T({ date: '2026-09-08', threadId: 'th' })
    const c = T({ date: '2026-09-09', threadId: 'th', status: 'completed' })
    const r = completionPatches([a, b, c], c, 'all')
    expect(r.resolved.sort()).toEqual([a._id, b._id].sort())
    expect(r.patches.get(a._id)).toMatchObject({ status: 'completed', progress: 100, resolvedBy: c._id })
    const first = { ...a, status: 'completed' }
    expect(completionPatches([first, b, { ...c, status: 'pending' }], first, 'all').removed.sort()).toEqual([b._id, c._id].sort())
    expect(completionPatches([a, b, c], c, 'none').resolved).toHaveLength(0)
  })
  it('reopening reopens the rows it resolved', () => {
    const last = T({ date: '2026-09-09', status: 'in_progress' })
    const a = T({ date: '2026-09-07', status: 'completed', resolvedBy: last._id })
    expect(completionPatches([a, last], last, 'all').reopened).toEqual([a._id])
  })
  it('auto carry: deterministic ids, skips finished/dismissed/recurring/weekends/old, keeps progress', () => {
    const open = T({ status: 'in_progress', progress: 60, projectId: 'p', number: 4 })
    const plan = planAutoCarry([open, T({ status: 'completed' }), T({ carryDismissed: true }), T({ recurringId: 'r' }), T({ date: '2026-08-01' })], '2026-09-08')
    expect(plan).toHaveLength(1)
    expect(plan[0].row).toMatchObject({ _id: `${open._id}~2026-09-08`, progress: 60, projectId: 'p', number: 4, carriedFrom: '2026-09-07', autoCarried: true })
    expect(planAutoCarry([open, plan[0].row], '2026-09-08')).toHaveLength(0)
    expect(planAutoCarry([T({ date: '2026-09-11' })], '2026-09-12')).toHaveLength(0) // Saturday
    expect(planAutoCarry([open], '2026-09-08', { settings: { autoCarry: false } })).toHaveLength(0)
    expect(dayTypeOf('2026-09-08', { '2026-09-08': { dayType: 'leave' } })).toBe('leave')
    expect(forwardRow(T({ status: 'completed', progress: 100 }), '2026-09-08', 0).progress).toBe(0)
  })
})

describe('dates and validation', () => {
  it('date helpers', () => {
    expect(isValidISO('2026-02-30')).toBe(false)
    expect(isValidISO('2026-09-07')).toBe(true)
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(diffDays('2026-09-10', '2026-09-07')).toBe(3)
    expect(isWeekend('2026-09-12')).toBe(true)
  })
  it('schemas reject bad input', () => {
    expect(v.auth.register.safeParse({ name: 'Al', email: 'a@b.co', password: 'short' }).success).toBe(false)
    expect(v.auth.register.safeParse({ name: 'Alice', email: 'A@B.co', password: 'Passw0rd!x' }).data.email).toBe('a@b.co')
    expect(v.task.create.safeParse({ title: 'x', date: '2026-09-07', evil: 1 }).success).toBe(false)
    expect(v.task.patch.safeParse({ progress: 101 }).success).toBe(false)
    expect(v.project.create.safeParse({ name: 'A', key: 'a1' }).data.key).toBe('A1')
  })
})
