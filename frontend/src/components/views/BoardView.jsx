import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useState } from 'react'
import { AlertTriangle, Gauge } from 'lucide-react'
import { Badge, Button, Input, PopoverBox, STATUS_COLOR } from '../ui'
import { DropColumn, TaskCard } from '../tasks/TaskCard'
import { useStore } from '../../store/useStore'

/**
 * Kanban: one column per status. Drop a card to change its status.
 * With `wipLimits` (+ `onLimit`) columns show work-in-progress limits and warn when exceeded.
 */
export function BoardView({ tasks, wipLimits, onLimit }) {
  const statuses = useStore((s) => s.settings.statuses)
  const update = useStore((s) => s.updateTask)
  const [dragging, setDragging] = useState(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const onEnd = ({ active, over }) => {
    setDragging(null)
    const t = tasks.find((x) => x.id === active.id)
    if (over && t && t.status !== over.id) update(t.id, { status: over.id }, 'Moved on board')
  }

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDragging(tasks.find((t) => t.id === e.active.id))} onDragEnd={onEnd} onDragCancel={() => setDragging(null)}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {statuses.map((s) => {
          const limit = wipLimits?.[s.id]
          const list = tasks.filter((t) => t.status === s.id).sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
          return (
            <DropColumn key={s.id} id={s.id} className={`flex min-h-64 flex-col rounded-card border bg-canvas ${limit && list.length > limit ? 'border-st-blocked' : 'border-line'}`}>
              <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
                <span className="size-2.5 rounded-full" style={{ background: STATUS_COLOR[s.id] || s.color }} aria-hidden />
                <h3 className="text-sm font-semibold">{s.label}</h3>
                <Badge tone={limit && list.length > limit ? 'bad' : 'neutral'}>{limit ? `${list.length} / ${limit}` : list.length}</Badge>
                {limit && list.length > limit ? <span className="inline-flex items-center gap-1 text-xs font-medium text-st-blocked"><AlertTriangle size={12} aria-hidden />Over limit</span> : null}
                {onLimit && (
                  <PopoverBox
                    className="w-56 space-y-2"
                    trigger={<Button size="icon" variant="ghost" className="ml-auto h-7 w-7" aria-label={`Set WIP limit for ${s.label}`}><Gauge size={14} /></Button>}
                  >
                    <label className="block text-xs font-medium text-muted">WIP limit for {s.label}
                      <Input type="number" min="0" max="99" defaultValue={limit || ''} placeholder="No limit" className="mt-1"
                        onBlur={(e) => onLimit(s.id, Number(e.target.value) || 0)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
                    </label>
                    <p className="text-xs text-muted">Columns turn red when they hold more cards than this. Leave empty for no limit.</p>
                  </PopoverBox>
                )}
              </div>
              <div className="flex-1 space-y-2 p-2">
                {list.map((t) => (
                  <div key={t.id}>
                    <p className="mb-0.5 px-0.5 text-[10px] uppercase tracking-wide text-muted">{t.date}</p>
                    <TaskCard task={t} showStatus={false} />
                  </div>
                ))}
                {!list.length && <p className="py-6 text-center text-xs text-muted">Drop tasks here</p>}
              </div>
            </DropColumn>
          )
        })}
      </div>
      <DragOverlay>{dragging && <TaskCard task={dragging} overlay />}</DragOverlay>
    </DndContext>
  )
}
