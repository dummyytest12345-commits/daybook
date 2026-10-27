import { useState } from 'react'
import { Card, CardHeader, Select } from '../ui'
import { usePivot } from '../../hooks/useData'
import { fmtHours } from '../../utils/format'

/** Rows x columns pivot with count or hours. */
export function PivotTable({ range, filters }) {
  const [cfg, setCfg] = useState({ rows: 'module', cols: 'week', value: 'count' })
  const p = usePivot(range, cfg, filters)
  const fmt = cfg.value === 'hours' ? fmtHours : (v) => v
  const set = (k) => (e) => setCfg((c) => ({ ...c, [k]: e.target.value }))
  return (
    <Card>
      <CardHeader
        title="Pivot table"
        action={
          <div className="flex flex-wrap gap-2 text-xs">
            <Select aria-label="Rows" value={cfg.rows} onChange={set('rows')} className="h-8 text-xs"><option value="module">Rows: Module</option><option value="project">Rows: Project</option><option value="status">Rows: Status</option><option value="priority">Rows: Priority</option></Select>
            <Select aria-label="Columns" value={cfg.cols} onChange={set('cols')} className="h-8 text-xs"><option value="week">Cols: Week</option><option value="month">Cols: Month</option><option value="weekday">Cols: Weekday</option><option value="status">Cols: Status</option></Select>
            <Select aria-label="Value" value={cfg.value} onChange={set('value')} className="h-8 text-xs"><option value="count">Count</option><option value="hours">Hours</option></Select>
          </div>
        }
      />
      <div className="overflow-x-auto p-2">
        {!p.rows.length ? <p className="py-8 text-center text-sm text-muted">No data for this period.</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th scope="col" className="px-3 py-1.5 text-left text-xs font-semibold text-muted">{cfg.rows}</th>
                {p.columns.map((c) => <th scope="col" key={c} className="px-3 py-1.5 text-right text-xs font-semibold text-muted">{c}</th>)}
                <th scope="col" className="px-3 py-1.5 text-right text-xs font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {p.rows.map((r) => (
                <tr key={r.row} className="border-t border-line">
                  <th scope="row" className="px-3 py-1.5 text-left font-medium">{r.row}</th>
                  {r.values.map((v, i) => <td key={i} className="px-3 py-1.5 text-right" style={{ background: v ? `rgb(42 120 214 / ${Math.min(0.35, v / (p.grandTotal || 1) * 3)})` : undefined }}>{v ? fmt(v) : '·'}</td>)}
                  <td className="px-3 py-1.5 text-right font-semibold">{fmt(r.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line font-semibold">
                <th scope="row" className="px-3 py-1.5 text-left">Total</th>
                {p.colTotals.map((v, i) => <td key={i} className="px-3 py-1.5 text-right">{fmt(v)}</td>)}
                <td className="px-3 py-1.5 text-right">{fmt(p.grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </Card>
  )
}
