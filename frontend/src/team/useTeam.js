import { io } from 'socket.io-client'
import { toast } from 'sonner'
import { create } from 'zustand'
import { API_URL, api, loadCloud, saveCloud, setCloudScope, setSocketId } from './api'

let socket = null
let typingTimers = new Map()

const bucketOf = (m) => m.taskId || 'main'
const upsert = (list, item) => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? { ...x, ...item } : x)) : [...list, item])

/**
 * Daybook Cloud / Team state: the server session, shared projects, the open project (tasks, members,
 * chat, presence) and notifications. Real-time events from the server keep everything current.
 */
export const useTeam = create((set, get) => ({
  cloud: null, // { token, user } | null, scoped to the signed-in local user
  status: 'idle', // 'idle' | 'connecting' | 'online' | 'offline'
  projects: [],
  projectsLoaded: false,
  notifications: [],
  unread: 0,
  current: null, // { id, project, members, invites, stats, tasks, messages: { main: [], [taskId]: [] }, hasMore: {}, online: [], typing: {} }

  // ---------------- session ----------------
  /** Called when the local user signs in/out: switch to that user's own server login (or none). */
  bindUser(userId) {
    socket?.close()
    socket = null
    setSocketId(null)
    setCloudScope(userId)
    set({ cloud: userId ? loadCloud() : null, status: 'idle', projects: [], projectsLoaded: false, notifications: [], unread: 0, current: null })
    if (userId && loadCloud()) get().connect()
  },

  async authenticate(mode, values) {
    const path = mode === 'register' ? '/api/auth/register' : '/api/auth/login'
    const data = await api.post(path, values, { token: null })
    const cloud = { token: data.token, user: data.user }
    saveCloud(cloud)
    set({ cloud })
    get().connect()
    return data
  },

  signOutCloud() {
    socket?.close()
    socket = null
    setSocketId(null)
    saveCloud(null)
    set({ cloud: null, status: 'idle', projects: [], projectsLoaded: false, notifications: [], unread: 0, current: null })
  },

  /** Open the realtime connection and load the lists. Safe to call repeatedly. */
  connect() {
    const { cloud } = get()
    if (!cloud || socket) return
    set({ status: 'connecting' })
    socket = io(API_URL, { auth: { token: cloud.token }, transports: ['websocket', 'polling'], reconnectionDelayMax: 8000 })

    socket.on('ready', ({ socketId }) => {
      setSocketId(socketId)
      set({ status: 'online' })
      get().refresh()
      const cur = get().current
      if (cur) socket.emit('team:join', { projectId: cur.id }, () => {}) // rejoin after a reconnect
    })
    socket.on('connect_error', (e) => {
      if (e.message === 'unauthorized') window.dispatchEvent(new Event('daybook:auth-lost'))
      else set({ status: 'offline' })
    })
    socket.on('disconnect', () => set({ status: 'offline' }))

    socket.on('notification', (n) => {
      set((s) => ({ notifications: [n, ...s.notifications].slice(0, 50), unread: s.unread + 1 }))
      toast(n.title, { description: n.body, action: n.link ? { label: 'Open', onClick: () => (window.location.href = n.link) } : undefined })
    })
    socket.on('team:projects-changed', () => get().loadProjects())
    socket.on('resync', () => window.dispatchEvent(new Event('daybook:resync'))) // another device changed personal data
    socket.on('team:presence', ({ projectId, online }) => get().current?.id === projectId && set((s) => ({ current: { ...s.current, online } })))
    socket.on('team:changes', (c) => get().onTeamChange(c))
    socket.on('chat:message', (m) => get().onMessage(m))
    socket.on('chat:updated', (m) => get().onMessageUpdated(m))
    socket.on('chat:typing', ({ projectId, userId, name, typing }) => {
      if (get().current?.id !== projectId) return
      clearTimeout(typingTimers.get(userId))
      set((s) => {
        const t = { ...s.current.typing }
        if (typing) t[userId] = name
        else delete t[userId]
        return { current: { ...s.current, typing: t } }
      })
      if (typing) {
        typingTimers.set(userId, setTimeout(() => set((s) => (s.current ? { current: { ...s.current, typing: Object.fromEntries(Object.entries(s.current.typing).filter(([k]) => k !== userId)) } } : s)), 4000))
      }
    })
  },

  async refresh() {
    await Promise.all([get().loadProjects(), get().loadNotifications()])
    const cur = get().current
    if (cur) get().openProject(cur.id, { silent: true })
  },

  // ---------------- projects ----------------
  async loadProjects() {
    try {
      const { projects } = await api.get('/api/team/projects')
      set({ projects, projectsLoaded: true })
    } catch (e) {
      /* a 401 is handled centrally (daybook:auth-lost) */
    }
  },

  async createProject(data) {
    const { project } = await api.post('/api/team/projects', data)
    await get().loadProjects()
    return project
  },

  async openProject(id, { silent = false } = {}) {
    const prev = get().current
    if (!silent && prev && prev.id !== id) socket?.emit('team:leave', { projectId: prev.id })
    const [detail, tasks] = await Promise.all([api.get(`/api/team/projects/${id}`), api.get(`/api/team/projects/${id}/tasks`)])
    const keep = prev?.id === id ? prev : null
    set({
      current: {
        id, ...detail, tasks: tasks.tasks,
        messages: keep?.messages || {}, hasMore: keep?.hasMore || {}, online: keep?.online || [], typing: keep?.typing || {},
      },
    })
    socket?.emit('team:join', { projectId: id }, (r) => r?.ok && set((s) => (s.current?.id === id ? { current: { ...s.current, online: r.online } } : s)))
    if (!keep) await get().loadMessages('main')
    get().markRead()
    return detail
  },

  closeProject() {
    const cur = get().current
    if (cur) socket?.emit('team:leave', { projectId: cur.id })
    set({ current: null })
  },

  async reloadCurrent() {
    const cur = get().current
    if (cur) await get().openProject(cur.id, { silent: true })
  },

  /** A change pushed by the server (someone edited tasks / members / progress). */
  onTeamChange(c) {
    const cur = get().current
    if (!cur || cur.id !== c.projectId) {
      get().loadProjects()
      return
    }
    if (c.task) set((s) => ({ current: { ...s.current, tasks: upsert(s.current.tasks, c.task) } }))
    if (c.removedTaskId) set((s) => ({ current: { ...s.current, tasks: s.current.tasks.filter((t) => t.id !== c.removedTaskId) } }))
    if (c.membersChanged || c.invitesChanged || c.tasksChanged) {
      // refresh members/invites/stats (cheap) without touching chat
      api.get(`/api/team/projects/${cur.id}`).then((d) => set((s) => (s.current?.id === cur.id ? { current: { ...s.current, ...d } } : s))).catch(() => {})
    }
    get().loadProjects()
  },

  // ---------------- members ----------------
  searchUser: (email, projectId) => api.get(`/api/team/users/search?email=${encodeURIComponent(email)}${projectId ? `&projectId=${projectId}` : ''}`),
  async addMember(email, role = 'editor') {
    const id = get().current.id
    const r = await api.post(`/api/team/projects/${id}/members`, { email, role })
    await get().reloadCurrent()
    return r
  },
  async removeMember(userId) {
    const id = get().current.id
    await api.del(`/api/team/projects/${id}/members/${userId}`)
    await get().reloadCurrent()
  },
  async setRole(userId, role) {
    await api.patch(`/api/team/projects/${get().current.id}/members/${userId}`, { role })
    await get().reloadCurrent()
  },
  async resendInvite(inviteId) {
    return api.post(`/api/team/projects/${get().current.id}/invites/${inviteId}/resend`, {})
  },
  async revokeInvite(inviteId) {
    await api.del(`/api/team/projects/${get().current.id}/invites/${inviteId}`)
    await get().reloadCurrent()
  },

  // ---------------- tasks and progress ----------------
  async createTask(data) {
    const { task } = await api.post(`/api/team/projects/${get().current.id}/tasks`, data)
    set((s) => ({ current: { ...s.current, tasks: upsert(s.current.tasks, task) } }))
    return task
  },
  async patchTask(id, patch) {
    const { task } = await api.patch(`/api/team/tasks/${id}`, patch)
    set((s) => ({ current: { ...s.current, tasks: upsert(s.current.tasks, task) } }))
    get().reloadStats()
    return task
  },
  async myProgress(id, progress, note) {
    const { task } = await api.put(`/api/team/tasks/${id}/my-progress`, { progress, ...(note ? { note } : {}) })
    set((s) => ({ current: { ...s.current, tasks: upsert(s.current.tasks, task) } }))
    get().reloadStats()
    return task
  },
  async deleteTask(id) {
    await api.del(`/api/team/tasks/${id}`)
    set((s) => ({ current: { ...s.current, tasks: s.current.tasks.filter((t) => t.id !== id) } }))
    get().reloadStats()
  },
  async reloadStats() {
    const id = get().current?.id
    if (!id) return
    const d = await api.get(`/api/team/projects/${id}`)
    set((s) => (s.current?.id === id ? { current: { ...s.current, stats: d.stats, members: d.members, project: d.project } } : s))
  },

  // ---------------- chat ----------------
  async loadMessages(bucket = 'main', { older = false } = {}) {
    const cur = get().current
    if (!cur) return
    const list = cur.messages[bucket] || []
    const qs = new URLSearchParams({ limit: '40' })
    if (bucket !== 'main') qs.set('taskId', bucket)
    if (older && list[0]) qs.set('before', list[0].createdAt)
    const { messages, hasMore } = await api.get(`/api/team/projects/${cur.id}/messages?${qs}`)
    set((s) => (s.current?.id === cur.id ? { current: { ...s.current, messages: { ...s.current.messages, [bucket]: older ? [...messages, ...list] : messages }, hasMore: { ...s.current.hasMore, [bucket]: hasMore } } } : s))
  },

  async sendMessage(text, taskId) {
    const cur = get().current
    const { message } = await api.post(`/api/team/projects/${cur.id}/messages`, { text, ...(taskId ? { taskId } : {}) })
    get().onMessage(message)
    return message
  },
  async editMessage(id, text) {
    const { message } = await api.patch(`/api/team/messages/${id}`, { text })
    get().onMessageUpdated(message)
  },
  async deleteMessage(id) {
    await api.del(`/api/team/messages/${id}`)
  },
  async react(id, emoji) {
    const { message } = await api.post(`/api/team/messages/${id}/reactions`, { emoji })
    get().onMessageUpdated(message)
  },
  onMessage(m) {
    const cur = get().current
    if (!cur || m.teamProjectId !== cur.id) return
    const name = cur.members.find((x) => x.userId === m.userId)?.name
    const msg = { author: name, ...m }
    set((s) => {
      // system lines (progress, status, joins) appear in the main chat AND in their task's thread
      const buckets = msg.type === 'system' && msg.taskId ? [msg.taskId, 'main'] : [bucketOf(msg)]
      const messages = { ...s.current.messages }
      for (const b of buckets) if (messages[b]) messages[b] = upsert(messages[b], msg) // an unopened bucket loads fresh later
      return { current: { ...s.current, messages } }
    })
    if (m.userId !== get().cloud?.user?.id && m.type === 'user') get().markRead()
  },
  onMessageUpdated(m) {
    const cur = get().current
    if (!cur || m.teamProjectId !== cur.id) return
    set((s) => {
      const b = bucketOf(m)
      const list = s.current.messages[b]
      if (!list) return s
      return { current: { ...s.current, messages: { ...s.current.messages, [b]: list.map((x) => (x.id === m.id ? { ...x, ...m } : x)) } } }
    })
  },
  setTyping(typing, taskId) {
    const cur = get().current
    if (cur) socket?.emit('chat:typing', { projectId: cur.id, taskId: taskId || null, typing })
  },
  markRead() {
    const cur = get().current
    if (cur) api.post(`/api/team/projects/${cur.id}/read`, {}).then(() => get().loadProjects()).catch(() => {})
  },

  // ---------------- notifications ----------------
  async loadNotifications() {
    try {
      const { notifications, unread } = await api.get('/api/team/notifications')
      set({ notifications, unread })
    } catch {
      /* offline */
    }
  },
  async readNotifications(all = true, ids) {
    const r = await api.post('/api/team/notifications/read', all ? { all: true } : { ids })
    set((s) => ({ unread: r.unread, notifications: s.notifications.map((n) => (all || ids?.includes(n.id) ? { ...n, read: true } : n)) }))
  },
}))
