import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CheckCheck, ClipboardList, Plus, Settings2, Trash2 } from 'lucide-react'
import { Badge, Button, Card, EmptyState, Field, Input, PopoverBox, ProgressBar, Select, Textarea } from '../ui'
import { EmptyLogIllustration } from '../ui/illustrations'
import { QuickAdd } from '../tasks/QuickAdd'
import { DragHandle, TaskRow } from '../tasks/TaskRow'
import { BulkBar } from '../tasks/BulkBar'
import { useDayLog, useCtx } from '../../hooks/useData'
import { actions } from '../../hooks/useActions'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { dayTypeOf, hoursMap, capacityOf, sum } from '../../selectors/common'
import { fmtHours } from '../../utils/format'
import { groupByDate } from '../../selectors/groupBy'
import { DAY_TYPES } from '../../schemas/dayLog'

function SortableRow({ task, muted, hours }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      <TaskRow task={task} muted={muted} hoursValue={hours} dragHandle={<DragHandle {...attributes} {...listeners} />} />
    </div>
  )
}

export function DaySettings({ date }) {
  const { dayType, capacity, note, set } = useDayLog(date)
  const ctx = useCtx()
  const effective = dayTypeOf(date, ctx.dayLogs, ctx.settings)
  return (
    <PopoverBox
      trigger={<Button size="sm"><Settings2 size={14} />Day settings</Button>}
      className="space-y-3"
    >
      <Field label="Day type">
        <Select value={dayType || effective} onChange={(e) => set({ dayType: e.target.value })}>
          {DAY_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
        </Select>
      </Field>
      <Field label="Capacity (hours)">
        <Input type="number" min="0" max="24" step="0.5" value={capacity} onChange={(e) => set({ capacityHours: Number(e.target.value) })} />
      </Field>
      <Field label="Day note">
        <Textarea rows={3} value={note} onChange={(e) => set({ note: e.target.value })} placeholder="Anything worth remembering…" />
      </Field>
    </PopoverBox>
  )
}

/** Single-day list with drag reorder, day type, note and bulk actions. */
export function DayView({ date, tasks }) {
  const ctx = useCtx()
  const openTaskModal = useUI((s) => s.openTaskModal)
  const moveTask = useStore((s) => s.moveTask)
  const dayLog = useStore((s) => s.dayLogs[date])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  const list = groupByDate(tasks)[date] || []
  const type = dayTypeOf(date, ctx.dayLogs, ctx.settings)
  const cap = capacityOf(date, ctx.dayLogs, ctx.settings)
  const hm = hoursMap(list, ctx.dayLogs, ctx.settings)
  const hours = sum(list, (t) => hm.get(t.id) || 0)
  const done = list.filter((t) => t.status === 'completed').length

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const to = list.findIndex((t) => t.id === over.id)
    moveTask(active.id, date, to)
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <QuickAdd date={date} id="quick-add" />
      </Card>
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
          <div className="min-w-40 flex-1">
            <div className="mb-1 flex items-center gap-2 text-sm">
              <span className="font-semibold">{done} of {list.length} done</span>
              {type !== 'work' && <Badge tone="warn">{type}</Badge>}
              <span className="text-muted">· {fmtHours(hours)}{cap ? ` / ${fmtHours(cap)}` : ''}h</span>
            </div>
            <ProgressBar value={done} max={list.length || 1} color="var(--color-st-completed)" label="Completion" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => openTaskModal(null, { date })}><Plus size={14} />Add task</Button>
            <Button size="sm" disabled={!list.some((t) => t.status !== 'completed')} onClick={() => actions.markDayComplete(date)}><CheckCheck size={14} />Mark all completed</Button>
            <DaySettings date={date} />
            <Button size="sm" variant="ghost" disabled={!list.length} onClick={() => actions.deleteDay(date)} aria-label="Clear day"><Trash2 size={14} /></Button>
          </div>
        </div>
        {dayLog?.note && <p className="border-b border-line bg-canvas px-4 py-2 text-sm text-muted">📝 {dayLog.note}</p>}
        <BulkBar />
        {list.length === 0 ? (
          <EmptyState illustration={<EmptyLogIllustration />} title="Nothing logged for this day" text="Use the quick-add bar above, or press N to add a task." action={<Button variant="primary" onClick={() => openTaskModal(null, { date })}>Add first task</Button>} />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={list.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5 p-2">
                {list.map((t) => <SortableRow key={t.id} task={t} muted={type !== 'work'} />)}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </Card>
    </div>
  )
}
