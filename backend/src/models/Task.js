import mongoose from 'mongoose'
import { newId, publicJson, stampEditTime } from './_plugin.js'

const updateSchema = new mongoose.Schema({ _id: { type: String, default: newId }, at: { type: Date, default: Date.now }, text: { type: String, maxlength: 1000 } })
const subtaskSchema = new mongoose.Schema({ _id: { type: String, default: newId }, title: String, done: { type: Boolean, default: false } })

const taskSchema = new mongoose.Schema(
  {
    _id: { type: String, default: newId },
    userId: { type: String, required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 500 },
    notes: String,
    status: { type: String, enum: ['pending', 'in_progress', 'blocked', 'completed'], default: 'pending' },
    /** 0-100. In Progress starts at 0, Completed is 100. */
    progress: { type: Number, min: 0, max: 100, default: 0 },
    hours: { type: Number, min: 0, max: 24 },
    estimateHours: { type: Number, min: 0, max: 240 },
    ticketNo: String,
    projectId: { type: String, default: null },
    number: Number,
    dueDate: String,
    module: String,
    tags: [String],
    priority: { type: String, enum: ['low', 'medium', 'high'] },
    subtasks: [subtaskSchema],
    order: { type: Number, default: 0 },
    timerStartedAt: Date,
    timerElapsedMs: Number,
    recurringId: String,
    completedAt: Date,
    // carry forward / threads
    carriedFrom: String,
    threadId: String,
    autoCarried: Boolean,
    carryDismissed: Boolean,
    resolvedBy: String,
    updates: [updateSchema],
    deletedAt: { type: Date, default: null },
    /** Time of the last edit on the device that wrote it (used for last-write-wins when syncing). */
    clientUpdatedAt: Date,
  },
  { timestamps: true },
)
taskSchema.index({ userId: 1, date: 1 })
taskSchema.index({ userId: 1, projectId: 1 })
taskSchema.index({ userId: 1, threadId: 1 })
taskSchema.index({ userId: 1, updatedAt: 1 })
taskSchema.set('toJSON', publicJson((r) => {
  r.updates = (r.updates || []).map((u) => ({ id: u._id, at: u.at, text: u.text }))
  r.subtasks = (r.subtasks || []).map((s) => ({ id: s._id, title: s.title, done: s.done }))
  return r
}))

taskSchema.plugin(stampEditTime)

export const Task = mongoose.model('Task', taskSchema)
