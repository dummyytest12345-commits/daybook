import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, ProjectIcon } from '../icons'
import { parseQuickAdd } from '../../utils/quickAdd'
import { cn } from '../../utils/format'

const DEMO_PROJECTS = [
  { id: 'web', key: 'WEB', name: 'Website', color: '#6366f1', icon: 'globe' },
  { id: 'pay', key: 'PAY', name: 'Payments', color: '#0891b2', icon: 'cart' },
]
const LINES = [
  'Fix checkout bug #payments !high ~PAY, Review landing copy #content ~WEB due:+3d',
  'Write release notes @DOC-21 +docs; Ping design team !low',
]

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Types a quick-add line and shows, live, what Daybook understands from it (uses the real parser). */
export function QuickAddDemo() {
  const [line, setLine] = useState(0)
  const [chars, setChars] = useState(0)
  const reduce = useRef(reducedMotion())
  const full = LINES[line]

  useEffect(() => {
    if (reduce.current) return setChars(full.length)
    let t
    if (chars < full.length) t = setTimeout(() => setChars((c) => c + 1), 38 + Math.random() * 40)
    else t = setTimeout(() => { setLine((l) => (l + 1) % LINES.length); setChars(0) }, 2600)
    return () => clearTimeout(t)
  }, [chars, full])

  const typed = full.slice(0, chars)
  const parsed = useMemo(() => parseQuickAdd(typed, { today: '2026-09-28', projects: DEMO_PROJECTS, modules: [] }), [typed])
  const project = DEMO_PROJECTS.find((p) => p.id === parsed.projectId)
  const chips = [
    parsed.date && ['Date', parsed.date, '#6366f1'],
    parsed.hours != null && ['Hours', `${parsed.hours}h`, '#0891b2'],
    parsed.module && ['Module', parsed.module, '#db2777'],
    parsed.priority && ['Priority', parsed.priority, '#e11d48'],
    project && ['Project', project.key, project.color],
    parsed.ticketNo && ['Ticket', parsed.ticketNo, '#d97706'],
    parsed.dueDate && ['Due', parsed.dueDate, '#059669'],
  ].filter(Boolean)

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-pop" role="group" aria-label="Quick add demo">
      <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-4 py-3 font-mono text-sm sm:text-base">
        <Icon name="plus" size={16} className="shrink-0 text-primary" />
        <span className="min-h-6 break-all">{typed}<span className="ml-0.5 inline-block h-5 w-0.5 translate-y-1 animate-pulse bg-primary" aria-hidden /></span>
      </div>
      <div className="mt-4 min-h-28">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Daybook understood</p>
        <p className="mt-1 text-lg font-semibold">{parsed.title || '…'}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          <AnimatePresence>
            {chips.map(([k, v, c]) => (
              <motion.li key={k} layout initial={{ opacity: 0, scale: 0.8, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.2 }}
                className="rounded-full px-3 py-1 text-xs font-semibold" style={{ color: c, background: `${c}1f`, border: `1px solid ${c}44` }}>
                <span className="opacity-70">{k}: </span>{v}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>
    </div>
  )
}

const COLS = [['pending', 'Pending', 'var(--color-st-pending)'], ['in_progress', 'In progress', 'var(--color-st-progress)'], ['completed', 'Completed', 'var(--color-st-completed)']]
const INITIAL = [
  { id: 'a', ref: 'WEB-1', title: 'Wireframe pricing page' },
  { id: 'b', ref: 'WEB-2', title: 'Design hero section' },
  { id: 'c', ref: 'WEB-3', title: 'Build footer' },
  { id: 'd', ref: 'WEB-4', title: 'Set up analytics' },
  { id: 'e', ref: 'WEB-5', title: 'Write launch post' },
]
// Scripted frames: column index of cards a..e. Frame 2 puts three cards in "In progress" (limit 2).
const FRAMES = [[0, 0, 1, 2, 0], [0, 1, 1, 2, 0], [0, 1, 1, 2, 1], [0, 1, 2, 2, 1], [0, 1, 2, 2, 2], [0, 2, 2, 2, 2], [1, 2, 2, 2, 2], [2, 2, 2, 2, 2]]

/** A self-playing Kanban board with a WIP limit: cards advance and the middle column flags when over its limit. */
export function KanbanDemo() {
  const [frame, setFrame] = useState(0)
  const reduce = useRef(reducedMotion())
  const LIMIT = 2
  useEffect(() => {
    if (reduce.current) return
    const t = setInterval(() => setFrame((f) => (f + 1) % (FRAMES.length + 1)), 1700)
    return () => clearInterval(t)
  }, [])
  const cols = FRAMES[Math.min(frame, FRAMES.length - 1)]
  const cards = INITIAL.map((c, i) => ({ ...c, col: frame >= FRAMES.length ? FRAMES[0][i] : cols[i] }))

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-pop" role="group" aria-label="Board demo with work-in-progress limit">
      <div className="mb-3 flex items-center gap-3">
        <ProjectIcon icon="globe" color="#6366f1" size={32} />
        <div><p className="text-sm font-semibold">Website <span className="ml-1 rounded bg-line/70 px-1.5 font-mono text-xs text-muted">WEB</span></p><p className="text-xs text-muted">WIP limit: {LIMIT} in progress</p></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {COLS.map(([id, label, color], ci) => {
          const list = cards.filter((c) => c.col === ci)
          const over = ci === 1 && list.length > LIMIT
          return (
            <div key={id} className={cn('min-h-52 rounded-xl border p-2 transition-colors', over ? 'border-st-blocked bg-st-blocked/10' : 'border-line bg-canvas')}>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />{label}
                <span className={cn('ml-auto rounded-full px-1.5 text-[10px]', over ? 'bg-st-blocked/20 text-st-blocked' : 'bg-line/70 text-muted')}>{ci === 1 ? `${list.length}/${LIMIT}` : list.length}</span>
              </p>
              <div className="space-y-1.5">
                <AnimatePresence>
                  {list.map((c) => (
                    <motion.div key={c.id} layout layoutId={c.id} transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="rounded-lg border border-line bg-surface p-2 text-xs shadow-card">
                      <span className="font-mono text-[10px] text-primary">{c.ref}</span>
                      <p className={cn('mt-0.5 leading-snug', ci === 2 && 'text-muted line-through')}>{c.title}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              {over && <p className="mt-2 text-[10px] font-semibold text-st-blocked">Over WIP limit</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
