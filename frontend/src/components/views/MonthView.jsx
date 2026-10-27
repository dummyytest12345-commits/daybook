import { format } from 'date-fns'
import { STATUS_COLOR } from '../ui'
import { useCtx } from '../../hooks/useData'
import { dayTypeOf } from '../../selectors/common'
import { groupByDate } from '../../selectors/groupBy'
import { addDaysISO, eachDayISO, fromISO, todayISO, rangeFor } from '../../utils/date'
import { cn } from '../../utils/format'

const NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Calendar grid: task count and status dots per cell; click opens the day. */
export function MonthView({ range, tasks, onOpenDay }) {
  const ctx = useCtx()
  const ws = ctx.settings.weekStartsOn
  const by = groupByDate(tasks)
  // pad to full weeks
  const first = rangeFor('week', range.start, ws).start
  const last = rangeFor('week', range.end, ws).end
  const days = eachDayISO(first, last)
  const head = [...NAMES.slice(ws), ...NAMES.slice(0, ws)]

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="grid grid-cols-7 border-b border-line bg-canvas text-center text-xs font-semibold uppercase text-muted">
        {head.map((n) => <div key={n} className="py-2">{n}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = by[d] || []
          const inMonth = d >= range.start && d <= range.end
          const type = dayTypeOf(d, ctx.dayLogs, ctx.settings)
          const counts = { completed: 0, in_progress: 0, blocked: 0, pending: 0 }
          list.forEach((t) => counts[t.status]++)
          return (
            <button
              type="button" key={d} onClick={() => onOpenDay(d)}
              aria-label={`${format(fromISO(d), 'EEEE d MMMM')}: ${list.length} tasks`}
              className={cn(
                'min-h-20 border-b border-r border-line p-1.5 text-left transition hover:bg-primary/5 md:min-h-24 md:p-2',
                !inMonth && 'opacity-40', type !== 'work' && 'bg-canvas italic',
              )}
            >
              <span className={cn('inline-flex size-6 items-center justify-center rounded-full text-xs font-medium', d === todayISO() && 'bg-primary text-white')}>
                {format(fromISO(d), 'd')}
              </span>
              {list.length > 0 && (
                <div className="mt-1">
                  <span className="text-xs font-semibold">{list.length} <span className="hidden font-normal text-muted sm:inline">tasks</span></span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(counts).filter(([, n]) => n).map(([s, n]) => (
                      <span key={s} title={`${n} ${s.replace('_', ' ')}`} className="inline-flex items-center gap-0.5 text-[10px] text-muted">
                        <span className="size-2 rounded-full" style={{ background: STATUS_COLOR[s] }} aria-hidden />{n}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { addDaysISO }
