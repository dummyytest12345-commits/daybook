import { csvSafe } from '../../utils/csvSafe'
import { summarize } from '../../selectors/summarize'
import { trend } from '../../selectors/groupBy'
import { projectBreakdown } from '../../selectors/projects'
import { DAILY_COLUMNS, buildDailyRows, buildTaskRows, rangeText, statusLabel } from './dataset'

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
const GREY_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
const STATUS_FILL = {
  completed: 'FFDCFCE7', in_progress: 'FFFEF3C7', pending: 'FFE2E8F0', blocked: 'FFFEE2E2',
}
const thin = { style: 'thin', color: { argb: 'FFE2E8F0' } }
const BORDER = { top: thin, left: thin, bottom: thin, right: thin }

function styleHeader(row) {
  row.eachCell((c) => {
    c.fill = HEADER_FILL
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    c.border = BORDER
  })
  row.height = 22
}

function addTable(ws, columns, rows, { totalCols = [] } = {}) {
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 14 }))
  styleHeader(ws.getRow(1))
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  rows.forEach((r) => ws.addRow(r))
  ws.eachRow((row, n) => {
    if (n === 1) return
    row.eachCell((c) => {
      c.border = BORDER
      c.alignment = { vertical: 'top', wrapText: true }
    })
  })
  if (totalCols.length && rows.length) {
    const last = rows.length + 1
    const totalRow = ws.addRow({})
    totalRow.getCell(1).value = 'Total'
    totalCols.forEach((key) => {
      const idx = columns.findIndex((c) => c.key === key) + 1
      const col = ws.getColumn(idx).letter
      totalRow.getCell(idx).value = { formula: `SUM(${col}2:${col}${last})` }
    })
    totalRow.font = { bold: true }
    totalRow.eachCell({ includeEmpty: true }, (c) => {
      c.border = BORDER
      c.fill = GREY_FILL
    })
  }
}

/** Multi-sheet workbook: Log, Daily Summary, Weekly, Monthly, Analytics (+ Tasks flat). */
export async function exportXlsx(tasks, range, ctx, { sheets } = {}) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Daybook'
  wb.created = new Date()
  const want = (n) => !sheets || sheets.includes(n)

  if (want('Log')) {
    const ws = wb.addWorksheet('Log')
    const rows = buildDailyRows(tasks, range, ctx).map((r) => ({ ...r, tasksText: csvSafe(r.tasksText) }))
    addTable(ws, DAILY_COLUMNS, rows, { totalCols: ['count', 'hours'] })
    rows.forEach((r, i) => {
      const row = ws.getRow(i + 2)
      if (r.dayType !== 'work') {
        row.eachCell((c) => {
          c.fill = GREY_FILL
          c.font = { italic: true, color: { argb: 'FF64748B' } }
        })
      }
      const sc = row.getCell(7)
      if (STATUS_FILL[r.status]) sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_FILL[r.status] } }
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'top' }
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'top' }
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'top' }
    })
  }

  if (want('Tasks')) {
    const ws = wb.addWorksheet('Tasks')
    const cols = [
      { key: 'dateText', header: 'Date', width: 13 }, { key: 'day', header: 'Day', width: 12 },
      { key: 'ref', header: 'ID', width: 11 }, { key: 'projectName', header: 'Project', width: 18 }, { key: 'title', header: 'Task', width: 50 },
      { key: 'module', header: 'Module', width: 14 }, { key: 'statusText', header: 'Status', width: 13 },
      { key: 'priority', header: 'Priority', width: 10 }, { key: 'hours', header: 'Hours', width: 8 },
      { key: 'estimateHours', header: 'Estimate', width: 9 }, { key: 'dueText', header: 'Due', width: 12 }, { key: 'tagsText', header: 'Tags', width: 18 },
      { key: 'notes', header: 'Notes', width: 40 },
    ]
    const rows = buildTaskRows(tasks, ctx).map((r) => ({ ...r, title: csvSafe(r.title), notes: csvSafe(r.notes) }))
    addTable(ws, cols, rows, { totalCols: ['hours'] })
    rows.forEach((r, i) => {
      const fill = STATUS_FILL[r.status]
      if (fill) ws.getRow(i + 2).getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
    })
  }

  if (want('Projects') && ctx.projects?.some((p) => !p.deletedAt)) {
    const ws = wb.addWorksheet('Projects')
    const rows = projectBreakdown(tasks, ctx.projects, ctx).map((r) => ({ key: r.key, name: r.name, count: r.count, completed: r.completed, rate: r.count ? r.completed / r.count : 0, hours: r.hours }))
    addTable(ws, [
      { key: 'key', header: 'Key', width: 9 }, { key: 'name', header: 'Project', width: 28 }, { key: 'count', header: 'Tasks', width: 9 },
      { key: 'completed', header: 'Completed', width: 11 }, { key: 'rate', header: 'Done %', width: 9 }, { key: 'hours', header: 'Hours', width: 9 },
    ], rows, { totalCols: ['count', 'completed', 'hours'] })
    ws.getColumn(5).numFmt = '0%'
  }

  const seriesSheet = (name, groupBy, label) => {
    if (!want(name)) return
    const ws = wb.addWorksheet(name)
    const cols = [
      { key: 'label', header: label, width: 14 }, { key: 'total', header: 'Tasks', width: 9 },
      { key: 'completed', header: 'Completed', width: 11 }, { key: 'in_progress', header: 'In Progress', width: 12 },
      { key: 'pending', header: 'Pending', width: 9 }, { key: 'blocked', header: 'Blocked', width: 9 },
      { key: 'hours', header: 'Hours', width: 9 }, { key: 'capacity', header: 'Capacity', width: 10 },
    ]
    addTable(ws, cols, trend(tasks, range, groupBy, ctx), { totalCols: ['total', 'completed', 'in_progress', 'pending', 'blocked', 'hours', 'capacity'] })
  }
  seriesSheet('Daily Summary', 'day', 'Date')
  seriesSheet('Weekly', 'week', 'Week of')
  seriesSheet('Monthly', 'month', 'Month')

  if (want('Analytics')) {
    const s = summarize(tasks, range, { ...ctx, allTasks: ctx.allTasks || tasks })
    const ws = wb.addWorksheet('Analytics')
    const rows = [
      ['Range', rangeText(range, ctx.settings.dateFormat)],
      ['Total tasks', s.total],
      ...['completed', 'inProgress', 'pending', 'blocked'].map((k) => [statusLabel(ctx.settings, k === 'inProgress' ? 'in_progress' : k), s[k]]),
      ['Completion %', s.completionRate],
      ['Hours logged', s.hours],
      ['Capacity hours', s.capacity],
      ['Utilisation %', s.utilisation],
      ['Working days', s.workingDays],
      ['Avg tasks / working day', s.avgTasksPerDay],
      ['Velocity (completed / working day)', s.velocity],
      ['Current streak (days)', s.streak],
    ]
    ws.columns = [{ header: 'Metric', key: 'k', width: 38 }, { header: 'Value', key: 'v', width: 26 }]
    styleHeader(ws.getRow(1))
    rows.forEach(([k, v]) => ws.addRow({ k, v }))
    ws.eachRow((row, n) => {
      if (n === 1) return
      row.eachCell((c) => (c.border = BORDER))
      const k = row.getCell(1).value
      if (String(k).includes('%')) row.getCell(2).numFmt = '0%'
    })
  }

  const buf = await wb.xlsx.writeBuffer()
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
