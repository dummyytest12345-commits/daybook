/**
 * Progress rules (0-100 %). Same rules as the frontend (selectors/progress.js):
 *  - moving to In Progress starts at 0 % (Blocked keeps what was reached)
 *  - Completed is always 100 %, Pending is 0 %
 *  - setting progress to 100 completes the task; above 0 on a Pending/Completed task makes it In Progress
 */
export const clampProgress = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)))
export const progressOf = (t) => (t.status === 'completed' ? 100 : t.progress != null ? clampProgress(t.progress) : 0)

/** `task` = current values, `patch` = requested changes. Returns the patch with side effects applied. */
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
  if (out.status && out.status !== task.status) out.completedAt = out.status === 'completed' ? new Date() : null
  return out
}
