export const fmtHours = (n) => {
  const v = Math.round((n || 0) * 100) / 100
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}
export const fmtPct = (n) => `${Math.round((n || 0) * 100)}%`
export const pluralize = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
export const fmtDuration = (ms) => {
  const s = Math.floor(ms / 1000)
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return `${h}:${m}:${sec}`
}
export const cn = (...a) => a.filter(Boolean).join(' ')
export const download = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
