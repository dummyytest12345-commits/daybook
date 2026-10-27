import Papa from 'papaparse'
import { csvSafe } from '../../utils/csvSafe'
import { DAILY_COLUMNS, TASK_COLUMNS, buildDailyRows, buildTaskRows } from './dataset'

const BOM = '﻿'

/** Build CSV text (UTF-8 BOM added by toCsvBlob). Multi-line cells are quoted by papaparse. */
export function toCsv(rows, columns) {
  const fields = columns.map((c) => c.header)
  const data = rows.map((r) => columns.map((c) => csvSafe(r[c.key])))
  return Papa.unparse({ fields, data }, { newline: '\r\n', quotes: false })
}

export const toCsvBlob = (text) => new Blob([BOM, text], { type: 'text/csv;charset=utf-8' })

export function exportCsv(tasks, range, ctx, { layout = 'daily', columns } = {}) {
  if (layout === 'tasks') {
    const cols = columns ? TASK_COLUMNS.filter((c) => columns.includes(c.key)) : TASK_COLUMNS
    return toCsvBlob(toCsv(buildTaskRows(tasks, ctx), cols))
  }
  const cols = columns ? DAILY_COLUMNS.filter((c) => columns.includes(c.key)) : DAILY_COLUMNS
  return toCsvBlob(toCsv(buildDailyRows(tasks, range, ctx), cols))
}
