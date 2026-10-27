import { toast } from 'sonner'
import { useStore } from '../store/useStore'

/** Undo / redo with toast feedback. */
export function useUndo() {
  const canUndo = useStore((s) => s.undoStack.length > 0)
  const canRedo = useStore((s) => s.redoStack.length > 0)
  const lastLabel = useStore((s) => s.undoStack.at(-1)?.label)
  return {
    canUndo, canRedo, lastLabel,
    undo: () => useStore.getState().undo() && toast('Undone'),
    redo: () => useStore.getState().redo() && toast('Redone'),
  }
}

/** Toast describing rows touched besides the ones the user changed. Returns true when it showed one. */
function notifyThreadEffects(before, after, ids) {
  const asked = new Set(ids)
  const old = new Map(before.map((t) => [t.id, t]))
  let resolved = 0
  let removed = 0
  let reopened = 0
  for (const t of after) {
    const o = old.get(t.id)
    if (!o || asked.has(t.id)) continue
    if (!o.deletedAt && t.deletedAt) removed++
    else if (o.status !== 'completed' && t.status === 'completed') resolved++
    else if (o.status === 'completed' && t.status !== 'completed') reopened++
  }
  if (!resolved && !removed && !reopened) return false
  const parts = [
    resolved && `${resolved} earlier day${resolved === 1 ? '' : 's'} marked completed`,
    removed && `${removed} carried copy removed`,
    reopened && `${reopened} earlier day${reopened === 1 ? '' : 's'} reopened`,
  ].filter(Boolean)
  toast.success(parts.join(' · '), { description: 'They belong to the same thread.', action: { label: 'Undo', onClick: () => useStore.getState().undo() } })
  return true
}

const undoAction = { label: 'Undo', onClick: () => useStore.getState().undo() }

/** Destructive/bulk actions that show an undo toast instead of a blocking dialog. */
export const actions = {
  remove(id) {
    useStore.getState().removeTask(id)
    toast('Task deleted', { action: undoAction })
  },
  removeMany(ids) {
    useStore.getState().removeTasks(ids)
    toast(`${ids.length} tasks deleted`, { action: undoAction })
  },
  /** Change one status; tells the user when other days of the same thread were completed or removed. */
  setStatus(id, status) {
    const before = useStore.getState().tasks
    useStore.getState().updateTask(id, { status }, 'Changed status')
    notifyThreadEffects(before, useStore.getState().tasks, [id])
  },
  bulkStatus(ids, status) {
    const before = useStore.getState().tasks
    useStore.getState().bulkUpdate(ids, { status })
    if (!notifyThreadEffects(before, useStore.getState().tasks, ids)) toast(`${ids.length} tasks updated`, { action: undoAction })
  },
  /** Set progress; reaching 100 completes the task, leaving 0 starts it (see selectors/progress.js). */
  setProgress(id, progress) {
    const before = useStore.getState().tasks
    useStore.getState().updateTask(id, { progress }, 'Updated progress')
    notifyThreadEffects(before, useStore.getState().tasks, [id])
  },
  removeCarried(id) {
    useStore.getState().removeCarried(id)
    toast('Removed from this day. It will not be carried forward again.', { action: undoAction })
  },
  stopCarrying(id) {
    useStore.getState().stopCarrying(id)
    toast('Won’t be carried forward any more', { action: { label: 'Undo', onClick: () => useStore.getState().undo() } })
  },
  resumeCarrying(id) {
    useStore.getState().resumeCarrying(id)
    toast.success('Will be carried forward again')
  },
  markDayComplete(date) {
    useStore.getState().markDayComplete(date)
    toast('Day marked complete', { action: undoAction })
  },
  deleteDay(date) {
    useStore.getState().deleteDay(date)
    toast('Day cleared', { action: undoAction })
  },
  carryOver(ids, to) {
    useStore.getState().carryOver(ids, to)
    toast(`${ids.length} tasks carried over`, { action: undoAction })
  },
  duplicate(id) {
    const t = useStore.getState().duplicateTask(id)
    if (t) toast('Task duplicated', { action: undoAction })
  },
}
