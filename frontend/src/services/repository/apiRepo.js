/**
 * Placeholder for the future backend (phase 10). Implement the WorkLogRepository
 * interface from ./index.js against REST endpoints: /tasks, /day-logs, /settings,
 * and /sync?since= for incremental changes. Conflict rule: last write wins by updatedAt.
 */
export class ApiRepository {
  constructor(baseUrl) {
    this.baseUrl = baseUrl
  }
  async listTasks() {
    throw new Error('ApiRepository is not implemented yet')
  }
}
