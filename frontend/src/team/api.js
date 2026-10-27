/** Small fetch client for the Daybook API. The cloud session (token) is kept per device in localStorage. */
export const API_URL = import.meta.env.VITE_API_URL
/** The server login is stored per LOCAL user, so another local account on this device never inherits it. */
let scope = null
export const setCloudScope = (userId) => {
  scope = userId
}
const keyFor = () => `daybook:cloud:${scope}`

export const loadCloud = () => {
  if (!scope) return null
  try {
    return JSON.parse(localStorage.getItem(keyFor())) || null
  } catch {
    return null
  }
}
export const saveCloud = (v) => {
  try {
    if (!scope) return
    if (v) localStorage.setItem(keyFor(), JSON.stringify(v))
    else localStorage.removeItem(keyFor())
  } catch {
    /* storage blocked: the session lasts for this visit only */
  }
}

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

let socketId = null
export const setSocketId = (id) => {
  socketId = id
}

/** request('POST', '/api/team/projects', body). Throws ApiError with the server's message. */
export async function request(method, path, body, { token } = {}) {
  const t = token ?? loadCloud()?.token
  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(t && { Authorization: `Bearer ${t}` }),
        ...(socketId && { 'x-socket-id': socketId }), // so the server does not echo our own changes back
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Cannot reach the Daybook server. Check that the backend is running.', 0)
  }
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  // a rejected session (expired/invalid token): tell the sync engine, which signs out and goes to the landing page
  if (res.status === 401 && t && typeof window !== 'undefined') window.dispatchEvent(new Event('daybook:auth-lost'))
  if (!res.ok) throw new ApiError(data?.error?.message || `Request failed (${res.status})`, res.status, data?.error?.details)
  return data
}

export const api = {
  get: (p, o) => request('GET', p, undefined, o),
  post: (p, b = {}, o) => request('POST', p, b, o),
  put: (p, b = {}, o) => request('PUT', p, b, o),
  patch: (p, b = {}, o) => request('PATCH', p, b, o),
  del: (p, b, o) => request('DELETE', p, b, o),
}
