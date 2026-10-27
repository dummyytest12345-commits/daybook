import { format } from 'date-fns'
import { ChartCard } from './ChartCard'
import { fromISO } from '../../utils/date'

const LEVELS = ['var(--color-line)', '#b7d3f6', '#6da7ec', '#2a78d6', '#184f95']
const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', '']

/** GitHub-style calendar heatmap built with CSS grid. Click a day to open it. */
export function Heatmap({ heat, onDay, weekStartsOn = 1 }) {
  const { weeks } = heat
  const labels = weekStartsOn === 1 ? DAY_LABELS : ['', 'Mon', '', 'Wed', '', 'Fri', '']
  let lastMonth = ''
  const data = weeks.flatMap((w) => w.days.filter((d) => d.inside && d.count).map((d) => ({ date: d.date, tasks: d.count })))
  return (
    <ChartCard title="Activity heatmap" subtitle="Tasks per day" data={data}>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex gap-1" role="img" aria-label="Calendar heatmap of tasks per day">
          <div className="grid grid-rows-[16px_repeat(7,14px)] gap-[3px] pr-1 text-[10px] text-muted">
            <span />{labels.map((l, i) => <span key={i} className="leading-[14px]">{l}</span>)}
          </div>
          {weeks.map((w) => {
            const m = format(fromISO(w.days.find((d) => d.inside)?.date || w.start), 'MMM')
            const showMonth = m !== lastMonth
            if (showMonth) lastMonth = m
            return (
              <div key={w.start} className="grid grid-rows-[16px_repeat(7,14px)] gap-[3px]">
                <span className="text-[10px] leading-4 text-muted">{showMonth ? m : ''}</span>
                {w.days.map((d) => (
                  <button
                    key={d.date} type="button" disabled={!d.inside} onClick={() => onDay?.(d.date)}
                    title={`${d.date}: ${d.count} task${d.count === 1 ? '' : 's'}`} aria-label={`${d.date}: ${d.count} tasks`}
                    className="size-[14px] rounded-[3px] disabled:opacity-0"
                    style={{ background: LEVELS[d.level] }}
                  />
                ))}
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted">
        Less {LEVELS.map((c) => <span key={c} className="size-3 rounded-[3px]" style={{ background: c }} aria-hidden />)} More
      </div>
    </ChartCard>
  )
}
