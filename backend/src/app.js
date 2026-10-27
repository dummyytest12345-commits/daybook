import compression from 'compression'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import { dbReady } from './config/db.js'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import routes from './routes/index.js'
import path from "path"

/** Builds the Express app (no listening, so tests can use it directly). */
export function createApp() {
  const app = express()
  app.use(express.static(path.join(process.cwd(), 'dist'), { index: false }))
  app.disable('x-powered-by')
  app.set('trust proxy', 1)

  app.use(helmet())

  // Configured for "Self Only" (Same-Origin restriction)
  app.use(cors({
    origin: false, // Disables all incoming cross-origin requests completely
    credentials: false,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-socket-id'],
    exposedHeaders: ['Retry-After']
  }))

  app.use(compression())
  app.use(express.json({ limit: '10mb' }))
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'))

  app.get('/health', (_req, res) => res.json({ status: 'ok', db: dbReady() ? 'up' : 'down', time: new Date().toISOString() }))
  app.use('/api', routes)

  app.use(/.*/, (_req, res) => res.sendFile(path.join(process.cwd(), 'dist', 'index.html')))

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
