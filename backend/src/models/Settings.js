import mongoose from 'mongoose'
import { stampEditTime } from './_plugin.js'

export const DEFAULT_STATUSES = [
  { id: 'pending', label: 'Pending', color: '#64748b' },
  { id: 'in_progress', label: 'In Progress', color: '#d97706' },
  { id: 'blocked', label: 'Blocked', color: '#dc2626' },
  { id: 'completed', label: 'Completed', color: '#16a34a' },
]

const settingsSchema = new mongoose.Schema(
  {
    _id: { type: String }, // = userId: one settings document per user
    weekStartsOn: { type: Number, enum: [0, 1], default: 1 },
    dailyCapacity: { type: Number, default: 8, min: 1, max: 24 },
    dateFormat: { type: String, enum: ['dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'], default: 'dd/MM/yyyy' },
    hoursMode: { type: String, enum: ['equal', 'manual', 'timer'], default: 'equal' },
    statuses: { type: [{ _id: false, id: String, label: String, color: String }], default: DEFAULT_STATUSES },
    modules: { type: [String], default: ['Profile', 'Consent', 'Testing', 'Responsive'] },
    holidays: { type: [{ _id: false, date: String, name: String }], default: [] },
    reminderTime: { type: String, default: null },
    dailyGoalTasks: { type: Number, default: 5 },
    autoCarry: { type: Boolean, default: true },
    threadResolve: { type: String, enum: ['all', 'none'], default: 'all' },
    carryMaxDays: { type: Number, default: 21, min: 1, max: 365 },
    recurring: { type: [{ _id: false, id: String, title: String, module: String, hours: Number, weekdays: [Number], active: { type: Boolean, default: true } }], default: [] },
    views: { type: [{ _id: false, id: String, name: String, filters: mongoose.Schema.Types.Mixed }], default: [] },
    clientUpdatedAt: Date,
  },
  { timestamps: true },
)
settingsSchema.set('toJSON', {
  versionKey: false,
  transform(_d, r) {
    delete r._id
    return r
  },
})

settingsSchema.plugin(stampEditTime)

export const Settings = mongoose.model('Settings', settingsSchema)

/** Default settings for a new account. Stamped with the epoch so ANY real edit from a device wins over them. */
export async function createDefaultSettings(userId) {
  const s = new Settings({ _id: userId, clientUpdatedAt: new Date(0) })
  s.$locals.skipStamp = true
  await s.save()
  return s
}
