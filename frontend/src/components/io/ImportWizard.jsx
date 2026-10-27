import { AlertTriangle, CheckCircle2, FileDown, UploadCloud } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge, Button, Card, CardHeader, Field, Input, Select, Textarea } from '../ui'
import { useImport } from '../../hooks/useImport'
import { SAMPLE_CSV } from '../../services/importers/csv'
import { IMPORT_FIELDS, errorsToCsv } from '../../services/importers/normalise'
import { useStore } from '../../store/useStore'
import { download } from '../../utils/format'
import { todayISO } from '../../utils/date'

function Steps({ current }) {
  const steps = ['File', 'Map columns', 'Preview', 'Import']
  const idx = { file: 0, json: 0, map: 1, preview: 2, done: 3 }[current]
  return (
    <ol className="mb-4 flex flex-wrap gap-2 text-xs" aria-label="Import steps">
      {steps.map((s, i) => (
        <li key={s} aria-current={i === idx ? 'step' : undefined} className={`rounded-full px-3 py-1 font-medium ${i === idx ? 'bg-primary text-white' : i < idx ? 'bg-st-completed/15 text-st-completed' : 'bg-line/60 text-muted'}`}>{i + 1}. {s}</li>
      ))}
    </ol>
  )
}

export function ImportWizard() {
  const w = useImport()
  const fileRef = useRef(null)
  const [text, setText] = useState('')
  const [legacyDate, setLegacyDate] = useState(todayISO())
  const [drag, setDrag] = useState(false)
  const restore = useStore((s) => s.restoreSnapshot)
  const allProjects = useStore((s) => s.projects)
  const projects = allProjects.filter((p) => !p.deletedAt && !p.archivedAt)

  const onDrop = (e) => {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files?.[0]
    if (f) w.pickFile(f)
  }

  return (
    <Card>
      <CardHeader title="Import tasks" subtitle="CSV, Excel, JSON backup, or pasted legacy notes"
        action={<Button size="sm" onClick={() => download(new Blob(['﻿', SAMPLE_CSV], { type: 'text/csv' }), 'daybook-sample.csv')}><FileDown size={14} />Sample template</Button>} />
      <div className="p-4">
        <Steps current={w.step} />
        {w.error && <p role="alert" className="mb-3 rounded-input bg-st-blocked/10 px-3 py-2 text-sm text-st-blocked">{w.error}</p>}

        {w.step === 'file' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
              className={`flex flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed p-8 text-center ${drag ? 'border-primary bg-primary/5' : 'border-line'}`}
            >
              <UploadCloud className="text-primary" aria-hidden />
              <p className="text-sm font-medium">Drop a .csv, .xlsx or .json file</p>
              <Button variant="primary" disabled={w.busy} onClick={() => fileRef.current?.click()}>{w.busy ? 'Reading…' : 'Choose file'}</Button>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.json" className="sr-only" aria-label="Choose import file" onChange={(e) => e.target.files[0] && w.pickFile(e.target.files[0])} />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Or paste legacy notes</p>
              <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'15 (responsive) … Working..1\n73 Profile page fix Completed'} aria-label="Legacy notes" />
              <div className="flex items-end gap-2">
                <Field label="Date for these tasks" className="flex-1"><Input type="date" value={legacyDate} onChange={(e) => setLegacyDate(e.target.value)} /></Field>
                <Button variant="primary" onClick={() => w.parseLegacy(text, legacyDate)}>Parse</Button>
              </div>
              <p className="text-xs text-muted">One task per line. A leading number becomes the ticket; Working / Completed sets the status.</p>
            </div>
          </div>
        )}

        {w.step === 'json' && (
          <div className="space-y-3">
            <p className="text-sm">“{w.fileName}” looks like a Work Log backup with <b>{w.json?.tasks?.length ?? 0}</b> tasks. Restoring <b>replaces all current data</b>.</p>
            <div className="flex gap-2">
              <Button onClick={w.reset}>Cancel</Button>
              <Button variant="danger" onClick={async () => { try { const r = await restore(w.json); toast.success(`Restored ${r.tasks} tasks${r.dropped ? ` (${r.dropped} invalid skipped)` : ''}`); w.reset() } catch (e) { toast.error(e.message) } }}>Replace data with backup</Button>
            </div>
          </div>
        )}

        {w.step === 'map' && (
          <div className="space-y-3">
            <p className="text-sm text-muted">{w.rows.length} rows in “{w.fileName}”. Match your columns to fields. Dates are read as <b>{useStore.getState().settings.dateFormat}</b> (change in Settings).</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {IMPORT_FIELDS.map((f) => (
                <Field key={f.key} label={`${f.label}${f.required ? ' *' : ''}`}>
                  <Select value={w.mapping[f.key] ?? ''} onChange={(e) => w.setMapping(f.key, e.target.value)}>
                    <option value="">— not mapped —</option>
                    {w.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </Select>
                </Field>
              ))}
            </div>
            <div className="flex gap-2"><Button onClick={w.reset}>Back</Button><Button variant="primary" onClick={w.validate}>Validate &amp; preview</Button></div>
          </div>
        )}

        {w.step === 'preview' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge tone="good"><CheckCircle2 size={12} />{w.tasks.length} valid</Badge>
              {w.errors.length > 0 && <Badge tone="bad"><AlertTriangle size={12} />{w.errors.length} problems</Badge>}
              {w.duplicates > 0 && <Badge tone="warn">{w.duplicates} already exist</Badge>}
            </div>
            <div className="max-h-64 overflow-auto rounded-input border border-line">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-canvas"><tr>{['Date', 'Task', 'Status', 'Ticket', 'Hours'].map((h) => <th key={h} className="px-2 py-1.5 text-left text-muted">{h}</th>)}</tr></thead>
                <tbody>{w.tasks.slice(0, 100).map((t) => <tr key={t.id} className="border-t border-line"><td className="px-2 py-1">{t.date}</td><td className="px-2 py-1">{t.title}</td><td className="px-2 py-1">{t.status}</td><td className="px-2 py-1">{t.ticketNo}</td><td className="px-2 py-1">{t.hours}</td></tr>)}</tbody>
              </table>
            </div>
            {w.errors.length > 0 && (
              <details className="rounded-input bg-st-blocked/5 p-2 text-xs">
                <summary className="cursor-pointer font-medium text-st-blocked">Show problems</summary>
                <ul className="mt-1 space-y-0.5">{w.errors.slice(0, 50).map((e, i) => <li key={i}>Row {e.row}: {e.message}</li>)}</ul>
                <Button size="sm" className="mt-2" onClick={() => download(new Blob([errorsToCsv(w.errors)], { type: 'text/csv' }), 'import-errors.csv')}>Download error report</Button>
              </details>
            )}
            {projects.length > 0 && (
              <Field label="Assign all imported tasks to a project (optional)" hint="Overrides a Project column in the file">
                <Select value={w.projectId} onChange={(e) => w.setProject(e.target.value)}>
                  <option value="">Use the file’s Project column, or none</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.key})</option>)}
                </Select>
              </Field>
            )}
            <Field label="If a task already exists">
              <Select value={w.mode} onChange={(e) => w.setMode(e.target.value)}>
                <option value="skip">Skip duplicates</option>
                <option value="merge">Merge (update existing)</option>
                <option value="replace">Replace all existing data</option>
              </Select>
            </Field>
            <div className="flex gap-2">
              <Button onClick={w.reset}>Start over</Button>
              <Button variant="primary" disabled={!w.tasks.length} onClick={w.commit}>Import {w.tasks.length} tasks</Button>
            </div>
          </div>
        )}

        {w.step === 'done' && (
          <div className="space-y-3 text-center">
            <CheckCircle2 className="mx-auto text-st-completed" size={32} aria-hidden />
            <p className="font-medium">Import complete. You can undo it from the top bar.</p>
            <Button onClick={w.reset}>Import another</Button>
          </div>
        )}
      </div>
    </Card>
  )
}
