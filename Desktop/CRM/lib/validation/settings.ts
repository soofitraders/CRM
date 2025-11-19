import { z } from 'zod'

export const updateSettingsSchema = z.object({
  companyName: z.string().min(1, 'Company name is required').trim().optional(),
  defaultCurrency: z.string().min(1, 'Currency is required').trim().uppercase().optional(),
  timezone: z.string().min(1, 'Timezone is required').trim().optional(),
  defaultTaxPercent: z.number().min(0).max(100, 'Tax percent cannot exceed 100').optional(),
})

export const updateNotificationPreferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
})

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>

