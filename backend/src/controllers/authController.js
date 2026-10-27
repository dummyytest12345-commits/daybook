import bcrypt from 'bcryptjs'
import { signToken } from '../middleware/auth.js'
import { DayLog } from '../models/DayLog.js'
import { Project } from '../models/Project.js'
import { Settings, createDefaultSettings } from '../models/Settings.js'
import { Task } from '../models/Task.js'
import { User } from '../models/User.js'
import { acceptPendingInvites } from '../services/teamService.js'
import { conflict, notFound, unauthorized } from '../utils/httpError.js'

const ROUNDS = 12
const MAX_ATTEMPTS = 5
const LOCK_MS = 15 * 60 * 1000
// compared against when the email is unknown so response time does not reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', ROUNDS)

const session = (user) => ({ token: signToken(String(user._id)), user: user.toJSON() })

export async function register(req, res) {
  const { name, email, password } = req.body
  if (await User.exists({ email })) throw conflict('An account with this email already exists')
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, ROUNDS) })
  await createDefaultSettings(String(user._id))
  const joined = await acceptPendingInvites(user) // projects they were invited to by email
  res.status(201).json({ ...session(user), joinedProjects: joined.map((p) => ({ id: String(p._id), name: p.name })) })
}

export async function login(req, res) {
  const { email, password } = req.body
  const user = await User.findOne({ email }).select('+passwordHash +failedLogins +lockedUntil')
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const secs = Math.ceil((user.lockedUntil - Date.now()) / 1000)
    res.set('Retry-After', String(secs))
    throw Object.assign(unauthorized(`Too many attempts. Try again in ${Math.ceil(secs / 60)} min.`), { status: 429 })
  }
  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH)
  if (!user || !ok) {
    if (user) {
      user.failedLogins = (user.failedLogins || 0) + 1
      if (user.failedLogins >= MAX_ATTEMPTS) {
        user.failedLogins = 0
        user.lockedUntil = new Date(Date.now() + LOCK_MS)
      }
      await user.save()
    }
    throw unauthorized('Incorrect email or password')
  }
  user.failedLogins = 0
  user.lockedUntil = undefined
  user.lastLoginAt = new Date()
  await user.save()
  await acceptPendingInvites(user)
  res.json(session(user))
}

export async function me(req, res) {
  const user = await User.findById(req.userId)
  if (!user) throw unauthorized('Account no longer exists')
  res.json({ user: user.toJSON() })
}

export async function updateProfile(req, res) {
  const user = await User.findByIdAndUpdate(req.userId, { name: req.body.name }, { returnDocument: 'after' })
  if (!user) throw notFound('Account')
  res.json({ user: user.toJSON() })
}

export async function changePassword(req, res) {
  const user = await User.findById(req.userId).select('+passwordHash')
  if (!user) throw notFound('Account')
  if (!(await bcrypt.compare(req.body.current, user.passwordHash))) throw unauthorized('Current password is incorrect')
  user.passwordHash = await bcrypt.hash(req.body.next, ROUNDS)
  await user.save()
  res.json({ ok: true })
}

/** Deletes the account and every task, project, day log and setting that belongs to it. */
export async function deleteAccount(req, res) {
  const user = await User.findById(req.userId).select('+passwordHash')
  if (!user) throw notFound('Account')
  if (!(await bcrypt.compare(req.body.password, user.passwordHash))) throw unauthorized('Password is incorrect')
  const userId = String(user._id)
  await Promise.all([Task.deleteMany({ userId }), Project.deleteMany({ userId }), DayLog.deleteMany({ userId }), Settings.deleteOne({ _id: userId }), User.deleteOne({ _id: userId })])
  res.status(204).end()
}
