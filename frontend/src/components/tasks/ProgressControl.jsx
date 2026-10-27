import { useEffect, useState } from 'react'
import { ProgressBar, ProgressChips, ProgressRing, ProgressSlider, progressLabel } from '../ui/Progress'
import { actions } from '../../hooks/useActions'
import { progressOf } from '../../selectors/progress'
import { cn } from '../../utils/format'

/**
 * Task progress.
 *  variant "row":   compact slider + percentage, used inside task rows
 *  variant "panel": ring, stage wording, slider and quick-set chips (task drawer)
 *  not editable:    read-only bar
 */
export function ProgressControl({ task, editable = false, compact = false, variant = 'row', className }) {
  const value = progressOf(task)
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const done = task.status === 'completed'
  const commit = (v) => v !== value && actions.setProgress(task.id, v)

  if (!editable) {
    if (task.status === 'pending' && value === 0) return null
    return <ProgressBar value={value} done={done} size="sm" className={cn(compact && 'min-w-16', className)} />
  }

  if (variant === 'panel') {
    return (
      <div className={cn('flex items-center gap-4 rounded-card border border-line bg-canvas p-3', className)}>
        <ProgressRing value={draft} done={done} size={72} stroke={7} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">{progressLabel(draft, task.status)}</p>
            <p className="text-xs text-muted">{done ? 'Completed' : task.status === 'blocked' ? 'Blocked, progress is kept' : 'Drag or pick a value'}</p>
          </div>
          <ProgressSlider value={draft} onChange={setDraft} onCommit={commit} label={`Progress for ${task.title}`} />
          <ProgressChips value={draft} onPick={(n) => { setDraft(n); commit(n) }} />
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <ProgressSlider value={draft} onChange={setDraft} onCommit={commit} label={`Progress for ${task.title}`} className="min-w-24" />
      <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-muted">{draft}%</span>
    </div>
  )
}
