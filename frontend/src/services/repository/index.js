import { LocalStorageRepository } from './localStorageRepo'

/**
 * Access point for the active repository. It is scoped to one signed-in user, so
 * two accounts on the same browser never see each other's data. To move to a
 * backend, implement the same async interface in apiRepo.js and return it here.
 * @typedef {Object} WorkLogRepository
 * @property {() => Promise<any[]>} listTasks
 * @property {(t:any) => Promise<void>} saveTask
 * @property {(id:string) => Promise<void>} deleteTask
 * @property {(ts:any[]) => Promise<void>} bulkUpsert
 * @property {() => Promise<any[]>} getDayLogs
 * @property {(l:any) => Promise<void>} saveDayLog
 * @property {() => Promise<any>} getSettings
 * @property {(s:any) => Promise<void>} saveSettings
 * @property {() => Promise<any>} exportSnapshot
 * @property {(s:any) => Promise<any>} importSnapshot
 */
let repo = null

/** Open (or reuse) the repository for a user. Disposes the previous user's repository. */
export function openRepository(userId, onError) {
  if (repo && repo.userId === userId) return repo
  repo?.dispose()
  repo = new LocalStorageRepository({ userId, onError })
  return repo
}
export function closeRepository() {
  repo?.dispose()
  repo = null
}
export function getRepository() {
  if (!repo) throw new Error('No user is signed in')
  return repo
}
export function setRepository(r) {
  repo = r
}
