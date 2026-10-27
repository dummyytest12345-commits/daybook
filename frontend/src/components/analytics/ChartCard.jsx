import { Download, Table2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button, Card, CardHeader, Menu } from '../ui'
import { download } from '../../utils/format'
import { csvSafe } from '../../utils/csvSafe'

/** Chart wrapper: title, "view data" table, download PNG/CSV. `data` = array of flat objects. */
export function ChartCard({ title, subtitle, data = [], className, children, legend }) {
  const ref = useRef(null)
  const [table, setTable] = useState(false)
  const cols = data.length ? Object.keys(data[0]).filter((k) => typeof data[0][k] !== 'object') : []

  const png = async () => {
    const { toPng } = await import('html-to-image')
    const url = await toPng(ref.current, { backgroundColor: getComputedStyle(document.body).backgroundColor, pixelRatio: 2 })
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.toLowerCase().replace(/\W+/g, '-')}.png`
    a.click()
  }
  const csv = () => {
    const esc = (v) => `"${csvSafe(v).replace(/"/g, '""')}"`
    const text = [cols.join(','), ...data.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\r\n')
    download(new Blob(['﻿', text], { type: 'text/csv' }), `${title.toLowerCase().replace(/\W+/g, '-')}.csv`)
  }

  return (
    <Card className={className}>
      <CardHeader
        title={title} subtitle={subtitle}
        action={
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setTable((t) => !t)} aria-pressed={table} aria-label={`${table ? 'Show chart' : 'View data'} for ${title}`}>
              <Table2 size={14} />{table ? 'Chart' : 'Data'}
            </Button>
            <Menu trigger={<Button size="sm" variant="ghost" aria-label={`Download ${title}`}><Download size={14} /></Button>}
              items={[{ label: 'Download PNG', onSelect: png }, { label: 'Download CSV', onSelect: csv }]} />
          </div>
        }
      />
      <div ref={ref} className="bg-surface p-4" data-chart-export>
        {table ? (
          <div className="max-h-64 overflow-auto">
            <table className="w-full text-xs">
              <thead><tr>{cols.map((c) => <th key={c} scope="col" className="border-b border-line px-2 py-1 text-left font-semibold text-muted">{c}</th>)}</tr></thead>
              <tbody>{data.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className="border-b border-line px-2 py-1">{String(r[c])}</td>)}</tr>)}</tbody>
            </table>
          </div>
        ) : (
          <>
            {children}
            {legend}
          </>
        )}
      </div>
    </Card>
  )
}

export function Legend({ items, hidden, onToggle }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
      {items.map((i) => {
        const Icon = i.icon
        return (
          <li key={i.key}>
            <button type="button" onClick={() => onToggle?.(i.key)} aria-pressed={!hidden?.includes(i.key)}
              className={`inline-flex items-center gap-1.5 ${hidden?.includes(i.key) ? 'opacity-40 line-through' : ''}`}>
              <span className="inline-block size-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
              {Icon && <Icon size={11} aria-hidden />}
              {i.label}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
