/** Fast non-crypto string hash (djb2) used for duplicate detection. */
export function hashString(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
export const taskHash = (t) =>
  hashString(`${t.date}|${(t.title || '').trim().toLowerCase()}|${(t.ticketNo || '').trim().toLowerCase()}`)
