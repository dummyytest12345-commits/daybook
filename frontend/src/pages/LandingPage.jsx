import { ArrowRight, Check, ChevronDown, Menu as MenuIcon, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/icons'
import { Logo, LogoMark } from '../components/ui/Logo'
import { AuthHero } from '../components/ui/illustrations'
import { ThemeToggle } from '../components/ui/ThemeToggle'
import { KanbanDemo, QuickAddDemo } from '../components/landing/Demos'
import { Reveal } from '../components/landing/Reveal'
import { Scene3D } from '../components/landing/Scene3D'
import { FAQ, FEATURES, JSON_LD, STEPS } from '../components/landing/content'
import { useSeo } from '../hooks/useSeo'
import { useTheme } from '../store/useTheme'
import { BRAND } from '../brand'
import { cn } from '../utils/format'

const NAV = [['Features', '#features'], ['How it works', '#how'], ['Projects', '#projects'], ['FAQ', '#faq']]

function Nav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <header className={cn('fixed inset-x-0 top-0 z-50 transition-all duration-300', scrolled ? 'border-b border-line bg-canvas/80 backdrop-blur-xl' : 'bg-transparent')}>
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5" aria-label="Primary">
        <a href="#top" aria-label={`${BRAND.name} home`}><Logo /></a>
        <ul className="hidden items-center gap-8 text-sm text-muted md:flex">
          {NAV.map(([l, h]) => <li key={h}><a href={h} className="transition hover:text-ink">{l}</a></li>)}
        </ul>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Link to="/login" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-ink sm:block">Sign in</Link>
          <Link to="/register" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-primary-hover">Get started</Link>
          <button type="button" className="rounded-lg p-2 text-muted md:hidden" aria-expanded={open} aria-controls="mobile-menu" aria-label="Menu" onClick={() => setOpen((o) => !o)}>{open ? <X size={20} /> : <MenuIcon size={20} />}</button>
        </div>
      </nav>
      {open && (
        <ul id="mobile-menu" className="animate-in border-t border-line bg-canvas/95 px-5 py-3 backdrop-blur-xl md:hidden">
          {[...NAV, ['Sign in', '/login']].map(([l, h]) => <li key={h}>{h.startsWith('#') ? <a href={h} onClick={() => setOpen(false)} className="block py-2.5">{l}</a> : <Link to={h} className="block py-2.5">{l}</Link>}</li>)}
        </ul>
      )}
    </header>
  )
}

function Hero() {
  const theme = useTheme((s) => s.resolved)
  const [progress, setProgress] = useState(0.3)
  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate overflow-hidden pt-28 sm:pt-32">
      {/* soft background: two tinted glows and a faint dot grid */}
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -left-32 -top-24 size-[520px] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-24 top-24 size-[420px] rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.5] [background-image:radial-gradient(color-mix(in_srgb,var(--color-ink)_14%,transparent)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      </div>
      <div className="mx-auto grid max-w-6xl items-center gap-6 px-5 pb-16 lg:grid-cols-[1.05fr_1fr] lg:pb-24">
        <div>
          <Reveal y={10}>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1 text-xs font-medium text-muted backdrop-blur">
              <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-st-completed opacity-70" /><span className="relative inline-flex size-2 rounded-full bg-st-completed" /></span>
              New: projects, boards and carry-forward threads
            </p>
          </Reveal>
          <Reveal delay={70}>
            <h1 id="hero-title" className="mt-5 text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              The work diary that <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 bg-clip-text text-transparent">writes your report.</span>
            </h1>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Log what you did in one line. {BRAND.name} turns it into day, week and month views, projects, analytics and ready-to-send Excel, PDF and CSV reports.
            </p>
          </Reveal>
          <Reveal delay={210} className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/register" className="group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary/30 transition hover:-translate-y-0.5 hover:bg-primary-hover">
              Start logging free <ArrowRight size={18} className="transition group-hover:translate-x-1" aria-hidden />
            </Link>
            <a href="#how" className="rounded-xl border border-line bg-surface px-6 py-3.5 text-base font-semibold transition hover:bg-canvas">See how it works</a>
          </Reveal>
          <Reveal delay={280}>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
              {['Free, no card', 'Private: data stays in your browser', 'Works offline'].map((t) => <li key={t} className="flex items-center gap-1.5"><Check size={14} className="text-st-completed" aria-hidden />{t}</li>)}
            </ul>
          </Reveal>
        </div>

        <div className="relative">
          <Scene3D
            key={theme}
            className="h-[300px] w-full sm:h-[380px] lg:-mr-10 lg:h-[440px] lg:w-[calc(100%+2.5rem)]"
            label="Animated 3D scene: task cards orbit a progress ring that fills as tasks are completed. Click a card to complete it."
            create={(el) => import('../scene/heroScene').then((m) => m.createHeroScene(el, { onProgress: setProgress, theme }))}
            fallback={<div className="grid h-[300px] place-items-center sm:h-[380px] lg:h-[440px]"><AuthHero className="w-full max-w-md" /></div>}
          />
          <p className="pointer-events-none absolute inset-x-0 bottom-0 text-center text-xs text-muted" aria-live="polite">
            Try it: click a card to complete it · {Math.round(progress * 100)}% done
          </p>
        </div>
      </div>
    </section>
  )
}

function SectionHead({ id, eyebrow, title, text }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
      <h2 id={id} className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {text && <p className="mt-3 text-lg text-muted">{text}</p>}
    </Reveal>
  )
}

function How() {
  return (
    <section id="how" aria-labelledby="how-title" className="border-y border-line bg-surface/60 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHead id="how-title" eyebrow="How it works" title="Log. Review. Report." text="Three jobs, each done in seconds." />
        <ol className="mt-14 grid gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} as="li" delay={i * 100} className="text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary text-lg font-bold text-white shadow-lg shadow-primary/30">{s.n}</span>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mx-auto mt-1.5 max-w-xs text-muted">{s.text}</p>
            </Reveal>
          ))}
        </ol>
        <Reveal delay={120} className="mx-auto mt-14 max-w-2xl"><QuickAddDemo /></Reveal>
      </div>
    </section>
  )
}

function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="mx-auto max-w-6xl px-5 py-20">
      <SectionHead id="features-title" eyebrow="Features" title="Everything a work diary should do" text="Fast to write, easy to review, painless to report." />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={(i % 3) * 70}>
            <article className="group h-full rounded-2xl border border-line bg-surface p-6 shadow-card transition duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-pop">
              <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white"><Icon name={f.icon} size={22} /></span>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

function Projects() {
  return (
    <section id="projects" aria-labelledby="projects-title" className="border-y border-line bg-surface/60 py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 lg:grid-cols-2">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Projects</p>
          <h2 id="projects-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Projects when you need them. Not when you don’t.</h2>
          <p className="mt-3 text-lg text-muted">Keep a personal log, or group work into projects with their own key, board and progress. Move tasks between projects any time.</p>
          <ul className="mt-6 space-y-3">
            {['Optional: tasks without a project work as before', 'IDs like WEB-12 and a board with WIP limits', 'Move one task or fifty, with undo'].map((b) => (
              <li key={b} className="flex items-start gap-3"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-st-completed/15 text-st-completed"><Check size={12} aria-hidden /></span>{b}</li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={100}><KanbanDemo /></Reveal>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="mx-auto max-w-3xl px-5 py-20">
      <SectionHead id="faq-title" eyebrow="FAQ" title="Questions, answered" />
      <div className="mt-10 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        {FAQ.map((f) => (
          <details key={f.q} className="group px-6 py-4 open:bg-canvas/60">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium marker:hidden [&::-webkit-details-marker]:hidden">
              {f.q}<ChevronDown size={18} className="shrink-0 text-muted transition group-open:rotate-180" aria-hidden />
            </summary>
            <p className="mt-3 leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="px-5 pb-20">
      <Reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-700 px-6 py-16 text-center text-white shadow-2xl shadow-indigo-500/30">
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 -left-10 size-72 rounded-full bg-cyan-300/20 blur-3xl" aria-hidden />
        <LogoMark size={52} className="relative mx-auto drop-shadow-lg" />
        <h2 id="cta-title" className="relative mx-auto mt-5 max-w-xl text-3xl font-extrabold tracking-tight sm:text-4xl">Start your {BRAND.name} today</h2>
        <p className="relative mx-auto mt-3 max-w-md text-indigo-100">Create a free account in ten seconds. No card, no install.</p>
        <div className="relative mt-7 flex flex-wrap justify-center gap-3">
          <Link to="/register" className="rounded-xl bg-white px-7 py-3.5 font-semibold text-indigo-700 shadow-lg transition hover:-translate-y-0.5">Create free account</Link>
          <Link to="/login" className="rounded-xl border border-white/40 px-7 py-3.5 font-semibold text-white transition hover:bg-white/10">Sign in</Link>
        </div>
      </Reveal>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-line px-5 py-10 text-sm text-muted">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-3 text-ink"><Logo /><span className="hidden text-muted sm:inline">{BRAND.tagline}</span></div>
        <nav aria-label="Footer"><ul className="flex flex-wrap justify-center gap-5">
          {NAV.map(([l, h]) => <li key={h}><a href={h} className="hover:text-ink">{l}</a></li>)}
          <li><Link to="/login" className="hover:text-ink">Sign in</Link></li><li><Link to="/register" className="hover:text-ink">Register</Link></li>
        </ul></nav>
        <p>© {new Date().getFullYear()} {BRAND.name}</p>
      </div>
    </footer>
  )
}

/** Public landing page for signed-out visitors at "/". Follows the device theme (light, dark or system). */
export default function LandingPage() {
  useSeo({ fullTitle: `${BRAND.name} – ${BRAND.tagline}`, description: BRAND.description, index: true, jsonLd: JSON_LD })
  return (
    <div className="min-h-screen bg-canvas text-ink selection:bg-primary/30">
      <a href="#features" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded focus:bg-surface focus:px-3 focus:py-2">Skip to content</a>
      <Nav />
      <main>
        <Hero />
        <How />
        <Features />
        <Projects />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
