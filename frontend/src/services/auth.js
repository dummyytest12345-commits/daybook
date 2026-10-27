import { emailSchema, passwordSchema, storedUserSchema } from '../schemas/auth'
import { newId } from '../utils/id'
import { ROOT, adoptLegacyData, hasLegacyData, purgeUserData } from './repository/localStorageRepo'

/**
 * Local (on-device) accounts. Passwords are salted and hashed with PBKDF2-SHA256 via WebCrypto,
 * never stored in plain text. This separates users on one browser; it is not a substitute for
 * server-side auth, because anyone with access to the browser profile can read localStorage.
 */
const USERS_KEY = `${ROOT}users`
const SESSION_KEY = `${ROOT}session`
const LOCK_KEY = `${ROOT}lockout`
const ITERATIONS = 210_000
const MAX_ATTEMPTS = 5
const LOCK_MS = 30_000

export class AuthError extends Error {
  constructor(message, code, extra = {}) {
    super(message)
    this.code = code
    Object.assign(this, extra)
  }
}

const read = (store, key, fallback) => {
  try {
    const raw = store.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
const write = (store, key, value) => {
  try {
    store.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

export async function hashPassword(password, salt = b64(crypto.getRandomValues(new Uint8Array(16))), iterations = ITERATIONS) {
  if (!globalThis.crypto?.subtle) throw new AuthError('Secure crypto is unavailable. Open the app over HTTPS or localhost.', 'no-crypto')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations }, key, 256)
  return { salt, hash: b64(bits), iterations }
}

const safeEqual = (a, b) => {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export const listUsers = () => read(localStorage, USERS_KEY, []).filter((u) => storedUserSchema.safeParse(u).success)
const saveUsers = (users) => {
  if (!write(localStorage, USERS_KEY, users)) throw new AuthError('Could not save the account: browser storage is full or blocked.', 'storage')
}
export const publicUser = ({ id, name, email, createdAt }) => ({ id, name, email, createdAt })

/** Create an account, sign in, and (for the very first account) adopt any pre-accounts data. */
export async function registerUser({ name, email, password, remember = true }) {
  const e = emailSchema.parse(email)
  passwordSchema.parse(password)
  const users = listUsers()
  if (users.some((u) => u.email === e)) throw new AuthError('An account with this email already exists. Try signing in.', 'exists')
  const user = { id: newId(), name: name.trim(), email: e, ...(await hashPassword(password)), createdAt: new Date().toISOString() }
  const adopt = users.length === 0 && hasLegacyData()
  saveUsers([...users, user])
  if (adopt) adoptLegacyData(user.id)
  startSession(user.id, remember)
  return { user: publicUser(user), adopted: adopt }
}

/**
 * Sign-in is done by the server. This links a server account to this device: finds (or creates) the
 * local data profile for the email, drops any password hash kept from the old local-only accounts,
 * and starts the session. Only a login token is kept on the device, never the password.
 */
export function linkServerAccount(serverUser, remember = true) {
  const e = emailSchema.parse(serverUser.email)
  const users = listUsers()
  let u = users.find((x) => x.email === e)
  let adopt = false
  if (u) {
    delete u.salt
    delete u.hash
    delete u.iterations
    u.name = serverUser.name
  } else {
    u = { id: newId(), name: serverUser.name, email: e, createdAt: serverUser.createdAt || new Date().toISOString() }
    adopt = users.length === 0 && hasLegacyData()
    users.push(u)
  }
  saveUsers(users)
  if (adopt) adoptLegacyData(u.id)
  startSession(u.id, remember)
  return { user: publicUser(u), adopted: adopt }
}

/** An old local-only account (with a password hash) that matches these credentials, or null. */
export async function legacyAccount(email, password) {
  const u = listUsers().find((x) => x.email === email.trim().toLowerCase())
  if (!u?.hash) return null
  const { hash } = await hashPassword(password, u.salt, u.iterations)
  return safeEqual(hash, u.hash) ? publicUser(u) : null
}

export function renameLocal(userId, name) {
  const users = listUsers()
  const u = users.find((x) => x.id === userId)
  if (u) {
    u.name = name.trim()
    saveUsers(users)
  }
  return u ? publicUser(u) : null
}

export function removeLocalAccount(userId) {
  saveUsers(listUsers().filter((x) => x.id !== userId))
  purgeUserData(userId)
  clearSession()
}

/** Check the old local password (accounts that have not moved to the server). */
export async function verifyPassword(userId, password) {
  const u = listUsers().find((x) => x.id === userId)
  if (!u?.hash) return
  const { hash } = await hashPassword(password, u.salt, u.iterations)
  if (!safeEqual(hash, u.hash)) throw new AuthError('Password is incorrect.', 'invalid')
}

const locks = () => read(localStorage, LOCK_KEY, {})

export function lockRemaining(email) {
  const l = locks()[email]
  return l?.until && l.until > Date.now() ? Math.ceil((l.until - Date.now()) / 1000) : 0
}

/** Verify credentials. After 5 wrong attempts the email is locked for 30s (stops rapid guessing). */
export async function loginUser({ email, password, remember = true }) {
  const e = emailSchema.parse(email)
  const wait = lockRemaining(e)
  if (wait) throw new AuthError(`Too many attempts. Try again in ${wait}s.`, 'locked', { wait })
  const user = listUsers().find((u) => u.email === e)
  // hash even when the user is missing so response time doesn't reveal which emails exist
  const { hash } = await hashPassword(password, user?.salt, user?.iterations)
  if (!user || !safeEqual(hash, user.hash)) {
    const all = locks()
    const cur = all[e] || { count: 0 }
    const count = cur.count + 1
    all[e] = count >= MAX_ATTEMPTS ? { count: 0, until: Date.now() + LOCK_MS } : { count }
    write(localStorage, LOCK_KEY, all)
    throw new AuthError('Incorrect email or password.', 'invalid')
  }
  const all = locks()
  delete all[e]
  write(localStorage, LOCK_KEY, all)
  startSession(user.id, remember)
  return publicUser(user)
}

/** "Remember me" keeps the session in localStorage; otherwise it ends with the browser tab. */
function startSession(userId, remember) {
  clearSession()
  write(remember ? localStorage : sessionStorage, SESSION_KEY, { userId, at: Date.now(), remember })
}
export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

/** The signed-in user (or null). A session pointing to a deleted account is discarded. */
export function currentUser() {
  const s = read(sessionStorage, SESSION_KEY, null) || read(localStorage, SESSION_KEY, null)
  if (!s?.userId) return null
  const u = listUsers().find((x) => x.id === s.userId)
  if (!u) {
    clearSession()
    return null
  }
  return publicUser(u)
}

export async function changePassword(userId, current, next) {
  passwordSchema.parse(next)
  const users = listUsers()
  const u = users.find((x) => x.id === userId)
  if (!u) throw new AuthError('Account not found.', 'missing')
  const { hash } = await hashPassword(current, u.salt, u.iterations)
  if (!safeEqual(hash, u.hash)) throw new AuthError('Current password is incorrect.', 'invalid')
  Object.assign(u, await hashPassword(next))
  saveUsers(users)
}

export function updateProfile(userId, { name }) {
  const users = listUsers()
  const u = users.find((x) => x.id === userId)
  if (!u) throw new AuthError('Account not found.', 'missing')
  u.name = name.trim()
  saveUsers(users)
  return publicUser(u)
}

/** Permanently remove the account and every task/setting stored under it. */
export async function deleteAccount(userId, password) {
  const u = listUsers().find((x) => x.id === userId)
  if (!u) throw new AuthError('Account not found.', 'missing')
  const { hash } = await hashPassword(password, u.salt, u.iterations)
  if (!safeEqual(hash, u.hash)) throw new AuthError('Password is incorrect.', 'invalid')
  saveUsers(listUsers().filter((x) => x.id !== userId))
  purgeUserData(userId)
  clearSession()
}

export const SESSION_STORAGE_KEY = SESSION_KEY
export const USERS_STORAGE_KEY = USERS_KEY
