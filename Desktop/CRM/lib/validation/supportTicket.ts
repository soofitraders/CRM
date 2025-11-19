import { z } from 'zod'

export const ticketPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])

export const createSupportTicketSchema = z.object({
  subject: z.string().min(1, 'Subject is required').trim().max(200, 'Subject too long'),
  description: z.string().min(10, 'Description must be at least 10 characters').trim(),
  priority: ticketPrioritySchema.default('MEDIUM'),
})

export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>

