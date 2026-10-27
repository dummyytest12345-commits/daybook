import mongoose from 'mongoose'
import { newId, publicJson } from './_plugin.js'

const userSchema = new mongoose.Schema(
  {
    _id: { type: String, default: newId },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true, maxlength: 120 },
    passwordHash: { type: String, required: true, select: false },
    failedLogins: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, select: false },
    lastLoginAt: Date,
  },
  { timestamps: true },
)
userSchema.set('toJSON', publicJson((r) => {
  delete r.passwordHash
  delete r.failedLogins
  delete r.lockedUntil
  return r
}))

export const User = mongoose.model('User', userSchema)
