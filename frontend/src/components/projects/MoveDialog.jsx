import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Modal } from '../ui'
import { Icon, ProjectIcon } from '../icons'
import { activeProjects } from '../../selectors/projects'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { cn } from '../../utils/format'

const UNDO = { label: 'Undo', onClick: () => useStore.getState().undo() }

function Option({ id, label, sub, icon, target, setTarget, current }) {
  return (
    <button type="button" role="radio" aria-checked={target === id} onClick={() => setTarget(id)}
      className={cn('flex w-full items-center gap-3 rounded-input border px-3 py-2 text-left transition', target === id ? 'border-primary bg-primary/5' : 'border-line hover:bg-canvas')}>
      {icon}
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{label}</span>{sub && <span className="text-xs text-muted">{sub}</span>}</span>
      {current.size === 1 && current.has(id) && <span className="text-xs text-muted">current</span>}
    </button>
  )
}

/** Move one or more tasks into a project, or back out of any project. Numbers are reassigned automatically. */
export function MoveDialog() {
  const ids = useUI((s) => s.moveDialog)
  const close = () => useUI.getState().openMoveDialog(null)
  const projects = useStore((s) => s.projects)
  const tasks = useStore((s) => s.tasks)
  const [target, setTarget] = useState(undefined)
  const list = activeProjects(projects)
  const current = new Set((ids || []).map((id) => tasks.find((t) => t.id === id)?.projectId || 'none'))

  const submit = () => {
    if (target === undefined) return
    useStore.getState().moveTasksToProject(ids, target === 'none' ? null : target)
    toast.success(`Moved ${ids.length} task${ids.length === 1 ? '' : 's'}`, { action: UNDO })
    useUI.getState().clearSelection()
    setTarget(undefined)
    close()
  }

  return (
    <Modal open={!!ids} onOpenChange={(o) => { if (!o) { setTarget(undefined); close() } }} title={`Move ${ids?.length || 0} task${ids?.length === 1 ? '' : 's'} to…`} description="Choose a project or move them out of any project">
      <div role="radiogroup" aria-label="Destination" className="max-h-80 space-y-1.5 overflow-y-auto">
        <Option id="none" target={target} setTarget={setTarget} current={current} label="No project" sub="Your personal log" icon={<span className="grid size-8 place-items-center rounded-lg bg-line text-muted"><Icon name="inbox" size={16} /></span>} />
        {list.map((p) => <Option key={p.id} id={p.id} target={target} setTarget={setTarget} current={current} label={p.name} sub={p.key} icon={<ProjectIcon icon={p.icon} color={p.color} size={32} />} />)}
      </div>
      {!list.length && <p className="mt-2 text-xs text-muted">No projects yet. Create one from the Projects page.</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={() => { setTarget(undefined); close() }}>Cancel</Button>
        <Button variant="primary" disabled={target === undefined} onClick={submit}>Move</Button>
      </div>
    </Modal>
  )
}
