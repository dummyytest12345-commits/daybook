import { z } from 'zod'

export const DEFAULT_STATUSES = [
  { id: 'pending', label: 'Pending', color: '#64748b' },
  { id: 'in_progress', label: 'In Progress', color: '#d97706' },
  { id: 'blocked', label: 'Blocked', color: '#dc2626' },
  { id: 'completed', label: 'Completed', color: '#16a34a' },
]

export const SCHEMA_VERSION = 2

export const settingsSchema = z.object({
  weekStartsOn: z.union([z.literal(0), z.literal(1)]).default(1),
  dailyCapacity: z.number().min(1).max(24).default(8),
  dateFormat: z.enum(['dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy']).default('dd/MM/yyyy'),
  hoursMode: z.enum(['equal', 'manual', 'timer']).default('equal'),
  statuses: z
    .array(z.object({ id: z.string(), label: z.string(), color: z.string() }))
    .default(DEFAULT_STATUSES),
  modules: z.array(z.string()).default(['Profile', 'Consent', 'Testing', 'Responsive']),
  holidays: z.array(z.object({ date: z.string(), name: z.string() })).default([]),
  theme: z.enum(['light', 'dark']).default('light'),
  reminderTime: z.string().nullable().default(null),
  dailyGoalTasks: z.number().default(5),
  /** Carry unfinished tasks to the next working day automatically. */
  autoCarry: z.boolean().default(true),
  /** When a carried task is completed: mark the earlier days completed too, or leave them as they were. */
  threadResolve: z.enum(['all', 'none']).default('all'),
  /** Tasks older than this many days are no longer carried forward. */
  carryMaxDays: z.number().int().min(1).max(365).default(21),
  schemaVersion: z.number().default(SCHEMA_VERSION),
})

export const defaultSettings = () => settingsSchema.parse({})

export const recurringSchema = z.object({
  id: z.string(),
  title: z.string(),
  module: z.string().optional(),
  hours: z.number().optional(),
  weekdays: z.array(z.number().min(0).max(6)),
  active: z.boolean().default(true),
})

export const savedViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  filters: z.record(z.string(), z.any()),
})
