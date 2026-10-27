import mongoose from 'mongoose'
import { connectDb, disconnectDb } from '../src/config/db.js'

/** Drops the database named in MONGODB_DB (used to clean up the browser e2e database). Refuses the real one. */
const name = process.env.MONGODB_DB
if (!name || !/e2e|test/.test(name)) {
  console.error('Refusing to drop: set MONGODB_DB to a database whose name contains "e2e" or "test".')
  process.exit(1)
}
await connectDb()
await mongoose.connection.dropDatabase()
console.log(`Dropped ${name}`)
await disconnectDb()
