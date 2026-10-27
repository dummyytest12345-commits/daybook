import { CalendarClock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDate, todayISO } from '../../utils/date'
import { isOverdue } from '../../selectors/projects'
import { useStore } from '../../store/useStore'
import { cn } from '../../utils/format'

/** Coloured KEY-number chip that links to the project. Renders nothing for unassigned tasks. */
export function ProjectChip({ project, number, link = true, className }) {
  if (!project) return null
  const inner = (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', className)}
      style={{ color: `color-mix(in srgb, ${project.color} 62%, var(--color-ink))`, background: `${project.color}1f` }}
      title={project.name}
    >
      <span className="size-1.5 rounded-full" style={{ background: project.color }} aria-hidden />
      {project.key}{number ? `-${number}` : ''}
    </span>
  )
  return link ? <Link to={`/projects/${project.id}`} onClick={(e) => e.stopPropagation()} className="hover:opacity-80">{inner}</Link> : inner
}

/** Due-date chip: red when overdue, amber when due within 2 days. */
export function DueBadge({ task }) {
  const fmt = useStore((s) => s.settings.dateFormat)
  if (!task.dueDate) return null
  const done = task.status === 'completed'
  const over = isOverdue(task)
  const soon = !done && !over && task.dueDate <= new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10) && task.dueDate >= todayISO()
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', over ? 'bg-st-blocked/10 text-st-blocked' : soon ? 'bg-st-progress/10 text-st-progress' : 'bg-line/70 text-muted')}
      title={over ? 'Overdue' : 'Due date'}
    >
      <CalendarClock size={11} aria-hidden />
      {over && <span className="sr-only">Overdue: </span>}
      {formatDate(task.dueDate, fmt)}
    </span>
  )
}
