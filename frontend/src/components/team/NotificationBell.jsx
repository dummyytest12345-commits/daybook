import { Bell, CheckCheck } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { Button, PopoverBox, Tip } from '../ui'
import { useTeam } from '../../team/useTeam'
import { cn } from '../../utils/format'

/** Bell with an unread badge. Only shown once the user has connected to Daybook Cloud. */
export function NotificationBell() {
  const cloud = useTeam((s) => s.cloud)
  const notifications = useTeam((s) => s.notifications)
  const unread = useTeam((s) => s.unread)
  const read = useTeam((s) => s.readNotifications)
  const navigate = useNavigate()
  if (!cloud) return null
  return (
    <PopoverBox
      className="w-80 p-0"
      trigger={
        <span className="relative inline-flex">
          <Tip label="Notifications">
            <Button size="icon" variant="ghost" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}><Bell size={16} /></Button>
          </Tip>
          {unread > 0 && <span className="pointer-events-none absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-st-blocked px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
        </span>
      }
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h3 className="text-sm font-semibold">Notifications</h3>
        <Button size="sm" variant="ghost" disabled={!unread} onClick={() => read(true)}><CheckCheck size={14} />Mark all read</Button>
      </div>
      <ul className="max-h-80 overflow-y-auto">
        {!notifications.length && <li className="px-4 py-8 text-center text-sm text-muted">Nothing yet.</li>}
        {notifications.map((n) => (
          <li key={n.id}>
            <button type="button" onClick={() => { read(false, [n.id]); if (n.link) navigate(n.link) }} className={cn('flex w-full gap-2 border-b border-line px-3 py-2.5 text-left hover:bg-canvas', !n.read && 'bg-primary/5')}>
              <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')} aria-hidden />
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{n.title}</span>{n.body && <span className="block truncate text-xs text-muted">{n.body}</span>}<span className="text-[11px] text-muted">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span></span>
            </button>
          </li>
        ))}
      </ul>
    </PopoverBox>
  )
}
