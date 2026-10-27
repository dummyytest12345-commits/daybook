import { Modal } from '../ui'
import { SHORTCUTS } from '../../hooks/useHotkeys'
import { useUI } from '../../store/useUI'

export function ShortcutSheet() {
  const open = useUI((s) => s.helpOpen)
  const setHelp = useUI((s) => s.setHelp)
  return (
    <Modal open={open} onOpenChange={setHelp} title="Keyboard shortcuts" description="Shortcuts work when you are not typing in a field">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {SHORTCUTS.map(([k, d]) => (
          <div key={k} className="contents">
            <dt><kbd className="rounded border border-line bg-canvas px-2 py-0.5 font-mono text-xs">{k}</kbd></dt>
            <dd className="text-muted">{d}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-muted">Quick add keeps your text as typed. Symbols set fields: <code>#module</code> <code>!high</code> <code>~PROJECT</code> <code>@ticket</code> <code>+tag</code> <code>due:+3d</code>. Separate tasks with a comma, <code>;</code>, <code>|</code> or a new line.</p>
    </Modal>
  )
}
