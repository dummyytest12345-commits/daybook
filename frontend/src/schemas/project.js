import { z } from 'zod'
import { PROJECT_COLORS, PROJECT_ICONS } from '../components/icons'

export const PROJECT_STATUSES = [
  { id: 'active', label: 'Active' },
  { id: 'on_hold', label: 'On hold' },
  { id: 'completed', label: 'Completed' },
]

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  key: z.string().regex(/^[A-Z][A-Z0-9]{1,5}$/),
  description: z.string().max(2000).optional(),
  color: z.string().default(PROJECT_COLORS[0]),
  icon: z.string().default(PROJECT_ICONS[0]),
  status: z.enum(['active', 'on_hold', 'completed']).catch('active'),
  favorite: z.boolean().default(false),
  startDate: isoDate.optional(),
  targetDate: isoDate.optional(),
  /** Work-in-progress limits per status id (Kanban WIP limits). */
  wipLimits: z.record(z.string(), z.number().int().min(0).max(99)).default({}),
  /** Next per-project task number (shown as KEY-<number>). */
  nextNumber: z.number().int().min(1).default(1),
  archivedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().default(null),
})

export const projectFormSchema = z
  .object({
    name: z.string().trim().min(1, 'Give the project a name').max(60),
    key: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]{1,5}$/, '2-6 letters or digits, starting with a letter'),
    description: z.string().max(2000).optional(),
    color: z.string(),
    icon: z.string(),
    status: z.enum(['active', 'on_hold', 'completed']),
    startDate: isoDate.optional().or(z.literal('')),
    targetDate: isoDate.optional().or(z.literal('')),
  })
  .refine((v) => !v.startDate || !v.targetDate || v.startDate <= v.targetDate, {
    path: ['targetDate'],
    message: 'Target date must be after the start date',
  })
