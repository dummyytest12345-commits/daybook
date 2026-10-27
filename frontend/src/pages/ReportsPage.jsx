import { useSeo } from '../hooks/useSeo'
import { Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Card, CardHeader, Checkbox, Field, Input, Select } from '../components/ui'
import { FilterBar } from '../components/layout/FilterBar'
import { StackedBar, StatusDonut } from '../components/analytics/charts'
import { useFilters } from '../hooks/useFilters'
import { FORMATS, TEMPLATES, useExport } from '../hooks/useExport'
import { useAnalytics } from '../hooks/useData'
import { buildDailyRows, rangeText } from '../services/exporters/dataset'
import { toMarkdown } from '../services/exporters/markdown'
import { PRESETS, addDaysISO, presetRange, todayISO } from '../utils/date'
import { fmtHours } from '../utils/format'
import { useStore } from '../store/useStore'

/** Export builder: template, range, format, options and a live preview. */
export default function ReportsPage() {
  useSeo({ title: 'Reports' })
  const [sp] = useSearchParams()
  const ws = useStore((s) => s.settings.weekStartsOn)
  const fmtDate = useStore((s) => s.settings.dateFormat)
  const [template, setTemplate] = useState('weekly')
  const [preset, setPreset] = useState(sp.get('range') || 'thisWeek')
  const [custom, setCustom] = useState({ start: addDaysISO(todayISO(), -6), end: todayISO() })
  const [format, setFormat] = useState(sp.get('fmt') || 'xlsx')
  const [layout, setLayout] = useState('daily')
  const [charts, setCharts] = useState(true)
  const { filters } = useFilters()

  useEffect(() => {
    const t = TEMPLATES[template]
    if (t.preset !== 'custom') setPreset(t.preset)
  }, [template])

  const range = useMemo(() => (preset === 'custom' ? custom : presetRange(preset, ws)), [preset, custom, ws])
  const { tasks, ctx, generate, busy } = useExport({ range, filters, layout, template, charts: charts && format === 'pdf' })
  const a = useAnalytics(range, 'day', filters)
  const rows = buildDailyRows(tasks, range, ctx).filter((r) => r.count > 0 || r.dayType !== 'work')

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <div className="space-y-4 no-print">
        <h1 className="text-2xl font-bold">Reports</h1>
        <Card className="space-y-3 p-4">
          <Field label="Template">
            <Select value={template} onChange={(e) => setTemplate(e.target.value)}>
              {Object.entries(TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Range">
            <Select value={preset} onChange={(e) => { setPreset(e.target.value); if (e.target.value === 'custom') setTemplate('custom') }}>
              {PRESETS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
            </Select>
          </Field>
          {preset === 'custom' && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="From"><Input type="date" value={custom.start} onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))} /></Field>
              <Field label="To"><Input type="date" value={custom.end} onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))} /></Field>
            </div>
          )}
          <Field label="Format">
            <Select value={format} onChange={(e) => setFormat(e.target.value)}>
              {FORMATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          {format === 'csv' && (
            <Field label="CSV layout">
              <Select value={layout} onChange={(e) => setLayout(e.target.value)}>
                <option value="daily">One row per day (sheet layout)</option>
                <option value="tasks">One row per task</option>
              </Select>
            </Field>
          )}
          {format === 'pdf' && template !== 'manager' && <Checkbox checked={charts} onChange={setCharts} label="Include charts" />}
          <p className="text-xs text-muted">Filters below also apply to the export.</p>
          <Button variant="primary" className="w-full" disabled={busy || !tasks.length} onClick={() => generate(format)}>
            <Download size={16} />{busy ? 'Generating…' : format === 'md' || format === 'txt' ? 'Copy' : format === 'print' ? 'Print' : 'Download'}
          </Button>
          {!tasks.length && <p className="text-xs text-st-progress">No tasks in this range — nothing to export.</p>}
        </Card>
        <FilterBar />
      </div>

      <div className="min-w-0 space-y-4">
        <Card>
          <CardHeader title="Live preview" subtitle={`${TEMPLATES[template].label} · ${rangeText(range, fmtDate)} · ${tasks.length} tasks`} />
          {format === 'md' || format === 'txt' ? (
            <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap p-4 text-sm">{toMarkdown(tasks, range, ctx, { plain: format === 'txt' })}</pre>
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-canvas text-xs uppercase text-muted">
                  <tr>{['Sr', 'Date', 'Day', 'Tasks', '#', 'Hours', 'Status'].map((h) => <th key={h} className="border-b border-line px-3 py-2 text-left">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.date} className={`border-b border-line align-top ${r.dayType !== 'work' ? 'bg-canvas italic text-muted' : ''}`}>
                      <td className="px-3 py-2">{r.sr}</td><td className="px-3 py-2">{r.dateText}</td><td className="px-3 py-2">{r.day}</td>
                      <td className="whitespace-pre-wrap px-3 py-2">{r.tasksText}</td><td className="px-3 py-2">{r.count}</td>
                      <td className="px-3 py-2">{fmtHours(r.hours)}</td><td className="px-3 py-2">{r.statusText}</td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={7} className="px-3 py-10 text-center text-muted">Nothing in this range.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        {(charts && format === 'pdf') || format === 'print' ? (
          <div id="report-charts" className="grid gap-4 md:grid-cols-2">
            <StackedBar data={a.series} />
            <StatusDonut summary={a.summary} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
