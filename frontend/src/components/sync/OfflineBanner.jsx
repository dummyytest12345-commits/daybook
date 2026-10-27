import { CloudOff, RefreshCw, ServerCrash, Wifi } from 'lucide-react'
import { useSync } from '../../sync/useSync'
import { useTeam } from '../../team/useTeam'
import { pluralize } from '../../utils/format'

/**
 * Full-width status strip under the top bar:
 *  - offline: everything keeps working and is saved on this device
 *  - server unreachable (network up, API down)
 *  - back online (shown for a few seconds while syncing)
 */
export function OfflineBanner() {
  const connection = useSync((s) => s.connection)
  const pending = useSync((s) => s.pending)
  const status = useSync((s) => s.status)
  const back = useSync((s) => s.justReconnected)
  const hasCloud = useTeam((s) => !!s.cloud)

  if (connection === 'offline') {
    return (
      <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-st-progress/15 px-4 py-2 text-sm text-st-progress">
        <CloudOff size={16} aria-hidden className="shrink-0" />
        <span className="font-semibold">You’re offline.</span>
        <span>Everything still works and is saved on this device{hasCloud ? '. It will sync automatically when you’re back online' : ''}.</span>
        {pending > 0 && hasCloud && <span className="font-semibold">{pluralize(pending, 'change')} waiting to sync.</span>}
      </div>
    )
  }
  if (connection === 'server-down' && hasCloud) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-st-progress/15 px-4 py-2 text-sm text-st-progress">
        <ServerCrash size={16} aria-hidden className="shrink-0" />
        <span className="font-semibold">Can’t reach the Daybook server.</span>
        <span>Your changes are safe on this device and we’ll retry automatically.</span>
        {pending > 0 && <span className="font-semibold">{pluralize(pending, 'change')} waiting.</span>}
      </div>
    )
  }
  if (back) {
    return (
      <div role="status" className="animate-in flex items-center gap-3 bg-st-completed/15 px-4 py-2 text-sm text-st-completed">
        <Wifi size={16} aria-hidden />
        <span className="font-semibold">You’re back online.</span>
        {hasCloud && <span className="inline-flex items-center gap-1.5">{status === 'syncing' ? <><RefreshCw size={13} className="animate-spin" aria-hidden />Checking your session and syncing…</> : pending > 0 ? `${pluralize(pending, 'change')} still to sync` : 'Everything is up to date.'}</span>}
      </div>
    )
  }
  return null
}
