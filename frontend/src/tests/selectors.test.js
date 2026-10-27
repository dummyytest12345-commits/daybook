import { describe, expect, it } from 'vitest'
import { T, ctx } from './helpers'
import { summarize, streak } from '../selectors/summarize'
import { hoursMap, dayTypeOf } from '../selectors/common'
import { comparePeriods } from '../selectors/compare'
import { trend, groupByDate, burnUp, moduleBreakdown } from '../selectors/groupBy'
import { buildHeatmap } from '../selectors/heatmap'
import { pivot } from '../selectors/pivot'
import { filterTasks } from '../selectors/filter'
import { insights } from '../selectors/insights'

const range = { start: '2026-09-07', end: '2026-09-13' } // Mon-Sun

describe('day types & hours', () => {
  it('detects weekends and holidays', () => {
    const c = ctx({ holidays: [{ date: '2026-09-08', name: 'X' }] })
    expect(dayTypeOf('2026-09-12', {}, c.settings)).toBe('weekend')
    expect(dayTypeOf('2026-09-08', {}, c.settings)).toBe('holiday')
    expect(dayTypeOf('2026-09-09', {}, c.settings)).toBe('work')
    expect(dayTypeOf('2026-09-09', { '2026-09-09': { dayType: 'leave' } }, c.settings)).toBe('leave')
  })
  it('splits 8h equally among the day tasks', () => {
    const tasks = [T(), T(), T(), T()]
    const m = hoursMap(tasks, {}, ctx().settings)
    expect(m.get(tasks[0].id)).toBe(2)
  })
  it('manual mode uses task hours', () => {
    const tasks = [T({ hours: 3 })]
    expect(hoursMap(tasks, {}, ctx({ hoursMode: 'manual' }).settings).get(tasks[0].id)).toBe(3)
  })
})

describe('summarize', () => {
  const tasks = [
    T({ status: 'completed' }),
    T({ status: 'completed' }),
    T({ status: 'blocked', date: '2026-09-08' }),
    T({ status: 'in_progress', date: '2026-09-09' }),
  ]
  it('computes KPIs', () => {
    const s = summarize(tasks, range, ctx())
    expect(s.total).toBe(4)
    expect(s.completed).toBe(2)
    expect(s.completionRate).toBe(0.5)
    expect(s.blocked).toBe(1)
    expect(s.workingDays).toBe(5)
    expect(s.hours).toBe(24)
    expect(s.capacity).toBe(40)
    expect(s.utilisation).toBeCloseTo(0.6)
    expect(s.avgTasksPerDay).toBe(0.8)
  })
  it('flags weekend work', () => {
    const s = summarize([T({ date: '2026-09-12' })], range, ctx())
    expect(s.weekendWorkDays).toEqual(['2026-09-12'])
  })
  it('streak skips weekends', () => {
    const t = [T({ date: '2026-09-10' }), T({ date: '2026-09-11' }), T({ date: '2026-09-14' })]
    expect(streak(t, {}, ctx().settings, '2026-09-14')).toBe(3)
    expect(streak(t, {}, ctx().settings, '2026-09-15')).toBe(3)
    expect(streak([], {}, ctx().settings, '2026-09-15')).toBe(0)
  })
})

describe('compare', () => {
  it('colours deltas by good/bad', () => {
    const c = comparePeriods({ completed: 5, blocked: 3, total: 9 }, { completed: 2, blocked: 1, total: 4 })
    expect(c.completed.tone).toBe('good')
    expect(c.total.tone).toBe('neutral')
    expect(c.completed.pct).toBe(1.5)
  })
})

describe('series', () => {
  const tasks = [T({ status: 'completed' }), T({ status: 'pending', date: '2026-09-09' })]
  it('trend includes empty days', () => {
    const t = trend(tasks, range, 'day', ctx())
    expect(t).toHaveLength(7)
    expect(t[0].completed).toBe(1)
    expect(t[1].total).toBe(0)
    expect(t[5].capacity).toBe(0)
  })
  it('trend by week/month', () => {
    expect(trend(tasks, range, 'week', ctx())).toHaveLength(1)
    expect(trend(tasks, { start: '2026-08-25', end: '2026-09-13' }, 'month', ctx())).toHaveLength(2)
  })
  it('burn-up is cumulative', () => {
    const b = burnUp(tasks, range)
    expect(b.at(-1)).toMatchObject({ planned: 2, completed: 1 })
  })
  it('groups by date and module', () => {
    expect(Object.keys(groupByDate(tasks))).toHaveLength(2)
    expect(moduleBreakdown(tasks, ctx())[0].module).toBe('Unassigned')
  })
})

describe('heatmap, pivot, filter', () => {
  it('builds week columns with levels', () => {
    const h = buildHeatmap([T(), T(), T()], range)
    expect(h.weeks).toHaveLength(1)
    expect(h.weeks[0].days[0].level).toBe(4)
    expect(h.weeks[0].days[1].level).toBe(0)
  })
  it('pivots module x status', () => {
    const p = pivot(
      [T({ module: 'A', status: 'completed' }), T({ module: 'A' }), T({ module: 'B' })],
      { rows: 'module', cols: 'status' },
      ctx(),
    )
    expect(p.grandTotal).toBe(3)
    expect(p.rows.find((r) => r.row === 'A').total).toBe(2)
  })
  it('filters by text, status, module', () => {
    const tasks = [T({ title: 'Fix login', module: 'Auth' }), T({ title: 'Other', status: 'completed' })]
    expect(filterTasks(tasks, { q: 'login' })).toHaveLength(1)
    expect(filterTasks(tasks, { status: ['completed'] })).toHaveLength(1)
    expect(filterTasks(tasks, { module: ['Auth'] })).toHaveLength(1)
  })
})

describe('insights', () => {
  it('returns text insights', () => {
    const tasks = [T({ status: 'completed' }), T({ status: 'blocked' })]
    const s = summarize(tasks, range, ctx())
    const list = insights(tasks, s, null, { today: '2026-09-10' })
    expect(list.some((i) => i.id === 'best-day')).toBe(true)
    expect(list.some((i) => i.id === 'blocked')).toBe(true)
  })
})
