import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button, Field, Input, Modal } from '../ui'
import { ProgressChips, ProgressRing, ProgressSlider, progressLabel } from '../ui/Progress'
import { MemberProgressList } from './parts'
import { useTeam } from '../../team/useTeam'

/** A member sets THEIR part of a shared task. The task's overall progress is the mean of everyone's. */
export function MyProgressDialog({ task, onClose }) {
  const me = useTeam((s) => s.cloud?.user)
  const members = useTeam((s) => s.current?.members || [])
  const myProgress = useTeam((s) => s.myProgress)
  const mine = task?.contributions.find((c) => c.userId === me?.id)?.progress ?? 0
  const [value, setValue] = useState(mine)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setValue(mine); setNote('') }, [task?.id, mine])
  if (!task) return <Modal open={false} onOpenChange={() => {}} title="Progress" />

  const assignedToOthers = task.assignees.length > 0 && !task.assignees.includes(me?.id)
  const n = Math.max(1, task.assignees.length || 1)
  const others = task.assignees.filter((a) => a !== me?.id).reduce((a, uid) => a + (task.contributions.find((c) => c.userId === uid)?.progress ?? 0), 0)
  const projected = Math.round((others + value) / (task.assignees.includes(me?.id) ? n : n))

  const save = async () => {
    setBusy(true)
    try {
      await myProgress(task.id, value, note.trim() || undefined)
      toast.success(value === 100 ? 'Your part is done' : `Progress set to ${value}%`)
      onClose()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Update your progress" description={task.title}>
      <div className="space-y-4">
        <div className="flex items-center gap-4 rounded-card border border-line bg-canvas p-3">
          <ProgressRing value={value} size={84} stroke={8} done={value === 100} />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-semibold">{progressLabel(value, value === 100 ? 'completed' : 'in_progress')}</p>
            <ProgressSlider value={value} onChange={setValue} label="Your progress" disabled={assignedToOthers} />
            <ProgressChips value={value} onPick={setValue} disabled={assignedToOthers} />
          </div>
        </div>
        <p className="rounded-input bg-primary/5 px-3 py-2 text-xs text-muted" aria-live="polite">
          Task overall will be <b className="text-ink">{projected}%</b>
          {task.assignees.length > 1 ? ' (the average of everyone’s progress).' : '.'} {projected >= 100 && 'It will be marked completed.'}
        </p>
        {task.assignees.length > 0 && <MemberProgressList task={task} members={members} meId={me?.id} />}
        <Field label="Add a note (optional)" hint="Shown in the project chat">
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. hero section done, waiting on copy" />
        </Field>
        {assignedToOthers && <p role="alert" className="text-xs text-st-blocked">This task is assigned to other people. Ask an editor to add you.</p>}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy || assignedToOthers || value === mine && !note.trim()}>{busy ? 'Saving…' : 'Save progress'}</Button>
        </div>
      </div>
    </Modal>
  )
}
