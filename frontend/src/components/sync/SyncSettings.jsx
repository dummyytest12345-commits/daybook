import { formatDistanceToNow } from 'date-fns'
import { Cloud, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Card, CardHeader, Checkbox } from '../ui'
import { ConnectCard } from '../team/ConnectCard'
import { useSync } from '../../sync/useSync'
import { useTeam } from '../../team/useTeam'
import { pluralize } from '../../utils/format'

/** Settings > Sync & device storage. */
export function SyncSettings() {
  const cloudUser = useTeam((s) => s.cloud?.user)
  const { connection, status, pending, lastSyncedAt, lastResult, clearOnLogout, syncNow, setClearOnLogout, resetDeviceCopy } = useSync()
  const [connecting, setConnecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const offline = connection !== 'online'

  const reset = async () => {
    if (!window.confirm('Rebuild this device from the server?\n\nYour data is uploaded and verified first. Then the local copy is cleared and downloaded again, which removes old deleted items and backups from this device.')) return
    setBusy(true)
    try {
      const r = await resetDeviceCopy()
      toast.success('Device copy rebuilt from the server', { description: `${r.restored} tasks restored` })
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card id="sync">
      <CardHeader title="Sync and device storage" subtitle="Your data is stored on the server. This device keeps a copy so Daybook works offline." />
      <div className="space-y-4 p-4">
        {!cloudUser ? (
          connecting ? (
            <ConnectCard onDone={() => setConnecting(false)} />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Cloud size={20} aria-hidden /></span>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Confirm your password to sync</p><p className="text-xs text-muted">Changes are saved on this device until you confirm.</p></div>
              <Button variant="primary" onClick={() => setConnecting(true)}>Confirm password</Button>
            </div>
          )
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-st-completed/10 text-st-completed"><Cloud size={20} aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Synced as {cloudUser.email}</p>
                <p className="text-xs text-muted">
                  {offline ? 'Offline. ' : ''}{pending > 0 ? `${pluralize(pending, 'change')} waiting to upload. ` : 'Everything is uploaded. '}
                  {lastSyncedAt ? `Last synced ${formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })}.` : 'Not synced yet.'}
                </p>
                {lastResult?.rejected?.length > 0 && <p className="text-xs text-st-blocked">{pluralize(lastResult.rejected.length, 'item')} could not be saved on the server (invalid data).</p>}
              </div>
              <Button disabled={offline || status === 'syncing'} onClick={() => syncNow({ reason: 'manual' })}><RefreshCw size={14} className={status === 'syncing' ? 'animate-spin' : ''} />Sync now</Button>
            </div>

            <div className="space-y-3 rounded-input border border-line bg-canvas p-3">
              <Checkbox checked={clearOnLogout} onChange={setClearOnLogout} label="Remove my data from this device when I sign out" />
              <p className="text-xs text-muted">Good for shared computers. Your data stays on the server and comes back when you sign in and turn on sync. It is only removed after everything is verified to be uploaded.</p>
              <Button size="sm" onClick={reset} disabled={busy || offline || pending > 0}><Trash2 size={14} />{busy ? 'Working…' : 'Clear and rebuild this device from the server'}</Button>
              {(offline || pending > 0) && <p className="text-xs text-muted">{offline ? 'Available when you are online.' : 'Available once your changes are uploaded.'}</p>}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
