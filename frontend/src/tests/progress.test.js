import { beforeEach, describe, expect, it } from 'vitest'
import { T } from './helpers'
import { clampProgress, progressOf, withProgressRules } from '../selectors/progress'
import { useStore } from '../store/useStore'
import { defaultSettings } from '../schemas/settings'
import { openRepository } from '../services/repository'

describe('progress rules', () => {
  it('In Progress starts at 0%, Completed is 100%, Pending is 0%', () => {
    expect(withProgressRules(T({ status: 'pending' }), { status: 'in_progress' })).toMatchObject({ status: 'in_progress', progress: 0 })
    expect(withProgressRules(T({ status: 'in_progress', progress: 40 }), { status: 'completed' })).toMatchObject({ status: 'completed', progress: 100 })
    expect(withProgressRules(T({ status: 'in_progress', progress: 40 }), { status: 'pending' }).progress).toBe(0)
    expect(withProgressRules(T({ status: 'completed', progress: 100 }), { status: 'in_progress' }).progress).toBe(0)
  })
  it('Blocked keeps what was reached when it resumes', () => {
    expect(withProgressRules(T({ status: 'blocked', progress: 60 }), { status: 'in_progress' }).progress).toBe(60)
  })
  it('setting progress starts or completes the task', () => {
    expect(withProgressRules(T({ status: 'pending' }), { progress: 30 })).toMatchObject({ status: 'in_progress', progress: 30 })
    expect(withProgressRules(T({ status: 'in_progress', progress: 30 }), { progress: 100 })).toMatchObject({ status: 'completed', progress: 100 })
    expect(withProgressRules(T({ status: 'completed' }), { progress: 70 })).toMatchObject({ status: 'in_progress', progress: 70 })
  })
  it('the task form re-sending an unchanged progress with a new status does not fight the status', () => {
    expect(withProgressRules(T({ status: 'in_progress', progress: 40 }), { status: 'completed', progress: 40 })).toMatchObject({ status: 'completed', progress: 100 })
  })
  it('clamps and defaults', () => {
    expect(clampProgress(150)).toBe(100)
    expect(clampProgress(-5)).toBe(0)
    expect(progressOf(T({ status: 'completed' }))).toBe(100)
    expect(progressOf(T())).toBe(0)
  })
})

describe('progress in the store', () => {
  beforeEach(() => {
    localStorage.clear()
    openRepository('prog')
    useStore.setState({ userId: 'prog', ready: true, tasks: [], projects: [], dayLogs: {}, settings: defaultSettings(), undoStack: [], redoStack: [], activity: [] })
  })
  const st = () => useStore.getState()
  it('walks pending -> in progress -> update -> complete', () => {
    const t = st().addTask({ title: 'A', date: '2026-09-07' })
    st().updateTask(t.id, { status: 'in_progress' })
    expect(st().tasks[0]).toMatchObject({ status: 'in_progress', progress: 0 })
    st().updateTask(t.id, { progress: 45 })
    expect(st().tasks[0].progress).toBe(45)
    st().updateTask(t.id, { progress: 100 })
    expect(st().tasks[0]).toMatchObject({ status: 'completed', progress: 100 })
    expect(st().tasks[0].completedAt).toBeTruthy()
  })
  it('carry forward keeps the progress; completing it resolves earlier days to 100%', () => {
    const t = st().addTask({ title: 'A', date: '2026-09-07', status: 'in_progress' })
    st().updateTask(t.id, { progress: 60 })
    st().runAutoCarry('2026-09-08')
    const copy = st().tasks.find((x) => x.date === '2026-09-08')
    expect(copy.progress).toBe(60)
    st().updateTask(copy.id, { status: 'completed' })
    expect(st().tasks.find((x) => x.id === t.id)).toMatchObject({ status: 'completed', progress: 100 })
  })
})
