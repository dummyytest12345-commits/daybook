import { create } from 'zustand'
import * as auth from '../services/auth'
import { ApiError, api, saveCloud, setCloudScope } from '../team/api'
import { useStore } from './useStore'
import { useUI } from './useUI'
import { useTeam } from '../team/useTeam'

/**
 * Keeps the loading animation on screen for at least `ms` (and avoids a flash on fast devices).
 * The signed-in state is only published after this delay, so the route does not change under the loader.
 */
async function holdMin(promise, ms) {
  const [res] = await Promise.allSettled([promise, new Promise((r) => setTimeout(r, ms))])
  if (res.status === 'rejected') throw res.reason
  return res.value
}
const MIN_LOADER_MS = 700

/**
 * The session lives in localStorage, so whether someone is signed in is known synchronously.
 * Signed-out visitors start as 'anon' (no loading screen, immediate redirect to /login);
 * only a signed-in user waits as 'loading' while their data is opened.
 */
const hasSession = (() => {
  try {
    return !!auth.currentUser()
  } catch {
    return false
  }
})()

const hasToken = () => !!useTeam.getState().cloud?.token

/** Calls the server auth endpoint and maps failures to the codes the sign-in form understands. */
async function serverAuth(path, body) {
  try {
    return await api.post(path, body, { token: null })
  } catch (e) {
    if (!(e instanceof ApiError)) throw e
    if (e.status === 0) throw new auth.AuthError('You are offline. Signing in needs a connection. If you were already signed in on this device, just reopen the app.', 'offline')
    if (e.status === 429) throw new auth.AuthError(e.message, 'locked', { wait: 60 })
    if (e.status === 401) throw new auth.AuthError('Incorrect email or password.', 'invalid')
    throw new auth.AuthError(e.message, e.status === 409 ? 'exists' : 'server')
  }
}

/** Auth state. Signing in opens that user's data; signing out wipes everything from memory. */
export const useAuth = create((set, get) => ({
  status: hasSession ? 'loading' : 'anon', // 'loading' (signed in, opening data) | 'anon' | 'authed'
  user: null,
  adoptedLegacy: false,
  /** The session ended without the user signing out (expired / removed / another tab). Private pages then go to the landing page. */
  sessionLost: false,
  started: false,

  /** Resolve the session on startup and keep tabs in sync (login/logout in another tab). */
  async init() {
    if (get().started) return
    set({ started: true })
    // a signed-in user sees the loading screen for at least ~0.45 s after the page started, so it never blinks
    await get().sync({ minMs: 450 })
    window.addEventListener('storage', (e) => {
      if (e.key === auth.SESSION_STORAGE_KEY || e.key === auth.USERS_STORAGE_KEY) get().sync()
    })
  },

  async sync({ minMs = 0 } = {}) {
    const user = auth.currentUser()
    const prev = get().user
    if (user && prev?.id === user.id) return set({ user })
    if (user) {
      const sincePageStart = Math.max(0, minMs - (typeof performance !== 'undefined' ? performance.now() : minMs))
      await Promise.all([useStore.getState().init(user.id), new Promise((r) => setTimeout(r, sincePageStart))])
      useTeam.getState().bindUser(user.id)
      set({ user, status: 'authed' })
    } else {
      if (prev) {
        useStore.getState().reset()
        useTeam.getState().bindUser(null)
      }
      set({ user: null, status: 'anon', ...(prev && { sessionLost: true }) })
    }
  },

  /** Accounts and passwords live on the server. The device only keeps a login token and an offline copy of the data. */
  async register(values, minMs = MIN_LOADER_MS) {
    const { name, email, password, remember = true } = values
    const data = await holdMin(serverAuth('/api/auth/register', { name, email, password }), minMs)
    return get().finishSignIn(data, remember, true)
  },

  async login(values, minMs = MIN_LOADER_MS) {
    const { email, password, remember = true } = values
    const data = await holdMin(
      (async () => {
        try {
          return await serverAuth('/api/auth/login', { email, password })
        } catch (e) {
          // an account made before accounts moved to the server: verify the old local password once, then create it on the server
          if (e.code === 'invalid') {
            const old = await auth.legacyAccount(email, password)
            if (old) return serverAuth('/api/auth/register', { name: old.name, email, password })
          }
          throw e
        }
      })(),
      minMs,
    )
    return get().finishSignIn(data, remember, false)
  },

  async finishSignIn(data, remember, isNew) {
    const { user, adopted } = auth.linkServerAccount(data.user, remember)
    setCloudScope(user.id)
    saveCloud({ token: data.token, user: data.user })
    await useStore.getState().init(user.id)
    useTeam.getState().bindUser(user.id)
    set({ user, status: 'authed', adoptedLegacy: isNew && adopted, sessionLost: false })
    return user
  },

  /**
   * Sign out. For a normal sign-out the pending changes are uploaded first, and if the user chose
   * "remove my data from this device" it is cleared (only when the server verifiably has it).
   * `expired` = the session was rejected; then nothing is uploaded or cleared (the changes wait on the device).
   */
  async logout({ expired = false } = {}) {
    if (!expired) {
      try {
        const { useSync } = await import('../sync/useSync')
        await useSync.getState().beforeLogout()
      } catch {
        /* never block signing out */
      }
    }
    try {
      const { useSync } = await import('../sync/useSync')
      useSync.getState().stop()
    } catch {
      /* ignore */
    }
    useTeam.getState().signOutCloud() // the login token is removed from the device
    useTeam.getState().bindUser(null)
    auth.clearSession()
    useStore.getState().reset()
    useUI.setState({ selection: [], drawerTaskId: null, paletteOpen: false, helpOpen: false, taskModal: { open: false, task: null, defaults: null } })
    set({ user: null, status: 'anon', adoptedLegacy: false, sessionLost: expired })
  },

  async updateProfile(values) {
    if (hasToken()) await api.patch('/api/auth/me', { name: values.name })
    set({ user: auth.renameLocal(get().user.id, values.name) || get().user })
  },
  async changePassword(current, next) {
    if (!hasToken()) return auth.changePassword(get().user.id, current, next)
    await api.post('/api/auth/password', { current, next })
  },

  async deleteAccount(password) {
    const id = get().user.id
    if (hasToken()) await api.del('/api/auth/me', { password }) // server first; a wrong password stops here
    else await auth.verifyPassword(id, password)
    useTeam.getState().signOutCloud()
    useTeam.getState().bindUser(null)
    useStore.getState().reset()
    auth.removeLocalAccount(id)
    set({ user: null, status: 'anon' })
  },
}))
