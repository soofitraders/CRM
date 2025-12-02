import { z } from 'zod'

export const createCustomerSchema = z.object({
  // User fields
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  
  // CustomerProfile fields
  nationalId: z.string().optional(),
  passportNumber: z.string().optional(),
  drivingLicenseNumber: z.string().min(1, 'Driving license number is required'),
  drivingLicenseCountry: z.string().min(1, 'Driving license country is required'),
  drivingLicenseExpiry: z.string().or(z.date()),
  phone: z.string().min(1, 'Phone is required'),
  alternatePhone: z.string().optional(),
  addressLine1: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  country: z.string().min(1, 'Country is required'),
  emergencyContactName: z.string().min(1, 'Emergency contact name is required'),
  emergencyContactPhone: z.string().min(1, 'Emergency contact phone is required'),
})

export const updateCustomerSchema = createCustomerSchema.partial().extend({
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
})

export const customerQuerySchema = z.object({
  search: z.string().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
})

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
export type CustomerQueryInput = z.infer<typeof customerQuerySchema>

