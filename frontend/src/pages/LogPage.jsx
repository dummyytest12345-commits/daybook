import { useSeo } from '../hooks/useSeo'
import { Plus } from 'lucide-react'
import { PeriodNavigator } from '../components/layout/PeriodNavigator'
import { ViewSwitcher } from '../components/layout/ViewSwitcher'
import { FilterBar } from '../components/layout/FilterBar'
import { Button, Select } from '../components/ui'
import { DayView } from '../components/views/DayView'
import { WeekView } from '../components/views/WeekView'
import { MonthView } from '../components/views/MonthView'
import { BoardView } from '../components/views/BoardView'
import { TableView } from '../components/views/TableView'
import { useFilters } from '../hooks/useFilters'
import { usePeriod } from '../hooks/usePeriod'
import { useTasks } from '../hooks/useData'
import { useStore } from '../store/useStore'
import { useUI } from '../store/useUI'
import { Skeleton } from '../components/ui'

export default function LogPage() {
  useSeo({ title: 'Task log' })
  const period = usePeriod()
  const { filters } = useFilters()
  const ready = useStore((s) => s.ready)
  const openTaskModal = useUI((s) => s.openTaskModal)
  const { tasks } = useTasks(period.range, filters)
  const { view, range } = period
  const projects = useStore((s) => s.projects)
  const setWipLimit = useStore((s) => s.setWipLimit)
  // WIP limits apply when the board is filtered to exactly one project
  const onlyProject = filters.project.length === 1 ? projects.find((p) => p.id === filters.project[0] && !p.deletedAt) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodNavigator period={period} />
        <div className="flex flex-wrap items-center gap-2">
          {(view === 'board' || view === 'table') && (
            <Select aria-label="Period unit" value={period.unit} onChange={(e) => period.setUnit(e.target.value)} className="h-9 w-28">
              <option value="day">Day</option><option value="week">Week</option><option value="month">Month</option>
            </Select>
          )}
          <ViewSwitcher view={view} onChange={period.setView} />
          <Button variant="primary" className="hidden sm:inline-flex" onClick={() => openTaskModal(null, { date: period.anchor })}><Plus size={16} />Add</Button>
        </div>
      </div>
      <FilterBar />
      {!ready ? (
        <div className="space-y-2"><Skeleton className="h-16" /><Skeleton className="h-16" /><Skeleton className="h-16" /></div>
      ) : (
        <div className="animate-in" key={`${view}-${period.unit}`}>
          {view === 'day' && <DayView date={period.anchor} tasks={tasks} />}
          {view === 'week' && <WeekView range={range} tasks={tasks} onOpenDay={period.openDay} />}
          {view === 'month' && <MonthView range={range} tasks={tasks} onOpenDay={period.openDay} />}
          {view === 'board' && <BoardView tasks={tasks} wipLimits={onlyProject?.wipLimits} onLimit={onlyProject ? (sid, n) => setWipLimit(onlyProject.id, sid, n) : undefined} />}
          {view === 'table' && <TableView range={range} tasks={tasks} />}
        </div>
      )}
    </div>
  )
}
