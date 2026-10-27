import { ArrowLeft, MessageCircle, MoreHorizontal, Plus, Trash2, UserMinus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge, Button, Card, CardHeader, Checkbox, Drawer, EmptyState, Input, Menu, Select, Skeleton, StatusBadge, TabPanel, Tabs } from '../components/ui'
import { Icon, ProjectIcon } from '../components/icons'
import { AddMember } from '../components/team/AddMember'
import { ChatPanel } from '../components/team/ChatPanel'
import { MyProgressDialog } from '../components/team/MyProgressDialog'
import { Avatar, AvatarStack, MemberProgressList, ROLE_LABEL } from '../components/team/parts'
import { ProgressBar, ProgressRing } from '../components/ui/Progress'
import { useSeo } from '../hooks/useSeo'
import { useTeam } from '../team/useTeam'
import { cn } from '../utils/format'

const STATUS_LABEL = { pending: 'Pending', in_progress: 'In Progress', blocked: 'Blocked', completed: 'Completed' }

function Stat({ label, value, sub }) {
  return <Card className="p-3.5"><p className="text-xs font-medium text-muted">{label}</p><p className="mt-1 text-2xl font-bold leading-none">{value}</p>{sub && <p className="mt-1.5 text-xs text-muted">{sub}</p>}</Card>
}

function TaskCard({ task, project, members, meId, canEdit, onProgress, onOpen }) {
  const patchTask = useTeam((s) => s.patchTask)
  const deleteTask = useTeam((s) => s.deleteTask)
  const byId = new Map(members.map((m) => [m.userId, m]))
  const mine = task.assignees.includes(meId)
  const canAdd = canEdit && (mine || !task.assignees.length)
  return (
    <article className={cn('rounded-card border bg-surface p-3.5 shadow-card', mine ? 'border-primary/40' : 'border-line')} aria-label={task.title}>
      <div className="flex items-start gap-3">
        <ProgressRing value={task.progress} done={task.status === 'completed'} size={52} stroke={5} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted">{project.key}-{task.number}</span>
            <Menu
              align="start" trigger={<button type="button" aria-label={`Status: ${STATUS_LABEL[task.status]}. Change status`} disabled={!canEdit}><StatusBadge status={task.status} label={STATUS_LABEL[task.status]} /></button>}
              items={Object.entries(STATUS_LABEL).map(([id, label]) => ({ label, onSelect: () => patchTask(task.id, { status: id }).catch((e) => toast.error(e.message)) }))}
            />
            {task.priority === 'high' && <Badge tone="bad">high</Badge>}
            {task.dueDate && <Badge>due {task.dueDate}</Badge>}
          </div>
          <button type="button" onClick={() => onOpen(task.id)} className={cn('mt-0.5 block text-left text-sm font-semibold hover:text-primary', task.status === 'completed' && 'text-muted line-through')}>{task.title}</button>
        </div>
        <div className="flex items-center">
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Discuss ${task.title}`} onClick={() => onOpen(task.id)}><MessageCircle size={16} /></Button>
          {canEdit && <Menu trigger={<Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Task actions"><MoreHorizontal size={16} /></Button>} items={[{ label: 'Delete task', icon: <Trash2 size={14} />, danger: true, onSelect: () => deleteTask(task.id).then(() => toast('Task deleted')).catch((e) => toast.error(e.message)) }]} />}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {task.assignees.length ? (
          <ul className="flex flex-wrap gap-x-3 gap-y-1.5" aria-label="Assignees and their progress">
            {task.assignees.map((uid) => {
              const c = task.contributions.find((x) => x.userId === uid)
              return <li key={uid} className="flex items-center gap-1.5 text-xs"><Avatar name={byId.get(uid)?.name || '?'} id={uid} size={22} /><span className="text-muted">{byId.get(uid)?.name.split(' ')[0] || 'Former'}</span><b className="tabular-nums">{c?.progress ?? 0}%</b></li>
            })}
          </ul>
        ) : <span className="text-xs text-muted">Unassigned</span>}
        {canAdd && <Button size="sm" variant={mine ? 'primary' : 'secondary'} className="ml-auto" onClick={() => onProgress(task)}><Icon name="chart" size={14} />{mine ? 'Update my progress' : 'Add progress'}</Button>}
      </div>
    </article>
  )
}

function TaskDrawer({ taskId, onClose, project, members, meId, canEdit, onProgress }) {
  const task = useTeam((s) => s.current?.tasks.find((t) => t.id === taskId))
  const patchTask = useTeam((s) => s.patchTask)
  return (
    <Drawer open={!!task} onOpenChange={(o) => !o && onClose()} title={task ? `${project.key}-${task.number} ${task.title}` : 'Task'}>
      {task && (
        <div className="space-y-5">
          <div className="flex items-center gap-4"><ProgressRing value={task.progress} done={task.status === 'completed'} size={72} stroke={7} /><div><StatusBadge status={task.status} label={STATUS_LABEL[task.status]} /><p className="mt-1 text-xs text-muted">Overall progress is the average of everyone assigned.</p></div></div>
          {task.notes && <p className="whitespace-pre-wrap rounded-input bg-canvas p-3 text-sm">{task.notes}</p>}
          <section aria-label="Progress by person"><h4 className="mb-2 text-sm font-semibold">Progress by person</h4><MemberProgressList task={task} members={members} meId={meId} /></section>
          {canEdit && (
            <section aria-label="Assignees">
              <h4 className="mb-2 text-sm font-semibold">Assignees</h4>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {members.filter((m) => m.role !== 'viewer').map((m) => (
                  <Checkbox key={m.userId} label={m.name} checked={task.assignees.includes(m.userId)} onChange={(c) => patchTask(task.id, { assignees: c ? [...task.assignees, m.userId] : task.assignees.filter((x) => x !== m.userId) }).catch((e) => toast.error(e.message))} />
                ))}
              </div>
              {(task.assignees.includes(meId) || !task.assignees.length) && <Button className="mt-3" variant="primary" size="sm" onClick={() => onProgress(task)}>Update my progress</Button>}
            </section>
          )}
          <section aria-label="Conversation"><h4 className="mb-2 text-sm font-semibold">Conversation about this task</h4><ChatPanel taskId={task.id} height="h-72" /></section>
        </div>
      )}
    </Drawer>
  )
}

export default function TeamProjectPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const cloud = useTeam((s) => s.cloud)
  const cur = useTeam((s) => (s.current?.id === id ? s.current : null))
  const { openProject, closeProject, createTask } = useTeam.getState()
  const [tab, setTab] = useState('tasks')
  const [title, setTitle] = useState('')
  const [assignees, setAssignees] = useState([])
  const [onlyMine, setOnlyMine] = useState(false)
  const [progressTask, setProgressTask] = useState(null)
  const [error, setError] = useState('')
  useSeo({ title: cur ? cur.project.name : 'Team project' })
  const meId = cloud?.user?.id

  useEffect(() => {
    if (!cloud) { navigate('/team', { replace: true }); return }
    openProject(id).catch((e) => setError(e.message))
    return () => closeProject()
  }, [id, cloud?.token]) // eslint-disable-line react-hooks/exhaustive-deps

  const openTaskId = sp.get('task')
  const tasks = useMemo(() => (cur ? cur.tasks.filter((t) => !onlyMine || t.assignees.includes(meId)) : []), [cur, onlyMine, meId])

  if (error) return <Card><EmptyState illustration={<Icon name="compass" size={40} className="text-muted" />} title="Project not found" text={error} action={<Link to="/team" className="font-medium text-primary hover:underline">Back to team projects</Link>} /></Card>
  if (!cur) return <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-40" /></div>

  const { project, members, invites, stats, online } = cur
  const role = project.myRole
  const canEdit = role === 'owner' || role === 'editor'
  const isOwner = role === 'owner'

  const add = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    try { await createTask({ title: title.trim(), assignees }); setTitle(''); setAssignees([]) } catch (err) { toast.error(err.message) }
  }

  return (
    <div className="space-y-4">
      <Link to="/team" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft size={14} aria-hidden />All team projects</Link>
      <div className="flex flex-wrap items-center gap-4">
        <ProjectIcon icon={project.icon} color={project.color} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">{project.name}<span className="rounded-md bg-line/70 px-2 py-0.5 font-mono text-sm font-medium text-muted">{project.key}</span><Badge tone="primary">{ROLE_LABEL[role]}</Badge></h1>
          {project.description && <p className="max-w-2xl text-muted">{project.description}</p>}
        </div>
        <div className="flex items-center gap-3"><AvatarStack people={members} max={5} size={32} /><span className="text-xs text-muted">{online.length} online</span></div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="flex items-center gap-3 p-3.5"><ProgressRing value={stats.avgProgress} size={56} stroke={6} /><div><p className="text-xs font-medium text-muted">Team progress</p><p className="text-sm font-semibold">{stats.avgProgress}% average</p></div></Card>
        <Stat label="Tasks" value={stats.total} sub={`${stats.byStatus.in_progress} in progress`} />
        <Stat label="Completed" value={stats.byStatus.completed} sub={`${stats.byStatus.blocked} blocked`} />
        <Stat label="Members" value={members.length} sub={invites.length ? `${invites.length} invited` : undefined} />
      </div>

      <Tabs value={tab} onValueChange={setTab} tabs={[{ value: 'tasks', label: `Tasks (${cur.tasks.length})` }, { value: 'people', label: `People (${members.length})` }, { value: 'chat', label: 'Chat' }]}>
        <TabPanel value="tasks" className="space-y-4">
          {canEdit && (
            <Card className="p-4">
              <form onSubmit={add} className="flex flex-wrap items-end gap-2" aria-label="New task">
                <div className="min-w-56 flex-1"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task for the team…" aria-label="New task title" maxLength={500} /></div>
                <Menu align="end" trigger={<Button><Icon name="projects" size={14} />{assignees.length ? `${assignees.length} assigned` : 'Assign'}</Button>} items={members.filter((m) => m.role !== 'viewer').map((m) => ({ label: `${assignees.includes(m.userId) ? '✓ ' : ''}${m.name}`, onSelect: () => setAssignees((a) => (a.includes(m.userId) ? a.filter((x) => x !== m.userId) : [...a, m.userId])) }))} />
                <Button variant="primary" type="submit" disabled={!title.trim()}><Plus size={16} />Add task</Button>
              </form>
            </Card>
          )}
          <Checkbox checked={onlyMine} onChange={setOnlyMine} label="Only tasks assigned to me" />
          {tasks.length === 0 ? (
            <Card><EmptyState illustration={<Icon name="flag" size={36} className="text-muted" />} title={onlyMine ? 'Nothing assigned to you' : 'No tasks yet'} text={canEdit ? 'Add the first task above and assign it to teammates.' : 'An editor will add tasks here.'} /></Card>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {tasks.map((t) => <TaskCard key={t.id} task={t} project={project} members={members} meId={meId} canEdit={canEdit} onProgress={setProgressTask} onOpen={(tid) => setSp({ task: tid })} />)}
            </div>
          )}
        </TabPanel>

        <TabPanel value="people" className="space-y-4">
          {canEdit && <Card className="p-4"><h3 className="mb-3 text-sm font-semibold">Add a teammate</h3><AddMember /></Card>}
          <Card>
            <CardHeader title="Members" subtitle="Average progress across the tasks they are assigned to" />
            <ul className="divide-y divide-line">
              {stats.members.map((m) => (
                <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Avatar name={m.name} id={m.userId} size={36} online={online.includes(m.userId)} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{m.name}{m.userId === meId && <span className="ml-1 text-muted">(you)</span>}</p><p className="truncate text-xs text-muted">{m.email}</p></div>
                  <div className="w-40"><ProgressBar value={m.avgProgress} done={m.assigned > 0 && m.finished === m.assigned} size="sm" ariaLabel={`${m.name} progress`} /><p className="text-[11px] text-muted">{m.assigned} assigned · {m.finished} finished</p></div>
                  {isOwner && m.role !== 'owner' ? (
                    <Select aria-label={`Role of ${m.name}`} value={m.role} onChange={(e) => useTeam.getState().setRole(m.userId, e.target.value).catch((er) => toast.error(er.message))} className="w-32"><option value="editor">Can edit</option><option value="viewer">View only</option></Select>
                  ) : <Badge>{ROLE_LABEL[m.role]}</Badge>}
                  {(isOwner || m.userId === meId) && m.role !== 'owner' && <Button size="icon" variant="ghost" aria-label={m.userId === meId ? 'Leave project' : `Remove ${m.name}`} onClick={() => { if (window.confirm(m.userId === meId ? 'Leave this project?' : `Remove ${m.name}?`)) useTeam.getState().removeMember(m.userId).then(() => m.userId === meId && navigate('/team')).catch((er) => toast.error(er.message)) }}><UserMinus size={16} /></Button>}
                </li>
              ))}
            </ul>
          </Card>
          {invites.length > 0 && (
            <Card>
              <CardHeader title="Pending invitations" subtitle="They join automatically when they register with that email" />
              <ul className="divide-y divide-line">
                {invites.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                    <Icon name="mail" size={16} className="text-muted" /><span className="min-w-0 flex-1 truncate">{i.email}</span><Badge>{i.role}</Badge>
                    {canEdit && <><Button size="sm" onClick={() => useTeam.getState().resendInvite(i.id).then((r) => toast.success(r.email?.sent ? 'Reminder sent' : 'Saved, email could not be sent')).catch((e) => toast.error(e.message))}>Resend</Button><Button size="sm" variant="ghost" onClick={() => useTeam.getState().revokeInvite(i.id).then(() => toast('Invitation revoked'))}>Revoke</Button></>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </TabPanel>

        <TabPanel value="chat"><ChatPanel /></TabPanel>
      </Tabs>

      <MyProgressDialog task={progressTask ? cur.tasks.find((t) => t.id === progressTask.id) || progressTask : null} onClose={() => setProgressTask(null)} />
      <TaskDrawer taskId={openTaskId} onClose={() => setSp({})} project={project} members={members} meId={meId} canEdit={canEdit} onProgress={setProgressTask} />
    </div>
  )
}
