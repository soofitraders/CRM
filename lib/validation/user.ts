import { z } from 'zod'
import { UserRole, UserStatus } from '@/lib/models/User'

export const userRoleSchema = z.enum([
  'SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'SALES_AGENT',
  'FINANCE',
  'INVESTOR',
  'CUSTOMER',
])

export const userStatusSchema = z.enum(['ACTIVE', 'INACTIVE'])

export const userQuerySchema = z.object({
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
  search: z.string().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
})

export const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  role: userRoleSchema.refine(
    (role) => role !== 'CUSTOMER' && role !== 'INVESTOR',
    {
      message: 'Cannot create CUSTOMER or INVESTOR users through this endpoint',
    }
  ),
  status: userStatusSchema.default('ACTIVE'),
  tempPassword: z.string().min(8, 'Password must be at least 8 characters').optional(),
})

export const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').trim().optional(),
  email: z.string().email('Invalid email address').toLowerCase().trim().optional(),
  role: userRoleSchema.optional(),
  status: userStatusSchema.optional(),
})

export type UserQueryInput = z.infer<typeof userQuerySchema>
export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>

