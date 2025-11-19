import { z } from 'zod'

export const paymentStatusSchema = z.enum(['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'])
export const paymentMethodSchema = z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE'])

export const paymentQuerySchema = z.object({
  status: paymentStatusSchema.optional(),
  method: paymentMethodSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
})

export type PaymentQueryInput = z.infer<typeof paymentQuerySchema>

