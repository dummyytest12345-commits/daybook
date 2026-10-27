import { useMemo } from 'react'
import { useStore } from '../store/useStore'

const bump = (map, key) => key && map.set(key, (map.get(key) || 0) + 1)
const ranked = (map) => [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v)

/** Values the user has used before, most used first: modules, tickets, tags, plus the project list. */
export function useSuggestionSources() {
  const tasks = useStore((s) => s.tasks)
  const modules = useStore((s) => s.settings.modules)
  const projects = useStore((s) => s.projects)
  return useMemo(() => {
    const mod = new Map(modules.map((m) => [m, 0]))
    const tick = new Map()
    const tag = new Map()
    for (const t of tasks) {
      if (t.deletedAt) continue
      bump(mod, t.module)
      bump(tick, t.ticketNo)
      t.tags?.forEach((x) => bump(tag, x))
    }
    return {
      '#': ranked(mod).map((v) => ({ value: v.replace(/\s+/g, ''), label: v })),
      '!': ['high', 'medium', 'low'].map((v) => ({ value: v, label: v })),
      '~': projects.filter((p) => !p.deletedAt && !p.archivedAt).map((p) => ({ value: p.key, label: p.name, hint: p.key, color: p.color })),
      '@': ranked(tick).map((v) => ({ value: v, label: v })),
      '+': ranked(tag).map((v) => ({ value: v, label: v })),
    }
  }, [tasks, modules, projects])
}

/** Options for the token being typed: prefix matches first, then "contains", at most 6. */
export function filterSuggestions(sources, token) {
  if (!token) return []
  const all = sources[token.trigger] || []
  const q = token.query.toLowerCase()
  if (!q) return all.slice(0, 6)
  const key = (o) => `${o.value} ${o.label}`.toLowerCase()
  const starts = all.filter((o) => o.value.toLowerCase().startsWith(q) || o.label.toLowerCase().startsWith(q))
  const rest = all.filter((o) => !starts.includes(o) && key(o).includes(q))
  return [...starts, ...rest].filter((o) => o.value.toLowerCase() !== q).slice(0, 6)
}
