import { useSeo } from '../hooks/useSeo'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Checkbox, Input, Select } from '../components/ui'
import { FilterBar } from '../components/layout/FilterBar'
import { KpiCard } from '../components/analytics/KpiCard'
import { AgingChart, BurnUp, ProgressChart, ProjectBreakdown, HoursCapacity, ModuleBreakdown, PeriodCompare, StackedBar, StatusDonut, TrendLine, WeekdayChart } from '../components/analytics/charts'
import { Heatmap } from '../components/analytics/Heatmap'
import { PivotTable } from '../components/analytics/PivotTable'
import { InsightList } from '../components/analytics/InsightList'
import { useAnalytics, useComparison, useCtx, useHeatmap, useInsights } from '../hooks/useData'
import { projectBreakdown } from '../selectors/projects'
import { useFilters } from '../hooks/useFilters'
import { useStore } from '../store/useStore'
import { PRESETS, addDaysISO, presetRange, todayISO } from '../utils/date'
import { fmtHours, fmtPct } from '../utils/format'
import { diffDays } from '../utils/date'

export default function AnalyticsPage() {
  useSeo({ title: 'Analytics' })
  const navigate = useNavigate()
  const ws = useStore((s) => s.settings.weekStartsOn)
  const capacity = useStore((s) => s.settings.dailyCapacity)
  const [preset, setPreset] = useState('thisMonth')
  const [custom, setCustom] = useState({ start: addDaysISO(todayISO(), -29), end: todayISO() })
  const [groupBy, setGroupBy] = useState('day')
  const [compare, setCompare] = useState(true)
  const { filters, setFilters } = useFilters()

  const range = useMemo(() => (preset === 'custom' ? custom : presetRange(preset, ws)), [preset, custom, ws])
  const a = useAnalytics(range, groupBy, filters)
  const { deltas } = useComparison(range, filters)
  const insights = useInsights(range, filters)
  const heatRange = useMemo(() => ({ start: addDaysISO(todayISO(), -364), end: todayISO() }), [])
  const heat = useHeatmap(heatRange)
  const s = a.summary
  const ctx = useCtx()
  const byProject = useMemo(() => projectBreakdown(a.tasks, ctx.projects, ctx), [a.tasks, ctx])
  const hasProjects = ctx.projects.some((p) => !p.deletedAt)
  const d = compare ? deltas : {}
  const spark = a.daily.length > 1 ? a.daily : null
  const setStatus = (st) => setFilters({ status: [st] })

  const openFilter = (f) => {
    if (f.date) return navigate(`/log/day?d=${f.date}`)
    const p = new URLSearchParams()
    if (f.status) p.set('status', f.status.join(','))
    if (f.dayType) p.set('dayType', f.dayType.join(','))
    p.set('d', range.start)
    p.set('u', diffDays(range.end, range.start) > 31 ? 'month' : diffDays(range.end, range.start) > 7 ? 'month' : 'week')
    navigate(`/log/table?${p}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold">Analytics</h1>
        <Select aria-label="Date range" value={preset} onChange={(e) => setPreset(e.target.value)} className="w-40">
          {PRESETS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
        </Select>
        {preset === 'custom' && (
          <div className="flex items-center gap-1">
            <Input type="date" aria-label="From" value={custom.start} onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))} className="w-36" />–
            <Input type="date" aria-label="To" value={custom.end} onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))} className="w-36" />
          </div>
        )}
        <Select aria-label="Group by" value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="w-32">
          <option value="day">Group: Day</option><option value="week">Group: Week</option><option value="month">Group: Month</option>
        </Select>
        <Checkbox checked={compare} onChange={setCompare} label="Compare prev." />
      </div>
      <FilterBar />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-9">
        <KpiCard label="Total tasks" value={s.total} delta={d.total} spark={spark} sparkKey="total" />
        <KpiCard label="Completed" value={fmtPct(s.completionRate)} delta={d.completionRate} format={(v) => `${Math.round(v * 100)} pts`} spark={spark} sparkKey="completed" />
        <KpiCard label="Hours logged" value={fmtHours(s.hours)} unit="h" delta={d.hours} format={fmtHours} spark={spark} sparkKey="hours" />
        <KpiCard label="Avg progress" value={s.avgProgress} unit="%" delta={d.avgProgress} format={(v) => `${Math.round(v)} pts`} />
        <KpiCard label="Utilisation" value={fmtPct(s.utilisation)} delta={d.utilisation} format={(v) => `${Math.round(v * 100)} pts`} />
        <KpiCard label="Avg tasks / day" value={s.avgTasksPerDay} delta={d.avgTasksPerDay} />
        <KpiCard label="Streak" value={s.streak} unit=" days" delta={d.streak} />
        <KpiCard label="Blocked" value={s.blocked} delta={d.blocked} />
        <KpiCard label="Carry-over" value={s.carryOver} delta={d.carryOver} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><StackedBar data={a.series} onStatus={setStatus} /></div>
        <StatusDonut summary={s} onStatus={setStatus} />
        <div className="lg:col-span-2"><TrendLine data={a.series} /></div>
        {hasProjects && <ProjectBreakdown data={byProject} onProject={(id) => setFilters({ project: [id] })} />}
        <ModuleBreakdown data={a.modules} onModule={(m) => setFilters({ module: [m] })} />
        <BurnUp data={a.burn} />
        <HoursCapacity data={a.series} capacity={capacity} />
        <WeekdayChart data={a.weekdays} />
        <ProgressChart data={a.progressBins} summary={s} />
        <AgingChart data={a.aging} />
        {compare && <PeriodCompare deltas={deltas} />}
      </div>
      <Heatmap heat={heat} weekStartsOn={ws} onDay={(dt) => navigate(`/log/day?d=${dt}`)} />
      <PivotTable range={range} filters={filters} />
      <InsightList items={insights} onOpen={openFilter} />
    </div>
  )
}
