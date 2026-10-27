/** Read the first worksheet of an .xlsx File. ExcelJS is loaded on demand. */
export async function parseXlsx(file) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await file.arrayBuffer())
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('The workbook has no sheets')
  const headers = []
  ws.getRow(1).eachCell({ includeEmpty: false }, (c, n) => (headers[n - 1] = String(cellValue(c.value)).trim()))
  const rows = []
  ws.eachRow((row, n) => {
    if (n === 1) return
    const obj = {}
    let any = false
    headers.forEach((h, i) => {
      if (!h) return
      const v = cellValue(row.getCell(i + 1).value)
      if (v !== '' && v != null) any = true
      obj[h] = v
    })
    if (any) rows.push(obj)
  })
  return { headers: headers.filter(Boolean), rows }
}

/** Flatten ExcelJS rich values (dates, formulas, rich text, hyperlinks) to plain values. */
function cellValue(v) {
  if (v == null) return ''
  if (v instanceof Date) return v
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((r) => r.text).join('')
    if ('result' in v) return cellValue(v.result)
    if (v.text) return v.text
    return ''
  }
  return v
}
