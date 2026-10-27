import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { activeTasks, inRange } from '../selectors/common'
import { filterTasks, EMPTY_FILTERS } from '../selectors/filter'
import { comparePeriods } from '../selectors/compare'
import { buildHeatmap } from '../selectors/heatmap'
import { insights } from '../selectors/insights'
import { pivot } from '../selectors/pivot'
import { burnUp, moduleBreakdown, progressDistribution, taskAging, trend, weekdayPattern } from '../selectors/groupBy'
import { summarize } from '../selectors/summarize'
import { previousRange, todayISO } from '../utils/date'
import { projectMap, taskRef } from '../selectors/projects'

/** Context every selector needs. */
export function useCtx() {
  const dayLogs = useStore((s) => s.dayLogs)
  const settings = useStore((s) => s.settings)
  const projects = useStore((s) => s.projects)
  return useMemo(() => {
    const map = projectMap(projects)
    return { dayLogs, settings, projects, projectMap: map, projectIds: new Set(map.keys()), refOf: (t) => taskRef(t, map) }
  }, [dayLogs, settings, projects])
}

export function useAllTasks() {
  const tasks = useStore((s) => s.tasks)
  return useMemo(() => activeTasks(tasks), [tasks])
}

/** Tasks in a range with filters applied, plus mutation helpers from the store. */
export function useTasks(range, filters = EMPTY_FILTERS) {
  const all = useAllTasks()
  const ctx = useCtx()
  const tasks = useMemo(
    () => filterTasks(range ? inRange(all, range) : all, filters, ctx),
    [all, range, filters, ctx],
  )
  const s = useStore.getState
  return {
    tasks,
    all,
    add: (t) => s().addTask(t),
    update: (id, patch, label) => s().updateTask(id, patch, label),
    remove: (id) => s().removeTask(id),
    duplicate: (id) => s().duplicateTask(id),
    move: (id, date, idx) => s().moveTask(id, date, idx),
    bulkUpdate: (ids, patch) => s().bulkUpdate(ids, patch),
  }
}

export function useDayLog(date) {
  const log = useStore((s) => s.dayLogs[date])
  const settings = useStore((s) => s.settings)
  const setDayLog = useStore((s) => s.setDayLog)
  return {
    log, dayType: log?.dayType, capacity: log?.capacityHours ?? settings.dailyCapacity, note: log?.note || '',
    set: (patch) => setDayLog(date, patch),
  }
}

export function useSummary(range, filters) {
  const all = useAllTasks()
  const ctx = useCtx()
  return useMemo(() => {
    const tasks = filterTasks(inRange(all, range), filters || EMPTY_FILTERS, ctx)
    return { tasks, summary: summarize(tasks, range, { ...ctx, allTasks: all }) }
  }, [all, range, filters, ctx])
}

export function useComparison(range, filters) {
  const all = useAllTasks()
  const ctx = useCtx()
  const { summary } = useSummary(range, filters)
  return useMemo(() => {
    const prevRange = previousRange(range)
    const prevTasks = filterTasks(inRange(all, prevRange), filters || EMPTY_FILTERS, ctx)
    const prev = summarize(prevTasks, prevRange, { ...ctx, allTasks: all })
    return { previous: prev, prevRange, deltas: comparePeriods(summary, prev) }
  }, [all, range, filters, ctx, summary])
}

export function useTrend(range, groupBy = 'day', filters) {
  const { tasks } = useSummary(range, filters)
  const ctx = useCtx()
  return useMemo(() => trend(tasks, range, groupBy, ctx), [tasks, range, groupBy, ctx])
}

export function useHeatmap(range) {
  const all = useAllTasks()
  const ws = useStore((s) => s.settings.weekStartsOn)
  return useMemo(() => buildHeatmap(inRange(all, range), range, ws), [all, range, ws])
}

export function usePivot(range, config, filters) {
  const { tasks } = useSummary(range, filters)
  const ctx = useCtx()
  return useMemo(() => pivot(tasks, config, ctx), [tasks, config, ctx])
}

export function useInsights(range, filters) {
  const { tasks, summary } = useSummary(range, filters)
  const { deltas } = useComparison(range, filters)
  const ctx = useCtx()
  return useMemo(() => insights(tasks, summary, deltas, { ...ctx, today: todayISO() }), [tasks, summary, deltas, ctx])
}

/** All the chart series for the analytics page in one memoised bundle. */
export function useAnalytics(range, groupBy, filters) {
  const { tasks, summary } = useSummary(range, filters)
  const all = useAllTasks()
  const ctx = useCtx()
  return useMemo(
    () => ({
      tasks, summary,
      series: trend(tasks, range, groupBy, ctx),
      daily: trend(tasks, range, 'day', ctx),
      burn: burnUp(tasks, range),
      modules: moduleBreakdown(tasks, ctx),
      weekdays: weekdayPattern(tasks),
      progressBins: progressDistribution(tasks),
      aging: taskAging(all.filter((t) => tasks.some((x) => x.id === t.id)), todayISO()),
    }),
    [tasks, summary, range, groupBy, ctx, all],
  )
}
