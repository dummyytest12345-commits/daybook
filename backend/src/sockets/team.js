import { TeamProject } from '../models/Team.js'
import { User } from '../models/User.js'
import { teamRoom } from '../services/realtime.js'

/** Which user ids currently have a socket in the project's room. */
async function onlineIn(io, projectId) {
  const sockets = await io.in(teamRoom(projectId)).fetchSockets()
  return [...new Set(sockets.map((s) => s.data.userId))]
}

/**
 * Team events from a client:
 *   team:join   { projectId } -> ack { ok, online }   (membership is checked)
 *   team:leave  { projectId }
 *   chat:typing { projectId, taskId?, typing: boolean }
 * Server -> clients: team:presence { projectId, online }, chat:typing { projectId, taskId, userId, name, typing }
 */
export function registerTeamHandlers(socket, io) {
  const joined = new Set()

  socket.on('team:join', async ({ projectId } = {}, ack) => {
    try {
      const ok = projectId && (await TeamProject.exists({ _id: projectId, deletedAt: null, 'members.userId': socket.data.userId }))
      if (!ok) return ack?.({ ok: false, error: 'not a member' })
      socket.join(teamRoom(projectId))
      joined.add(projectId)
      const online = await onlineIn(io, projectId)
      io.to(teamRoom(projectId)).emit('team:presence', { projectId, online })
      ack?.({ ok: true, online })
    } catch {
      ack?.({ ok: false, error: 'server error' })
    }
  })

  const leave = async (projectId) => {
    socket.leave(teamRoom(projectId))
    joined.delete(projectId)
    io.to(teamRoom(projectId)).emit('team:presence', { projectId, online: await onlineIn(io, projectId) })
  }
  socket.on('team:leave', ({ projectId } = {}) => projectId && leave(projectId))

  socket.on('chat:typing', async ({ projectId, taskId = null, typing = true } = {}) => {
    if (!joined.has(projectId)) return // only people who joined (and so are members) can broadcast
    if (!socket.data.name) socket.data.name = (await User.findById(socket.data.userId, 'name').lean())?.name || 'Someone'
    socket.to(teamRoom(projectId)).emit('chat:typing', { projectId, taskId, userId: socket.data.userId, name: socket.data.name, typing: !!typing })
  })

  socket.on('disconnect', async () => {
    for (const projectId of joined) io.to(teamRoom(projectId)).emit('team:presence', { projectId, online: await onlineIn(io, projectId) })
  })
}
