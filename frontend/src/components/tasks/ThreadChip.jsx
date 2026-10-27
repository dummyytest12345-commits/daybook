import { format } from 'date-fns'
import { Icon } from '../icons'
import { useThreadInfo } from '../../hooks/useThreads'
import { useUI } from '../../store/useUI'
import { fromISO } from '../../utils/date'
import { cn } from '../../utils/format'

const d = (iso) => format(fromISO(iso), 'd MMM')

/**
 * Small chip that tells where a row sits in its thread and opens the conversation.
 * Nothing is rendered for ordinary single-day tasks.
 */
export function ThreadChip({ task }) {
  const info = useThreadInfo(task)
  const openDrawer = useUI((s) => s.openDrawer)
  if (!info.inThread) return null

  let text
  let tone = 'bg-primary/10 text-primary'
  let title
  if (task.resolvedBy) {
    const by = info.rows.find((r) => r.id === task.resolvedBy)
    text = by ? `Done ${d(by.date)}` : 'Done later'
    tone = 'bg-st-completed/10 text-st-completed'
    title = by ? `Completed because the work was finished on ${d(by.date)}` : 'Completed later in the thread'
  } else if (!info.isTail) {
    text = `Continued ${d(info.next.date)}`
    tone = 'bg-line/70 text-muted'
    title = `Carried forward to ${d(info.next.date)}`
  } else {
    text = `Day ${info.position}`
    title = `Day ${info.position} of ${info.total}. Started ${d(info.firstDate)}${task.carriedFrom ? `, carried from ${d(task.carriedFrom)}` : ''}`
    if (info.position >= 3) tone = 'bg-st-progress/10 text-st-progress'
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); openDrawer(task.id) }}
      title={`${title}. Open thread`}
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition hover:opacity-80', tone)}
    >
      <Icon name="thread" size={11} />
      {text}
      <span className="sr-only">. Open thread</span>
    </button>
  )
}
