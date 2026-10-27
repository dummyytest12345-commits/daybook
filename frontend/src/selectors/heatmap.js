import { addDays, startOfWeek } from 'date-fns'
import { fromISO, toISO } from '../utils/date'

/**
 * GitHub-style calendar: array of week columns, each with 7 day cells.
 * level 0..4 is scaled by the busiest day in the window.
 */
export function buildHeatmap(tasks, { start, end }, weekStartsOn = 1) {
  const counts = {}
  for (const t of tasks) counts[t.date] = (counts[t.date] || 0) + 1
  const max = Math.max(1, ...Object.values(counts))
  const first = startOfWeek(fromISO(start), { weekStartsOn })
  const last = fromISO(end)
  const weeks = []
  for (let w = first; w <= last; w = addDays(w, 7)) {
    const days = []
    for (let i = 0; i < 7; i++) {
      const d = addDays(w, i)
      const iso = toISO(d)
      const inside = iso >= start && iso <= end
      const count = inside ? counts[iso] || 0 : 0
      const level = !count ? 0 : Math.min(4, Math.ceil((count / max) * 4))
      days.push({ date: iso, count, level, inside })
    }
    weeks.push({ start: toISO(w), days })
  }
  return { weeks, max }
}
