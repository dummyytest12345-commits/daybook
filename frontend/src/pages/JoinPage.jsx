import { Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Card, Field, Input } from '../components/ui'
import { ProjectIcon } from '../components/icons'
import { Logo } from '../components/ui/Logo'
import { LottieLoader } from '../components/ui/LottieLoader'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { useSeo } from '../hooks/useSeo'
import { passwordStrength } from '../schemas/auth'
import { useAuth } from '../store/useAuth'
import { useTeam } from '../team/useTeam'
import { api } from '../team/api'

/**
 * Landing page of the invitation email. Shows who invited you to what, then creates your account
 * (a local account for the app plus a cloud account for sharing) and you join the project automatically.
 */
export default function JoinPage() {
  useSeo({ title: 'Join a team project' })
  const [sp] = useSearchParams()
  const token = sp.get('invite') || ''
  const navigate = useNavigate()
  const status = useAuth((s) => s.status)
  const registerLocal = useAuth((s) => s.register)
  const [invite, setInvite] = useState(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) { setError('This invitation link is incomplete.'); return }
    api.get(`/api/team/invites/${encodeURIComponent(token)}`, { token: null }).then(setInvite).catch((e) => setError(e.status === 404 ? 'This invitation has expired, was already used, or was cancelled. Ask for a new one.' : e.message))
  }, [token])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await registerLocal({ name, email: invite.email, password }) // creates the account on the server and signs in
      toast.success(`Welcome! You joined ${invite.project.name}`)
      const joined = invite.project.id
      navigate(`/team/${joined}`, { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const strength = passwordStrength(password)
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="w-full max-w-md space-y-5">
        <Link to="/" aria-label="Daybook home" className="flex justify-center"><Logo /></Link>
        {!invite && !error && <div className="grid place-items-center py-16"><LottieLoader size={110} label="Loading your invitation" /></div>}
        {error && !invite && (
          <Card className="p-6 text-center"><h1 className="text-lg font-bold">Invitation unavailable</h1><p className="mt-2 text-sm text-muted">{error}</p><Link to="/login" className="mt-4 inline-block font-medium text-primary hover:underline">Go to sign in</Link></Card>
        )}
        {invite && (
          <Card className="p-6">
            <p className="text-sm text-muted"><b className="text-ink">{invite.invitedBy}</b> invited you to collaborate</p>
            <div className="mt-3 flex items-center gap-3 rounded-card border border-line bg-canvas p-3">
              <ProjectIcon icon="cube" color={invite.project.color || '#4f46e5'} size={44} />
              <div><p className="font-bold">{invite.project.name}</p><p className="text-xs text-muted"><span className="font-mono">{invite.project.key}</span> · you will be able to {invite.role === 'viewer' ? 'view and chat' : 'add progress and chat'}</p></div>
            </div>
            {invite.accountExists ? (
              <div className="mt-5 space-y-3 text-sm"><p>You already have an account with <b>{invite.email}</b>, so you were added automatically.</p><Link to="/login" className="inline-flex"><Button variant="primary">Sign in and open the project</Button></Link></div>
            ) : status === 'authed' ? (
              <p className="mt-5 text-sm text-muted">You are signed in already. Sign out first to create the account for {invite.email}.</p>
            ) : (
              <form onSubmit={submit} className="relative mt-5 space-y-3" aria-busy={busy}>
                {error && <p role="alert" className="rounded-input bg-st-blocked/10 px-3 py-2 text-sm text-st-blocked">{error}</p>}
                <Field label="Email" hint="The address the invitation was sent to"><Input value={invite.email} readOnly /></Field>
                <Field label="Your name"><Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" autoFocus /></Field>
                <Field label="Choose a password" hint="At least 8 characters with a letter and a number">
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
                  {password && <div className="mt-1.5 flex gap-1" aria-hidden>{[0, 1, 2, 3].map((i) => <span key={i} className="h-1 flex-1 rounded-full bg-line" style={i < strength ? { background: strength > 2 ? 'var(--color-st-completed)' : 'var(--color-st-progress)' } : undefined} />)}</div>}
                </Field>
                {busy && <div className="animate-in absolute -inset-2 z-10 grid place-items-center rounded-card bg-surface/85 backdrop-blur-[2px]"><LottieLoader size={90} label="Creating your account" /></div>}
                <Button type="submit" variant="primary" className="w-full" disabled={busy}><Users size={16} />Create account and join</Button>
              </form>
            )}
          </Card>
        )}
        <p className="text-center text-xs text-muted">Free. Your personal log stays on your device; only shared projects are stored on the server.</p>
      </div>
    </div>
  )
}
