import { z } from 'zod'

export const STATUS_IDS = ['pending', 'in_progress', 'blocked', 'completed']
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const subtaskSchema = z.object({ id: z.string(), title: z.string(), done: z.boolean() })

export const taskSchema = z.object({
  id: z.string().min(1),
  date: isoDate,
  title: z.string().min(1).max(500),
  notes: z.string().optional(),
  status: z.enum(STATUS_IDS).catch('pending'),
  hours: z.number().min(0).max(24).optional(),
  estimateHours: z.number().min(0).max(240).optional(),
  /** 0-100. In Progress starts at 0, Completed is 100 (see selectors/progress.js). */
  progress: z.number().int().min(0).max(100).optional(),
  ticketNo: z.string().optional(),
  /** Optional project. Missing/unknown ids mean "no project". */
  projectId: z.string().optional(),
  /** Per-project sequence number (KEY-<number>). */
  number: z.number().int().optional(),
  dueDate: isoDate.optional(),
  /** Date of the earlier row this one was carried forward from. */
  carriedFrom: isoDate.optional(),
  /** All rows of one piece of work across days share a thread id (the first row's id). */
  threadId: z.string().optional(),
  /** True when the app (not the user) created this row by carrying an unfinished task forward. */
  autoCarried: z.boolean().optional(),
  /** Set on a row the user chose to stop carrying forward. */
  carryDismissed: z.boolean().optional(),
  /** Id of the row whose completion marked this earlier row completed. */
  resolvedBy: z.string().optional(),
  /** Per-day progress notes, shown as a conversation in the thread view. */
  updates: z.array(z.object({ id: z.string(), at: z.string(), text: z.string() })).optional(),
  module: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  subtasks: z.array(subtaskSchema).optional(),
  order: z.number().default(0),
  timerStartedAt: z.string().nullable().optional(),
  timerElapsedMs: z.number().optional(),
  recurringId: z.string().optional(),
  completedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().default(null),
})

/** Form schema (user-editable fields). */
export const taskFormSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500),
  date: isoDate,
  status: z.enum(STATUS_IDS),
  hours: z.number().min(0, 'Min 0').max(24, 'Max 24').optional(),
  progress: z.number().int('Whole numbers only').min(0, 'Min 0').max(100, 'Max 100').optional(),
  estimateHours: z.number().min(0).max(240).optional(),
  module: z.string().optional(),
  ticketNo: z.string().optional(),
  projectId: z.string().optional(),
  /** Import only: resolved to a project id (found or created) when the rows are committed. */
  projectName: z.string().max(60).optional(),
  dueDate: isoDate.optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  notes: z.string().optional(),
})
