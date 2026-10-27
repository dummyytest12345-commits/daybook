import { CalendarDays, CalendarRange, Kanban, LayoutList, Table2 } from 'lucide-react'
import { cn } from '../../utils/format'

const VIEWS = [
  ['day', 'Day', LayoutList, '1'], ['week', 'Week', CalendarRange, '2'], ['month', 'Month', CalendarDays, '3'],
  ['board', 'Board', Kanban, '4'], ['table', 'Table', Table2, '5'],
]

export function ViewSwitcher({ view, onChange }) {
  return (
    <div className="inline-flex rounded-input border border-line bg-surface p-0.5" role="tablist" aria-label="Log view">
      {VIEWS.map(([id, label, Icon, key]) => (
        <button
          key={id} role="tab" type="button" aria-selected={view === id} title={`${label} (${key})`} onClick={() => onChange(id)}
          className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium sm:px-3', view === id ? 'bg-primary text-white shadow-card' : 'text-muted hover:text-ink')}
        >
          <Icon size={14} aria-hidden /><span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}
