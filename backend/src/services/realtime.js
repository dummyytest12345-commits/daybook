/**
 * Socket.IO fan-out. Every change a user makes is pushed to all of that user's other connected
 * devices/tabs (room `user:<id>`), skipping the socket that made the change (header x-socket-id).
 */
let io = null

export const setIo = (instance) => {
  io = instance
}
export const userRoom = (userId) => `user:${userId}`

/** Emit `event` with `payload` to every socket of the user except `origin` (the sender's socket id). */
export function emitToUser(userId, event, payload, origin) {
  if (!io) return
  const room = io.to(userRoom(userId))
  ;(origin ? room.except(origin) : room).emit(event, payload)
}

/** Convenience: tell clients which entities changed so they can merge them. */
export function emitChanges(userId, origin, changes) {
  const body = Object.fromEntries(Object.entries(changes).filter(([, v]) => v && (!Array.isArray(v) || v.length)))
  if (Object.keys(body).length) emitToUser(userId, 'changes', body, origin)
}

export const teamRoom = (projectId) => `team:${projectId}`

/** Emit to everyone currently viewing a team project (they joined the room with `team:join`). */
export function emitToTeam(projectId, event, payload, origin) {
  if (!io) return
  const room = io.to(teamRoom(projectId))
  ;(origin ? room.except(origin) : room).emit(event, payload)
}

export const getIo = () => io

export const connectedCount = (userId) => io?.sockets.adapter.rooms.get(userRoom(userId))?.size || 0
