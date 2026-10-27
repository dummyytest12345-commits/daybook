import { LogOut, Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/useAuth'
import { useTheme } from '../store/useTheme'
import { useSeo } from '../hooks/useSeo'
import { SyncSettings } from '../components/sync/SyncSettings'
import { passwordSchema } from '../schemas/auth'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button, Card, CardHeader, Checkbox, Field, Input, Select, StatusBadge } from '../components/ui'
import { requestNotifications, notificationsSupported } from '../hooks/useNotifications'
import { useStore } from '../store/useStore'
import { newId } from '../utils/id'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function Section({ title, subtitle, children }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="space-y-3 p-4">{children}</div>
    </Card>
  )
}

function AccountSection() {
  const { user, updateProfile, changePassword, deleteAccount, logout } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(user.name)
  const [pw, setPw] = useState({ current: '', next: '' })
  const [pwError, setPwError] = useState('')
  const [delPw, setDelPw] = useState('')
  const [delOpen, setDelOpen] = useState(false)
  const [delError, setDelError] = useState('')

  return (
    <Section title="Account" subtitle={`Signed in as ${user.email}. Your account and data are stored on the server; this device keeps an offline copy.`}>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim().length < 2) return toast.error('Enter your name'); updateProfile({ name }); toast.success('Profile updated') }}>
        <Field label="Display name" className="min-w-48 flex-1"><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
        <Button type="submit" disabled={name.trim() === user.name}>Save name</Button>
      </form>
      <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={async (e) => {
        e.preventDefault(); setPwError('')
        const ok = passwordSchema.safeParse(pw.next)
        if (!ok.success) return setPwError(ok.error.issues[0].message)
        try { await changePassword(pw.current, pw.next); setPw({ current: '', next: '' }); toast.success('Password changed') } catch (err) { setPwError(err.message) }
      }}>
        <Field label="Current password"><Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
        <Field label="New password"><Input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
        <Button type="submit" disabled={!pw.current || !pw.next}>Change password</Button>
        {pwError && <p role="alert" className="text-xs text-st-blocked sm:col-span-3">{pwError}</p>}
      </form>
      <div className="flex flex-wrap gap-2">
        <Button onClick={async () => { await logout(); navigate('/login', { replace: true }) }}><LogOut size={14} />Sign out</Button>
        <Button variant="ghost" className="text-st-blocked" onClick={() => setDelOpen((o) => !o)}>Delete account…</Button>
      </div>
      {delOpen && (
        <form className="space-y-2 rounded-input border border-st-blocked/40 bg-st-blocked/5 p-3" onSubmit={async (e) => {
          e.preventDefault(); setDelError('')
          try { await deleteAccount(delPw); toast.success('Account and its data deleted'); navigate('/login', { replace: true }) } catch (err) { setDelError(err.message) }
        }}>
          <p className="text-sm">This permanently deletes your account and <b>all its tasks</b> on this device. Enter your password to confirm.</p>
          <div className="flex gap-2"><Input type="password" autoComplete="current-password" aria-label="Confirm password" value={delPw} onChange={(e) => setDelPw(e.target.value)} /><Button type="submit" variant="danger" disabled={!delPw}>Delete forever</Button></div>
          {delError && <p role="alert" className="text-xs text-st-blocked">{delError}</p>}
        </form>
      )}
    </Section>
  )
}

export default function SettingsPage() {
  useEffect(() => { if (window.location.hash) setTimeout(() => document.querySelector(window.location.hash)?.scrollIntoView({ behavior: 'smooth' }), 100) }, [])
  const themePref = useTheme((st) => st.pref)
  const setThemePref = useTheme((st) => st.setPref)
  useSeo({ title: 'Settings' })
  const s = useStore((st) => st.settings)
  const save = useStore((st) => st.saveSettings)
  const recurring = useStore((st) => st.recurring)
  const saveRecurring = useStore((st) => st.saveRecurring)
  const [mod, setMod] = useState('')
  const [hol, setHol] = useState({ date: '', name: '' })
  const [rec, setRec] = useState({ title: '', weekdays: [1, 2, 3, 4, 5] })

  const rename = (from) => {
    const to = window.prompt(`Rename module “${from}” to:`, from)?.trim()
    if (to && to !== from) {
      useStore.getState().renameModule(from, to)
      toast.success('Module renamed everywhere, including history')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>

      <AccountSection />

      <SyncSettings />

      <Section title="General">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Week starts on">
            <Select value={s.weekStartsOn} onChange={(e) => save({ weekStartsOn: Number(e.target.value) })}><option value={1}>Monday</option><option value={0}>Sunday</option></Select>
          </Field>
          <Field label="Daily capacity (hours)">
            <Input type="number" min="1" max="24" step="0.5" value={s.dailyCapacity} onChange={(e) => save({ dailyCapacity: Number(e.target.value) || 8 })} />
          </Field>
          <Field label="Date format" hint="Also used to read ambiguous dates when importing">
            <Select value={s.dateFormat} onChange={(e) => save({ dateFormat: e.target.value })}><option>dd/MM/yyyy</option><option>MM/dd/yyyy</option><option>yyyy-MM-dd</option></Select>
          </Field>
          <Field label="Hours mode" hint={{ equal: 'Each day’s capacity is split equally across its tasks.', manual: 'Each task carries its own hours.', timer: 'Hours come from the task timer.' }[s.hoursMode]}>
            <Select value={s.hoursMode} onChange={(e) => save({ hoursMode: e.target.value })}>
              <option value="equal">Equal split of daily hours</option><option value="manual">Manual hours per task</option><option value="timer">From timer</option>
            </Select>
          </Field>
          <Field label="Daily task goal"><Input type="number" min="1" value={s.dailyGoalTasks} onChange={(e) => save({ dailyGoalTasks: Number(e.target.value) || 5 })} /></Field>
          <Field label="Theme" hint="Applies on this device, including the landing and sign-in pages"><Select value={themePref} onChange={(e) => setThemePref(e.target.value)}><option value="system">Match system</option><option value="light">Light</option><option value="dark">Dark</option></Select></Field>
        </div>
      </Section>

      <Section title="Carry forward" subtitle="What happens to tasks you did not finish.">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" className="mt-1 size-4 accent-[var(--color-primary)]" checked={s.autoCarry} onChange={(e) => save({ autoCarry: e.target.checked })} />
          <span><span className="block text-sm font-medium">Carry unfinished tasks to the next working day</span><span className="text-xs text-muted">Each day gets its own row linked in a thread, so day views and hours stay accurate. Recurring tasks and tasks older than {s.carryMaxDays} days are skipped.</span></span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="When a carried task is completed" hint="Choose what happens to the earlier days of that thread">
            <Select value={s.threadResolve} onChange={(e) => save({ threadResolve: e.target.value })}>
              <option value="all">Mark the earlier days completed too</option>
              <option value="none">Leave earlier days as they were</option>
            </Select>
          </Field>
          <Field label="Stop carrying after (days)"><Input type="number" min="1" max="365" value={s.carryMaxDays} onChange={(e) => save({ carryMaxDays: Math.max(1, Number(e.target.value) || 21) })} /></Field>
        </div>
      </Section>

      <Section title="Statuses" subtitle="Rename labels — history updates automatically because tasks store the status id.">
        {s.statuses.map((st) => (
          <div key={st.id} className="flex items-center gap-3">
            <StatusBadge status={st.id} label="" className="px-1.5" />
            <Input value={st.label} onChange={(e) => useStore.getState().renameStatus(st.id, e.target.value)} aria-label={`Label for ${st.id}`} />
          </div>
        ))}
      </Section>

      <Section title="Modules">
        <ul className="flex flex-wrap gap-2">
          {s.modules.map((m) => (
            <li key={m} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-sm">
              <button type="button" onClick={() => rename(m)} title="Rename" className="hover:text-primary">{m}</button>
              <button type="button" aria-label={`Remove ${m}`} onClick={() => save({ modules: s.modules.filter((x) => x !== m) })} className="text-muted hover:text-st-blocked"><Trash2 size={12} /></button>
            </li>
          ))}
        </ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = mod.trim(); if (v && !s.modules.includes(v)) save({ modules: [...s.modules, v] }); setMod('') }}>
          <Input value={mod} onChange={(e) => setMod(e.target.value)} placeholder="New module" aria-label="New module" />
          <Button type="submit"><Plus size={14} />Add</Button>
        </form>
      </Section>

      <Section title="Holidays" subtitle="Holiday dates have no capacity and appear greyed.">
        <ul className="divide-y divide-line text-sm">
          {[...s.holidays].sort((a, b) => a.date.localeCompare(b.date)).map((h) => (
            <li key={h.date} className="flex items-center justify-between py-1.5">
              <span>{h.date} — {h.name}</span>
              <Button size="icon" variant="ghost" aria-label={`Remove ${h.name}`} onClick={() => save({ holidays: s.holidays.filter((x) => x.date !== h.date) })}><Trash2 size={14} /></Button>
            </li>
          ))}
          {!s.holidays.length && <li className="py-1.5 text-muted">No holidays added.</li>}
        </ul>
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (!hol.date || !hol.name.trim()) return; save({ holidays: [...s.holidays.filter((x) => x.date !== hol.date), { date: hol.date, name: hol.name.trim() }] }); setHol({ date: '', name: '' }) }}>
          <Input type="date" value={hol.date} onChange={(e) => setHol({ ...hol, date: e.target.value })} className="w-40" aria-label="Holiday date" />
          <Input value={hol.name} onChange={(e) => setHol({ ...hol, name: e.target.value })} placeholder="Holiday name" className="flex-1" aria-label="Holiday name" />
          <Button type="submit"><Plus size={14} />Add</Button>
        </form>
      </Section>

      <Section title="Recurring tasks" subtitle="Templates you can add to any day (use “Add recurring” on Today).">
        <ul className="divide-y divide-line text-sm">
          {recurring.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 py-1.5">
              <span>{r.title} <span className="text-muted">· {r.weekdays.map((d) => DOW[d]).join(' ')}</span></span>
              <Button size="icon" variant="ghost" aria-label={`Remove ${r.title}`} onClick={() => saveRecurring(recurring.filter((x) => x.id !== r.id))}><Trash2 size={14} /></Button>
            </li>
          ))}
          {!recurring.length && <li className="py-1.5 text-muted">None yet, e.g. a weekly “Testing” block.</li>}
        </ul>
        <div className="flex flex-wrap items-center gap-2">
          <Input value={rec.title} onChange={(e) => setRec({ ...rec, title: e.target.value })} placeholder="Task title" className="min-w-40 flex-1" aria-label="Recurring title" />
          {DOW.map((d, i) => (
            <label key={d} className="inline-flex items-center gap-1 text-xs"><input type="checkbox" className="accent-[var(--color-primary)]" checked={rec.weekdays.includes(i)} onChange={(e) => setRec({ ...rec, weekdays: e.target.checked ? [...rec.weekdays, i] : rec.weekdays.filter((x) => x !== i) })} />{d}</label>
          ))}
          <Button onClick={() => { if (!rec.title.trim() || !rec.weekdays.length) return; saveRecurring([...recurring, { id: newId(), title: rec.title.trim(), weekdays: rec.weekdays, active: true }]); setRec({ ...rec, title: '' }) }}><Plus size={14} />Add</Button>
        </div>
      </Section>

      <Section title="Reminders">
        {!notificationsSupported() ? <p className="text-sm text-muted">This browser does not support notifications.</p> : (
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Remind me to log my day at">
              <Input type="time" value={s.reminderTime || ''} onChange={async (e) => { const v = e.target.value || null; if (v && (await requestNotifications()) !== 'granted') return toast.error('Notification permission was not granted'); save({ reminderTime: v }) }} className="w-36" />
            </Field>
            {s.reminderTime && <Button onClick={() => save({ reminderTime: null })}>Turn off</Button>}
            <p className="w-full text-xs text-muted">Reminders fire while the app is open in a browser tab.</p>
          </div>
        )}
      </Section>

      <Section title="Danger zone">
        <Button variant="danger" onClick={async () => { if (window.confirm('Delete ALL tasks, day logs and settings? Automatic snapshots are kept. This cannot be undone.')) { await useStore.getState().clearAll(); toast.success('All data cleared') } }}>Clear all data</Button>
      </Section>
    </div>
  )
}

export { Checkbox }
