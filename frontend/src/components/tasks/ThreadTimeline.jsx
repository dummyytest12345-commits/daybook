import { format } from 'date-fns'
import { X } from 'lucide-react'
import { useState } from 'react'
import { Button, Input, STATUS_COLOR, StatusBadge } from '../ui'
import { Icon } from '../icons'
import { useStatusLabel } from './StatusSelect'
import { getThreadIndex } from '../../hooks/useThreads'
import { threadInfo } from '../../selectors/threads'
import { actions } from '../../hooks/useActions'
import { progressOf } from '../../selectors/progress'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { diffDays, fromISO, todayISO } from '../../utils/date'
import { cn, fmtHours } from '../../utils/format'

const dayLabel = (iso) => format(fromISO(iso), 'EEE d MMM')
const clock = (iso) => format(new Date(iso), 'HH:mm')

/** Connector text between two rows of a thread. */
function Between({ from, to }) {
  const gap = diffDays(to.date, from.date)
  const text = to.autoCarried ? 'Carried forward automatically' : 'Continued'
  return (
    <li className="relative ml-[7px] flex items-center gap-2 border-l-2 border-dashed border-line py-2 pl-5 text-xs text-muted">
      <span className="rounded-full bg-canvas px-2.5 py-0.5 ring-1 ring-line">{text}{gap > 1 ? ` · ${gap} days later` : ''}</span>
    </li>
  )
}

/**
 * The conversation for one piece of work: one block per day it was worked on, progress notes as
 * message bubbles, system notes for carry-forward and completion, and a box to add an update.
 */
export function ThreadTimeline({ task }) {
  const tasks = useStore((s) => s.tasks)
  const statusLabel = useStatusLabel()
  const info = threadInfo(task, getThreadIndex(tasks))
  const [text, setText] = useState('')
  const today = todayISO()
  const open = info.rows.filter((r) => r.status !== 'completed')
  const tail = info.rows.at(-1)

  const send = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    useStore.getState().addUpdate(task.id, text)
    setText('')
  }

  return (
    <section aria-label="Thread" className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold"><Icon name="thread" size={15} />Thread</h4>
        <p className="text-xs text-muted">
          {info.inThread ? `${info.total} days · started ${dayLabel(info.firstDate)}${info.spanDays > info.total - 1 ? ` · ${info.spanDays + 1} days elapsed` : ''}` : 'Single day. Unfinished work carries forward automatically.'}
        </p>
      </header>

      <ol className="relative" aria-label="Days in this thread">
        {info.rows.map((r, i) => {
          const current = r.id === task.id
          const resolver = r.resolvedBy ? info.rows.find((x) => x.id === r.resolvedBy) : null
          return (
            <li key={r.id} className="contents">
              {i > 0 && <Between from={info.rows[i - 1]} to={r} />}
              <div className="relative flex gap-3">
                <span className="relative mt-1 grid size-4 shrink-0 place-items-center rounded-full ring-4 ring-surface" style={{ background: STATUS_COLOR[r.status] }} aria-hidden>
                  {r.status === 'completed' && <Icon name="check" size={10} className="text-white" strokeWidth={3} />}
                </span>
                <div className={cn('min-w-0 flex-1 rounded-card border p-3', current ? 'border-primary/50 bg-primary/5' : 'border-line bg-surface')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{dayLabel(r.date)}</span>
                    {r.date === today && <span className="rounded bg-primary/10 px-1.5 text-[10px] font-semibold uppercase text-primary">Today</span>}
                    <StatusBadge status={r.status} label={statusLabel(r.status)} />
                    {r.hours != null && <span className="text-xs text-muted">{fmtHours(r.hours)}h</span>}
                    {(r.status === 'in_progress' || r.status === 'completed') && <span className="text-xs font-medium text-muted">{progressOf(r)}%</span>}
                    {!current && (
                      <button type="button" className="ml-auto text-xs text-primary hover:underline" onClick={() => useUI.getState().openDrawer(r.id)}>Open</button>
                    )}
                  </div>
                  {resolver && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-st-completed"><Icon name="check" size={12} />Marked completed because it was finished on {dayLabel(resolver.date)}</p>
                  )}
                  {(r.updates || []).length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {r.updates.map((u) => (
                        <li key={u.id} className="group flex items-start gap-2">
                          <div className="max-w-full rounded-2xl rounded-tl-sm bg-canvas px-3 py-1.5 text-sm ring-1 ring-line">
                            <p className="whitespace-pre-wrap break-words">{u.text}</p>
                            <p className="mt-0.5 text-[10px] text-muted">{clock(u.at)}</p>
                          </div>
                          <button type="button" aria-label="Delete update" onClick={() => useStore.getState().deleteUpdate(r.id, u.id)} className="mt-1 rounded p-0.5 text-muted opacity-0 hover:text-st-blocked focus:opacity-100 group-hover:opacity-100"><X size={12} /></button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!(r.updates || []).length && !resolver && <p className="mt-1.5 text-xs text-muted">{r.autoCarried ? 'Carried forward. No update yet.' : 'No update yet.'}</p>}
                </div>
              </div>
            </li>
          )
        })}
        {tail.status === 'completed' && (
          <li className="ml-[7px] border-l-2 border-transparent py-2 pl-5 text-xs font-medium text-st-completed">
            <Icon name="check" size={12} className="mr-1 inline" />Completed {dayLabel(tail.date)}{info.spanDays > 0 ? ` after ${info.spanDays + 1} days` : ''}
          </li>
        )}
      </ol>

      <form onSubmit={send} className="flex gap-2" aria-label={`Add an update for ${dayLabel(task.date)}`}>
        <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={`Add an update for ${task.date === today ? 'today' : dayLabel(task.date)}…`} aria-label="Thread update" />
        <Button type="submit" variant="primary" size="icon" aria-label="Send update" disabled={!text.trim()}><Icon name="send" size={16} /></Button>
      </form>

      {open.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" onClick={() => actions.setStatus(open.at(-1).id, 'completed')}><Icon name="check" size={14} />Mark complete{open.length > 1 ? ` (all ${open.length} days)` : ''}</Button>
          <Button size="sm" onClick={() => useUI.getState().openFinishDialog(task.id)}><Icon name="history" size={14} />Finished on another day…</Button>
        </div>
      )}
    </section>
  )
}
