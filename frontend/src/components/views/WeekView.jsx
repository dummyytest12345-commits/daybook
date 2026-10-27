import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, ProgressBar } from '../ui'
import { DropColumn, TaskCard } from '../tasks/TaskCard'
import { useCtx } from '../../hooks/useData'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { capacityOf, dayTypeOf, hoursMap, sum } from '../../selectors/common'
import { groupByDate } from '../../selectors/groupBy'
import { eachDayISO, fromISO, todayISO } from '../../utils/date'
import { cn, fmtHours } from '../../utils/format'
import { format } from 'date-fns'

/** 7 columns, weekends greyed, per-day progress and hour totals. Drag cards between days. */
export function WeekView({ range, tasks, onOpenDay }) {
  const ctx = useCtx()
  const moveTask = useStore((s) => s.moveTask)
  const openTaskModal = useUI((s) => s.openTaskModal)
  const [dragging, setDragging] = useState(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const by = groupByDate(tasks)
  const hm = hoursMap(tasks, ctx.dayLogs, ctx.settings)

  const onEnd = ({ active, over }) => {
    setDragging(null)
    if (over && tasks.find((t) => t.id === active.id)?.date !== over.id) moveTask(active.id, over.id)
  }

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDragging(tasks.find((t) => t.id === e.active.id))} onDragEnd={onEnd} onDragCancel={() => setDragging(null)}>
      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        {eachDayISO(range.start, range.end).map((d) => {
          const list = by[d] || []
          const type = dayTypeOf(d, ctx.dayLogs, ctx.settings)
          const cap = capacityOf(d, ctx.dayLogs, ctx.settings)
          const hours = sum(list, (t) => hm.get(t.id) || 0)
          const done = list.filter((t) => t.status === 'completed').length
          const today = d === todayISO()
          return (
            <DropColumn
              key={d} id={d}
              className={cn('flex min-h-52 flex-col rounded-card border bg-surface shadow-card', today ? 'border-primary' : 'border-line', type !== 'work' && 'bg-canvas')}
            >
              <div className="border-b border-line p-2.5">
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => onOpenDay(d)} className="text-left hover:text-primary">
                    <span className={cn('block text-xs font-semibold uppercase tracking-wide', type !== 'work' ? 'italic text-muted' : 'text-muted')}>{format(fromISO(d), 'EEE')}</span>
                    <span className="text-lg font-semibold">{format(fromISO(d), 'd')}</span>
                    <span className="ml-1 text-xs text-muted">{format(fromISO(d), 'MMM')}</span>
                  </button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Add task on ${d}`} onClick={() => openTaskModal(null, { date: d })}><Plus size={14} /></Button>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
                  <span>{done}/{list.length} done</span>
                  <span>{fmtHours(hours)}h</span>
                </div>
                <ProgressBar value={done} max={list.length || 1} color="var(--color-st-completed)" className="mt-1 h-1.5" label={`${d} progress`} />
                {type !== 'work' && <Badge tone="warn" className="mt-1.5">{type}{list.length ? ' · work logged' : ''}</Badge>}
                {cap === 0 && !list.length && null}
              </div>
              <div className="flex-1 space-y-1.5 p-2">
                {list.map((t) => <TaskCard key={t.id} task={t} />)}
              </div>
            </DropColumn>
          )
        })}
      </div>
      <DragOverlay>{dragging && <TaskCard task={dragging} overlay />}</DragOverlay>
    </DndContext>
  )
}
