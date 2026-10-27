import { cn } from '../../utils/format'

/** Plain-language stage for a percentage, so the number always comes with words. */
export function progressLabel(v, status) {
  if (status === 'completed' || v >= 100) return 'Done'
  if (status === 'blocked') return 'Blocked'
  if (v <= 0) return status === 'in_progress' ? 'Just started' : 'Not started'
  if (v < 25) return 'Getting going'
  if (v < 50) return 'Making progress'
  if (v < 75) return 'Over halfway'
  return 'Almost there'
}

const GRADIENT = 'linear-gradient(90deg, #6366f1, #22d3ee)'
const DONE = 'linear-gradient(90deg, #10b981, #34d399)'

/** Animated bar. Gradient while in flight, green when done. `label` adds the percentage at the right. */
export function ProgressBar({ value, done, size = 'md', label = true, className, ariaLabel = 'Progress' }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  const h = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2'
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div role="progressbar" aria-label={ariaLabel} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} className={cn('relative w-full min-w-16 overflow-hidden rounded-full bg-line', h)}>
        <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${v}%`, background: done || v >= 100 ? DONE : GRADIENT }} />
        {!done && v > 0 && v < 100 && <div className="progress-sheen absolute inset-y-0 left-0 rounded-full" style={{ width: `${v}%` }} aria-hidden />}
      </div>
      {label && <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-muted">{v}%</span>}
    </div>
  )
}

/** Circular progress with the percentage in the middle. */
export function ProgressRing({ value, size = 56, stroke = 6, done, children, className }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const id = `pr-${size}-${done ? 'd' : 'p'}`
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${v} percent`}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={done || v >= 100 ? '#10b981' : '#6366f1'} />
            <stop offset="1" stopColor={done || v >= 100 ? '#34d399' : '#22d3ee'} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset 500ms ease' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children ?? <span className="text-xs font-bold tabular-nums" style={{ fontSize: size * 0.24 }}>{v}%</span>}</div>
    </div>
  )
}

/** Styled range input. Calls onChange while dragging and onCommit when the user lets go (pointer or keyboard). */
export function ProgressSlider({ value, onChange, onCommit, label, disabled, className }) {
  const commitKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']
  return (
    <input
      type="range" min={0} max={100} step={5} value={value} disabled={disabled}
      aria-label={label} aria-valuetext={`${value} percent`}
      style={{ '--p': `${value}%` }}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={() => onCommit?.(value)}
      onKeyUp={(e) => commitKeys.includes(e.key) && onCommit?.(value)}
      onBlur={() => onCommit?.(value)}
      className={cn('progress-range w-full', className)}
    />
  )
}

/** Quick-set chips: 0, 25, 50, 75, 100. */
export function ProgressChips({ value, onPick, disabled }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Set progress">
      {[0, 25, 50, 75, 100].map((n) => (
        <button
          key={n} type="button" disabled={disabled} onClick={() => onPick(n)} aria-pressed={value === n}
          className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums transition', value === n ? 'border-transparent bg-primary text-white' : 'border-line text-muted hover:border-primary/50 hover:text-ink')}
        >
          {n}%
        </button>
      ))}
    </div>
  )
}
