import { z } from 'zod'

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(120)

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Include at least one letter and one number')

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Enter your name').max(60),
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' })

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
  remember: z.boolean().optional(),
})

export const storedUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  salt: z.string().optional(), // absent once the account lives on the server (no password is kept on the device)
  hash: z.string().optional(),
  iterations: z.number().optional(),
  createdAt: z.string(),
})

/** 0-4 strength score for the meter (length, variety). */
export function passwordStrength(p) {
  let score = 0
  if (p.length >= 8) score++
  if (p.length >= 12) score++
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++
  return Math.min(4, score)
}
