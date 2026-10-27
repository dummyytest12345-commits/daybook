import { useSeo } from '../hooks/useSeo'
import { Download, RotateCcw } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Card, CardHeader, ProgressBar } from '../components/ui'
import { ImportWizard } from '../components/io/ImportWizard'
import { getRepository } from '../services/repository'
import { useStore } from '../store/useStore'
import { download } from '../utils/format'
import { todayISO } from '../utils/date'

export default function DataPage() {
  useSeo({ title: 'Import & Export' })
  const restore = useStore((s) => s.restoreSnapshot)
  const [, force] = useState(0)
  const fileRef = useRef(null)
  const repo = getRepository()
  const usage = repo.usage()
  const snaps = repo.listSnapshots()

  const backup = async () => {
    const snap = await repo.exportSnapshot()
    download(new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' }), `daybook-backup-${todayISO()}.json`)
    toast.success('Backup downloaded')
  }
  const restoreFile = async (f) => {
    try {
      const data = JSON.parse(await f.text())
      if (!window.confirm(`Replace ALL current data with this backup (${data.tasks?.length ?? 0} tasks)?`)) return
      const r = await restore(data)
      toast.success(`Restored ${r.tasks} tasks`)
      force((n) => n + 1)
    } catch (e) {
      toast.error(`Restore failed: ${e.message}`)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Import &amp; Export</h1>
        <Link to="/reports" className="text-sm font-medium text-primary hover:underline">Need a report? Open the export builder →</Link>
      </div>
      <ImportWizard />
      <Card>
        <CardHeader title="Backup & restore" subtitle="All data lives in this browser — back it up." />
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={backup}><Download size={14} />Download full backup (JSON)</Button>
            <Button onClick={() => fileRef.current?.click()}><RotateCcw size={14} />Restore from backup…</Button>
            <input ref={fileRef} type="file" accept=".json" className="sr-only" aria-label="Choose backup file" onChange={(e) => e.target.files[0] && restoreFile(e.target.files[0])} />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted">Storage used: {(usage.used / 1024).toFixed(0)} KB of about 5 MB</p>
            <ProgressBar value={usage.ratio} color={usage.ratio > 0.8 ? 'var(--color-st-blocked)' : 'var(--color-primary)'} label="Storage used" />
          </div>
          <div>
            <h4 className="mb-1 text-sm font-semibold">Automatic daily snapshots (last 5)</h4>
            {snaps.length === 0 ? <p className="text-sm text-muted">Snapshots appear after your first day with data.</p> : (
              <ul className="divide-y divide-line rounded-input border border-line text-sm">
                {snaps.map((s) => (
                  <li key={s.day} className="flex items-center justify-between px-3 py-2">
                    <span>{s.day} · {s.count} tasks</span>
                    <Button size="sm" onClick={async () => { if (window.confirm(`Restore snapshot from ${s.day}? This replaces current data.`)) { await restore(repo.getSnapshot(s.day)); toast.success('Snapshot restored'); force((n) => n + 1) } }}>Restore</Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
