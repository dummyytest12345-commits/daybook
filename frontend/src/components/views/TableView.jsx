import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Button, Checkbox, PopoverBox, StatusBadge } from '../ui'
import { useCtx } from '../../hooks/useData'
import { buildDailyRows, buildTaskRows } from '../../services/exporters/dataset'
import { useUI } from '../../store/useUI'
import { cn, fmtHours } from '../../utils/format'

const VIRTUALIZE_AT = 500

const dailyCols = (open) => [
  { accessorKey: 'sr', header: 'Sr No', size: 64, cell: (c) => c.getValue() || '' },
  { accessorKey: 'dateText', header: 'Date', size: 110, sortingFn: (a, b) => a.original.date.localeCompare(b.original.date) },
  { accessorKey: 'day', header: 'Day', size: 110 },
  {
    accessorKey: 'tasks', header: 'Tasks', size: 460, enableSorting: false,
    cell: (c) => (
      <ol className="space-y-0.5">
        {c.row.original.tasks.map((t, i) => <li key={i} className="break-words"><span className="text-muted">{i + 1}.</span> {t}</li>)}
      </ol>
    ),
  },
  { accessorKey: 'count', header: 'No. of Tasks', size: 110 },
  { accessorKey: 'hours', header: 'Hours', size: 80, cell: (c) => fmtHours(c.getValue()) },
  {
    accessorKey: 'statusText', header: 'Status', size: 130,
    cell: (c) => (c.row.original.status ? <StatusBadge status={c.row.original.status} label={c.getValue()} /> : <span className="italic text-muted">{c.getValue()}</span>),
  },
]

const flatCols = (open) => [
  { accessorKey: 'dateText', header: 'Date', size: 110, sortingFn: (a, b) => a.original.date.localeCompare(b.original.date) },
  { accessorKey: 'day', header: 'Day', size: 100 },
  { accessorKey: 'ticketNo', header: 'Ticket', size: 80 },
  { accessorKey: 'title', header: 'Task', size: 360, cell: (c) => <button type="button" className="text-left hover:text-primary" onClick={() => open(c.row.original)}>{c.getValue()}</button> },
  { accessorKey: 'module', header: 'Module', size: 110 },
  { accessorKey: 'statusText', header: 'Status', size: 120, cell: (c) => <StatusBadge status={c.row.original.status} label={c.getValue()} /> },
  { accessorKey: 'priority', header: 'Priority', size: 90 },
  { accessorKey: 'hours', header: 'Hours', size: 80, cell: (c) => fmtHours(c.getValue()) },
  { accessorKey: 'tagsText', header: 'Tags', size: 130 },
]

/** Sortable table in the original sheet layout (or a flat per-task layout) with column chooser. */
export function TableView({ range, tasks }) {
  const ctx = useCtx()
  const openTaskModal = useUI((s) => s.openTaskModal)
  const [mode, setMode] = useState('daily')
  const [sorting, setSorting] = useState([])
  const [visibility, setVisibility] = useState({})

  const data = useMemo(
    () => (mode === 'daily' ? buildDailyRows(tasks, range, ctx).filter((r) => r.count > 0 || r.dayType !== 'work') : buildTaskRows(tasks, ctx)),
    [mode, tasks, range, ctx],
  )
  const columns = useMemo(() => (mode === 'daily' ? dailyCols(openTaskModal) : flatCols(openTaskModal)), [mode, openTaskModal])

  const table = useReactTable({
    data, columns, state: { sorting, columnVisibility: visibility },
    onSortingChange: setSorting, onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
  })
  const rows = table.getRowModel().rows
  const parentRef = useRef(null)
  const virtual = rows.length > VIRTUALIZE_AT
  const virt = useVirtualizer({ count: rows.length, getScrollElement: () => parentRef.current, estimateSize: () => 56, overscan: 12, enabled: virtual })
  const items = virtual ? virt.getVirtualItems() : rows.map((_, i) => ({ index: i }))
  const padTop = virtual && items.length ? items[0].start : 0
  const padBottom = virtual && items.length ? virt.getTotalSize() - items.at(-1).end : 0
  const totalHours = data.reduce((a, r) => a + (r.hours || 0), 0)

  return (
    <div className="rounded-card border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="inline-flex rounded-input border border-line p-0.5" role="group" aria-label="Table layout">
          {[['daily', 'By day'], ['tasks', 'By task']].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setMode(v)} aria-pressed={mode === v}
              className={cn('rounded-md px-3 py-1 text-xs font-medium', mode === v ? 'bg-primary text-white' : 'text-muted hover:text-ink')}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>{rows.length} rows · {fmtHours(totalHours)}h</span>
          <PopoverBox trigger={<Button size="sm"><Columns3 size={14} />Columns</Button>} className="w-56 space-y-2">
            {table.getAllLeafColumns().map((c) => (
              <Checkbox key={c.id} label={String(c.columnDef.header)} checked={c.getIsVisible()} onChange={(v) => c.toggleVisibility(v)} />
            ))}
          </PopoverBox>
        </div>
      </div>
      <div ref={parentRef} className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-canvas">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const dir = h.column.getIsSorted()
                  return (
                    <th key={h.id} style={{ width: h.getSize() }} aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      className="border-b border-line px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      {h.column.getCanSort() ? (
                        <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {dir === 'asc' ? <ArrowUp size={12} /> : dir === 'desc' ? <ArrowDown size={12} /> : <ChevronsUpDown size={12} className="opacity-40" />}
                        </button>
                      ) : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {padTop > 0 && <tr><td style={{ height: padTop }} /></tr>}
            {items.map(({ index }) => {
              const row = rows[index]
              const off = row.original.dayType && row.original.dayType !== 'work'
              return (
                <tr key={row.id} className={cn('border-b border-line align-top hover:bg-canvas', off && 'bg-canvas italic text-muted')}>
                  {row.getVisibleCells().map((c) => <td key={c.id} className="px-3 py-2">{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}
                </tr>
              )
            })}
            {padBottom > 0 && <tr><td style={{ height: padBottom }} /></tr>}
            {!rows.length && <tr><td colSpan={columns.length} className="px-3 py-10 text-center text-muted">No rows in this period.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
