import { execFileSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

export default async function teardown() {
  const backend = path.resolve(import.meta.dirname, '../../backend')
  try {
    execFileSync(process.execPath, ['scripts/drop-db.js'], { cwd: backend, env: { ...process.env, MONGODB_DB: 'daybook_e2e' }, stdio: 'inherit' })
  } catch {
    console.warn('Could not drop the e2e database; it only contains test data.')
  }
  fs.rmSync(path.join(backend, 'outbox'), { recursive: true, force: true })
}
