import { Plus } from 'lucide-react'
import { useId, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button, Input } from '../ui'
import { filterSuggestions, useSuggestionSources } from '../../hooks/useSuggestions'
import { useStore } from '../../store/useStore'
import { activeToken, applySuggestion, parseQuickAddMany } from '../../utils/quickAdd'
import { formatDate } from '../../utils/date'
import { cn } from '../../utils/format'

const HINT = { '#': 'Modules', '!': 'Priority', '~': 'Projects', '@': 'Tickets', '+': 'Tags' }

/**
 * One-line quick add. The text is kept exactly as typed; only #module !priority ~PROJECT @ticket +tag due:…
 * become fields. Separate tasks with a comma, semicolon, | or a new line. Typing a symbol suggests earlier values.
 */
export function QuickAdd({ date, autoFocus, id = 'quick-add', projectId }) {
  const [text, setText] = useState('')
  const [caret, setCaret] = useState(0)
  const [active, setActive] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const inputRef = useRef(null)
  const listId = useId()
  const modules = useStore((s) => s.settings.modules)
  const fmt = useStore((s) => s.settings.dateFormat)
  const allProjects = useStore((s) => s.projects)
  const projects = useMemo(() => allProjects.filter((p) => !p.deletedAt && !p.archivedAt), [allProjects])
  const sources = useSuggestionSources()

  const items = useMemo(() => parseQuickAddMany(text, { modules, projects }), [text, modules, projects])
  const token = dismissed ? null : activeToken(text, caret)
  const options = useMemo(() => filterSuggestions(sources, token), [sources, token])
  const open = options.length > 0
  const idx = Math.min(active, Math.max(0, options.length - 1))

  const sync = (el) => setCaret(el.selectionStart ?? el.value.length)

  const accept = (opt) => {
    const r = applySuggestion(text, token, opt.value)
    setText(r.text)
    setActive(0)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(r.caret, r.caret)
      setCaret(r.caret)
    })
  }

  const submit = (e) => {
    e?.preventDefault()
    if (!items.length) return
    let last
    for (const p of items) last = useStore.getState().addTask({ ...p, date: p.date || date, projectId: p.projectId || projectId })
    toast.success(items.length === 1 ? `Added to ${formatDate(last.date, fmt)}` : `Added ${items.length} tasks to ${formatDate(last.date, fmt)}`)
    setText('')
    setCaret(0)
  }

  const onKeyDown = (e) => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((idx + 1) % options.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((idx - 1 + options.length) % options.length) }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); accept(options[idx]) }
    else if (e.key === 'Escape') { e.preventDefault(); setDismissed(true) }
  }

  return (
    <form onSubmit={submit} className="space-y-1.5">
      <div className="relative flex gap-2">
        <Input
          ref={inputRef}
          id={id}
          value={text}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${listId}-${idx}` : undefined}
          onChange={(e) => { setText(e.target.value); sync(e.target); setActive(0); setDismissed(false) }}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => sync(e.currentTarget)}
          onClick={(e) => sync(e.currentTarget)}
          onBlur={() => setTimeout(() => setDismissed(true), 120)}
          onFocus={() => setDismissed(false)}
          placeholder="Add tasks: Fix login bug #consent !high, Review copy ~WEB"
          aria-label="Quick add task"
        />
        <Button variant="primary" type="submit" disabled={!items.length}><Plus size={16} />Add{items.length > 1 ? ` ${items.length}` : ''}</Button>

        {open && (
          <ul id={listId} role="listbox" aria-label={`${HINT[token.trigger]} suggestions`} className="animate-in absolute left-0 top-full z-30 mt-1 w-full max-w-sm overflow-hidden rounded-card border border-line bg-surface py-1 shadow-pop">
            <li role="presentation" className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">{HINT[token.trigger]} you used before</li>
            {options.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === idx}
                onMouseDown={(e) => { e.preventDefault(); accept(o) }}
                onMouseEnter={() => setActive(i)}
                className={cn('flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm', i === idx ? 'bg-primary/10 text-primary' : 'text-ink')}
              >
                {o.color && <span className="size-2 rounded-full" style={{ background: o.color }} aria-hidden />}
                <span className="font-mono text-xs text-muted">{token.trigger}</span>
                <span className="flex-1 truncate">{o.label}</span>
                {o.hint && <span className="font-mono text-xs text-muted">{o.hint}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {items.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted" aria-live="polite" aria-label="Tasks that will be added">
          {items.map((p, i) => {
            const proj = projects.find((x) => x.id === (p.projectId || projectId))
            return (
              <li key={i} className="flex flex-wrap items-center gap-x-3">
                {items.length > 1 && <span className="font-mono text-[10px]">{i + 1}.</span>}
                <span className="text-ink">“{p.title}”</span>
                <span>{formatDate(p.date || date, fmt)}</span>
                {p.module && <span>#{p.module}</span>}
                {p.priority && <span>!{p.priority}</span>}
                {p.ticketNo && <span>@{p.ticketNo}</span>}
                {p.tags?.map((t) => <span key={t}>+{t}</span>)}
                {proj && <span style={{ color: proj.color }}>in {proj.name}</span>}
                {p.dueDate && <span>due {formatDate(p.dueDate, fmt)}</span>}
              </li>
            )
          })}
        </ul>
      )}
    </form>
  )
}
