import { Trash2, X } from 'lucide-react'
import { Button, Menu, StatusBadge } from '../ui'
import { actions } from '../../hooks/useActions'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'

/** Appears when tasks are selected: bulk status change / delete. */
export function BulkBar() {
  const selection = useUI((s) => s.selection)
  const clear = useUI((s) => s.clearSelection)
  const statuses = useStore((s) => s.settings.statuses)
  if (!selection.length) return null
  return (
    <div className="animate-in flex flex-wrap items-center gap-2 border-b border-line bg-primary/5 px-4 py-2 text-sm" role="toolbar" aria-label="Bulk actions">
      <span className="font-medium">{selection.length} selected</span>
      <Menu
        align="start"
        trigger={<Button size="sm">Set status…</Button>}
        items={statuses.map((s) => ({
          label: s.label,
          icon: <StatusBadge status={s.id} label="" className="px-1" />,
          onSelect: () => { actions.bulkStatus(selection, s.id); clear() },
        }))}
      />
      <Button size="sm" onClick={() => useUI.getState().openMoveDialog(selection)}>Move to project…</Button>
      <Button size="sm" variant="ghost" className="text-st-blocked" onClick={() => { actions.removeMany(selection); clear() }}><Trash2 size={14} />Delete</Button>
      <Button size="sm" variant="ghost" onClick={clear}><X size={14} />Clear</Button>
    </div>
  )
}
