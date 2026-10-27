import { AlertTriangle, CalendarClock, CheckCircle2, MoreHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Button } from '../ui'
import { ProgressBar as ProgressBarX } from '../ui/Progress'
import { Icon, ProjectIcon } from '../icons'
import { ProjectMenu } from './ProjectMenu'
import { PROJECT_STATUSES } from '../../schemas/project'
import { useStore } from '../../store/useStore'
import { formatDate } from '../../utils/date'
import { fmtHours, pluralize } from '../../utils/format'

const HEALTH = {
  good: { label: 'On track', tone: 'good', Icon: CheckCircle2 },
  warn: { label: 'At risk', tone: 'warn', Icon: AlertTriangle },
  bad: { label: 'Off track', tone: 'bad', Icon: AlertTriangle },
  done: { label: 'Complete', tone: 'good', Icon: CheckCircle2 },
}

/** Health text always has an icon and a label, never colour alone. */
export function HealthBadge({ health, total }) {
  if (!total) return <Badge>No tasks yet</Badge>
  const h = HEALTH[health]
  return <Badge tone={h.tone}><h.Icon size={12} aria-hidden />{h.label}</Badge>
}

export function ProjectCard({ project, stats }) {
  const fmt = useStore((s) => s.settings.dateFormat)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const status = PROJECT_STATUSES.find((s) => s.id === project.status)
  return (
    <article className="group relative flex flex-col rounded-card border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className="flex items-start gap-3">
        <ProjectIcon icon={project.icon} color={project.color} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold">
            <Link to={`/projects/${project.id}`} className="after:absolute after:inset-0 after:content-[''] hover:text-primary">{project.name}</Link>
          </h3>
          <p className="flex items-center gap-2 text-xs text-muted"><span className="font-mono">{project.key}</span>{project.archivedAt ? <Badge>Archived</Badge> : status?.id !== 'active' && <Badge tone="warn">{status?.label}</Badge>}</p>
        </div>
        <div className="relative z-10 flex items-center">
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-pressed={project.favorite} aria-label={project.favorite ? `Remove ${project.name} from favourites` : `Add ${project.name} to favourites`} onClick={() => toggleFavorite(project.id)}>
            <Icon name="star" size={16} filled={project.favorite} className={project.favorite ? 'text-st-progress' : ''} />
          </Button>
          <ProjectMenu project={project} taskCount={stats.total} trigger={<Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Actions for ${project.name}`}><MoreHorizontal size={16} /></Button>} />
        </div>
      </div>
      {project.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{project.description}</p>}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs"><span className="font-medium">{stats.done}/{stats.total} done</span><span className="text-muted">avg progress</span></div>
        <ProgressBarX value={stats.avgProgress} done={stats.total > 0 && stats.done === stats.total} ariaLabel={`${project.name} progress`} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <HealthBadge health={stats.health} total={stats.total} />
        {stats.overdue > 0 && <Badge tone="bad">{pluralize(stats.overdue, 'overdue task')}</Badge>}
        {stats.blocked > 0 && <Badge tone="bad">{stats.blocked} blocked</Badge>}
        <span>{fmtHours(stats.hours)}h logged</span>
        {project.targetDate && (
          <span className="inline-flex items-center gap-1"><CalendarClock size={12} aria-hidden />{formatDate(project.targetDate, fmt)}{stats.daysLeft != null && stats.progress < 1 ? ` · ${stats.daysLeft < 0 ? `${-stats.daysLeft}d late` : `${stats.daysLeft}d left`}` : ''}</span>
        )}
      </div>
    </article>
  )
}
