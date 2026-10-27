import mongoose from 'mongoose'
import { newId, publicJson, stampEditTime } from './_plugin.js'

const projectSchema = new mongoose.Schema(
  {
    _id: { type: String, default: newId },
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    key: { type: String, required: true, uppercase: true, match: /^[A-Z][A-Z0-9]{1,5}$/ },
    description: { type: String, maxlength: 2000 },
    color: { type: String, default: '#4f46e5' },
    icon: { type: String, default: 'cube' },
    status: { type: String, enum: ['active', 'on_hold', 'completed'], default: 'active' },
    favorite: { type: Boolean, default: false },
    startDate: String,
    targetDate: String,
    wipLimits: { type: Map, of: Number, default: {} },
    nextNumber: { type: Number, default: 1, min: 1 },
    archivedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    clientUpdatedAt: Date,
  },
  { timestamps: true },
)
// a key is unique among a user's live projects
projectSchema.index({ userId: 1, key: 1 }, { unique: true, partialFilterExpression: { deletedAt: null } })
projectSchema.set('toJSON', publicJson((r) => {
  if (r.wipLimits instanceof Map) r.wipLimits = Object.fromEntries(r.wipLimits)
  return r
}))

projectSchema.plugin(stampEditTime)

export const Project = mongoose.model('Project', projectSchema)
