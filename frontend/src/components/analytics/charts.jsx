import { useState } from 'react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend as RLegend, Line, LineChart,
  Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ChartCard, Legend } from './ChartCard'
import { STATUS_COLOR, STATUS_ICON } from '../ui'
import { useStore } from '../../store/useStore'

/** Fixed categorical order (never cycled); 9th+ folds into "Other". */
export const CAT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const AXIS = { fontSize: 11, fill: '#898781' }
const GRID = 'var(--color-line)'
const STACK_ORDER = ['completed', 'in_progress', 'pending', 'blocked']

const tip = {
  contentStyle: { background: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: 8, fontSize: 12, color: 'var(--color-ink)' },
  cursor: { fill: 'rgb(148 163 184 / 0.12)' },
}

function useStatusMeta() {
  const statuses = useStore((s) => s.settings.statuses)
  return STACK_ORDER.map((id) => ({
    key: id, label: statuses.find((s) => s.id === id)?.label || id, color: STATUS_COLOR[id], icon: STATUS_ICON[id],
  }))
}

const Empty = () => <p className="py-16 text-center text-sm text-muted">No data for this period.</p>

/** Tasks per bucket, stacked by status. Click a segment to filter by that status. */
export function StackedBar({ data, onStatus }) {
  const meta = useStatusMeta()
  const [hidden, setHidden] = useState([])
  const has = data.some((d) => d.total)
  return (
    <ChartCard title="Tasks by status" subtitle="Stacked per period" data={data.map(({ label, total, completed, in_progress, pending, blocked }) => ({ period: label, total, completed, in_progress, pending, blocked }))}
      legend={<Legend items={meta} hidden={hidden} onToggle={(k) => setHidden((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]))} />}>
      {!has ? <Empty /> : (
        <div role="img" aria-label="Stacked bar chart of tasks per period by status" className="h-64">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ left: -20, right: 4 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip {...tip} />
              {meta.filter((m) => !hidden.includes(m.key)).map((m) => (
                <Bar key={m.key} dataKey={m.key} name={m.label} stackId="s" fill={m.color} stroke="var(--color-surface)" strokeWidth={1}
                  cursor="pointer" onClick={() => onStatus?.(m.key)} maxBarSize={36} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}

export function StatusDonut({ summary, onStatus }) {
  const meta = useStatusMeta()
  const counts = { completed: summary.completed, in_progress: summary.inProgress, pending: summary.pending, blocked: summary.blocked }
  const data = meta.map((m) => ({ ...m, value: counts[m.key] })).filter((d) => d.value)
  return (
    <ChartCard title="Status split" data={meta.map((m) => ({ status: m.label, tasks: counts[m.key] }))}
      legend={<Legend items={meta.map((m) => ({ ...m, label: `${m.label} (${counts[m.key]})` }))} />}>
      {!data.length ? <Empty /> : (
        <div className="relative h-56" role="img" aria-label={`Status donut: ${Math.round(summary.completionRate * 100)} percent done`}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="88%" paddingAngle={2} stroke="var(--color-surface)" strokeWidth={2} cursor="pointer" onClick={(d) => onStatus?.(d.key)}>
                {data.map((d) => <Cell key={d.key} fill={d.color} />)}
              </Pie>
              <Tooltip {...tip} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{Math.round(summary.completionRate * 100)}%</span>
            <span className="text-xs text-muted">done</span>
          </div>
        </div>
      )}
    </ChartCard>
  )
}

export function TrendLine({ data }) {
  const rows = data.map((d) => ({ period: d.label, completed: d.completed, rate: d.total ? Math.round((d.completed / d.total) * 100) : 0 }))
  return (
    <ChartCard title="Completion trend" subtitle="Tasks completed per period" data={rows}>
      {!data.some((d) => d.total) ? <Empty /> : (
        <div className="h-56" role="img" aria-label="Line chart of completed tasks over time">
          <ResponsiveContainer>
            <AreaChart data={rows} margin={{ left: -20, right: 4 }}>
              <defs><linearGradient id="g-trend" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={CAT[0]} stopOpacity={0.25} /><stop offset="1" stopColor={CAT[0]} stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="period" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip {...tip} />
              <Area type="monotone" dataKey="completed" name="Completed" stroke={CAT[0]} strokeWidth={2} fill="url(#g-trend)" dot={rows.length < 20 ? { r: 3, stroke: 'var(--color-surface)', strokeWidth: 2 } : false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}

export function BurnUp({ data }) {
  const rows = data.map((d) => ({ date: d.label, planned: d.planned, completed: d.completed }))
  return (
    <ChartCard title="Burn-up" subtitle="Planned vs completed (cumulative)" data={rows}
      legend={<Legend items={[{ key: 'p', label: 'Planned', color: '#898781' }, { key: 'c', label: 'Completed', color: CAT[2] }]} />}>
      {!rows.some((r) => r.planned) ? <Empty /> : (
        <div className="h-56" role="img" aria-label="Burn-up line chart of planned versus completed tasks">
          <ResponsiveContainer>
            <LineChart data={rows} margin={{ left: -20, right: 4 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip {...tip} />
              <Line type="stepAfter" dataKey="planned" name="Planned" stroke="#898781" strokeWidth={2} strokeDasharray="5 4" dot={false} />
              <Line type="monotone" dataKey="completed" name="Completed" stroke={CAT[2]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}

export function HoursCapacity({ data, capacity }) {
  const rows = data.map((d) => ({ period: d.label, hours: d.hours, capacity: d.capacity }))
  return (
    <ChartCard title="Hours vs capacity" subtitle={`Reference line = ${capacity}h/day`} data={rows}>
      {!rows.length ? <Empty /> : (
        <div className="h-56" role="img" aria-label="Bar chart of hours logged versus capacity">
          <ResponsiveContainer>
            <ComposedChart data={rows} margin={{ left: -20, right: 4 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="period" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip {...tip} />
              <Bar dataKey="hours" name="Hours" fill={CAT[0]} radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Line type="stepAfter" dataKey="capacity" name="Capacity" stroke="#898781" strokeDasharray="5 4" dot={false} strokeWidth={2} />
              {data.length === 1 || <ReferenceLine y={0} stroke={GRID} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}

export function ModuleBreakdown({ data, onModule }) {
  const top = data.slice(0, 8)
  const rest = data.slice(8)
  const rows = rest.length ? [...top, { module: 'Other', count: rest.reduce((a, r) => a + r.count, 0), hours: rest.reduce((a, r) => a + r.hours, 0) }] : top
  return (
    <ChartCard title="Top modules" subtitle="Tasks per module" data={rows.map(({ module, count, hours }) => ({ module, tasks: count, hours }))}>
      {!rows.length ? <Empty /> : (
        <div style={{ height: Math.max(180, rows.length * 34) }} role="img" aria-label="Horizontal bar chart of tasks per module">
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="module" tick={{ ...AXIS, fill: 'var(--color-muted)' }} tickLine={false} axisLine={false} width={90} />
              <Tooltip {...tip} />
              <Bar dataKey="count" name="Tasks" radius={[0, 4, 4, 0]} maxBarSize={20} cursor="pointer" label={{ position: 'right', fontSize: 11, fill: 'var(--color-muted)' }}
                onClick={(d) => d.module !== 'Other' && d.module !== 'Unassigned' && onModule?.(d.module)}>
                {rows.map((r, i) => <Cell key={r.module} fill={CAT[i % CAT.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}

export function WeekdayChart({ data }) {
  return (
    <ChartCard title="Weekday pattern" subtitle="Total tasks by weekday" data={data.map((d) => ({ weekday: d.day, tasks: d.count, avgPerDay: d.avg }))}>
      {!data.some((d) => d.count) ? <Empty /> : (
        <div className="h-52" role="img" aria-label="Bar chart of tasks by weekday">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ left: -20, right: 4 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip {...tip} />
              <Bar dataKey="count" name="Tasks" fill={CAT[0]} radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}

export function AgingChart({ data }) {
  return (
    <ChartCard title="Task aging" subtitle="How long unfinished tasks have been open" data={data.map((d) => ({ age: d.bin, tasks: d.count }))}>
      {!data.some((d) => d.count) ? <p className="py-16 text-center text-sm text-muted">Nothing open. 🎉</p> : (
        <div className="h-52" role="img" aria-label="Histogram of open task age">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ left: -20, right: 4 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="bin" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip {...tip} />
              <Bar dataKey="count" name="Open tasks" fill={CAT[3]} radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}

/** Grouped bar: current vs previous period totals for key metrics. */
export function PeriodCompare({ deltas }) {
  const rows = [['Tasks', 'total'], ['Completed', 'completed'], ['Hours', 'hours'], ['Blocked', 'blocked']].map(([label, k]) => ({
    metric: label, current: deltas[k].current, previous: deltas[k].previous,
  }))
  return (
    <ChartCard title="Period comparison" subtitle="Current vs previous period" data={rows}
      legend={<Legend items={[{ key: 'c', label: 'Current', color: CAT[0] }, { key: 'p', label: 'Previous', color: '#b7d3f6' }]} />}>
      <div className="h-52" role="img" aria-label="Grouped bar chart comparing current and previous period">
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ left: -20, right: 4 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="metric" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} />
            <Tooltip {...tip} />
            <Bar dataKey="previous" name="Previous" fill="#b7d3f6" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="current" name="Current" fill={CAT[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}

export { RLegend }

/** Tasks per project (including "No project"), coloured by each project's own colour. Click to filter. */
export function ProjectBreakdown({ data, onProject }) {
  return (
    <ChartCard title="Projects" subtitle="Tasks per project, with average progress in the tooltip" data={data.map(({ name, key, count, completed, hours, avgProgress }) => ({ project: name, key, tasks: count, completed, hours, avgProgress: `${avgProgress}%` }))}>
      {!data.length ? <Empty /> : (
        <div style={{ height: Math.max(180, data.length * 34) }} role="img" aria-label="Horizontal bar chart of tasks per project">
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ ...AXIS, fill: 'var(--color-muted)' }} tickLine={false} axisLine={false} width={96} />
              <Tooltip {...tip} />
              <Bar dataKey="count" name="Tasks" radius={[0, 4, 4, 0]} maxBarSize={20} cursor="pointer" label={{ position: 'right', fontSize: 11, fill: 'var(--color-muted)' }} onClick={(d) => onProject?.(d.id)}>
                {data.map((r) => <Cell key={r.id} fill={r.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}

/** Open tasks by how far along they are, plus the average progress of the work in flight. */
export function ProgressChart({ data, summary }) {
  return (
    <ChartCard title="Progress of open tasks" subtitle={`Average ${summary.avgOpenProgress}% in flight · ${summary.avgProgress}% overall`} data={data.map((d) => ({ range: d.bin, tasks: d.count }))}>
      {!data.some((d) => d.count) ? <p className="py-16 text-center text-sm text-muted">No open tasks. 🎉</p> : (
        <div className="h-52" role="img" aria-label="Histogram of open tasks by progress">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ left: -20, right: 4 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="bin" tick={AXIS} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip {...tip} />
              <Bar dataKey="count" name="Open tasks" radius={[4, 4, 0, 0]} maxBarSize={40}>
                {data.map((d, i) => <Cell key={d.bin} fill={['#b7d3f6', '#6da7ec', '#2a78d6', '#184f95'][i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}
