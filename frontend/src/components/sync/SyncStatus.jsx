import { formatDistanceToNow } from 'date-fns'
import { AlertTriangle, CheckCircle2, CloudOff, RefreshCw, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, PopoverBox } from '../ui'
import { useSync } from '../../sync/useSync'
import { useTeam } from '../../team/useTeam'
import { cn, pluralize } from '../../utils/format'

/** Compact sync indicator in the top bar. Click for details and "Sync now". */
export function SyncStatus() {
  const connection = useSync((s) => s.connection)
  const status = useSync((s) => s.status)
  const pending = useSync((s) => s.pending)
  const last = useSync((s) => s.lastSyncedAt)
  const error = useSync((s) => s.lastError)
  const syncNow = useSync((s) => s.syncNow)
  const hasCloud = useTeam((s) => !!s.cloud)
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000) // keeps "synced 2 minutes ago" fresh
    return () => clearInterval(id)
  }, [])

  const offline = connection !== 'online'
  let tone = 'text-muted'
  let Icon = CheckCircle2
  let label = 'Synced'
  if (!hasCloud) {
    if (!offline) return null // local-only and online: nothing to show
    Icon = WifiOff; tone = 'text-st-progress'; label = 'Offline'
  } else if (offline) {
    Icon = connection === 'offline' ? WifiOff : CloudOff; tone = 'text-st-progress'; label = pending ? `Offline · ${pending}` : 'Offline'
  } else if (status === 'syncing') {
    Icon = RefreshCw; tone = 'text-primary'; label = 'Syncing…'
  } else if (status === 'error') {
    Icon = AlertTriangle; tone = 'text-st-blocked'; label = 'Sync failed'
  } else if (pending > 0) {
    Icon = RefreshCw; tone = 'text-primary'; label = `${pending} to sync`
  } else {
    tone = 'text-st-completed'
  }

  return (
    <PopoverBox
      className="w-72 space-y-3"
      trigger={
        <button type="button" aria-label={`Sync status: ${label}`} className={cn('inline-flex h-9 items-center gap-1.5 rounded-input px-2.5 text-xs font-medium hover:bg-line/60', tone)}>
          <Icon size={15} aria-hidden className={status === 'syncing' && !offline ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      }
    >
      <div>
        <p className="text-sm font-semibold">{!hasCloud ? 'Working offline' : offline ? (connection === 'offline' ? 'You’re offline' : 'Server unreachable') : status === 'error' ? 'Sync failed' : pending ? 'Changes waiting' : 'Everything is synced'}</p>
        <p className="mt-1 text-xs text-muted">
          {!hasCloud
            ? 'Your data is saved on this device. It works without a connection.'
            : offline
              ? `${pluralize(pending, 'change')} saved on this device. They upload automatically when the connection is back.`
              : status === 'error'
                ? error
                : last ? `Last synced ${formatDistanceToNow(new Date(last), { addSuffix: true })}.` : 'Not synced yet.'}
        </p>
      </div>
      {hasCloud ? (
        <div className="flex gap-2">
          <Button size="sm" variant="primary" disabled={offline || status === 'syncing'} onClick={() => syncNow({ reason: 'manual' })}><RefreshCw size={13} />Sync now</Button>
          <Link to="/settings#sync" className="inline-flex h-8 items-center rounded-input px-2.5 text-xs font-medium text-primary hover:underline">Sync settings</Link>
        </div>
      ) : (
        <Link to="/settings#sync" className="text-xs font-medium text-primary hover:underline">Turn on sync to back up and use another device</Link>
      )}
    </PopoverBox>
  )
}
