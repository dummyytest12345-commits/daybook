import { zodResolver } from '@hookform/resolvers/zod'
import { BarChart3, Eye, EyeOff, FileText, Lock, ShieldCheck, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Checkbox, Field, Input } from '../components/ui'
import { AuthHero } from '../components/ui/illustrations'
import { Logo } from '../components/ui/Logo'
import { LottieLoader } from '../components/ui/LottieLoader'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { useSeo } from '../hooks/useSeo'
import { loginSchema, passwordStrength, registerSchema } from '../schemas/auth'
import { lockRemaining } from '../services/auth'
import { useAuth } from '../store/useAuth'

const STRENGTH = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong']
const STRENGTH_COLOR = ['#dc2626', '#dc2626', '#d97706', '#16a34a', '#16a34a']

function PasswordField({ label, error, registerProps, autoComplete, meter, value }) {
  const [show, setShow] = useState(false)
  const score = meter ? passwordStrength(value || '') : 0
  return (
    <Field label={label} error={error}>
      <div className="relative">
        <Input type={show ? 'text' : 'password'} autoComplete={autoComplete} aria-invalid={!!error} className="pr-10" {...registerProps} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {meter && value && (
        <div className="mt-1.5" aria-live="polite">
          <div className="flex gap-1" aria-hidden>
            {[0, 1, 2, 3].map((i) => <span key={i} className="h-1 flex-1 rounded-full bg-line" style={i < score ? { background: STRENGTH_COLOR[score] } : undefined} />)}
          </div>
          <span className="text-xs text-muted">Strength: {STRENGTH[score]}</span>
        </div>
      )}
    </Field>
  )
}

/** Sign-in and create-account screens (`mode` = 'login' | 'register'). Accounts are stored on the Daybook server. */
export default function AuthPage({ mode }) {
  const isLogin = mode === 'login'
  useSeo({
    title: isLogin ? 'Sign in' : 'Create your account',
    description: isLogin
      ? 'Sign in to Daybook to log daily tasks, review your week and export Excel, PDF or CSV reports.'
      : 'Create a free Daybook account to keep your own private work diary, analytics and reports.',
    index: true,
  })
  const { login, register: signUp } = useAuth()
  const navigate = useNavigate()
  const from = useLocation().state?.from
  const [serverError, setServerError] = useState('')
  const [wait, setWait] = useState(0)

  const form = useForm({
    resolver: zodResolver(isLogin ? loginSchema : registerSchema),
    defaultValues: isLogin ? { email: '', password: '', remember: true } : { name: '', email: '', password: '', confirm: '' },
    mode: 'onTouched',
  })
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = form

  useEffect(() => { setServerError('') }, [mode])
  useEffect(() => {
    if (!wait) return
    const id = setInterval(() => setWait((w) => Math.max(0, w - 1)), 1000)
    return () => clearInterval(id)
  }, [wait])

  const go = () => navigate(from?.pathname ? `${from.pathname}${from.search || ''}` : '/', { replace: true })

  const onSubmit = handleSubmit(async (v) => {
    setServerError('')
    try {
      if (isLogin) {
        const user = await login({ email: v.email, password: v.password, remember: v.remember })
        toast.success(`Welcome back, ${user.name.split(' ')[0]}`)
      } else {
        const user = await signUp({ name: v.name, email: v.email, password: v.password })
        toast.success(`Welcome, ${user.name.split(' ')[0]}! Your account is ready.`)
        if (useAuth.getState().adoptedLegacy) toast.info('Your existing tasks were moved into this account.')
      }
      go()
    } catch (e) {
      if (e.code === 'locked') setWait(e.wait)
      else if (e.code === 'invalid' && isLogin) setWait(lockRemaining(v.email.trim().toLowerCase()))
      setServerError(e.message || 'Something went wrong. Please try again.')
    }
  })

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <div className="absolute right-4 top-4 z-20"><ThemeToggle /></div>
      <div className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="mb-8 inline-block" aria-label="Daybook home"><Logo /></Link>
          <h1 className="text-2xl font-bold">{isLogin ? 'Sign in to your work diary' : 'Create your account'}</h1>
          <p className="mb-6 mt-1 text-muted">{isLogin ? 'Pick up where you left off.' : 'Your tasks are private to your account and saved securely online.'}</p>

          <form onSubmit={onSubmit} noValidate aria-busy={isSubmitting} className="relative space-y-4" aria-label={isLogin ? 'Sign in form' : 'Create account form'}>
            {serverError && <p role="alert" className="rounded-input bg-st-blocked/10 px-3 py-2 text-sm text-st-blocked">{serverError}{wait > 0 && ` (${wait}s)`}</p>}
            {!isLogin && (
              <Field label="Full name" error={errors.name?.message}>
                <Input autoComplete="name" autoFocus aria-invalid={!!errors.name} {...register('name')} />
              </Field>
            )}
            <Field label="Email" error={errors.email?.message}>
              <Input type="email" autoComplete="email" inputMode="email" autoFocus={isLogin} aria-invalid={!!errors.email} {...register('email')} />
            </Field>
            <PasswordField label="Password" error={errors.password?.message} autoComplete={isLogin ? 'current-password' : 'new-password'} registerProps={register('password')} meter={!isLogin} value={watch('password')} />
            {!isLogin && <PasswordField label="Confirm password" error={errors.confirm?.message} autoComplete="new-password" registerProps={register('confirm')} />}
            {isLogin && <Checkbox checked={!!watch('remember')} onChange={(v) => setValue('remember', v)} label="Keep me signed in on this device" />}
            {isSubmitting && (
              <div className="animate-in absolute -inset-3 z-10 grid place-items-center rounded-card bg-surface/85 backdrop-blur-[2px]">
                <LottieLoader size={110} label={isLogin ? 'Checking your login' : 'Creating your account'} />
              </div>
            )}
            <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting || wait > 0}>
              {isSubmitting ? <LottieLoader size={26} primary="#ffffff" secondary="#c7d2fe" label={isLogin ? 'Checking your login' : 'Creating your account'} /> : wait > 0 ? `Try again in ${wait}s` : isLogin ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <p className="mt-5 text-sm text-muted">
            {isLogin ? 'New here? ' : 'Already have an account? '}
            <Link to={isLogin ? '/register' : '/login'} state={{ from }} className="font-medium text-primary hover:underline">{isLogin ? 'Create an account' : 'Sign in'}</Link>
          </p>
          <p className="mt-6 flex items-start gap-2 rounded-input bg-canvas p-3 text-xs text-muted">
            <Lock size={14} className="mt-0.5 shrink-0" aria-hidden />
            Your account and data are stored on the Daybook server (passwords are hashed). When you are offline, changes are kept on this device and sync when you reconnect.
          </p>
        </div>
      </div>

      <aside className="hidden flex-col justify-center gap-6 bg-primary/5 px-12 lg:flex" aria-label="About Daybook">
        <AuthHero />
        <h2 className="text-xl font-semibold">Log fast. See progress. Report in one click.</h2>
        <ul className="space-y-3 text-sm">
          {[
            [Zap, 'Add a task in seconds', 'Quick-add understands dates, hours, modules and priority.'],
            [BarChart3, 'Analytics that explain your week', 'KPIs, heatmap, burn-up and plain-English insights.'],
            [FileText, 'Reports your manager can open', 'Excel, PDF and CSV exports plus a standup generator.'],
            [ShieldCheck, 'Private and offline-ready', 'Every account keeps its own separate data.'],
          ].map(([Icon, t, d]) => (
            <li key={t} className="flex gap-3"><Icon size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden /><span><b className="block">{t}</b><span className="text-muted">{d}</span></span></li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
