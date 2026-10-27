import { Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Checkbox, EmptyState, Input, Select } from '../components/ui'
import { ProjectIcon } from '../components/icons'
import { ProjectCard } from '../components/projects/ProjectCard'
import { EmptyProjectsIllustration } from '../components/ui/illustrations'
import { useAllTasks, useCtx } from '../hooks/useData'
import { useSeo } from '../hooks/useSeo'
import { liveProjects, projectStats, sortProjects } from '../selectors/projects'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'

/** All projects: search, sort, archived toggle, health at a glance, and the personal "No project" inbox. */
export default function ProjectsPage() {
  useSeo({ title: 'Projects' })
  const projects = useStore((s) => s.projects)
  const openProjectModal = useUI((s) => s.openProjectModal)
  const all = useAllTasks()
  const ctx = useCtx()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('recent')
  const [showArchived, setShowArchived] = useState(false)

  const live = liveProjects(projects)
  const stats = useMemo(() => {
    const m = new Map()
    live.forEach((p) => m.set(p.id, projectStats(p, all.filter((t) => t.projectId === p.id), ctx)))
    return m
  }, [live, all, ctx])
  const inbox = useMemo(() => {
    const ids = new Set(live.map((p) => p.id))
    return all.filter((t) => !t.projectId || !ids.has(t.projectId))
  }, [all, live])

  const ql = q.trim().toLowerCase()
  const list = sortProjects(
    live.filter((p) => (showArchived ? !!p.archivedAt : !p.archivedAt) && (!ql || `${p.name} ${p.key} ${p.description || ''}`.toLowerCase().includes(ql))),
    sort, stats,
  )
  const archivedCount = live.filter((p) => p.archivedAt).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted">Optional. Group related tasks, track progress and move tasks between projects any time.</p>
        </div>
        <Button variant="primary" onClick={() => openProjectModal()}><Plus size={16} />New project</Button>
      </div>

      {live.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1 sm:max-w-xs">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects…" aria-label="Search projects" className="pl-8" />
          </div>
          <Select aria-label="Sort projects" value={sort} onChange={(e) => setSort(e.target.value)} className="w-44">
            <option value="recent">Recently updated</option><option value="name">Name</option><option value="progress">Progress</option><option value="target">Target date</option>
          </Select>
          <Checkbox checked={showArchived} onChange={setShowArchived} label={`Show archived (${archivedCount})`} />
        </div>
      )}

      {live.length === 0 ? (
        <Card>
          <EmptyState illustration={<EmptyProjectsIllustration />} title="No projects yet"
            text="You don't need projects to use Daybook. Create one when you want to group tasks, see per-project progress, or use a board with WIP limits."
            action={<Button variant="primary" onClick={() => openProjectModal()}>Create your first project</Button>} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => <ProjectCard key={p.id} project={p} stats={stats.get(p.id)} />)}
          {!showArchived && (
            <Link to="/log/table?project=none" className="flex flex-col justify-between rounded-card border border-dashed border-line bg-canvas p-4 transition hover:border-primary/50">
              <div className="flex items-center gap-3">
                <ProjectIcon icon="inbox" color="#64748b" size={44} />
                <div><h3 className="font-semibold">No project</h3><p className="text-xs text-muted">Your personal log</p></div>
              </div>
              <p className="mt-4 text-sm text-muted">{inbox.length} task{inbox.length === 1 ? '' : 's'} not in a project. Select them in any view and use “Move to project…”.</p>
            </Link>
          )}
          {!list.length && <p className="col-span-full py-8 text-center text-sm text-muted">No projects match.</p>}
        </div>
      )}
    </div>
  )
}
