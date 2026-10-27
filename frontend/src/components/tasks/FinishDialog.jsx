import { format } from 'date-fns'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button, Field, Input, Modal } from '../ui'
import { Icon } from '../icons'
import { getThreadIndex } from '../../hooks/useThreads'
import { threadInfo } from '../../selectors/threads'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { fromISO, todayISO } from '../../utils/date'
import { cn } from '../../utils/format'

const label = (iso) => format(fromISO(iso), 'EEE d MMM')

/**
 * "When was this finished?" — complete a task on the day the work really ended, even if that was
 * 2-3 days ago. Earlier days are marked completed; copies carried past that day are removed.
 */
export function FinishDialog() {
  const id = useUI((s) => s.finishDialog)
  const close = () => useUI.getState().openFinishDialog(null)
  const tasks = useStore((s) => s.tasks)
  const resolve = useStore((s) => s.settings.threadResolve)
  const row = id ? tasks.find((t) => t.id === id) : null
  const info = row ? threadInfo(row, getThreadIndex(tasks)) : null
  const today = todayISO()
  const [date, setDate] = useState(today)

  useEffect(() => { if (id) setDate(today) }, [id, today])
  if (!row || !info) return <Modal open={false} onOpenChange={close} title="Finish" />

  const earlier = info.rows.filter((r) => r.date < date && r.status !== 'completed').length
  const later = info.rows.filter((r) => r.date > date && r.status !== 'completed').length
  const valid = date >= info.firstDate && date <= today
  const quick = [...new Set([...info.rows.map((r) => r.date), today])].filter((x) => x <= today)

  const submit = () => {
    if (!valid) return
    if (!useStore.getState().finishThreadOn(row.id, date)) return toast.error('That date is outside this task’s history')
    toast.success(`Completed on ${label(date)}`, {
      description: [earlier && resolve === 'all' ? `${earlier} earlier day${earlier === 1 ? '' : 's'} marked completed` : null, later ? `${later} later copy removed` : null].filter(Boolean).join(' · ') || undefined,
      action: { label: 'Undo', onClick: () => useStore.getState().undo() },
    })
    close()
  }

  return (
    <Modal open onOpenChange={(o) => !o && close()} title="When was this finished?" description={`“${row.title}” — pick the day the work actually ended`}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick dates">
          {quick.map((q) => (
            <button key={q} type="button" onClick={() => setDate(q)} aria-pressed={date === q}
              className={cn('rounded-full border px-3 py-1 text-xs font-medium transition', date === q ? 'border-primary bg-primary text-white' : 'border-line text-muted hover:text-ink')}>
              {q === today ? 'Today' : label(q)}
            </button>
          ))}
        </div>
        <Field label="Completed on" error={!valid ? `Choose a date between ${label(info.firstDate)} and today` : undefined}>
          <Input type="date" value={date} min={info.firstDate} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <ul className="space-y-1.5 rounded-input bg-canvas p-3 text-sm" aria-live="polite">
          <li className="flex items-center gap-2"><Icon name="check" size={14} className="text-st-completed" />This task is marked completed on <b>{valid ? label(date) : '…'}</b></li>
          {earlier > 0 && <li className="flex items-center gap-2 text-muted"><Icon name="thread" size={14} />{resolve === 'all' ? `${earlier} earlier day${earlier === 1 ? '' : 's'} will be marked completed too` : `${earlier} earlier day${earlier === 1 ? '' : 's'} stay as they were (change in Settings)`}</li>}
          {later > 0 && <li className="flex items-center gap-2 text-muted"><Icon name="history" size={14} />{later} carried copy after that day will be removed</li>}
        </ul>
        <div className="flex justify-end gap-2">
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={submit}>Mark completed</Button>
        </div>
      </div>
    </Modal>
  )
}
