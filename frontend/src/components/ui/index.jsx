import * as Dialog from '@radix-ui/react-dialog'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as Popover from '@radix-ui/react-popover'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import * as RTabs from '@radix-ui/react-tabs'
import { AlertCircle, Check, ChevronDown, Circle, Clock, X } from 'lucide-react'
import { forwardRef } from 'react'
import { cn } from '../../utils/format'

/* ---------- Button ---------- */
const VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-card',
  secondary: 'bg-surface text-ink border border-line hover:bg-canvas',
  ghost: 'text-muted hover:bg-line/60 hover:text-ink',
  danger: 'bg-st-blocked text-white hover:opacity-90',
}
const SIZES = { sm: 'h-8 px-2.5 text-xs', md: 'h-9 px-3.5 text-sm', icon: 'h-9 w-9' }

export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', className, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-input font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant], SIZES[size], className,
      )}
      {...props}
    />
  )
})

/* ---------- Card ---------- */
export function Card({ className, children, ...props }) {
  return (
    <div className={cn('rounded-card border border-line bg-surface shadow-card', className)} {...props}>
      {children}
    </div>
  )
}
export function CardHeader({ title, action, subtitle }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/* ---------- Status ---------- */
export const STATUS_ICON = { completed: Check, in_progress: Clock, pending: Circle, blocked: AlertCircle }
/** Theme-aware: resolves to the CSS variables, which have lighter values in dark mode. */
export const STATUS_COLOR = { completed: 'var(--color-st-completed)', in_progress: 'var(--color-st-progress)', pending: 'var(--color-st-pending)', blocked: 'var(--color-st-blocked)' }

export function StatusBadge({ status, label, className }) {
  const Icon = STATUS_ICON[status] || Circle
  const color = STATUS_COLOR[status] || '#64748b'
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', className)}
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      <Icon size={12} aria-hidden strokeWidth={2.5} />
      {label || status}
    </span>
  )
}

export function Badge({ children, className, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-line/70 text-muted', primary: 'bg-primary/10 text-primary',
    good: 'bg-st-completed/10 text-st-completed', bad: 'bg-st-blocked/10 text-st-blocked',
    warn: 'bg-st-progress/10 text-st-progress',
  }
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>
}

/* ---------- Inputs ---------- */
const inputCls =
  'h-9 w-full rounded-input border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/70 focus:border-primary disabled:opacity-60'

export const Input = forwardRef(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(inputCls, className)} {...p} />
})
export const Textarea = forwardRef(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} className={cn(inputCls, 'h-auto min-h-20 py-2', className)} {...p} />
})
export const Select = forwardRef(function Select({ className, children, ...p }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(inputCls, 'appearance-none pr-8', className)} {...p}>
        {children}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  )
})
export function Field({ label, error, children, className, hint }) {
  return (
    <label className={cn('block space-y-1', className)}>
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-muted">{hint}</span>}
      {error && <span role="alert" className="block text-xs text-st-blocked">{error}</span>}
    </label>
  )
}
export function Checkbox({ checked, onChange, label, className }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm', className)}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--color-primary)]" />
      {label}
    </label>
  )
}

/* ---------- Modal / Drawer ---------- */
export function Modal({ open, onOpenChange, title, description, children, wide }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-in fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px]" />
        <Dialog.Content
          className={cn(
            'animate-in fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card border border-line bg-surface p-5 shadow-pop',
            wide ? 'max-w-3xl' : 'max-w-xl',
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
              <Dialog.Description className={description ? 'text-xs text-muted' : 'sr-only'}>{description || title}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close"><X size={16} /></Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function Drawer({ open, onOpenChange, title, children }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-in fixed inset-0 z-40 bg-slate-900/30" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto border-l border-line bg-surface p-5 shadow-pop">
          <div className="mb-4 flex items-start justify-between">
            <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
            <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close"><X size={16} /></Button></Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/* ---------- Tooltip / Popover / Menu ---------- */
export function Tip({ label, children }) {
  return (
    <Tooltip.Root delayDuration={300}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content sideOffset={6} className="z-[70] rounded-md bg-ink px-2 py-1 text-xs text-canvas shadow-pop">
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function PopoverBox({ trigger, children, align = 'end', className }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align={align} sideOffset={6} className={cn('animate-in z-50 w-72 rounded-card border border-line bg-surface p-3 shadow-pop', className)}>
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function Menu({ trigger, items, align = 'end' }) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align={align} sideOffset={6} className="animate-in z-50 min-w-44 rounded-card border border-line bg-surface p-1 shadow-pop">
          {items.map((it, i) =>
            it.separator ? (
              <Dropdown.Separator key={i} className="my-1 h-px bg-line" />
            ) : (
              <Dropdown.Item
                key={it.label}
                onSelect={it.onSelect}
                disabled={it.disabled}
                className={cn('flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none data-[highlighted]:bg-line/70', it.danger && 'text-st-blocked')}
              >
                {it.icon}
                {it.label}
              </Dropdown.Item>
            ),
          )}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  )
}

/* ---------- Tabs ---------- */
export function Tabs({ value, onValueChange, tabs, children, className }) {
  return (
    <RTabs.Root value={value} onValueChange={onValueChange} className={className}>
      <RTabs.List className="mb-4 flex gap-1 border-b border-line">
        {tabs.map((t) => (
          <RTabs.Trigger
            key={t.value}
            value={t.value}
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted hover:text-ink data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            {t.label}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {children}
    </RTabs.Root>
  )
}
export const TabPanel = RTabs.Content

/* ---------- Feedback ---------- */
export const Skeleton = ({ className }) => <div className={cn('skeleton rounded-md', className)} aria-hidden />

export function EmptyState({ icon: Icon, illustration, title, text, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {illustration || (Icon && <div className="rounded-full bg-primary/10 p-3 text-primary"><Icon size={22} aria-hidden /></div>)}
      <h3 className="text-sm font-semibold">{title}</h3>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {action}
    </div>
  )
}

export function ProgressBar({ value, max = 1, color = 'var(--color-primary)', label, className }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0))
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-line', className)}
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}
    >
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function ProgressRing({ value, size = 96, stroke = 9, children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${Math.round(value * 100)}% complete`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-st-completed)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, value))}
          style={{ transition: 'stroke-dashoffset 400ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center">{children}</div>
    </div>
  )
}

export { Tooltip }
