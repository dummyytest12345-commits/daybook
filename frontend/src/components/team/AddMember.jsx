import { CheckCircle2, Mail, Search, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button, Input, Select } from '../ui'
import { Avatar } from './parts'
import { useDebounce } from '../../hooks/utils'
import { useTeam } from '../../team/useTeam'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Add somebody by email. As you type, it looks the address up:
 *  - has an account: shows who they are, "Add to project" (they get an email and a notification)
 *  - no account yet: "Send invitation" (they get an email to register; they join automatically)
 */
export function AddMember() {
  const projectId = useTeam((s) => s.current.id)
  const searchUser = useTeam((s) => s.searchUser)
  const addMember = useTeam((s) => s.addMember)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('editor')
  const [res, setRes] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const dq = useDebounce(email.trim(), 350)
  const valid = EMAIL.test(dq)

  useEffect(() => {
    let cancelled = false
    if (!valid) { setRes(null); return }
    setLoading(true)
    searchUser(dq, projectId).then((r) => !cancelled && setRes(r)).catch((e) => !cancelled && setRes({ error: e.message })).finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [dq, valid, projectId, searchUser])

  const submit = async (e) => {
    e?.preventDefault()
    if (!valid || busy || res?.state === 'member') return
    setBusy(true)
    try {
      const r = await addMember(dq, role)
      if (r.result === 'added') toast.success(`${res?.user?.name || dq} was added`, { description: r.email?.sent ? 'They were notified by email.' : 'Email could not be sent.' })
      else if (r.result === 'invited') toast.success(`Invitation sent to ${dq}`, { description: r.email?.sent ? 'They can register and will join automatically.' : 'Saved, but the email could not be sent.' })
      else toast(r.result === 'already_member' ? 'They are already in this project' : 'An invitation is already pending')
      setEmail('')
      setRes(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Add a team member">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Search by email address…" aria-label="Teammate email" className="pl-8" autoComplete="off" />
        </div>
        <Select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)} className="w-36"><option value="editor">Can edit</option><option value="viewer">View only</option></Select>
      </div>

      <div aria-live="polite" className="min-h-14">
        {loading && <p className="text-xs text-muted">Searching…</p>}
        {!loading && res?.error && <p role="alert" className="text-xs text-st-blocked">{res.error}</p>}
        {!loading && res && !res.error && res.exists && (
          <div className="flex items-center gap-3 rounded-card border border-line bg-canvas p-3">
            <Avatar name={res.user.name} id={res.user.id} size={40} />
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{res.user.name}</p><p className="truncate text-xs text-muted">{res.user.email} · has a Daybook account</p></div>
            {res.state === 'member'
              ? <span className="inline-flex items-center gap-1 text-xs font-medium text-st-completed"><CheckCircle2 size={14} />Already in this project</span>
              : <Button variant="primary" type="submit" disabled={busy}><UserPlus size={14} />{busy ? 'Adding…' : 'Add to project'}</Button>}
          </div>
        )}
        {!loading && res && !res.error && !res.exists && (
          <div className="flex items-center gap-3 rounded-card border border-dashed border-line bg-canvas p-3">
            <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary"><Mail size={18} aria-hidden /></span>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">No account for {res.email}</p><p className="text-xs text-muted">{res.state === 'invited' ? 'An invitation is already pending. You can resend it below.' : 'Send an invitation email. When they register with this address they join automatically.'}</p></div>
            {res.state !== 'invited' && <Button variant="primary" type="submit" disabled={busy}><Mail size={14} />{busy ? 'Sending…' : 'Send invitation'}</Button>}
          </div>
        )}
        {!email && <p className="text-xs text-muted">Type an email address. We check if they already have an account and tell you what will happen.</p>}
      </div>
    </form>
  )
}
