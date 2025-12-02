import { z } from 'zod'

export const vehicleCategorySchema = z.enum([
  'SUV',
  'SEDAN',
  'HATCHBACK',
  'COUPE',
  'CONVERTIBLE',
  'WAGON',
  'VAN',
  'TRUCK',
  'OTHER',
])

export const ownershipTypeSchema = z.enum(['COMPANY', 'INVESTOR'])

export const vehicleStatusSchema = z.enum([
  'AVAILABLE',
  'BOOKED',
  'IN_MAINTENANCE',
  'INACTIVE',
])

export const fuelTypeSchema = z.enum(['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG'])

export const transmissionSchema = z.enum(['MANUAL', 'AUTOMATIC', 'CVT'])

export const createVehicleSchema = z.object({
  plateNumber: z.string().min(1, 'Plate number is required'),
  vin: z.string().min(1, 'VIN is required'),
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.number().min(1900).max(new Date().getFullYear() + 1),
  category: vehicleCategorySchema,
  ownershipType: ownershipTypeSchema,
  investor: z.string().optional(),
  status: vehicleStatusSchema.default('AVAILABLE'),
  mileage: z.number().min(0),
  fuelType: fuelTypeSchema,
  transmission: transmissionSchema,
  registrationExpiry: z.string().or(z.date()),
  insuranceExpiry: z.string().or(z.date()),
  dailyRate: z.number().min(0),
  weeklyRate: z.number().min(0),
  monthlyRate: z.number().min(0),
  currentBranch: z.string().min(1, 'Current branch is required'),
})

export const updateVehicleSchema = createVehicleSchema.partial()

export const vehicleQuerySchema = z.object({
  status: vehicleStatusSchema.optional(),
  ownershipType: ownershipTypeSchema.optional(),
  branch: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
})

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>
export type VehicleQueryInput = z.infer<typeof vehicleQuerySchema>

