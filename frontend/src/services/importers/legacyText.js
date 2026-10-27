import { newId } from '../../utils/id'
import { todayISO } from '../../utils/date'
import { normaliseStatus } from './normalise'

const MARKER = /(?:[.…\s-]*)\b(working|completed|complete|done|pending|blocked|in progress|wip)\b[.…\s]*\d*\s*$/i

/**
 * Parse pasted legacy notes like:
 *   15 (responsive) … Working..1
 *   73 Profile page fix Completed
 * The leading number becomes the ticket, the Working/Completed marker the status,
 * the remaining text the title. Each line is one task. Returns { tasks, errors }.
 */
export function parseLegacyText(text, { date = todayISO() } = {}) {
  const tasks = []
  const errors = []
  const now = new Date().toISOString()
  text.split(/\r?\n/).forEach((line, i) => {
    let s = line.trim()
    if (!s) return
    let status = 'pending'
    const m = MARKER.exec(s)
    if (m) {
      status = normaliseStatus(m[1])
      s = s.slice(0, m.index).trim()
    } else {
      s = s.replace(/[.…]+\s*\d*\s*$/, '').trim()
    }
    let ticketNo
    const t = /^(?:#|no\.?\s*)?(\d+)\s*[-–.):]?\s+(.*)$/i.exec(s)
    if (t) {
      ticketNo = t[1]
      s = t[2]
    }
    s = s.replace(/^[\s.…]+|[\s.…]+$/g, '')
    if (!s) return errors.push({ row: i + 1, message: 'No task text found', data: { line } })
    tasks.push({
      id: newId(), date, title: s, status, ticketNo, order: tasks.length,
      completedAt: status === 'completed' ? now : undefined,
      createdAt: now, updatedAt: now, deletedAt: null,
    })
  })
  return { tasks, errors }
}
