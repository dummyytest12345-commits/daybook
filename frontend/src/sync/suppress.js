/** Changes applied inside `untracked()` (data coming from the server or another tab) are not recorded as local edits. */
let suppressed = 0
export const isSuppressed = () => suppressed > 0
export function untracked(fn) {
  suppressed++
  try {
    return fn()
  } finally {
    suppressed--
  }
}
