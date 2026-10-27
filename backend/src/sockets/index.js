import { Server } from 'socket.io'
import { env } from '../config/env.js'
import { verifyToken } from '../middleware/auth.js'
import { setIo, userRoom } from '../services/realtime.js'
import { registerTeamHandlers } from './team.js'

/**
 * Real-time channel. Clients connect with `io(url, { auth: { token } })`.
 * Server -> client events:
 *   changes   { tasksUpserted, tasksRemoved, projectsUpserted, projectsRemoved, dayLogsUpserted, dayLogsRemoved }
 *   settings  <settings>            resync { reason }
 * Rooms: `user:<id>` for the signed-in user's devices (more rooms are added by the collaboration module).
 */
export function attachSockets(httpServer, { onConnection } = {}) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigins },
    pingInterval: 20000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1e6,
  })
  setIo(io)

  io.use((socket, next) => {
    try {
      socket.data.userId = verifyToken(String(socket.handshake.auth?.token || ''))
      next()
    } catch {
      next(new Error('unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    const { userId } = socket.data
    socket.join(userRoom(userId))
    socket.emit('ready', { socketId: socket.id, userId })
    registerTeamHandlers(socket, io)
    onConnection?.(socket, io)
  })
  return io
}
