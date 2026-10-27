import mongoose from 'mongoose'
import { stampEditTime } from './_plugin.js'

const dayLogSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    dayType: { type: String, enum: ['work', 'weekend', 'leave', 'holiday'] },
    capacityHours: { type: Number, min: 0, max: 24, default: 8 },
    note: { type: String, maxlength: 2000 },
    mood: { type: Number, min: 1, max: 5 },
    clientUpdatedAt: Date,
  },
  { timestamps: true },
)
dayLogSchema.index({ userId: 1, date: 1 }, { unique: true })
dayLogSchema.set('toJSON', {
  versionKey: false,
  transform(_d, r) {
    delete r._id
    delete r.userId
    return r
  },
})

dayLogSchema.plugin(stampEditTime)

export const DayLog = mongoose.model('DayLog', dayLogSchema)
