import { z } from 'zod'
import { calculateBookingAmounts } from '@/lib/utils/bookingPricing'
import { depositMessage } from '@/lib/utils/bookingRules'

export const bookingStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'CHECKED_OUT',
  'CHECKED_IN',
  'CANCELLED',
])

export const rentalTypeSchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY'])

export const depositStatusSchema = z.enum(['HELD', 'RELEASED', 'PARTIAL'])

export const paymentStatusSchema = z.enum(['UNPAID', 'PARTIALLY_PAID', 'PAID'])

export const createBookingSchema = z
  .object({
    vehicle: z.string().min(1, 'Vehicle is required'),
    customer: z.string().min(1, 'Customer is required'),
    rentalType: rentalTypeSchema,
    startDateTime: z.string().or(z.date()),
    endDateTime: z.string().or(z.date()).optional(),
    pickupBranch: z.string().min(1, 'Pickup branch is required'),
    dropoffBranch: z.string().min(1, 'Dropoff branch is required'),
    baseRate: z.number().min(0, 'Base rate must be positive'),
    discounts: z.number().min(0, 'Discounts cannot be negative').default(0),
    taxPercent: z.number().min(0).max(100, 'Tax percent must be between 0 and 100').default(0),
    depositAmount: z.number().min(0, 'Deposit amount must be positive'),
    notes: z.string().optional(),
    status: bookingStatusSchema.optional(),
  })
  .refine(
    (data) => {
      if (!data.endDateTime) return true // End date is optional
      const start = new Date(data.startDateTime)
      const end = new Date(data.endDateTime)
      return end > start
    },
    {
      message: 'End date must be after start date',
      path: ['endDateTime'],
    }
  )
  .superRefine((data, ctx) => {
    // The deposit is part of what the customer pays, so it can't exceed the booking total
    const total = calculateBookingAmounts({
      rentalType: data.rentalType,
      baseRate: data.baseRate,
      discounts: data.discounts,
      taxPercent: data.taxPercent,
      startDateTime: data.startDateTime,
      endDateTime: data.endDateTime,
    }).totalAmount
    if (data.depositAmount > total + 0.005) {
      ctx.addIssue({
        code: 'custom',
        message: depositMessage(data.depositAmount, total),
        path: ['depositAmount'],
      })
    }
  })

export const updateBookingSchema = z.object({
  status: bookingStatusSchema.optional(),
  startDateTime: z.string().or(z.date()).optional(),
  endDateTime: z.string().or(z.date()).optional(),
  paymentStatus: paymentStatusSchema.optional(),
  depositStatus: depositStatusSchema.optional(),
  baseRate: z.number().min(0).optional(),
  discounts: z.number().min(0).optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  depositAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
})

export const bookingQuerySchema = z.object({
  status: bookingStatusSchema.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
})

export type CreateBookingInput = z.infer<typeof createBookingSchema>
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>
export type BookingQueryInput = z.infer<typeof bookingQuerySchema>

