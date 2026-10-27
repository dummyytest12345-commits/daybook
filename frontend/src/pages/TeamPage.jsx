import { MessageCircle, Plus, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Card, EmptyState, Field, Input, Modal, Skeleton, Textarea } from '../components/ui'
import { Icon, PROJECT_COLORS, PROJECT_ICONS, ProjectIcon } from '../components/icons'
import { ConnectCard } from '../components/team/ConnectCard'
import { ProgressBar } from '../components/ui/Progress'
import { useSeo } from '../hooks/useSeo'
import { useTeam } from '../team/useTeam'
import { cn } from '../utils/format'

function NewTeamProject({ open, onClose }) {
  const create = useTeam((s) => s.createProject)
  const navigate = useNavigate()
  const [f, setF] = useState({ name: '', key: '', description: '', color: PROJECT_COLORS[0], icon: PROJECT_ICONS[0] })
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const p = await create({ ...f, key: f.key || undefined, description: f.description || undefined })
      toast.success(`${p.name} created`)
      onClose()
      navigate(`/team/${p.id}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} title="New team project" description="Shared with the people you add. Everyone can add their own progress and chat.">
      <form onSubmit={submit} className="space-y-3">
        <div className="flex items-start gap-3">
          <ProjectIcon icon={f.icon} color={f.color} size={48} />
          <div className="grid flex-1 gap-3 sm:grid-cols-[1fr_110px]">
            <Field label="Name *"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required maxLength={60} autoFocus placeholder="e.g. Website redesign" /></Field>
            <Field label="Key" hint="Optional"><Input value={f.key} onChange={(e) => setF({ ...f, key: e.target.value.toUpperCase() })} maxLength={6} className="font-mono uppercase" /></Field>
          </div>
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour">
          {PROJECT_COLORS.map((c) => <button key={c} type="button" role="radio" aria-checked={f.color === c} aria-label={c} onClick={() => setF({ ...f, color: c })} className={cn('size-7 rounded-full ring-offset-2 ring-offset-surface', f.color === c && 'ring-2 ring-ink')} style={{ background: c }} />)}
        </div>
        <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-12" role="radiogroup" aria-label="Icon">
          {PROJECT_ICONS.map((i) => <button key={i} type="button" role="radio" aria-checked={f.icon === i} aria-label={i} onClick={() => setF({ ...f, icon: i })} className={cn('grid size-9 place-items-center rounded-lg border', f.icon === i ? 'border-transparent text-white' : 'border-line text-muted')} style={f.icon === i ? { background: f.color } : undefined}><Icon name={i} size={18} /></button>)}
        </div>
        <Field label="Description"><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={2000} /></Field>
        <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" type="submit" disabled={busy || !f.name.trim()}>{busy ? 'Creating…' : 'Create project'}</Button></div>
      </form>
    </Modal>
  )
}

/** Shared projects. Gate: connect to Daybook Cloud first. */
export default function TeamPage() {
  useSeo({ title: 'Team' })
  const cloud = useTeam((s) => s.cloud)
  const status = useTeam((s) => s.status)
  const projects = useTeam((s) => s.projects)
  const loaded = useTeam((s) => s.projectsLoaded)
  const [creating, setCreating] = useState(false)
  useEffect(() => { document.title = 'Team · Daybook' }, [])

  if (!cloud) {
    return (
      <div className="space-y-5">
        <div><h1 className="text-2xl font-bold">Team</h1><p className="text-sm text-muted">Work on projects together: assign tasks, add your own progress and talk about it.</p></div>
        <ConnectCard lockEmail />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-sm text-muted">Signed in as {cloud.user.name} · <span className={status === 'online' ? 'text-st-completed' : 'text-st-progress'}>{status === 'online' ? 'connected' : status === 'connecting' ? 'connecting…' : 'offline, retrying'}</span></p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} />New team project</Button>
      </div>

      {!loaded ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      ) : projects.length === 0 ? (
        <Card><EmptyState icon={Users} title="No team projects yet" text="Create one and add teammates by email. If they don't have an account yet, they get an invitation to join." action={<Button variant="primary" onClick={() => setCreating(true)}>Create a team project</Button>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} to={`/team/${p.id}`} className="group flex flex-col rounded-card border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop">
              <div className="flex items-start gap-3">
                <ProjectIcon icon={p.icon} color={p.color} size={44} />
                <div className="min-w-0 flex-1"><h3 className="truncate font-semibold group-hover:text-primary">{p.name}</h3><p className="text-xs text-muted"><span className="font-mono">{p.key}</span> · {p.memberCount} member{p.memberCount === 1 ? '' : 's'} · {p.myRole}</p></div>
                {p.unread > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white" aria-label={`${p.unread} unread messages`}><MessageCircle size={11} aria-hidden />{p.unread}</span>}
              </div>
              {p.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{p.description}</p>}
              <div className="mt-4"><div className="mb-1 flex justify-between text-xs"><span className="font-medium">{p.stats.completed}/{p.stats.total} done</span><span className="text-muted">team progress</span></div><ProgressBar value={p.stats.avgProgress} done={p.stats.total > 0 && p.stats.completed === p.stats.total} ariaLabel={`${p.name} team progress`} /></div>
            </Link>
          ))}
        </div>
      )}
      <NewTeamProject open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
