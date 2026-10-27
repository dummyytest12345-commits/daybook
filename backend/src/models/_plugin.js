import { nanoid } from 'nanoid'

export const newId = () => nanoid(12)

/**
 * Every normal (REST) write stamps clientUpdatedAt = now, so "when was this last edited" is always
 * answerable for sync's last-write-wins. Sync's own native bulk writes bypass these hooks on purpose
 * and set the editing device's own time instead.
 */
export function stampEditTime(schema) {
  schema.pre('save', function stamp() {
    if (this.$locals?.skipStamp) return // generated defaults are not a user edit
    this.clientUpdatedAt = new Date()
  })
  for (const op of ['findOneAndUpdate', 'updateOne', 'updateMany']) {
    schema.pre(op, function stampQuery() {
      this.set({ clientUpdatedAt: new Date() })
    })
  }
}

/** Public JSON shape: `id` instead of `_id`, no owner id, no __v. */
export function publicJson(extra) {
  return {
    versionKey: false,
    transform(_doc, ret) {
      ret.id = ret._id
      delete ret._id
      delete ret.userId
      return extra ? extra(ret) : ret
    },
  }
}
