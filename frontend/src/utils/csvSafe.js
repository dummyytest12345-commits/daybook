/** Prevent spreadsheet formula injection: cells starting with = + - @ get a leading '. */
export function csvSafe(value) {
  if (value == null) return ''
  const s = String(value)
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
}
