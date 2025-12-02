import { z } from 'zod'
import mongoose from 'mongoose'

const objectId = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId',
})

export const investorPayoutInputSchema = z.object({
  investorId: objectId,
  periodFrom: z.union([
    z.string().datetime(), // ISO datetime string
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // Date string in yyyy-MM-dd format
    z.date(), // Date object
  ]),
  periodTo: z.union([
    z.string().datetime(), // ISO datetime string
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // Date string in yyyy-MM-dd format
    z.date(), // Date object
  ]),
  branchId: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  createPayment: z.boolean().optional(),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CASH', 'OTHER']).optional(),
})

export const investorPayoutUpdateSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'CANCELLED']).optional(),
  notes: z.string().trim().optional(),
  paymentInfo: z
    .object({
      status: z.enum(['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED']).optional(),
      transactionId: z.string().trim().optional(),
      paidAt: z.string().datetime().or(z.date()).optional(),
      method: z.string().optional(),
    })
    .optional(),
})

export type InvestorPayoutInput = z.infer<typeof investorPayoutInputSchema>
export type InvestorPayoutUpdateInput = z.infer<typeof investorPayoutUpdateSchema>
