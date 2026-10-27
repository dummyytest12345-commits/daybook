import { useEffect } from 'react'
import { toast } from 'sonner'
import { useStore } from '../store/useStore'
import { buildThreadIndex, threadInfo } from '../selectors/threads'

// Cache the thread index per tasks array so every row shares one computation per change.
const cache = new WeakMap()
export function getThreadIndex(tasks) {
  let idx = cache.get(tasks)
  if (!idx) {
    idx = buildThreadIndex(tasks)
    cache.set(tasks, idx)
  }
  return idx
}

/** Thread info (position, neighbours, span) for a row. */
export function useThreadInfo(task) {
  const tasks = useStore((s) => s.tasks)
  return threadInfo(task, getThreadIndex(tasks))
}

/**
 * Carries unfinished tasks forward automatically: when the app opens, when the tab regains focus
 * after midnight, and once a minute. Shows a toast with an Undo that removes the copies and stops
 * those tasks from being carried again.
 */
export function useCarryForward() {
  const ready = useStore((s) => s.ready)
  const auto = useStore((s) => s.settings.autoCarry)
  useEffect(() => {
    if (!ready || !auto) return
    const run = () => {
      const rows = useStore.getState().runAutoCarry()
      if (!rows.length) return
      toast(`${rows.length} unfinished task${rows.length === 1 ? ' was' : 's were'} carried forward to today`, {
        description: 'Each one keeps its history as a thread. Complete it today and the earlier days are marked completed too.',
        duration: 9000,
        action: { label: 'Undo', onClick: () => useStore.getState().removeTasks(rows.map((r) => r.id)) },
      })
    }
    run()
    const onVis = () => !document.hidden && run()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', run)
    const id = setInterval(run, 60000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', run)
      clearInterval(id)
    }
  }, [ready, auto])
}
