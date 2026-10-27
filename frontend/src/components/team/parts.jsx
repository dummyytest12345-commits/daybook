import { cn } from '../../utils/format'
import { ProgressBar } from '../ui/Progress'

const PALETTE = ['#6366f1', '#0891b2', '#db2777', '#d97706', '#059669', '#7c3aed', '#2563eb', '#dc2626']
const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
export const colorFor = (key) => PALETTE[hash(key) % PALETTE.length]
export const initials = (name = '?') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?'

/** Round initials avatar with a stable colour per person; optional online dot. */
export function Avatar({ name, id, size = 32, online, ring, className }) {
  const c = colorFor(id || name)
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center rounded-full font-semibold text-white', ring && 'ring-2 ring-surface', className)} style={{ width: size, height: size, background: c, fontSize: size * 0.38 }} title={name} role="img" aria-label={name}>
      {initials(name)}
      {online != null && <span className={cn('absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-surface', online ? 'bg-st-completed' : 'bg-st-pending')} style={{ width: size * 0.3, height: size * 0.3 }} aria-label={online ? 'online' : 'offline'} />}
    </span>
  )
}

/** Overlapping avatars, "+N" for the rest. */
export function AvatarStack({ people, max = 4, size = 28 }) {
  const shown = people.slice(0, max)
  return (
    <span className="inline-flex items-center" role="group" aria-label={`${people.length} people`}>
      {shown.map((p, i) => <span key={p.userId || p.id || i} style={{ marginLeft: i ? -size * 0.3 : 0 }}><Avatar name={p.name} id={p.userId || p.id} size={size} ring /></span>)}
      {people.length > max && <span className="ml-1 text-xs font-medium text-muted">+{people.length - max}</span>}
    </span>
  )
}

/** One row per assignee: avatar, name, their own progress bar. */
export function MemberProgressList({ task, members, meId }) {
  const byId = new Map(members.map((m) => [m.userId, m]))
  if (!task.assignees.length) return <p className="text-xs text-muted">Nobody is assigned. The first person to add progress takes it.</p>
  return (
    <ul className="space-y-2" aria-label="Progress by person">
      {task.assignees.map((uid) => {
        const m = byId.get(uid)
        const c = task.contributions.find((x) => x.userId === uid)
        const v = c?.progress ?? 0
        return (
          <li key={uid} className="flex items-center gap-2.5">
            <Avatar name={m?.name || 'Former member'} id={uid} size={26} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-medium">{m?.name || 'Former member'}{uid === meId && <span className="ml-1 text-muted">(you)</span>}</span>
              </div>
              <ProgressBar value={v} done={v === 100} size="sm" ariaLabel={`${m?.name || 'Member'} progress`} />
              {c?.note && <p className="mt-0.5 truncate text-[11px] text-muted" title={c.note}>“{c.note}”</p>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export const ROLE_LABEL = { owner: 'Owner', editor: 'Can edit', viewer: 'View only' }
