import { ArrowLeft, CalendarClock, MoreHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, CardHeader, EmptyState, Input, TabPanel, Tabs } from '../components/ui'
import { Icon, ProjectIcon } from '../components/icons'
import { BurnUp, StatusDonut } from '../components/analytics/charts'
import { KpiCard } from '../components/analytics/KpiCard'
import { HealthBadge } from '../components/projects/ProjectCard'
import { ProjectMenu } from '../components/projects/ProjectMenu'
import { QuickAdd } from '../components/tasks/QuickAdd'
import { BulkBar } from '../components/tasks/BulkBar'
import { TaskRow } from '../components/tasks/TaskRow'
import { BoardView } from '../components/views/BoardView'
import { useAllTasks, useCtx } from '../hooks/useData'
import { useSeo } from '../hooks/useSeo'
import { burnUp } from '../selectors/groupBy'
import { filterTasks } from '../selectors/filter'
import { projectStats } from '../selectors/projects'
import { summarize } from '../selectors/summarize'
import { PROJECT_STATUSES } from '../schemas/project'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { addDaysISO, formatDate, todayISO } from '../utils/date'
import { fmtHours, fmtPct } from '../utils/format'

/** One project: overview, list (grouped by status) and board with WIP limits. */
export default function ProjectPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const project = useStore((s) => s.projects.find((p) => p.id === id && !p.deletedAt))
  useSeo({ title: project ? project.name : 'Project' })
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const setWipLimit = useStore((s) => s.setWipLimit)
  const statuses = useStore((s) => s.settings.statuses)
  const fmt = useStore((s) => s.settings.dateFormat)
  const openTaskModal = useUI((s) => s.openTaskModal)
  const all = useAllTasks()
  const ctx = useCtx()
  const [tab, setTab] = useState('overview')
  const [q, setQ] = useState('')

  const tasks = useMemo(() => all.filter((t) => t.projectId === id), [all, id])
  const stats = useMemo(() => (project ? projectStats(project, tasks, ctx) : null), [project, tasks, ctx])
  const range = useMemo(() => {
    const dates = tasks.map((t) => t.date).sort()
    const start = dates[0] || todayISO()
    const end = [dates.at(-1) || todayISO(), todayISO()].sort().at(-1)
    return { start: end > addDaysISO(start, 120) ? addDaysISO(end, -120) : start, end }
  }, [tasks])
  const summary = useMemo(() => summarize(tasks, range, { ...ctx, allTasks: all }), [tasks, range, ctx, all])
  const burn = useMemo(() => burnUp(tasks, range), [tasks, range])
  const shown = useMemo(() => filterTasks(tasks, { q, status: [], module: [], tag: [], priority: [], dayType: [], project: [] }, ctx), [tasks, q, ctx])

  if (!project) {
    return <Card><EmptyState illustration={<Icon name="compass" size={40} className="text-muted" />} title="Project not found" text="It may have been deleted." action={<Link to="/projects" className="font-medium text-primary hover:underline">Back to projects</Link>} /></Card>
  }
  const status = PROJECT_STATUSES.find((s) => s.id === project.status)

  return (
    <div className="space-y-4">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} aria-hidden />All projects</Link>
      <div className="flex flex-wrap items-start gap-4">
        <ProjectIcon icon={project.icon} color={project.color} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
            {project.name}
            <span className="rounded-md bg-line/70 px-2 py-0.5 font-mono text-sm font-medium text-muted">{project.key}</span>
            {project.archivedAt && <Badge>Archived</Badge>}
            {status.id !== 'active' && <Badge tone="warn">{status.label}</Badge>}
          </h1>
          {project.description && <p className="mt-1 max-w-2xl text-muted">{project.description}</p>}
          <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
            <HealthBadge health={stats.health} total={stats.total} />
            {project.startDate && <span>Started {formatDate(project.startDate, fmt)}</span>}
            {project.targetDate && <span className="inline-flex items-center gap-1"><CalendarClock size={12} aria-hidden />Target {formatDate(project.targetDate, fmt)}{stats.daysLeft != null && stats.progress < 1 ? ` (${stats.daysLeft < 0 ? `${-stats.daysLeft} days late` : `${stats.daysLeft} days left`})` : ''}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button aria-pressed={project.favorite} onClick={() => toggleFavorite(project.id)}><Icon name="star" size={14} filled={project.favorite} />{project.favorite ? 'Favourite' : 'Favourite'}</Button>
          <Button variant="primary" onClick={() => openTaskModal(null, { projectId: project.id })}><Icon name="plus" size={16} />Add task</Button>
          <ProjectMenu project={project} taskCount={tasks.length} afterDelete={() => navigate('/projects')} trigger={<Button size="icon" aria-label="Project actions"><MoreHorizontal size={16} /></Button>} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
        <KpiCard label="Tasks" value={stats.total} />
        <KpiCard label="Completed" value={fmtPct(stats.progress)} />
        <KpiCard label="Avg progress" value={stats.avgProgress} unit="%" />
        <KpiCard label="Open" value={stats.open} />
        <KpiCard label="In progress" value={stats.inProgress} />
        <KpiCard label="Overdue" value={stats.overdue} />
        <KpiCard label="Hours logged" value={fmtHours(stats.hours)} unit="h" />
      </div>

      <Tabs value={tab} onValueChange={setTab} tabs={[{ value: 'overview', label: 'Overview' }, { value: 'list', label: `List (${tasks.length})` }, { value: 'board', label: 'Board' }]}>
        <TabPanel value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <StatusDonut summary={summary} />
            <BurnUp data={burn} />
          </div>
          <Card>
            <CardHeader title="Recently updated" />
            <div className="space-y-0.5 p-2">
              {[...tasks].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6).map((t) => <TaskRow key={t.id} task={t} selectable={false} showDate />)}
              {!tasks.length && <EmptyState title="No tasks in this project yet" text="Add one below or move existing tasks here with “Move to project…”." />}
            </div>
          </Card>
        </TabPanel>

        <TabPanel value="list" className="space-y-4">
          <Card className="p-4"><QuickAdd date={todayISO()} projectId={project.id} id="project-quick-add" /></Card>
          <div className="max-w-xs"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search in this project…" aria-label="Search in this project" /></div>
          <Card>
            <BulkBar />
            {statuses.map((s) => {
              const list = shown.filter((t) => t.status === s.id).sort((a, b) => (a.number || 0) - (b.number || 0))
              if (!list.length) return null
              return (
                <section key={s.id} aria-label={s.label}>
                  <h3 className="flex items-center gap-2 border-b border-line bg-canvas px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted">{s.label}<Badge>{list.length}</Badge></h3>
                  <div className="space-y-0.5 p-2">{list.map((t) => <TaskRow key={t.id} task={t} showDate />)}</div>
                </section>
              )
            })}
            {!shown.length && <EmptyState title={q ? 'No tasks match' : 'No tasks yet'} text={q ? 'Try a different search.' : 'Use the quick-add bar above.'} />}
          </Card>
        </TabPanel>

        <TabPanel value="board">
          <p className="mb-2 text-xs text-muted">Drag cards between columns. Use the gauge on a column to set a WIP limit (Kanban).</p>
          <BoardView tasks={tasks} wipLimits={project.wipLimits} onLimit={(statusId, n) => setWipLimit(project.id, statusId, n)} />
        </TabPanel>
      </Tabs>
    </div>
  )
}
