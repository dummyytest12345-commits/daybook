import { useEffect } from 'react'
import { toast } from 'sonner'
import { useStore } from '../store/useStore'
import { useTick } from './utils'

const STALE_MS = 10 * 3600 * 1000

/** Elapsed ms for a task (running or paused). State lives on the task, so it survives refresh. */
export const elapsedOf = (t, now = Date.now()) =>
  (t.timerElapsedMs || 0) + (t.timerStartedAt ? now - Date.parse(t.timerStartedAt) : 0)

export function useTimer(taskId) {
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId))
  const running = !!task?.timerStartedAt
  useTick(running)
  return {
    running,
    elapsed: task ? elapsedOf(task) : 0,
    start: () => useStore.getState().startTimer(taskId),
    pause: () => useStore.getState().stopTimer(taskId, { writeHours: false }),
    stop: () => useStore.getState().stopTimer(taskId),
  }
}

/** The currently running task (only one at a time). */
export function useRunningTask() {
  const running = useStore((s) => s.tasks.find((t) => t.timerStartedAt && !t.deletedAt))
  useTick(!!running)
  return running || null
}

/** Warn when a timer was left running overnight and offer to trim it. Mount once. */
export function useStaleTimerGuard() {
  const ready = useStore((s) => s.ready)
  useEffect(() => {
    if (!ready) return
    const t = useStore.getState().tasks.find((x) => x.timerStartedAt && !x.deletedAt)
    if (!t || Date.now() - Date.parse(t.timerStartedAt) < STALE_MS) return
    toast.warning(`Timer for “${t.title}” has been running for over 10 hours.`, {
      duration: Infinity,
      action: { label: 'Discard running time', onClick: () => useStore.getState().discardTimer(t.id) },
      cancel: { label: 'Keep', onClick: () => {} },
    })
  }, [ready])
}
