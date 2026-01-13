import { z } from 'zod'

export const invoiceStatusSchema = z.enum(['DRAFT', 'ISSUED', 'PAID', 'VOID'])

export const invoiceQuerySchema = z.object({
  status: invoiceStatusSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
})

export const updateInvoiceStatusSchema = z.object({
  status: z.enum(['PAID', 'VOID']).optional(),
  items: z
    .array(
      z.object({
        label: z.string().min(1, 'Item label is required'),
        amount: z.number(),
      })
    )
    .min(1, 'At least one item is required')
    .optional(),
  taxAmount: z.number().min(0, 'Tax amount cannot be negative').optional(),
})

export const createInvoiceSchema = z.object({
  booking: z.string().min(1, 'Booking ID is required'),
  items: z
    .array(
      z.object({
        label: z.string().min(1, 'Item label is required'),
        amount: z.number(),
      })
    )
    .min(1, 'At least one item is required'),
  issueDate: z.string().or(z.date()).optional(),
  dueDate: z.string().or(z.date()).optional(),
  taxPercent: z.number().min(0).max(100).optional(),
})

export const createInvoiceFromBookingSchema = z.object({
  booking: z.string().min(1, 'Booking ID is required'),
})

export type InvoiceQueryInput = z.infer<typeof invoiceQuerySchema>
export type UpdateInvoiceStatusInput = z.infer<typeof updateInvoiceStatusSchema>
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export type CreateInvoiceFromBookingInput = z.infer<typeof createInvoiceFromBookingSchema>

