import mongoose, { Schema, Document, Model } from 'mongoose'

export type ScheduleType = 'MILEAGE' | 'TIME' | 'BOTH'
export type TimeInterval = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

export interface IMaintenanceSchedule extends Document {
  vehicle: mongoose.Types.ObjectId
  serviceType: string // e.g., 'Oil Change', 'Tire Replacement', 'Brake Inspection'
  scheduleType: ScheduleType
  mileageInterval?: number // Miles/kilometers between services
  timeInterval?: TimeInterval // Time-based interval
  timeIntervalDays?: number // Custom days for time interval
  lastServiceMileage?: number // Last mileage when service was performed
  lastServiceDate?: Date // Last date when service was performed
  nextServiceMileage?: number // Next mileage when service is due
  nextServiceDate?: Date // Next date when service is due
  reminderDaysBefore?: number // Days before to send reminder
  reminderMileageBefore?: number // Miles before to send reminder
  estimatedCost?: number
  isActive: boolean
  notes?: string
  createdBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const MaintenanceScheduleSchema = new Schema<IMaintenanceSchedule>(
  {
    vehicle: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Vehicle is required'],
    },
    serviceType: {
      type: String,
      required: [true, 'Service type is required'],
      trim: true,
    },
    scheduleType: {
      type: String,
      enum: ['MILEAGE', 'TIME', 'BOTH'],
      required: [true, 'Schedule type is required'],
    },
    mileageInterval: {
      type: Number,
      min: [0, 'Mileage interval cannot be negative'],
    },
    timeInterval: {
      type: String,
      enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'],
    },
    timeIntervalDays: {
      type: Number,
      min: [1, 'Time interval days must be at least 1'],
    },
    lastServiceMileage: {
      type: Number,
      min: [0, 'Last service mileage cannot be negative'],
    },
    lastServiceDate: {
      type: Date,
    },
    nextServiceMileage: {
      type: Number,
      min: [0, 'Next service mileage cannot be negative'],
    },
    nextServiceDate: {
      type: Date,
    },
    reminderDaysBefore: {
      type: Number,
      default: 7,
      min: [0, 'Reminder days cannot be negative'],
    },
    reminderMileageBefore: {
      type: Number,
      default: 500,
      min: [0, 'Reminder mileage cannot be negative'],
    },
    estimatedCost: {
      type: Number,
      min: [0, 'Estimated cost cannot be negative'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by user is required'],
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes
MaintenanceScheduleSchema.index({ vehicle: 1, isActive: 1 })
MaintenanceScheduleSchema.index({ nextServiceDate: 1 })
MaintenanceScheduleSchema.index({ nextServiceMileage: 1 })
MaintenanceScheduleSchema.index({ isActive: 1 })

const MaintenanceSchedule: Model<IMaintenanceSchedule> =
  mongoose.models.MaintenanceSchedule ||
  mongoose.model<IMaintenanceSchedule>('MaintenanceSchedule', MaintenanceScheduleSchema)

export default MaintenanceSchedule

