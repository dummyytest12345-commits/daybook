import { z } from 'zod'

export const DAY_TYPES = ['work', 'weekend', 'leave', 'holiday']

export const dayLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayType: z.enum(DAY_TYPES).optional(),
  capacityHours: z.number().min(0).max(24).default(8),
  note: z.string().optional(),
  mood: z.number().int().min(1).max(5).optional(),
})
