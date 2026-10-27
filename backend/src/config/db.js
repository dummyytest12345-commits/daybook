import mongoose from 'mongoose'
import { env } from './env.js'

mongoose.set('strictQuery', true)

/** Connect to MongoDB Atlas. Fails fast with a readable message (bad password, IP not allowed, ...). */
export async function connectDb() {
  try {
    await mongoose.connect(env.mongoUri, { ...(process.env.MONGODB_DB ? { dbName: process.env.MONGODB_DB } : {}), serverSelectionTimeoutMS: 12000, maxPoolSize: 10 })
  } catch (err) {
    const hint = /auth/i.test(err.message)
      ? 'Check the database user and password.'
      : /ENOTFOUND|ECONNREFUSED|timed out|selection/i.test(err.message)
        ? 'Check the cluster host and that your IP address is allowed in Atlas > Network Access.'
        : ''
    throw new Error(`MongoDB connection failed: ${err.message} ${hint}`.trim())
  }
  return mongoose.connection
}

export const disconnectDb = () => mongoose.disconnect()
export const dbReady = () => mongoose.connection.readyState === 1
