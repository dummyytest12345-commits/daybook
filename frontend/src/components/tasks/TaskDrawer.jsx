import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Button, Drawer, Input, StatusBadge } from '../ui'
import { StatusSelect } from './StatusSelect'
import { TimerButton } from './TimerButton'
import { ThreadTimeline } from './ThreadTimeline'
import { ProgressControl } from './ProgressControl'
import { actions } from '../../hooks/useActions'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { newId } from '../../utils/id'
import { fmtHours } from '../../utils/format'

/** Side panel: subtasks, timer and recent activity for one task. */
export function TaskDrawer() {
  const id = useUI((s) => s.drawerTaskId)
  const openDrawer = useUI((s) => s.openDrawer)
  const openTaskModal = useUI((s) => s.openTaskModal)
  const task = useStore((s) => s.tasks.find((t) => t.id === id))
  const activity = useStore((s) => s.activity)
  const update = useStore((s) => s.updateTask)
  const [text, setText] = useState('')

  const subs = task?.subtasks || []
  const setSubs = (next) => update(task.id, { subtasks: next }, 'Updated subtasks')

  return (
    <Drawer open={!!task} onOpenChange={(o) => !o && openDrawer(null)} title={task?.title || 'Task'}>
      {task && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusSelect status={task.status} onChange={(s) => actions.setStatus(task.id, s)} />
            <TimerButton taskId={task.id} />
            {task.hours != null && <span className="text-sm text-muted">{fmtHours(task.hours)}h logged</span>}
            <Button size="sm" onClick={() => { openDrawer(null); openTaskModal(task) }}>Edit details</Button>
          </div>
          <section aria-label="Progress"><h4 className="mb-1.5 text-sm font-semibold">Progress</h4><ProgressControl task={task} editable variant="panel" /></section>
          {task.notes && <p className="whitespace-pre-wrap rounded-input bg-canvas p-3 text-sm">{task.notes}</p>}

          <ThreadTimeline task={task} />

          <section aria-label="Subtasks">
            <h4 className="mb-2 text-sm font-semibold">Subtasks {subs.length > 0 && <span className="font-normal text-muted">({subs.filter((s) => s.done).length}/{subs.length})</span>}</h4>
            <ul className="space-y-1">
              {subs.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={s.done} className="size-4 accent-[var(--color-primary)]" aria-label={s.title}
                    onChange={() => setSubs(subs.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))} />
                  <span className={`flex-1 text-sm ${s.done ? 'text-muted line-through' : ''}`}>{s.title}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Remove ${s.title}`} onClick={() => setSubs(subs.filter((x) => x.id !== s.id))}><X size={14} /></Button>
                </li>
              ))}
            </ul>
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; setSubs([...subs, { id: newId(), title: text.trim(), done: false }]); setText('') }}>
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a checklist item" aria-label="New subtask" />
              <Button type="submit" size="icon" aria-label="Add subtask"><Plus size={16} /></Button>
            </form>
          </section>

          <section aria-label="Activity">
            <h4 className="mb-2 text-sm font-semibold">Recent activity (this session)</h4>
            <ul className="space-y-1 text-xs text-muted">
              {activity.slice(0, 8).map((a, i) => <li key={i}>{new Date(a.at).toLocaleTimeString()} — {a.text}</li>)}
              {!activity.length && <li>Nothing yet.</li>}
            </ul>
          </section>
          <p className="text-xs text-muted">Created {new Date(task.createdAt).toLocaleString()} · <StatusBadge status={task.status} label={task.status.replace('_', ' ')} /></p>
        </div>
      )}
    </Drawer>
  )
}
