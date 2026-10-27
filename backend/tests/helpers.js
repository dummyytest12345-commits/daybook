import http from 'node:http'
import mongoose from 'mongoose'
import request from 'supertest'
import { io as ioClient } from 'socket.io-client'
import { createApp } from '../src/app.js'
import { connectDb, disconnectDb } from '../src/config/db.js'
import { attachSockets } from '../src/sockets/index.js'

export const hasDb = !!process.env.MONGODB_URI

let server
let ioServer
let baseUrl

export async function startTestServer() {
  await connectDb()
  const app = createApp()
  server = http.createServer(app)
  ioServer = attachSockets(server)
  await new Promise((r) => server.listen(0, r))
  baseUrl = `http://localhost:${server.address().port}`
  return { app, baseUrl }
}

export async function stopTestServer({ dropDb = true } = {}) {
  ioServer?.close()
  await new Promise((r) => server?.close(r))
  if (dropDb && mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase()
  await disconnectDb()
}

export const api = () => request(baseUrl)

let counter = 0
/** Registers a fresh user; returns { token, user, auth() } where auth() sets the Authorization header. */
export async function makeUser(label = 'user') {
  const email = `${label}.${Date.now()}.${++counter}@example.com`
  const res = await api().post('/api/auth/register').send({ name: `${label} Tester`, email, password: 'Passw0rd!x' })
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`)
  const { token, user } = res.body
  return { token, user, email, password: 'Passw0rd!x', h: { Authorization: `Bearer ${token}` } }
}

export function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const s = ioClient(baseUrl, { auth: { token }, transports: ['websocket'], reconnection: false })
    s.once('ready', (info) => resolve({ socket: s, info }))
    s.once('connect_error', (e) => reject(e))
  })
}

export const waitFor = (socket, event, ms = 4000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out waiting for "${event}"`)), ms)
    socket.once(event, (p) => {
      clearTimeout(t)
      resolve(p)
    })
  })
