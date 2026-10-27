import { Bookmark, Filter, Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Checkbox, Input, Menu, PopoverBox } from '../ui'
import { useFilters } from '../../hooks/useFilters'
import { useDebounce } from '../../hooks/utils'
import { useStore } from '../../store/useStore'
import { useAllTasks } from '../../hooks/useData'

function MultiPick({ label, options, value, onChange }) {
  return (
    <PopoverBox
      align="start" className="w-56 space-y-1.5"
      trigger={
        <Button size="sm">
          <Filter size={13} />{label}
          {value.length > 0 && <Badge tone="primary">{value.length}</Badge>}
        </Button>
      }
    >
      {options.length === 0 && <p className="text-xs text-muted">Nothing to filter yet.</p>}
      {options.map((o) => (
        <Checkbox key={o.value} label={o.label} checked={value.includes(o.value)}
          onChange={(c) => onChange(c ? [...value, o.value] : value.filter((v) => v !== o.value))} />
      ))}
    </PopoverBox>
  )
}

/** Search, status/module/priority/tag/day-type filters and saved views. State lives in the URL. */
export function FilterBar() {
  const { filters, setFilters, clear, active, views, saveView, deleteView, applyView } = useFilters()
  const statuses = useStore((s) => s.settings.statuses)
  const modules = useStore((s) => s.settings.modules)
  const allProjects = useStore((s) => s.projects)
  const projects = useMemo(() => allProjects.filter((p) => !p.deletedAt), [allProjects])
  const all = useAllTasks()
  const [q, setQ] = useState(filters.q)
  const dq = useDebounce(q, 250)
  useEffect(() => { if (dq !== filters.q) setFilters({ q: dq }) }, [dq]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setQ(filters.q), [filters.q])

  const tags = [...new Set(all.flatMap((t) => t.tags || []))].sort()
  const usedModules = [...new Set([...modules, ...all.map((t) => t.module).filter(Boolean)])]

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-48 flex-1 sm:max-w-xs">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" aria-label="Search tasks" className="pl-8" />
      </div>
      <MultiPick label="Status" options={statuses.map((s) => ({ value: s.id, label: s.label }))} value={filters.status} onChange={(v) => setFilters({ status: v })} />
      {projects.length > 0 && (
        <MultiPick label="Project" options={[{ value: 'none', label: 'No project' }, ...projects.map((p) => ({ value: p.id, label: `${p.name} (${p.key})` }))]} value={filters.project} onChange={(v) => setFilters({ project: v })} />
      )}
      <MultiPick label="Module" options={usedModules.map((m) => ({ value: m, label: m }))} value={filters.module} onChange={(v) => setFilters({ module: v })} />
      <MultiPick label="Priority" options={['high', 'medium', 'low'].map((p) => ({ value: p, label: p }))} value={filters.priority} onChange={(v) => setFilters({ priority: v })} />
      {tags.length > 0 && <MultiPick label="Tag" options={tags.map((t) => ({ value: t, label: `#${t}` }))} value={filters.tag} onChange={(v) => setFilters({ tag: v })} />}
      <MultiPick label="Day type" options={['work', 'weekend', 'leave', 'holiday'].map((p) => ({ value: p, label: p }))} value={filters.dayType} onChange={(v) => setFilters({ dayType: v })} />
      {active && <Button size="sm" variant="ghost" onClick={clear}><X size={13} />Clear</Button>}
      <Menu
        trigger={<Button size="sm" aria-label="Saved views"><Bookmark size={13} />Views{views.length > 0 && <Badge>{views.length}</Badge>}</Button>}
        items={[
          ...views.map((v) => ({ label: v.name, onSelect: () => applyView(v) })),
          ...(views.length ? [{ separator: true }] : []),
          { label: 'Save current filters…', disabled: !active, onSelect: () => { const n = window.prompt('Name this view'); if (n?.trim()) saveView(n.trim()) } },
          ...views.map((v) => ({ label: `Delete “${v.name}”`, danger: true, onSelect: () => deleteView(v.id) })),
        ]}
      />
    </div>
  )
}
