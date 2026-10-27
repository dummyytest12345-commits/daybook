import { z } from 'zod'

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
const statusEnum = z.enum(['pending', 'in_progress', 'blocked', 'completed'])
const priority = z.enum(['low', 'medium', 'high'])
const emptyToUndef = (s) => z.preprocess((v) => (v === '' || v === null ? undefined : v), s.optional())

export const auth = {
  register: z.object({
    name: z.string().trim().min(2).max(60),
    email: z.string().trim().toLowerCase().email().max(120),
    password: z.string().min(8).max(128).refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Include a letter and a number'),
  }),
  login: z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) }),
  profile: z.object({ name: z.string().trim().min(2).max(60) }),
  password: z.object({ current: z.string().min(1), next: z.string().min(8).max(128).refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Include a letter and a number') }),
  remove: z.object({ password: z.string().min(1) }),
}

const taskFields = {
  title: z.string().trim().min(1).max(500),
  date: iso,
  notes: z.string().max(10000).optional(),
  status: statusEnum,
  progress: z.number().int().min(0).max(100),
  hours: z.number().min(0).max(24),
  estimateHours: z.number().min(0).max(240),
  ticketNo: z.string().max(40),
  projectId: z.string().min(1).nullable(),
  dueDate: iso,
  module: z.string().max(60),
  tags: z.array(z.string().max(40)).max(30),
  priority,
  order: z.number(),
  recurringId: z.string(),
  carryDismissed: z.boolean(),
  subtasks: z.array(z.object({ id: z.string().optional(), title: z.string().max(300), done: z.boolean() })).max(100),
}

export const task = {
  create: z.object({ ...taskFields, id: z.string().min(1).max(40).optional() }).partial({ status: true, progress: true, hours: true, estimateHours: true, ticketNo: true, projectId: true, dueDate: true, module: true, tags: true, priority: true, order: true, recurringId: true, carryDismissed: true, subtasks: true }).strict(),
  patch: z.object(Object.fromEntries(Object.entries(taskFields).map(([k, v]) => [k, v.optional()]))).extend({ dueDate: z.union([iso, z.null()]).optional() }).strict(),
  list: z.object({
    from: iso.optional(), to: iso.optional(), status: z.string().optional(), projectId: z.string().optional(),
    q: z.string().max(100).optional(), threadId: z.string().optional(), updatedSince: z.string().optional(),
    includeDeleted: z.enum(['true', 'false']).optional(), limit: z.coerce.number().int().min(1).max(2000).optional(),
  }),
  bulkCreate: z.object({ tasks: z.array(z.object(taskFields).partial({ status: true, progress: true, hours: true, estimateHours: true, ticketNo: true, projectId: true, dueDate: true, module: true, tags: true, priority: true, order: true, subtasks: true, recurringId: true, carryDismissed: true }).strict()).min(1).max(200) }),
  bulkPatch: z.object({ ids: z.array(z.string()).min(1).max(500), patch: z.object(Object.fromEntries(Object.entries(taskFields).map(([k, v]) => [k, v.optional()]))).strict() }),
  bulkDelete: z.object({ ids: z.array(z.string()).min(1).max(500) }),
  move: z.object({ ids: z.array(z.string()).min(1).max(500), projectId: z.string().min(1).nullable() }),
  finish: z.object({ date: iso }),
  update: z.object({ text: z.string().trim().min(1).max(1000) }),
  forward: z.object({ to: iso }),
  carryForward: z.object({ date: iso.optional() }),
  progress: z.object({ progress: z.number().int().min(0).max(100) }),
}

export const project = {
  create: z.object({
    name: z.string().trim().min(1).max(60),
    key: emptyToUndef(z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]{1,5}$/, '2-6 letters or digits, starting with a letter')),
    description: z.string().max(2000).optional(), color: z.string().max(20).optional(), icon: z.string().max(30).optional(),
    status: z.enum(['active', 'on_hold', 'completed']).optional(), startDate: emptyToUndef(iso), targetDate: emptyToUndef(iso),
  }).refine((v) => !v.startDate || !v.targetDate || v.startDate <= v.targetDate, { path: ['targetDate'], message: 'Target date must be after the start date' }),
  patch: z.object({
    name: z.string().trim().min(1).max(60), key: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]{1,5}$/), description: z.string().max(2000),
    color: z.string().max(20), icon: z.string().max(30), status: z.enum(['active', 'on_hold', 'completed']), favorite: z.boolean(),
    startDate: z.union([iso, z.null()]), targetDate: z.union([iso, z.null()]),
    wipLimits: z.record(z.string(), z.number().int().min(0).max(99)),
  }).partial().strict(),
  remove: z.object({ mode: z.enum(['unassign', 'delete']).default('unassign') }),
  duplicate: z.object({ withTasks: z.boolean().default(false) }),
}

export const dayLog = {
  put: z.object({
    dayType: z.enum(['work', 'weekend', 'leave', 'holiday']).nullable().optional(),
    capacityHours: z.number().min(0).max(24).optional(), note: z.string().max(2000).optional(), mood: z.number().int().min(1).max(5).optional(),
  }).strict(),
  range: z.object({ from: iso.optional(), to: iso.optional() }),
}

export const settings = {
  put: z.object({
    weekStartsOn: z.union([z.literal(0), z.literal(1)]), dailyCapacity: z.number().min(1).max(24),
    dateFormat: z.enum(['dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy']), hoursMode: z.enum(['equal', 'manual', 'timer']),
    statuses: z.array(z.object({ id: z.string(), label: z.string().max(40), color: z.string().max(20) })).max(12),
    modules: z.array(z.string().max(60)).max(100), holidays: z.array(z.object({ date: iso, name: z.string().max(80) })).max(400),
    reminderTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(), dailyGoalTasks: z.number().int().min(1).max(100),
    autoCarry: z.boolean(), threadResolve: z.enum(['all', 'none']), carryMaxDays: z.number().int().min(1).max(365),
    recurring: z.array(z.object({ id: z.string(), title: z.string().max(200), module: z.string().max(60).optional(), hours: z.number().min(0).max(24).optional(), weekdays: z.array(z.number().int().min(0).max(6)), active: z.boolean().default(true) })).max(100),
    views: z.array(z.object({ id: z.string(), name: z.string().max(80), filters: z.record(z.string(), z.any()) })).max(100),
  }).partial().strict(),
}

export const analytics = z.object({ from: iso, to: iso, projectId: z.string().optional() })
export const idParam = z.object({ id: z.string().min(1).max(60) })
export const dateParam = z.object({ date: iso })
export const syncPush = z.object({
  since: z.string().datetime({ offset: true }).nullable().optional(),
  deviceId: z.string().max(60).optional(),
  tasks: z.array(z.record(z.string(), z.any())).max(5000).default([]),
  projects: z.array(z.record(z.string(), z.any())).max(500).default([]),
  dayLogs: z.array(z.record(z.string(), z.any())).max(5000).default([]),
  settings: z.record(z.string(), z.any()).optional(),
  settingsUpdatedAt: z.string().optional(),
})
export const syncImport = z.object({
  mode: z.enum(['replace', 'merge']).default('merge'),
  tasks: z.array(z.record(z.string(), z.any())).max(20000).default([]),
  projects: z.array(z.record(z.string(), z.any())).max(500).default([]),
  dayLogs: z.array(z.record(z.string(), z.any())).max(5000).default([]),
  settings: z.record(z.string(), z.any()).optional(),
})

export const team = {
  project: z.object({
    name: z.string().trim().min(1).max(60),
    key: emptyToUndef(z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]{1,5}$/, '2-6 letters or digits, starting with a letter')),
    description: z.string().max(2000).optional(), color: z.string().max(20).optional(), icon: z.string().max(30).optional(),
  }),
  projectPatch: z.object({ name: z.string().trim().min(1).max(60), description: z.string().max(2000), color: z.string().max(20), icon: z.string().max(30) }).partial().strict(),
  search: z.object({ email: z.string().trim().toLowerCase().email(), projectId: z.string().optional() }),
  addMember: z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(['editor', 'viewer']).default('editor') }),
  role: z.object({ role: z.enum(['editor', 'viewer']) }),
  task: z.object({
    title: z.string().trim().min(1).max(500), notes: z.string().max(10000).optional(), assignees: z.array(z.string()).max(50).optional(),
    dueDate: iso.optional(), priority: priority.optional(),
  }).strict(),
  taskPatch: z.object({
    title: z.string().trim().min(1).max(500), notes: z.string().max(10000), assignees: z.array(z.string()).max(50),
    dueDate: iso, priority, status: statusEnum, progress: z.number().int().min(0).max(100),
  }).partial().strict(),
  myProgress: z.object({ progress: z.number().int().min(0).max(100), note: z.string().trim().max(500).optional() }),
  message: z.object({ text: z.string().trim().min(1).max(2000), taskId: z.string().optional() }),
  messageEdit: z.object({ text: z.string().trim().min(1).max(2000) }),
  reaction: z.object({ emoji: z.string().min(1).max(8) }),
  messages: z.object({ taskId: z.string().optional(), before: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).optional() }),
  notifications: z.object({ ids: z.array(z.string()).max(200).optional(), all: z.boolean().optional() }),
}
