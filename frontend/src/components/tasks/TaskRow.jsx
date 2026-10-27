import { Copy, GripVertical, MoreHorizontal, PanelRight, Pencil, Trash2 } from 'lucide-react'
import { Icon } from '../icons'
import { DueBadge, ProjectChip } from '../projects/ProjectChip'
import { ThreadChip } from './ThreadChip'
import { ProgressControl } from './ProgressControl'
import { useThreadInfo } from '../../hooks/useThreads'
import { todayISO } from '../../utils/date'
import { Badge, Menu, Button } from '../ui'
import { StatusSelect } from './StatusSelect'
import { TimerButton } from './TimerButton'
import { actions } from '../../hooks/useActions'
import { useUI } from '../../store/useUI'
import { useStore } from '../../store/useStore'
import { cn, fmtHours } from '../../utils/format'

const PRIORITY_TONE = { high: 'bad', medium: 'warn', low: 'neutral' }

/** One task line: select, status, title, meta, timer, actions. */
export function TaskRow({ task, dragHandle, selectable = true, showDate = false, muted, hoursValue }) {
  const openTaskModal = useUI((s) => s.openTaskModal)
  const openDrawer = useUI((s) => s.openDrawer)
  const selected = useUI((s) => s.selection.includes(task.id))
  const toggleSelected = useUI((s) => s.toggleSelected)
  const hoursMode = useStore((s) => s.settings.hoursMode)
  const projects = useStore((s) => s.projects)
  const project = task.projectId ? projects.find((p) => p.id === task.projectId && !p.deletedAt) : null
  const done = task.status === 'completed'
  const info = useThreadInfo(task)
  const forwarded = info.inThread && !info.isTail && !task.resolvedBy && !done
  const canFinishEarlier = !done && (info.inThread || task.date < todayISO())
  const subDone = task.subtasks?.filter((x) => x.done).length
  const subTotal = task.subtasks?.length

  return (
    <div
      className={cn(
        'group flex items-start gap-2 rounded-input border border-transparent px-2 py-2 hover:border-line hover:bg-canvas',
        selected && 'border-primary/40 bg-primary/5',
        muted && 'italic',
        forwarded && 'opacity-60',
      )}
    >
      {dragHandle}
      {selectable && (
        <input
          type="checkbox" checked={selected} onChange={() => toggleSelected(task.id)}
          aria-label={`Select ${task.title}`} className="mt-1 size-4 shrink-0 accent-[var(--color-primary)]"
        />
      )}
      <StatusSelect status={task.status} onChange={(s) => actions.setStatus(task.id, s)} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => openTaskModal(task)} className={cn('block max-w-full text-left text-sm font-medium hover:text-primary', done && 'text-muted line-through')}>
          {task.ticketNo && <span className="mr-1.5 font-mono text-xs text-muted">#{task.ticketNo}</span>}
          <span className="break-words">{task.title}</span>
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {showDate && <Badge>{task.date}</Badge>}
          <ProjectChip project={project} number={task.number} />
          <ThreadChip task={task} />
          <DueBadge task={task} />
          {task.module && <Badge tone="primary">{task.module}</Badge>}
          {task.priority && task.priority !== 'medium' && <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>}
          {task.tags?.map((t) => <Badge key={t}>#{t}</Badge>)}
          {subTotal > 0 && <Badge>{subDone}/{subTotal} subtasks</Badge>}
          {task.carriedFrom && !info.inThread && <Badge tone="warn">carried over</Badge>}
          {(hoursMode !== 'equal' && task.hours != null) || hoursValue != null ? (
            <span className="text-xs text-muted">{fmtHours(hoursValue ?? task.hours)}h</span>
          ) : null}
        </div>
        {(task.status === 'in_progress' || (task.progress > 0 && !done)) && <ProgressControl task={task} editable className="mt-1.5 max-w-xs" />}
      </div>
      <div className="flex shrink-0 items-center opacity-70 group-hover:opacity-100 group-focus-within:opacity-100">
        <TimerButton taskId={task.id} compact />
        <Menu
          trigger={<Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Task actions"><MoreHorizontal size={16} /></Button>}
          items={[
            { label: 'Edit', icon: <Pencil size={14} />, onSelect: () => openTaskModal(task) },
            { label: 'Open details', icon: <PanelRight size={14} />, onSelect: () => openDrawer(task.id) },
            { label: 'Move to project…', icon: <Icon name="move" size={14} />, onSelect: () => useUI.getState().openMoveDialog([task.id]) },
            ...(info.inThread ? [{ label: 'View thread', icon: <Icon name="thread" size={14} />, onSelect: () => openDrawer(task.id) }] : []),
            ...(canFinishEarlier ? [{ label: 'Finished on another day…', icon: <Icon name="history" size={14} />, onSelect: () => useUI.getState().openFinishDialog(task.id) }] : []),
            ...(task.autoCarried ? [{ label: 'Remove from this day', icon: <Icon name="archive" size={14} />, onSelect: () => actions.removeCarried(task.id) }] : []),
            ...(!done && info.isTail ? [task.carryDismissed
              ? { label: 'Resume carrying forward', icon: <Icon name="forward" size={14} />, onSelect: () => actions.resumeCarrying(task.id) }
              : { label: 'Stop carrying forward', icon: <Icon name="forward" size={14} />, onSelect: () => actions.stopCarrying(task.id) }] : []),
            { label: 'Duplicate', icon: <Copy size={14} />, onSelect: () => actions.duplicate(task.id) },
            { separator: true },
            { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onSelect: () => actions.remove(task.id) },
          ]}
        />
      </div>
    </div>
  )
}

export const DragHandle = (props) => (
  <button type="button" aria-label="Drag to reorder" className="mt-0.5 cursor-grab touch-none text-muted/60 hover:text-ink active:cursor-grabbing" {...props}>
    <GripVertical size={16} />
  </button>
)

