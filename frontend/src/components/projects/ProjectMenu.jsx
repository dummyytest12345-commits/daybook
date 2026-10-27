import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Menu, Modal } from '../ui'
import { Icon } from '../icons'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'

const UNDO = { label: 'Undo', onClick: () => useStore.getState().undo() }

/** Edit / duplicate / archive / delete actions for one project. `trigger` is the menu button. */
export function ProjectMenu({ project, trigger, taskCount = 0, afterDelete }) {
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState(false)
  const [mode, setMode] = useState('unassign')
  const st = () => useStore.getState()

  return (
    <>
      <Menu
        trigger={trigger}
        items={[
          { label: 'Edit project', icon: <Icon name="pen" size={14} />, onSelect: () => useUI.getState().openProjectModal(project) },
          { label: project.favorite ? 'Remove from favourites' : 'Add to favourites', icon: <Icon name="star" size={14} filled={project.favorite} />, onSelect: () => st().toggleFavorite(project.id) },
          { label: 'Duplicate (settings only)', icon: <Icon name="cube" size={14} />, onSelect: () => { const c = st().duplicateProject(project.id); toast.success(`Created ${c.name}`, { action: UNDO }); navigate(`/projects/${c.id}`) } },
          { label: 'Duplicate with tasks', icon: <Icon name="cube" size={14} />, onSelect: () => { const c = st().duplicateProject(project.id, { withTasks: true }); toast.success(`Created ${c.name} with its tasks`, { action: UNDO }); navigate(`/projects/${c.id}`) } },
          { separator: true },
          project.archivedAt
            ? { label: 'Restore from archive', icon: <Icon name="archive" size={14} />, onSelect: () => { st().restoreProject(project.id); toast.success('Project restored') } }
            : { label: 'Archive', icon: <Icon name="archive" size={14} />, onSelect: () => { st().archiveProject(project.id); toast.success('Project archived', { action: UNDO }) } },
          { label: 'Delete…', danger: true, icon: <Icon name="bug" size={14} />, onSelect: () => setConfirm(true) },
        ]}
      />
      <Modal open={confirm} onOpenChange={setConfirm} title={`Delete “${project.name}”?`} description="Choose what happens to the tasks in this project">
        <div role="radiogroup" className="space-y-2" aria-label="What to do with tasks">
          {[
            ['unassign', 'Keep the tasks', `Move ${taskCount} task${taskCount === 1 ? '' : 's'} back to “No project”.`],
            ['delete', 'Delete the tasks too', 'The tasks are deleted along with the project.'],
          ].map(([v, t, d]) => (
            <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)}
              className={`w-full rounded-input border px-3 py-2 text-left ${mode === v ? 'border-primary bg-primary/5' : 'border-line hover:bg-canvas'}`}>
              <span className="block text-sm font-medium">{t}</span><span className="text-xs text-muted">{d}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">You can undo this right after from the toast or the top bar.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { st().deleteProject(project.id, mode); setConfirm(false); toast.success('Project deleted', { action: UNDO }); afterDelete?.() }}>Delete project</Button>
        </div>
      </Modal>
    </>
  )
}
