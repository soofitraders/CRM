import { z } from 'zod'

export const salaryInputSchema = z.object({
  staffUser: z.string().min(1, 'Staff user is required'),
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2100),
  grossSalary: z.number().min(0, 'Gross salary cannot be negative'),
  allowances: z.number().min(0).optional().default(0),
  deductions: z.number().min(0).optional().default(0),
  netSalary: z.number().min(0).optional(), // Will be calculated if not provided
  status: z.enum(['PENDING', 'PAID']).optional().default('PENDING'),
  paidAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  branchId: z.string().optional(),
})

export const salaryUpdateSchema = salaryInputSchema.partial()

export type SalaryInput = z.infer<typeof salaryInputSchema>
export type SalaryUpdate = z.infer<typeof salaryUpdateSchema>

