import { parseFlexibleDate } from '../../utils/date'
import { newId } from '../../utils/id'
import { taskFormSchema } from '../../schemas/task'

const STATUS_ALIASES = {
  completed: 'completed', complete: 'completed', done: 'completed', finished: 'completed', closed: 'completed', resolved: 'completed',
  working: 'in_progress', 'in progress': 'in_progress', in_progress: 'in_progress', inprogress: 'in_progress', wip: 'in_progress', ongoing: 'in_progress', started: 'in_progress',
  pending: 'pending', todo: 'pending', 'to do': 'pending', open: 'pending', new: 'pending', planned: 'pending',
  blocked: 'blocked', stuck: 'blocked', hold: 'blocked', 'on hold': 'blocked',
}

export function normaliseStatus(text) {
  if (!text) return 'pending'
  const k = String(text).trim().toLowerCase().replace(/[.\s]+$/, '')
  return STATUS_ALIASES[k] || STATUS_ALIASES[k.replace(/[-_]/g, ' ')] || 'pending'
}

/** Canonical import fields and header synonyms used for auto column mapping. */
export const IMPORT_FIELDS = [
  { key: 'date', label: 'Date', aliases: ['date', 'day date', 'when'], required: true },
  { key: 'title', label: 'Task / Title', aliases: ['task', 'tasks', 'title', 'description', 'summary', 'work'], required: true },
  { key: 'status', label: 'Status', aliases: ['status', 'state'] },
  { key: 'hours', label: 'Hours', aliases: ['hours', 'hrs', 'time', 'duration'] },
  { key: 'estimateHours', label: 'Estimate', aliases: ['estimate', 'estimated', 'estimate hours'] },
  { key: 'ticketNo', label: 'Ticket', aliases: ['ticket', 'ticket no', 'ticketno', 'id', 'issue', 'sr no'] },
  { key: 'project', label: 'Project', aliases: ['project', 'project name', 'board', 'epic'] },
  { key: 'module', label: 'Module', aliases: ['module', 'area', 'component', 'project'] },
  { key: 'dueDate', label: 'Due date', aliases: ['due', 'due date', 'deadline', 'due on'] },
  { key: 'priority', label: 'Priority', aliases: ['priority'] },
  { key: 'tags', label: 'Tags', aliases: ['tags', 'labels'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'comments', 'remarks'] },
]

/** Guess { field -> header } from a header row. */
export function autoMap(headers) {
  const map = {}
  const used = new Set()
  for (const f of IMPORT_FIELDS) {
    const h = headers.find((x) => !used.has(x) && f.aliases.includes(String(x).trim().toLowerCase()))
    if (h != null) {
      map[f.key] = h
      used.add(h)
    }
  }
  return map
}

const num = (v) => {
  if (v == null || v === '') return undefined
  const n = Number(String(v).replace(',', '.').replace(/h$/i, ''))
  return Number.isFinite(n) ? n : NaN
}

/**
 * Convert raw rows (objects keyed by header) to tasks using a mapping.
 * A multi-line title cell is split into one task per line.
 * Returns { tasks, errors: [{row, message, data}] } — bad rows are never dropped silently.
 */
export function rowsToTasks(rows, mapping, { dateFormat = 'dd/MM/yyyy', splitLines = true } = {}) {
  const tasks = []
  const errors = []
  const now = new Date().toISOString()
  let lastDate = null
  rows.forEach((raw, i) => {
    const get = (k) => (mapping[k] != null ? raw[mapping[k]] : undefined)
    const rowNo = i + 2
    const dateRaw = get('date')
    let date = dateRaw === '' || dateRaw == null ? lastDate : parseFlexibleDate(dateRaw, dateFormat)
    if (!date) return errors.push({ row: rowNo, message: `Invalid or missing date “${dateRaw ?? ''}”`, data: raw })
    lastDate = date
    const titleCell = String(get('title') ?? '').trim()
    if (!titleCell) return errors.push({ row: rowNo, message: 'Missing task title', data: raw })
    const hours = num(get('hours'))
    const est = num(get('estimateHours'))
    if (Number.isNaN(hours) || Number.isNaN(est)) return errors.push({ row: rowNo, message: 'Hours must be a number', data: raw })
    const titles = splitLines ? titleCell.split(/\r?\n/).map((s) => s.replace(/^\s*(?:\d+[.)]|[-•*])\s+/, '').trim()).filter(Boolean) : [titleCell]
    titles.forEach((title, j) => {
      const candidate = {
        title, date, status: normaliseStatus(get('status')),
        hours: titles.length > 1 ? undefined : hours,
        estimateHours: est,
        ticketNo: get('ticketNo') != null && get('ticketNo') !== '' ? String(get('ticketNo')) : undefined,
        dueDate: get('dueDate') ? parseFlexibleDate(get('dueDate'), dateFormat) || undefined : undefined,
        projectName: get('project') ? String(get('project')).trim().slice(0, 60) : undefined,
        module: get('module') ? String(get('module')).trim() : undefined,
        priority: ['low', 'medium', 'high'].includes(String(get('priority')).toLowerCase()) ? String(get('priority')).toLowerCase() : undefined,
        tags: get('tags') ? String(get('tags')).split(/[,;]/).map((s) => s.trim()).filter(Boolean) : undefined,
        notes: get('notes') ? String(get('notes')) : undefined,
      }
      const res = taskFormSchema.safeParse(candidate)
      if (!res.success) return errors.push({ row: rowNo, message: res.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; '), data: raw })
      tasks.push({
        ...res.data, id: newId(), order: j, createdAt: now, updatedAt: now, deletedAt: null,
        completedAt: res.data.status === 'completed' ? now : undefined,
      })
    })
  })
  return { tasks, errors }
}

export function errorsToCsv(errors) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return ['Row,Problem,Data', ...errors.map((e) => [e.row, esc(e.message), esc(JSON.stringify(e.data))].join(','))].join('\r\n')
}
