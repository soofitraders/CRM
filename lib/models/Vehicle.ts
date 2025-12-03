import mongoose, { Schema, Model } from 'mongoose'

export type VehicleCategory = 'SUV' | 'SEDAN' | 'HATCHBACK' | 'COUPE' | 'CONVERTIBLE' | 'WAGON' | 'VAN' | 'TRUCK' | 'OTHER'
export type OwnershipType = 'COMPANY' | 'INVESTOR'
export type VehicleStatus = 'AVAILABLE' | 'BOOKED' | 'IN_MAINTENANCE' | 'INACTIVE'
export type FuelType = 'PETROL' | 'DIESEL' | 'ELECTRIC' | 'HYBRID' | 'CNG'
export type Transmission = 'MANUAL' | 'AUTOMATIC' | 'CVT'

export interface IVehicle extends Omit<mongoose.Document, 'model'> {
  plateNumber: string
  vin: string
  brand: string
  model: string
  year: number
  category: VehicleCategory
  ownershipType: OwnershipType
  investor?: mongoose.Types.ObjectId
  status: VehicleStatus
  mileage: number
  lastUpdatedMileage?: Date
  maintenanceScheduled?: boolean
  fuelType: FuelType
  transmission: Transmission
  registrationExpiry: Date
  insuranceExpiry: Date
  dailyRate: number
  weeklyRate: number
  monthlyRate: number
  currentBranch: string
  createdAt: Date
  updatedAt: Date
}

const VehicleSchema = new Schema<IVehicle>(
  {
    plateNumber: {
      type: String,
      required: [true, 'Plate number is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    vin: {
      type: String,
      required: [true, 'VIN is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    brand: {
      type: String,
      required: [true, 'Brand is required'],
      trim: true,
    },
    model: {
      type: String,
      required: [true, 'Model is required'],
      trim: true,
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: [1900, 'Year must be valid'],
      max: [new Date().getFullYear() + 1, 'Year cannot be in the future'],
    },
    category: {
      type: String,
      enum: ['SUV', 'SEDAN', 'HATCHBACK', 'COUPE', 'CONVERTIBLE', 'WAGON', 'VAN', 'TRUCK', 'OTHER'],
      required: [true, 'Category is required'],
    },
    ownershipType: {
      type: String,
      enum: ['COMPANY', 'INVESTOR'],
      required: [true, 'Ownership type is required'],
    },
    investor: {
      type: Schema.Types.ObjectId,
      ref: 'InvestorProfile',
      required: function(this: IVehicle) {
        return this.ownershipType === 'INVESTOR'
      },
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'BOOKED', 'IN_MAINTENANCE', 'INACTIVE'],
      required: true,
      default: 'AVAILABLE',
    },
    mileage: {
      type: Number,
      required: [true, 'Mileage is required'],
      min: [0, 'Mileage cannot be negative'],
    },
    lastUpdatedMileage: {
      type: Date,
    },
    maintenanceScheduled: {
      type: Boolean,
      default: false,
    },
    fuelType: {
      type: String,
      enum: ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID', 'CNG'],
      required: [true, 'Fuel type is required'],
    },
    transmission: {
      type: String,
      enum: ['MANUAL', 'AUTOMATIC', 'CVT'],
      required: [true, 'Transmission is required'],
    },
    registrationExpiry: {
      type: Date,
      required: [true, 'Registration expiry is required'],
    },
    insuranceExpiry: {
      type: Date,
      required: [true, 'Insurance expiry is required'],
    },
    dailyRate: {
      type: Number,
      required: [true, 'Daily rate is required'],
      min: [0, 'Daily rate cannot be negative'],
    },
    weeklyRate: {
      type: Number,
      required: [true, 'Weekly rate is required'],
      min: [0, 'Weekly rate cannot be negative'],
    },
    monthlyRate: {
      type: Number,
      required: [true, 'Monthly rate is required'],
      min: [0, 'Monthly rate cannot be negative'],
    },
    currentBranch: {
      type: String,
      required: [true, 'Current branch is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes
VehicleSchema.index({ plateNumber: 1 }, { unique: true })
VehicleSchema.index({ vin: 1 }, { unique: true })
VehicleSchema.index({ status: 1 })
VehicleSchema.index({ ownershipType: 1 })
VehicleSchema.index({ investor: 1 })
VehicleSchema.index({ category: 1 })
VehicleSchema.index({ currentBranch: 1 })
VehicleSchema.index({ status: 1, currentBranch: 1 }) // Compound index for available vehicles by branch

const Vehicle: Model<IVehicle> = mongoose.models.Vehicle || mongoose.model<IVehicle>('Vehicle', VehicleSchema)

export default Vehicle

