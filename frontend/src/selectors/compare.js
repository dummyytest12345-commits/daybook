/**
 * Compare two summaries. `goodWhen` says whether an increase is good/bad/neutral,
 * so the UI can colour deltas correctly.
 */
const METRICS = {
  total: 'neutral',
  completed: 'up',
  avgProgress: 'up',
  completionRate: 'up',
  hours: 'neutral',
  utilisation: 'up',
  avgTasksPerDay: 'neutral',
  velocity: 'up',
  blocked: 'down',
  carryOver: 'down',
  streak: 'up',
}

export function comparePeriods(current, previous) {
  const out = {}
  for (const [key, goodWhen] of Object.entries(METRICS)) {
    const cur = current[key] ?? 0
    const prev = previous?.[key] ?? 0
    const delta = cur - prev
    out[key] = {
      current: cur,
      previous: prev,
      delta,
      pct: prev ? delta / prev : cur ? 1 : 0,
      direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
      tone: delta === 0 || goodWhen === 'neutral' ? 'neutral' : (delta > 0) === (goodWhen === 'up') ? 'good' : 'bad',
    }
  }
  return out
}
