import { addDaysISO, isValidISO, todayISO } from './date'

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const squash = (s) => s.toLowerCase().replace(/\s+/g, '')

function nextWeekday(idx, from) {
  const d = new Date(`${from}T00:00:00`)
  let diff = (idx - d.getDay() + 7) % 7
  if (diff === 0) diff = 7
  return addDaysISO(from, diff)
}

/** Characters that end one task and start the next: comma, semicolon, pipe, new line. */
export const TASK_SEPARATORS = /[,;|\n\r]+/

/** Split typed text into separate task entries (empty parts are dropped). */
export const splitQuickAdd = (input) => input.split(TASK_SEPARATORS).map((s) => s.trim()).filter(Boolean)

/**
 * Parse ONE entry. Only symbol tokens become fields; every other word stays in the title exactly as typed:
 *   #module  !high|medium|low  ~PROJECTKEY  @ticket  +tag  due:2026-10-01|today|tomorrow|+3d
 * Set `natural: true` to also understand bare words like "tomorrow", "friday", "2026-10-01" and "2h".
 */
export function parseQuickAdd(input, { today = todayISO(), modules = [], projects = [], natural = false } = {}) {
  const out = { title: '' }
  const tags = []
  const tokens = [...input.matchAll(/\S+/g)]
  const drop = [] // [start, end] ranges that became fields
  for (const t of tokens) {
    const w = t[0]
    const lw = w.toLowerCase()
    let used = true
    let m
    if (w.startsWith('#') && w.length > 1) {
      const name = w.slice(1)
      out.module = modules.find((x) => squash(x) === squash(name)) || name[0].toUpperCase() + name.slice(1)
    } else if ((m = /^!(low|medium|med|high)$/i.exec(w))) out.priority = m[1].toLowerCase() === 'med' ? 'medium' : m[1].toLowerCase()
    else if (w.startsWith('@') && w.length > 1) out.ticketNo = w.slice(1)
    else if (w.startsWith('~') && w.length > 1) {
      const n = squash(w.slice(1))
      const p = projects.find((x) => x.key.toLowerCase() === n || squash(x.name) === n)
      if (p) out.projectId = p.id
      else used = false
    } else if ((m = /^due:(.+)$/i.exec(w))) {
      const v = m[1].toLowerCase()
      if (isValidISO(v)) out.dueDate = v
      else if (v === 'today') out.dueDate = today
      else if (v === 'tomorrow' || v === 'tmr') out.dueDate = addDaysISO(today, 1)
      else if (/^\+\d+d$/.test(v)) out.dueDate = addDaysISO(today, Number(v.slice(1, -1)))
      else used = false
    } else if (w.startsWith('+') && w.length > 1) tags.push(w.slice(1))
    else if (natural && (m = /^(\d+(?:\.\d+)?)h$/i.exec(w))) out.hours = Number(m[1])
    else if (natural && (m = /^(\d+)m$/i.exec(w))) out.hours = Math.round((Number(m[1]) / 60) * 100) / 100
    else if (natural && lw === 'today') out.date = today
    else if (natural && (lw === 'tomorrow' || lw === 'tmr')) out.date = addDaysISO(today, 1)
    else if (natural && lw === 'yesterday') out.date = addDaysISO(today, -1)
    else if (natural && isValidISO(w)) out.date = w
    else if (natural && /^(mon|tue|wed|thu|fri|sat|sun)(day|sday|nesday|rsday|urday)?$/.test(lw)) out.date = nextWeekday(WEEKDAYS.indexOf(lw.slice(0, 3)), today)
    else used = false
    if (used) drop.push([t.index, t.index + w.length])
  }
  // keep the remaining text untouched (original spacing and case), only removing the symbol tokens
  let title = ''
  let pos = 0
  for (const [a, b] of drop) {
    title += input.slice(pos, a)
    pos = b
  }
  title += input.slice(pos)
  out.title = title.replace(/\s{2,}/g, ' ').trim()
  if (tags.length) out.tags = tags
  return out
}

/** Parse the whole box: one task per comma/semicolon/pipe/new-line separated entry. Entries with no title are skipped. */
export const parseQuickAddMany = (input, opts) => splitQuickAdd(input).map((s) => parseQuickAdd(s, opts)).filter((p) => p.title)

const TRIGGERS = '#!~@+'

/** The symbol word being typed at the caret, e.g. "#con" -> { trigger: '#', query: 'con', start, end }. */
export function activeToken(text, caret = text.length) {
  const before = text.slice(0, caret)
  const m = /(^|[\s,;|])([#!~@+])([^\s,;|]*)$/.exec(before)
  if (!m || !TRIGGERS.includes(m[2])) return null
  const start = caret - m[2].length - m[3].length
  return { trigger: m[2], query: m[3], start, end: caret }
}

/** Replace the active token with the chosen value and a trailing space. Returns { text, caret }. */
export function applySuggestion(text, token, value) {
  const insert = `${token.trigger}${value} `
  const tail = text.slice(token.end).replace(/^[^\s,;|]*/, '') // drop the rest of the half-typed word
  const next = text.slice(0, token.start) + insert + tail.replace(/^ /, '')
  return { text: next, caret: token.start + insert.length }
}
