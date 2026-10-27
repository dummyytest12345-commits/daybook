import { connectDb, disconnectDb } from '../src/config/db.js'
import mongoose from 'mongoose'

/** `npm run check:db` - connects to Atlas, prints the database name and a ping, then exits. */
try {
  await connectDb()
  const ping = await mongoose.connection.db.admin().ping()
  console.log(`Connected to "${mongoose.connection.name}" on ${mongoose.connection.host}. ping:`, ping)
} catch (e) {
  console.error(e.message)
  process.exitCode = 1
} finally {
  await disconnectDb()
}
