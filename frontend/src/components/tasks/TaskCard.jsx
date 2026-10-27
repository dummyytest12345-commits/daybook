import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Badge, StatusBadge } from '../ui'
import { useUI } from '../../store/useUI'
import { cn } from '../../utils/format'
import { useStatusLabel } from './StatusSelect'
import { DueBadge, ProjectChip } from '../projects/ProjectChip'
import { useStore } from '../../store/useStore'
import { ProgressControl } from './ProgressControl'

/** Compact draggable card for Week and Board views. */
export function TaskCard({ task, showStatus = true, overlay }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled: overlay })
  const openTaskModal = useUI((s) => s.openTaskModal)
  const label = useStatusLabel()
  const project = useStore((s) => (task.projectId ? s.projects.find((p) => p.id === task.projectId && !p.deletedAt) : null))
  const style = transform && !overlay ? { transform: CSS.Translate.toString(transform) } : undefined
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onDoubleClick={() => openTaskModal(task)}
      onKeyDown={(e) => { if (e.key === 'Enter') openTaskModal(task); else listeners?.onKeyDown?.(e) }}
      className={cn(
        'cursor-grab touch-none rounded-input border border-line bg-surface p-2 text-left shadow-card active:cursor-grabbing',
        isDragging && 'opacity-40',
        overlay && 'rotate-1 shadow-pop',
      )}
    >
      <p className={cn('text-xs font-medium leading-snug', task.status === 'completed' && 'text-muted line-through')}>
        {!project && task.ticketNo && <span className="mr-1 font-mono text-muted">#{task.ticketNo}</span>}
        {task.title}
      </p>
      {task.status === 'in_progress' && <ProgressControl task={task} compact className="mt-1.5" />}
      <div className="mt-1.5 flex flex-wrap gap-1">
        <ProjectChip project={project} number={task.number} link={false} />
        <DueBadge task={task} />
        {showStatus && <StatusBadge status={task.status} label={label(task.status)} />}
        {task.module && <Badge tone="primary">{task.module}</Badge>}
        {task.priority === 'high' && <Badge tone="bad">high</Badge>}
      </div>
    </div>
  )
}

export function DropColumn({ id, className, children, ...props }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={cn(className, isOver && 'ring-2 ring-primary/60')} {...props}>
      {children}
    </div>
  )
}
