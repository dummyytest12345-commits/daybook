/** All dates are 'YYYY-MM-DD' strings (no time zones), exactly like the frontend. */
export const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const parse = (s) => new Date(`${s}T00:00:00Z`)
export const isValidISO = (s) => typeof s === 'string' && ISO_RE.test(s) && !Number.isNaN(parse(s).getTime()) && parse(s).toISOString().slice(0, 10) === s
export const addDays = (s, n) => new Date(parse(s).getTime() + n * 86400000).toISOString().slice(0, 10)
export const diffDays = (a, b) => Math.round((parse(a).getTime() - parse(b).getTime()) / 86400000)
export const isWeekend = (s) => [0, 6].includes(parse(s).getUTCDay())
export const todayISO = () => new Date().toISOString().slice(0, 10)
