import { defaultSettings } from '../schemas/settings'

let n = 0
export const T = (over = {}) => ({
  id: `t${++n}`,
  date: '2026-09-07',
  title: 'Task',
  status: 'pending',
  order: n,
  createdAt: '2026-09-07T09:00:00.000Z',
  updatedAt: '2026-09-07T09:00:00.000Z',
  deletedAt: null,
  ...over,
})
export const ctx = (over = {}) => ({ dayLogs: {}, settings: { ...defaultSettings(), ...over } })
