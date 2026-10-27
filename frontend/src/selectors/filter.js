import { dayTypeOf } from './common'

export const EMPTY_FILTERS = { q: '', status: [], module: [], tag: [], priority: [], dayType: [], project: [] }

/** Pure filter over tasks. dayLogs/settings are only needed for the dayType filter. */
export function filterTasks(tasks, f = EMPTY_FILTERS, ctx = {}) {
  const q = (f.q || '').trim().toLowerCase()
  return tasks.filter((t) => {
    if (f.status?.length && !f.status.includes(t.status)) return false
    if (f.module?.length && !f.module.includes(t.module)) return false
    if (f.priority?.length && !f.priority.includes(t.priority)) return false
    if (f.project?.length) {
      // 'none' matches tasks without a project (or pointing at a deleted one)
      const live = ctx.projectIds
      const pid = t.projectId && (!live || live.has(t.projectId)) ? t.projectId : 'none'
      if (!f.project.includes(pid)) return false
    }
    if (f.tag?.length && !(t.tags || []).some((x) => f.tag.includes(x))) return false
    if (f.dayType?.length && !f.dayType.includes(dayTypeOf(t.date, ctx.dayLogs, ctx.settings))) return false
    if (q) {
      const hay = `${t.title} ${t.notes || ''} ${t.ticketNo || ''} ${ctx.refOf?.(t) || ''} ${t.module || ''} ${(t.tags || []).join(' ')}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

export const hasFilters = (f) =>
  !!(f.q || f.status?.length || f.module?.length || f.tag?.length || f.priority?.length || f.dayType?.length || f.project?.length)
