import mongoose from 'mongoose'
import { newId } from './_plugin.js'

/** Shared ("team") projects live apart from personal projects, so personal data stays private. */
const memberSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    role: { type: String, enum: ['owner', 'editor', 'viewer'], default: 'editor' },
    addedBy: String,
    addedAt: { type: Date, default: Date.now },
    lastReadAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const teamProjectSchema = new mongoose.Schema(
  {
    _id: { type: String, default: newId },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    key: { type: String, required: true, uppercase: true, match: /^[A-Z][A-Z0-9]{1,5}$/ },
    description: { type: String, maxlength: 2000 },
    color: { type: String, default: '#4f46e5' },
    icon: { type: String, default: 'cube' },
    ownerId: { type: String, required: true, index: true },
    members: { type: [memberSchema], default: [] },
    nextNumber: { type: Number, default: 1 },
    archivedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
)
teamProjectSchema.index({ 'members.userId': 1, deletedAt: 1 })
// keep ownerId visible: members already carry the role, but clients need it for convenience
teamProjectSchema.set('toJSON', {
  versionKey: false,
  transform(_d, r) {
    r.id = r._id
    delete r._id
    return r
  },
})

const contributionSchema = new mongoose.Schema({ userId: String, progress: { type: Number, min: 0, max: 100, default: 0 }, note: { type: String, maxlength: 500 }, at: { type: Date, default: Date.now } }, { _id: false })

const teamTaskSchema = new mongoose.Schema(
  {
    _id: { type: String, default: newId },
    teamProjectId: { type: String, required: true, index: true },
    number: Number,
    title: { type: String, required: true, trim: true, maxlength: 500 },
    notes: { type: String, maxlength: 10000 },
    status: { type: String, enum: ['pending', 'in_progress', 'blocked', 'completed'], default: 'pending' },
    /** Overall progress: the mean of the assignees' own progress, or set directly when nobody is assigned. */
    progress: { type: Number, min: 0, max: 100, default: 0 },
    assignees: { type: [String], default: [] },
    contributions: { type: [contributionSchema], default: [] },
    dueDate: String,
    priority: { type: String, enum: ['low', 'medium', 'high'] },
    order: { type: Number, default: 0 },
    createdBy: { type: String, required: true },
    completedAt: Date,
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
)
teamTaskSchema.index({ teamProjectId: 1, deletedAt: 1, order: 1 })
teamTaskSchema.set('toJSON', {
  versionKey: false,
  transform(_d, r) {
    r.id = r._id
    delete r._id
    return r
  },
})

const messageSchema = new mongoose.Schema(
  {
    _id: { type: String, default: newId },
    teamProjectId: { type: String, required: true },
    taskId: { type: String, default: null },
    userId: { type: String, required: true },
    type: { type: String, enum: ['user', 'system'], default: 'user' },
    text: { type: String, required: true, maxlength: 2000 },
    meta: mongoose.Schema.Types.Mixed,
    reactions: { type: [{ _id: false, emoji: String, userIds: [String] }], default: [] },
    editedAt: Date,
    deletedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)
messageSchema.index({ teamProjectId: 1, taskId: 1, createdAt: -1 })
messageSchema.set('toJSON', {
  versionKey: false,
  transform(_d, r) {
    r.id = r._id
    delete r._id
    if (r.deletedAt) r.text = ''
    return r
  },
})

const inviteSchema = new mongoose.Schema(
  {
    _id: { type: String, default: newId },
    email: { type: String, required: true, lowercase: true, trim: true },
    teamProjectId: { type: String, required: true },
    invitedBy: { type: String, required: true },
    role: { type: String, enum: ['editor', 'viewer'], default: 'editor' },
    token: { type: String, required: true, unique: true },
    status: { type: String, enum: ['pending', 'accepted', 'revoked'], default: 'pending' },
    expiresAt: { type: Date, required: true },
    acceptedBy: String,
    sentCount: { type: Number, default: 1 },
  },
  { timestamps: true },
)
inviteSchema.index({ email: 1, status: 1 })
inviteSchema.index({ teamProjectId: 1, email: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } })
inviteSchema.set('toJSON', {
  versionKey: false,
  transform(_d, r) {
    r.id = r._id
    delete r._id
    delete r.token
    return r
  },
})

const notificationSchema = new mongoose.Schema(
  {
    _id: { type: String, default: newId },
    userId: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, maxlength: 500 },
    link: String,
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)
notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.set('toJSON', {
  versionKey: false,
  transform(_d, r) {
    r.id = r._id
    delete r._id
    delete r.userId
    return r
  },
})

export const TeamProject = mongoose.model('TeamProject', teamProjectSchema)
export const TeamTask = mongoose.model('TeamTask', teamTaskSchema)
export const Message = mongoose.model('Message', messageSchema)
export const Invite = mongoose.model('Invite', inviteSchema)
export const Notification = mongoose.model('Notification', notificationSchema)
