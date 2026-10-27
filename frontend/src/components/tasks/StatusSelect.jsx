import { ChevronDown } from 'lucide-react'
import { Menu, STATUS_ICON, STATUS_COLOR, StatusBadge } from '../ui'
import { useStore } from '../../store/useStore'
import { cn } from '../../utils/format'

export function useStatusLabel() {
  const statuses = useStore((s) => s.settings.statuses)
  return (id) => statuses.find((s) => s.id === id)?.label || id
}

/** Inline status changer: click the badge to pick a new status. */
export function StatusSelect({ status, onChange, className }) {
  const statuses = useStore((s) => s.settings.statuses)
  const label = statuses.find((s) => s.id === status)?.label || status
  return (
    <Menu
      align="start"
      trigger={
        <button
          type="button"
          aria-label={`Status: ${label}. Change status`}
          className={cn('inline-flex items-center gap-0.5 rounded-full hover:opacity-80', className)}
        >
          <StatusBadge status={status} label={label} />
          <ChevronDown size={12} className="text-muted" aria-hidden />
        </button>
      }
      items={statuses.map((s) => {
        const Icon = STATUS_ICON[s.id]
        return {
          label: s.label,
          icon: Icon && <Icon size={14} style={{ color: STATUS_COLOR[s.id] }} aria-hidden />,
          onSelect: () => onChange(s.id),
        }
      })}
    />
  )
}
