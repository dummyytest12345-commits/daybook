import { format, isToday, isYesterday } from 'date-fns'
import { MoreHorizontal, Pencil, SmilePlus, Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button, Menu } from '../ui'
import { Icon } from '../icons'
import { Avatar } from './parts'
import { useTeam } from '../../team/useTeam'
import { cn } from '../../utils/format'

const EMOJI = ['👍', '❤️', '🎉', '👀', '🙏']
const dayLabel = (d) => (isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEE d MMM'))

/** Highlights @mentions of project members inside a message. */
function Body({ text, names }) {
  const parts = text.split(/(@[\w.-]+)/g)
  return (
    <>
      {parts.map((p, i) => (p.startsWith('@') && names.has(p.slice(1).toLowerCase()) ? <span key={i} className="rounded bg-primary/15 px-1 font-medium text-primary">{p}</span> : <span key={i}>{p}</span>))}
    </>
  )
}

function SystemLine({ m }) {
  const icon = { progress: 'chart', task: 'plus', status: 'flag', member: 'projects', invite: 'mail' }[m.meta?.kind] || 'thread'
  return (
    <li className="flex items-center justify-center gap-2 px-6 py-1 text-center text-xs text-muted">
      <Icon name={icon} size={12} />
      <span>{m.text}</span>
      <span className="opacity-60">{format(new Date(m.createdAt), 'HH:mm')}</span>
      {m.meta?.kind === 'progress' && <span className="rounded-full bg-primary/10 px-1.5 font-semibold text-primary">{m.meta.overall}% overall</span>}
    </li>
  )
}

function Bubble({ m, mine, showAuthor, names, meId, onReact, onEdit, onDelete, canModerate }) {
  const reactions = m.reactions || []
  return (
    <li className={cn('group flex gap-2', mine && 'flex-row-reverse')}>
      <div className="w-8 shrink-0">{showAuthor && !mine && <Avatar name={m.author || '?'} id={m.userId} size={32} />}</div>
      <div className={cn('flex max-w-[78%] flex-col', mine ? 'items-end' : 'items-start')}>
        {showAuthor && !mine && <span className="mb-0.5 px-1 text-xs font-medium text-muted">{m.author}</span>}
        <div className={cn('flex items-center gap-1', mine && 'flex-row-reverse')}>
          {m.deletedAt ? (
            <p className="rounded-2xl border border-dashed border-line px-3 py-1.5 text-sm italic text-muted">Message deleted</p>
          ) : (
            <p className={cn('whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm', mine ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md bg-canvas ring-1 ring-line')}>
              <Body text={m.text} names={names} />
              {m.editedAt && <span className={cn('ml-1.5 text-[10px]', mine ? 'text-white/70' : 'text-muted')}>(edited)</span>}
            </p>
          )}
          {!m.deletedAt && (
            <span className="flex opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
              <Menu
                trigger={<Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Add reaction"><SmilePlus size={14} /></Button>}
                items={EMOJI.map((e) => ({ label: e, onSelect: () => onReact(m.id, e) }))}
              />
              {(mine || canModerate) && (
                <Menu
                  trigger={<Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Message actions"><MoreHorizontal size={14} /></Button>}
                  items={[
                    ...(mine ? [{ label: 'Edit', icon: <Pencil size={14} />, onSelect: () => onEdit(m) }] : []),
                    { label: 'Delete', icon: <Trash2 size={14} />, danger: true, onSelect: () => onDelete(m.id) },
                  ]}
                />
              )}
            </span>
          )}
        </div>
        {reactions.length > 0 && !m.deletedAt && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {reactions.map((r) => (
              <button key={r.emoji} type="button" onClick={() => onReact(m.id, r.emoji)} aria-pressed={r.userIds.includes(meId)} aria-label={`${r.emoji} ${r.userIds.length}`}
                className={cn('rounded-full border px-1.5 py-0.5 text-xs', r.userIds.includes(meId) ? 'border-primary/50 bg-primary/10' : 'border-line bg-surface')}>
                {r.emoji} {r.userIds.length}
              </button>
            ))}
          </div>
        )}
        <span className="mt-0.5 px-1 text-[10px] text-muted">{format(new Date(m.createdAt), 'HH:mm')}</span>
      </div>
    </li>
  )
}

/**
 * Project chat (or the thread of one task when `taskId` is given). Real-time: new messages, edits,
 * reactions, typing indicators. Enter sends, Shift+Enter makes a new line, @ suggests teammates.
 */
export function ChatPanel({ taskId = null, className, height = 'h-[460px]' }) {
  const bucket = taskId || 'main'
  const meId = useTeam((s) => s.cloud?.user?.id)
  const cur = useTeam((s) => s.current)
  const { loadMessages, sendMessage, editMessage, deleteMessage, react, setTyping } = useTeam.getState()
  const list = cur.messages[bucket]
  const members = cur.members
  const names = useMemo(() => new Set(members.flatMap((m) => [m.name.split(' ')[0].toLowerCase(), m.email.split('@')[0].toLowerCase()])), [members])
  const isOwner = cur.project.myRole === 'owner'
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const scroller = useRef(null)
  const stick = useRef(true)
  const typingOn = useRef(false)
  const typists = Object.entries(cur.typing).filter(([uid]) => uid !== meId).map(([, n]) => n)

  useEffect(() => { if (!list) loadMessages(bucket) }, [bucket, list]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { if (stick.current && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight }, [list?.length, typists.length])

  const onScroll = (e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }

  const send = async () => {
    const t = text.trim()
    if (!t || busy) return
    setBusy(true)
    try {
      if (editing) { await editMessage(editing.id, t); setEditing(null) }
      else { stick.current = true; await sendMessage(t, taskId) }
      setText('')
      if (typingOn.current) { setTyping(false, taskId); typingOn.current = false }
    } catch (e) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onChange = (v) => {
    setText(v)
    if (!typingOn.current && v) { typingOn.current = true; setTyping(true, taskId) }
    else if (typingOn.current && !v) { typingOn.current = false; setTyping(false, taskId) }
  }

  const mention = /(^|\s)@([\w.-]*)$/.exec(text)
  const q = mention?.[2].toLowerCase() ?? ''
  // hide the list once the name is fully typed (then Enter sends the message)
  const mentionOptions = mention ? members.filter((m) => m.userId !== meId && m.name.toLowerCase().startsWith(q) && m.name.split(' ')[0].toLowerCase() !== q).slice(0, 5) : []
  const pick = (m) => onChange(text.replace(/@[\w.-]*$/, `@${m.name.split(' ')[0]} `))

  const rows = []
  let lastDay = ''
  let lastUser = null
  ;(list || []).forEach((m) => {
    const d = new Date(m.createdAt)
    const key = format(d, 'yyyy-MM-dd')
    if (key !== lastDay) { rows.push({ divider: dayLabel(d), key: `d${key}` }); lastDay = key; lastUser = null }
    rows.push({ m, showAuthor: m.type === 'user' && lastUser !== m.userId })
    lastUser = m.type === 'user' ? m.userId : null
  })

  return (
    <section className={cn('flex flex-col rounded-card border border-line bg-surface', className)} aria-label={taskId ? 'Task conversation' : 'Project chat'}>
      <ol ref={scroller} onScroll={onScroll} className={cn('flex-1 space-y-2 overflow-y-auto p-3', height)} aria-live="polite" aria-relevant="additions">
        {cur.hasMore[bucket] && <li className="text-center"><Button size="sm" variant="ghost" onClick={() => { stick.current = false; loadMessages(bucket, { older: true }) }}>Load earlier messages</Button></li>}
        {!list && <li className="py-10 text-center text-sm text-muted">Loading conversation…</li>}
        {list && !list.length && <li className="py-10 text-center text-sm text-muted">No messages yet. Say hello 👋<br /><span className="text-xs">Progress updates from teammates also show up here.</span></li>}
        {rows.map((r) => (r.divider
          ? <li key={r.key} className="flex items-center gap-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted" role="separator"><span className="h-px flex-1 bg-line" />{r.divider}<span className="h-px flex-1 bg-line" /></li>
          : r.m.type === 'system'
            ? <SystemLine key={r.m.id} m={r.m} />
            : <Bubble key={r.m.id} m={r.m} mine={r.m.userId === meId} showAuthor={r.showAuthor} names={names} meId={meId} onReact={react} onEdit={(m) => { setEditing(m); setText(m.text) }} onDelete={deleteMessage} canModerate={isOwner} />))}
      </ol>

      <div className="h-5 px-4 text-xs italic text-muted" aria-live="polite">
        {typists.length > 0 && `${typists.slice(0, 2).join(' and ')} ${typists.length > 2 ? 'and others are' : typists.length === 2 ? 'are' : 'is'} typing…`}
      </div>

      <div className="relative border-t border-line p-2.5">
        {mentionOptions.length > 0 && (
          <ul role="listbox" aria-label="Mention a teammate" className="absolute bottom-full left-2.5 z-10 mb-1 w-56 overflow-hidden rounded-card border border-line bg-surface py-1 shadow-pop">
            {mentionOptions.map((m) => (
              <li key={m.userId} role="option" aria-selected="false" onMouseDown={(e) => { e.preventDefault(); pick(m) }} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-primary/10">
                <Avatar name={m.name} id={m.userId} size={22} />{m.name}
              </li>
            ))}
          </ul>
        )}
        {editing && <p className="mb-1 flex items-center justify-between text-xs text-muted">Editing message <button type="button" className="text-primary hover:underline" onClick={() => { setEditing(null); setText('') }}>Cancel</button></p>}
        <div className="flex items-end gap-2">
          <textarea
            value={text} rows={1} maxLength={2000} aria-label={taskId ? 'Message about this task' : 'Message the team'}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => { if (typingOn.current) { typingOn.current = false; setTyping(false, taskId) } }}
            onKeyDown={(e) => { if (mentionOptions.length && (e.key === 'Enter' || e.key === 'Tab')) { e.preventDefault(); pick(mentionOptions[0]) } else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } else if (e.key === 'Escape' && editing) { setEditing(null); setText('') } }}
            placeholder={taskId ? 'Discuss this task… (@name to mention)' : 'Message the team… (@name to mention)'}
            className="max-h-32 min-h-9 flex-1 resize-none rounded-input border border-line bg-surface px-3 py-2 text-sm focus:border-primary"
          />
          <Button variant="primary" size="icon" onClick={send} disabled={!text.trim() || busy} aria-label={editing ? 'Save edit' : 'Send message'}><Icon name="send" size={16} /></Button>
        </div>
      </div>
    </section>
  )
}
