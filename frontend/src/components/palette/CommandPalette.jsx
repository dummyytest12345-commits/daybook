import { Command } from 'cmdk'
import * as Dialog from '@radix-ui/react-dialog'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { addDaysISO, todayISO } from '../../utils/date'
import { standup } from '../../services/exporters/markdown'
import { actions } from '../../hooks/useActions'

/** Ctrl+K: navigate, run actions, or search tasks. */
export function CommandPalette({ navigate }) {
  const open = useUI((s) => s.paletteOpen)
  const setPalette = useUI((s) => s.setPalette)
  const tasks = useStore((s) => s.tasks)
  const projects = useStore((s) => s.projects)

  const commands = useMemo(() => {
    const today = todayISO()
    const run = (fn) => () => { setPalette(false); fn() }
    const st = () => useStore.getState()
    return [
      { group: 'Go to', items: [
        ['Today', () => navigate('/')],
        ['Day view', () => navigate(`/log/day?d=${today}`)],
        ['This week', () => navigate(`/log/week?d=${today}`)],
        ['Last week', () => navigate(`/log/week?d=${addDaysISO(today, -7)}`)],
        ['This month', () => navigate(`/log/month?d=${today}`)],
        ['Board', () => navigate('/log/board')],
        ['Table', () => navigate('/log/table')],
        ['Analytics', () => navigate('/analytics')],
        ['Projects', () => navigate('/projects')],
        ['Team projects', () => navigate('/team')],
        ['Reports', () => navigate('/reports')],
        ['Import / Export', () => navigate('/data')],
        ['Settings', () => navigate('/settings')],
      ] },
      { group: 'Actions', items: [
        ['New task', () => useUI.getState().openTaskModal()],
        ['New project', () => useUI.getState().openProjectModal()],
        ['Move selected tasks to project…', () => { const sel = useUI.getState().selection; if (sel.length) useUI.getState().openMoveDialog(sel); else toast('Select tasks first (checkbox on each task)') }],
        ['Mark today complete', () => actions.markDayComplete(today)],
        ['Carry over unfinished tasks to today', () => navigate('/')],
        ['Export month as PDF', () => navigate('/reports?fmt=pdf&range=thisMonth')],
        ['Export week as Excel', () => navigate('/reports?fmt=xlsx&range=thisWeek')],
        ['Copy standup to clipboard', async () => {
          const s = st()
          await navigator.clipboard?.writeText(standup(s.tasks, { settings: s.settings, dayLogs: s.dayLogs }))
          toast.success('Standup copied')
        }],
        ['Apply recurring tasks for today', () => toast(`${st().applyRecurring()} tasks created`)],
        ['Undo last change', () => st().undo()],
        ['Toggle dark theme', () => st().saveSettings({ theme: st().settings.theme === 'dark' ? 'light' : 'dark' })],
      ] },
    ].map((g) => ({ ...g, items: g.items.map(([label, fn]) => ({ label, fn: run(fn) })) }))
  }, [navigate, setPalette])

  const recent = useMemo(
    () => tasks.filter((t) => !t.deletedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 200),
    [tasks],
  )

  return (
    <Dialog.Root open={open} onOpenChange={setPalette}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-in fixed inset-0 z-[60] bg-slate-900/40" />
        <Dialog.Content className="animate-in fixed left-1/2 top-[15vh] z-[61] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-card border border-line bg-surface shadow-pop" aria-label="Command palette">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">Search tasks or run a command</Dialog.Description>
          <Command loop label="Command palette">
            <Command.Input autoFocus placeholder="Type a command or search tasks…" className="h-12 w-full border-b border-line bg-transparent px-4 text-sm outline-none" />
            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="px-3 py-6 text-center text-sm text-muted">No results.</Command.Empty>
              {commands.map((g) => (
                <Command.Group key={g.group} heading={g.group} className="text-xs text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                  {g.items.map((i) => (
                    <Command.Item key={i.label} value={`${g.group} ${i.label}`} onSelect={i.fn} className="cursor-pointer rounded-md px-3 py-2 text-sm text-ink aria-selected:bg-primary/10 aria-selected:text-primary">{i.label}</Command.Item>
                  ))}
                </Command.Group>
              ))}
              <Command.Group heading="Projects" className="text-xs text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                {projects.filter((p) => !p.deletedAt).map((p) => (
                  <Command.Item key={p.id} value={`project ${p.name} ${p.key}`} onSelect={() => { setPalette(false); navigate(`/projects/${p.id}`) }} className="flex cursor-pointer justify-between gap-3 rounded-md px-3 py-2 text-sm text-ink aria-selected:bg-primary/10 aria-selected:text-primary">
                    <span className="truncate">{p.name}</span><span className="shrink-0 font-mono text-xs text-muted">{p.key}</span>
                  </Command.Item>
                ))}
              </Command.Group>
              <Command.Group heading="Tasks" className="text-xs text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
                {recent.map((t) => (
                  <Command.Item key={t.id} value={`task ${t.title} ${t.ticketNo || ''} ${t.module || ''} ${t.date}`} onSelect={() => { setPalette(false); navigate(`/log/day?d=${t.date}`); useUI.getState().openTaskModal(t) }} className="flex cursor-pointer justify-between gap-3 rounded-md px-3 py-2 text-sm text-ink aria-selected:bg-primary/10 aria-selected:text-primary">
                    <span className="truncate">{t.title}</span><span className="shrink-0 text-xs text-muted">{t.date}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
