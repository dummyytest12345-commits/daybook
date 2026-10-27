import { describe, expect, it } from 'vitest'
import { T, ctx } from './helpers'
import { activeToken, applySuggestion, parseQuickAdd, parseQuickAddMany } from '../utils/quickAdd'
import { csvSafe } from '../utils/csvSafe'
import { parseFlexibleDate } from '../utils/date'
import { parseLegacyText } from '../services/importers/legacyText'
import { autoMap, normaliseStatus, rowsToTasks } from '../services/importers/normalise'
import { parseCsv, SAMPLE_CSV } from '../services/importers/csv'
import { toCsv } from '../services/exporters/csv'
import { DAILY_COLUMNS, buildDailyRows } from '../services/exporters/dataset'
import { standup, toMarkdown } from '../services/exporters/markdown'
import { taskSchema } from '../schemas/task'

describe('quick add', () => {
  it('parses tokens', () => {
    const r = parseQuickAdd('Fix profile bug tomorrow 2h #consent !high @FE-122', {
      today: '2026-09-07',
      modules: ['Consent'],
    })
    // only symbol tokens become fields; the rest of the text is kept exactly as typed
    expect(r).toMatchObject({ title: 'Fix profile bug tomorrow 2h', module: 'Consent', priority: 'high', ticketNo: 'FE-122' })
    expect(r.date).toBeUndefined()
    expect(r.hours).toBeUndefined()
  })
  it('keeps text, spacing and case as typed', () => {
    expect(parseQuickAdd('Fix  API (v2) in Friday meeting').title).toBe('Fix API (v2) in Friday meeting')
    expect(parseQuickAdd('Call Bob #Work').title).toBe('Call Bob')
  })
  it('natural words are opt-in', () => {
    const r = parseQuickAdd('Fix bug tomorrow 2h', { today: '2026-09-07', natural: true })
    expect(r).toMatchObject({ title: 'Fix bug', date: '2026-09-08', hours: 2 })
  })
  it('splits on comma, semicolon, pipe and new lines', () => {
    const list = parseQuickAddMany('Fix login #auth !high, Review copy ~WEB; Write docs | Plan sprint\n, ,  ', { projects: [{ id: 'p1', key: 'WEB', name: 'Website' }] })
    expect(list.map((x) => x.title)).toEqual(['Fix login', 'Review copy', 'Write docs', 'Plan sprint'])
    expect(list[0]).toMatchObject({ module: 'Auth', priority: 'high' })
    expect(list[1].projectId).toBe('p1')
  })
  it('finds and replaces the symbol being typed', () => {
    const text = 'Fix bug, Review #con'
    const tok = activeToken(text)
    expect(tok).toMatchObject({ trigger: '#', query: 'con', start: 16 })
    expect(applySuggestion(text, tok, 'Consent')).toEqual({ text: 'Fix bug, Review #Consent ', caret: 25 })
    expect(activeToken('plain words')).toBeNull()
    expect(activeToken('email a@b.com')).toBeNull()
    expect(activeToken('Fix #a', 3)).toBeNull()
  })
  it('keeps plain title', () => expect(parseQuickAdd('Just text').title).toBe('Just text'))
})

describe('csv safety', () => {
  it('prefixes formula cells', () => {
    expect(csvSafe('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvSafe('-1+1')).toBe("'-1+1")
    expect(csvSafe('normal')).toBe('normal')
  })
  it('quotes multi-line cells', () => {
    const rows = buildDailyRows(
      [T({ title: 'A' }), T({ title: 'B' })],
      { start: '2026-09-07', end: '2026-09-07' },
      ctx(),
    )
    expect(toCsv(rows, DAILY_COLUMNS)).toContain('"1. A\n2. B"')
  })
})

describe('dates', () => {
  it('parses per format', () => {
    expect(parseFlexibleDate('03/04/2026', 'dd/MM/yyyy')).toBe('2026-04-03')
    expect(parseFlexibleDate('03/04/2026', 'MM/dd/yyyy')).toBe('2026-03-04')
    expect(parseFlexibleDate('2026-09-01')).toBe('2026-09-01')
    expect(parseFlexibleDate(46266)).toBe('2026-09-01')
    expect(parseFlexibleDate('garbage')).toBeNull()
  })
})

describe('import', () => {
  it('normalises status', () => {
    expect(normaliseStatus('Done')).toBe('completed')
    expect(normaliseStatus('Working')).toBe('in_progress')
    expect(normaliseStatus('???')).toBe('pending')
  })
  it('imports sample CSV, splits multi-line cells', async () => {
    const { headers, rows } = await parseCsv(SAMPLE_CSV)
    const { tasks, errors } = rowsToTasks(rows, autoMap(headers), { dateFormat: 'yyyy-MM-dd' })
    expect(errors).toHaveLength(0)
    expect(tasks).toHaveLength(4)
    expect(tasks.every((t) => taskSchema.safeParse(t).success)).toBe(true)
  })
  it('reports bad rows instead of dropping them', () => {
    const { tasks, errors } = rowsToTasks(
      [{ Date: 'nope', Task: 'x' }, { Date: '2026-09-01', Task: '' }],
      { date: 'Date', title: 'Task' },
    )
    expect(tasks).toHaveLength(0)
    expect(errors).toHaveLength(2)
  })
  it('parses legacy text', () => {
    const { tasks } = parseLegacyText('15 (responsive) … Working..1\n73 Profile fix Completed', { date: '2026-09-01' })
    expect(tasks[0]).toMatchObject({ ticketNo: '15', title: '(responsive)', status: 'in_progress' })
    expect(tasks[1]).toMatchObject({ ticketNo: '73', title: 'Profile fix', status: 'completed' })
  })
})

describe('markdown', () => {
  it('renders report and standup', () => {
    const c = ctx()
    const md = toMarkdown([T({ status: 'completed', title: 'Ship it' })], { start: '2026-09-07', end: '2026-09-07' }, c)
    expect(md).toContain('Ship it')
    const s = standup(
      [T({ date: '2026-09-04', title: 'Old' }), T({ date: '2026-09-07', title: 'New', status: 'blocked' })],
      c,
      '2026-09-07',
    )
    expect(s).toContain('Old')
    expect(s).toContain('**Blockers**')
  })
})

import { filterSuggestions } from '../hooks/useSuggestions'
describe('suggestions', () => {
  const sources = { '#': [{ value: 'Consent', label: 'Consent' }, { value: 'Profile', label: 'Profile' }], '!': [{ value: 'high', label: 'high' }] }
  it('prefix matches first, hides exact matches, empty query lists the top options', () => {
    expect(filterSuggestions(sources, { trigger: '#', query: 'co' }).map((o) => o.value)).toEqual(['Consent'])
    expect(filterSuggestions(sources, { trigger: '#', query: 'file' }).map((o) => o.value)).toEqual(['Profile'])
    expect(filterSuggestions(sources, { trigger: '#', query: 'consent' })).toEqual([])
    expect(filterSuggestions(sources, { trigger: '!', query: '' })).toHaveLength(1)
    expect(filterSuggestions(sources, null)).toEqual([])
  })
})
