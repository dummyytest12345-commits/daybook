/**
 * Progress rules (0-100 %), one place so the UI, store and backend agree:
 *  - moving to In Progress starts at 0 % (unless it was Blocked, which keeps what was reached)
 *  - Completed is always 100 %
 *  - Pending is 0 %
 *  - setting progress to 100 completes the task; above 0 on a Pending task starts it
 */
export const clampProgress = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)))

/** Effective progress for display (older tasks have none stored). */
export const progressOf = (t) => (t.status === 'completed' ? 100 : t.progress != null ? clampProgress(t.progress) : 0)

/** Returns the patch to apply, extended with the progress/status side effects. */
export function withProgressRules(task, patch) {
  const out = { ...patch }
  const touched = 'progress' in patch && clampProgress(patch.progress) !== progressOf(task)
  if ('progress' in patch) out.progress = clampProgress(patch.progress)
  if (touched) {
    const p = out.progress
    if (p >= 100) out.status = 'completed'
    else if (!patch.status || patch.status === task.status) {
      if (p > 0 && (task.status === 'pending' || task.status === 'completed')) out.status = 'in_progress'
      else if (task.status === 'completed') out.status = 'in_progress'
    }
  }
  const next = out.status
  if (next && next !== task.status && !(touched && out.progress < 100 && next !== 'completed' && !patch.status)) {
    if (next === 'completed') out.progress = 100
    else if (!touched) {
      if (next === 'in_progress') out.progress = task.status === 'blocked' ? progressOf(task) : 0
      else if (next === 'pending') out.progress = 0
    }
  }
  return out
}
