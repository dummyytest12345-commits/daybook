import { Cloud, Lock } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Card, Field, Input } from '../ui'
import { LottieLoader } from '../ui/LottieLoader'
import { useAuth } from '../../store/useAuth'
import { useTeam } from '../../team/useTeam'

/** Connect this account to Daybook Cloud (needed for shared projects). */
export function ConnectCard({ defaultEmail = '', defaultName = '', lockEmail = false, invite, onDone }) {
  const local = useAuth((s) => s.user)
  const authenticate = useTeam((s) => s.authenticate)
  const [mode, setMode] = useState(invite ? 'register' : 'login')
  const [email, setEmail] = useState(defaultEmail || local?.email || '')
  const [name, setName] = useState(defaultName || local?.name || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await authenticate(mode, mode === 'register' ? { name, email, password } : { email, password })
      toast.success(mode === 'register' ? 'Cloud account created' : 'Connected to Daybook Cloud')
      onDone?.(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="relative mx-auto max-w-md p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Cloud size={22} aria-hidden /></span>
        <div><h2 className="text-lg font-bold">Confirm it’s you</h2><p className="text-sm text-muted">Enter your password once to use teams on this device.</p></div>
      </div>
      <div className="mb-4 inline-flex rounded-input border border-line p-0.5" role="tablist" aria-label="Cloud account">
        {[['login', 'Sign in'], ['register', 'Create account']].map(([v, l]) => (
          <button key={v} role="tab" type="button" aria-selected={mode === v} onClick={() => { setMode(v); setError('') }} className={`rounded-md px-3 py-1 text-xs font-medium ${mode === v ? 'bg-primary text-white' : 'text-muted hover:text-ink'}`}>{l}</button>
        ))}
      </div>
      <form onSubmit={submit} className="relative space-y-3" aria-busy={busy}>
        {error && <p role="alert" className="rounded-input bg-st-blocked/10 px-3 py-2 text-sm text-st-blocked">{error}</p>}
        {mode === 'register' && <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} /></Field>}
        <Field label="Email" hint={lockEmail ? 'This is the address the invitation was sent to' : undefined}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required readOnly={lockEmail} /></Field>
        <Field label="Password" hint={mode === 'register' ? 'At least 8 characters with a letter and a number' : undefined}><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={mode === 'register' ? 8 : 1} /></Field>
        {busy && <div className="animate-in absolute -inset-2 z-10 grid place-items-center rounded-card bg-surface/85 backdrop-blur-[2px]"><LottieLoader size={90} label="Connecting" /></div>}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>{mode === 'register' ? 'Create cloud account' : 'Connect'}</Button>
      </form>
      <p className="mt-4 flex items-start gap-2 text-xs text-muted"><Lock size={13} className="mt-0.5 shrink-0" aria-hidden />Your account and data are stored on the Daybook server. This device keeps a copy only for working offline.</p>
    </Card>
  )
}
