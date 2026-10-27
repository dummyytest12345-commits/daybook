import { useSeo } from '../hooks/useSeo'
import { format } from 'date-fns'
import { ClipboardCopy, Flame, Repeat, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Card, CardHeader, EmptyState, ProgressBar, ProgressRing } from '../components/ui'
import { EmptyLogIllustration } from '../components/ui/illustrations'
import { QuickAdd } from '../components/tasks/QuickAdd'
import { TaskRow } from '../components/tasks/TaskRow'
import { InsightList } from '../components/analytics/InsightList'
import { BulkBar } from '../components/tasks/BulkBar'
import { useAllTasks, useCtx, useInsights, useSummary } from '../hooks/useData'
import { actions } from '../hooks/useActions'
import { carryOverCandidates, bestStreak } from '../selectors/summarize'
import { groupByDate } from '../selectors/groupBy'
import { standup } from '../services/exporters/markdown'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { todayISO } from '../utils/date'
import { fmtHours, pluralize } from '../utils/format'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function TodayPage() {
  useSeo({ title: 'Today' })
  const today = todayISO()
  const range = { start: today, end: today }
  const all = useAllTasks()
  const ctx = useCtx()
  const { summary } = useSummary(range)
  const insights = useInsights(range)
  const recurring = useStore((s) => s.recurring)
  const openTaskModal = useUI((s) => s.openTaskModal)
  const list = groupByDate(all)[today] || []
  const carry = carryOverCandidates(all, today, ctx.settings.carryMaxDays)
  const carriedToday = list.filter((t) => t.autoCarried && t.status !== 'completed')
  const best = bestStreak(all, ctx.dayLogs, ctx.settings)

  const copyStandup = async () => {
    try {
      await navigator.clipboard.writeText(standup(all, ctx, today))
      toast.success('Standup copied to clipboard')
    } catch {
      toast.error('Clipboard not available')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{greeting()} 👋</h1>
          <p className="text-muted">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={summary.streak ? 'warn' : 'neutral'} className="px-3 py-1 text-sm"><Flame size={14} aria-hidden />{summary.streak}-day streak{best > summary.streak ? ` · best ${best}` : ''}</Badge>
          <Button onClick={copyStandup}><ClipboardCopy size={14} />Copy standup</Button>
          {recurring.length > 0 && <Button onClick={() => toast(`${useStore.getState().applyRecurring(today)} recurring tasks added`)}><Repeat size={14} />Add recurring</Button>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card className="p-4"><QuickAdd date={today} autoFocus /></Card>
          {carriedToday.length > 0 && (
            <Card className="border-primary/30">
              <CardHeader
                title={`Carried forward (${carriedToday.length})`}
                subtitle="Unfinished from earlier days. Complete one here and its earlier days are marked completed too."
              />
              <div className="space-y-0.5 p-2">
                {carriedToday.map((t) => (
                  <div key={t.id} className="rounded-input">
                    <TaskRow task={t} selectable={false} />
                    <div className="flex flex-wrap gap-1.5 pb-2 pl-10">
                      <Button size="sm" variant="primary" onClick={() => actions.setStatus(t.id, 'completed')}>Done</Button>
                      <Button size="sm" onClick={() => useUI.getState().openFinishDialog(t.id)}>Finished earlier…</Button>
                      <Button size="sm" variant="ghost" onClick={() => actions.removeCarried(t.id)}>Remove from today</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="Today’s tasks" action={<Button size="sm" disabled={!list.some((t) => t.status !== 'completed')} onClick={() => actions.markDayComplete(today)}>Mark all completed</Button>} />
            <BulkBar />
            {list.length === 0 ? (
              <EmptyState illustration={<EmptyLogIllustration />} title="Nothing logged yet today" text="Add your first task with the quick-add bar (try “Fix bug 2h #profile”)." action={<Button variant="primary" onClick={() => openTaskModal()}>Add task</Button>} />
            ) : (
              <div className="space-y-0.5 p-2">{list.filter((t) => !carriedToday.includes(t)).map((t) => <TaskRow key={t.id} task={t} />)}
                {list.length > 0 && list.every((t) => carriedToday.includes(t)) && <p className="px-2 py-3 text-sm text-muted">Only carried-forward tasks so far. Add something new with the quick-add bar.</p>}</div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="flex items-center gap-4 p-4">
            <ProgressRing value={summary.completionRate}>
              <div><p className="text-xl font-bold">{summary.completed}<span className="text-sm text-muted">/{summary.total}</span></p><p className="text-[10px] text-muted">done</p></div>
            </ProgressRing>
            <div className="flex-1 space-y-1.5">
              <p className="text-sm font-medium">{summary.total ? `${pluralize(summary.total - summary.completed, 'task')} left` : 'No tasks yet'}</p>
              <p className="text-xs text-muted">{fmtHours(summary.hours)} of {fmtHours(summary.capacity)}h logged</p>
              <ProgressBar value={summary.hours} max={summary.capacity || 1} label="Hours vs capacity" />
            </div>
          </Card>

          {carry.length > 0 && (
            <Card>
              <CardHeader title={`Unfinished from earlier days (${carry.length})`} subtitle="Not carried forward yet"
                action={<Button size="sm" onClick={() => actions.carryOver(carry.map((t) => t.id), today)}>Carry to today</Button>} />
              <div className="max-h-64 space-y-0.5 overflow-y-auto p-2">
                {carry.slice(0, 12).map((t) => <TaskRow key={t.id} task={t} selectable={false} showDate />)}
                {carry.length > 12 && <p className="px-2 py-1 text-xs text-muted">+{carry.length - 12} more</p>}
              </div>
            </Card>
          )}
          <InsightList items={insights.slice(0, 3)} />
        </div>
      </div>
    </div>
  )
}

export { Undo2 }
