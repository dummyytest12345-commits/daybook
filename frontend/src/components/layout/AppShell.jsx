import { AlertTriangle, HelpCircle, LogOut, Moon, PanelLeft, Plus, Redo2, Search, Settings, Sun, Timer, Undo2, User } from 'lucide-react'
import { OfflineBanner } from '../sync/OfflineBanner'
import { SyncStatus } from '../sync/SyncStatus'
import { useSync } from '../../sync/useSync'
import { Icon as AppIcon, ProjectIcon } from '../icons'
import { ProjectModal } from '../projects/ProjectModal'
import { MoveDialog } from '../projects/MoveDialog'
import { FinishDialog } from '../tasks/FinishDialog'
import { useCarryForward } from '../../hooks/useThreads'
import { activeProjects } from '../../selectors/projects'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Button, Menu, Tip } from '../ui'
import { Logo } from '../ui/Logo'
import { ThemeToggle } from '../ui/ThemeToggle'
import { NotificationBell } from '../team/NotificationBell'
import { useTheme } from '../../store/useTheme'
import { useAuth } from '../../store/useAuth'
import { CommandPalette } from '../palette/CommandPalette'
import { ShortcutSheet } from './ShortcutSheet'
import { TaskModal } from '../tasks/TaskModal'
import { TaskDrawer } from '../tasks/TaskDrawer'
import { TimerButton } from '../tasks/TimerButton'
import { useHotkeys } from '../../hooks/useHotkeys'
import { useNotifications } from '../../hooks/useNotifications'
import { useRunningTask, useStaleTimerGuard } from '../../hooks/useTimer'
import { useUndo } from '../../hooks/useActions'
import { getRepository } from '../../services/repository'
import { useStore } from '../../store/useStore'
import { useUI } from '../../store/useUI'
import { cn } from '../../utils/format'
import { useEffect, useState } from 'react'

const NAV = [
  ['/', 'Today', 'today', true],
  ['/log/day', 'Log', 'log'],
  ['/projects', 'Projects', 'projects'],
  ['/team', 'Team', 'team'],
  ['/analytics', 'Analytics', 'analytics'],
  ['/reports', 'Reports', 'reports'],
  ['/data', 'Import/Export', 'data'],
  ['/settings', 'Settings', 'settings'],
]
const MOBILE = ['/', '/log/day', '/projects', '/team', '/settings']

/** Favourite and active projects under the main nav. */
function SidebarProjects({ collapsed }) {
  const projects = useStore((s) => s.projects)
  const openProjectModal = useUI((s) => s.openProjectModal)
  const list = activeProjects(projects).sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || a.name.localeCompare(b.name)).slice(0, 8)
  if (collapsed) return null
  return (
    <div className="border-t border-line px-2 py-2" aria-label="Projects">
      <div className="mb-1 flex items-center justify-between px-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Projects
        <button type="button" onClick={() => openProjectModal()} aria-label="New project" className="rounded p-0.5 hover:bg-line/60 hover:text-ink"><AppIcon name="plus" size={14} /></button>
      </div>
      <ul className="max-h-48 space-y-0.5 overflow-y-auto">
        {list.map((p) => (
          <li key={p.id}>
            <NavLink to={`/projects/${p.id}`} className={({ isActive }) => cn('flex items-center gap-2 rounded-input px-3 py-1.5 text-sm', isActive ? 'bg-primary/10 font-medium text-primary' : 'text-muted hover:bg-line/60 hover:text-ink')}>
              <ProjectIcon icon={p.icon} color={p.color} size={20} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.favorite && <AppIcon name="star" size={12} filled className="text-st-progress" />}
            </NavLink>
          </li>
        ))}
        {!list.length && <li className="px-3 py-1 text-xs text-muted">No projects yet (optional)</li>}
      </ul>
    </div>
  )
}

function StorageBanner() {
  const err = useStore((s) => s.storageError)
  const dropped = useStore((s) => s.droppedRows)
  const [ratio, setRatio] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setRatio(getRepository().usage().ratio), 5000)
    setRatio(getRepository().usage().ratio)
    return () => clearInterval(id)
  }, [])
  const msg =
    err === 'unavailable' ? 'Browser storage is unavailable (private mode?). Data is kept in memory only and will be lost on close. Export a backup.'
    : err === 'quota' ? 'Storage is full — new changes may not be saved. Export a backup and clear old data.'
    : err === 'write' ? 'Could not save to browser storage. Export a backup now.'
    : ratio > 0.8 ? `Storage is ${Math.round(ratio * 100)}% full. Consider exporting a backup.`
    : dropped ? `${dropped} stored rows were invalid and skipped.` : null
  if (!msg) return null
  return (
    <div role="alert" className="flex items-center gap-2 bg-st-progress/15 px-4 py-2 text-sm text-st-progress">
      <AlertTriangle size={16} aria-hidden />{msg}
    </div>
  )
}

export function AppShell() {
  useHotkeys()
  useNotifications()
  useStaleTimerGuard()
  useCarryForward()
  const userId = useAuth((s) => s.user?.id)
  const ready = useStore((s) => s.ready)
  // start offline-first sync (change tracking, reconnect handling) for the signed-in user
  useEffect(() => {
    if (!userId || !ready) return
    useSync.getState().start(userId)
    return () => useSync.getState().stop()
  }, [userId, ready])
  const navigate = useNavigate()
  const collapsed = useUI((s) => s.sidebarCollapsed)
  const toggleSidebar = useUI((s) => s.toggleSidebar)
  const openTaskModal = useUI((s) => s.openTaskModal)
  const setPalette = useUI((s) => s.setPalette)
  const setHelp = useUI((s) => s.setHelp)
  const theme = useTheme((s) => s.resolved)
  const { undo, redo, canUndo, canRedo, lastLabel } = useUndo()
  const running = useRunningTask()
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)


  return (
    <div className="flex min-h-screen">
      <aside className={cn('sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 md:flex', collapsed ? 'w-16' : 'w-60')}>
        <div className="flex h-14 items-center gap-2 border-b border-line px-4">
          <Logo collapsed={collapsed} />
        </div>
        <nav className="flex-1 space-y-1 p-2" aria-label="Main">
          {NAV.map(([to, label, icon, end]) => (
            <NavLink key={to} to={to} end={end} title={label}
              className={({ isActive }) => cn('flex items-center gap-3 rounded-input px-3 py-2 text-sm font-medium', isActive || (to.startsWith('/log') && location.pathname.startsWith('/log')) ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-line/60 hover:text-ink')}>
              <AppIcon name={icon} size={18} />{!collapsed && label}
            </NavLink>
          ))}
        </nav>
        <SidebarProjects collapsed={collapsed} />
        <div className="border-t border-line p-2">
          <Button variant="ghost" className="w-full justify-start" onClick={toggleSidebar} aria-label="Toggle sidebar"><PanelLeft size={18} />{!collapsed && 'Collapse'}</Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur sm:px-5">
          <button type="button" onClick={() => setPalette(true)} className="flex h-9 max-w-sm flex-1 items-center gap-2 rounded-input border border-line bg-canvas px-3 text-sm text-muted hover:border-primary/50">
            <Search size={14} aria-hidden /><span className="flex-1 text-left">Search or run a command</span>
            <kbd className="hidden rounded border border-line bg-surface px-1.5 text-[10px] sm:inline">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <SyncStatus />
            {running && (
              <span className="hidden items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary lg:flex" title={running.title}>
                <Timer size={12} aria-hidden /><span className="max-w-32 truncate">{running.title}</span><TimerButton taskId={running.id} compact />
              </span>
            )}
            <Tip label={canUndo ? `Undo: ${lastLabel}` : 'Nothing to undo'}><Button size="icon" variant="ghost" onClick={undo} disabled={!canUndo} aria-label="Undo"><Undo2 size={16} /></Button></Tip>
            <Tip label="Redo"><Button size="icon" variant="ghost" onClick={redo} disabled={!canRedo} aria-label="Redo"><Redo2 size={16} /></Button></Tip>
            <NotificationBell />
            <ThemeToggle />
            <Tip label="Shortcuts (?)"><Button size="icon" variant="ghost" aria-label="Help and shortcuts" onClick={() => setHelp(true)}><HelpCircle size={16} /></Button></Tip>
            <Button variant="primary" onClick={() => openTaskModal()}><Plus size={16} /><span className="hidden sm:inline">Add Task</span></Button>
            <Menu
              trigger={
                <button type="button" aria-label={`Account menu for ${user?.name}`} className="ml-1 grid size-9 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary hover:bg-primary/20">
                  {(user?.name || '?').trim().charAt(0).toUpperCase()}
                </button>
              }
              items={[
                { label: user?.name || 'Account', icon: <User size={14} />, disabled: true },
                { label: user?.email || '', disabled: true },
                { separator: true },
                { label: 'Settings', icon: <Settings size={14} />, onSelect: () => navigate('/settings') },
                { label: 'Sign out', icon: <LogOut size={14} />, onSelect: async () => { await logout(); navigate('/login', { replace: true }) } },
              ]}
            />
          </div>
        </header>
        <OfflineBanner />
        <StorageBanner />
        <main className="mx-auto w-full max-w-[1400px] flex-1 p-3 sm:p-5">
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface md:hidden" aria-label="Mobile">
        {NAV.filter(([to]) => MOBILE.includes(to)).map(([to, label, icon, end]) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[11px]', isActive ? 'text-primary' : 'text-muted')}>
            <AppIcon name={icon} size={20} />{label}
          </NavLink>
        ))}
      </nav>

      <TaskModal />
      <ProjectModal />
      <MoveDialog />
      <FinishDialog />
      <TaskDrawer />
      <CommandPalette navigate={navigate} />
      <ShortcutSheet />
      <Toaster position="bottom-right" richColors closeButton theme={theme} />
    </div>
  )
}
