import mongoose, { Schema, Document, Model } from 'mongoose'

export type MaintenanceType = 'SERVICE' | 'REPAIR' | 'ACCIDENT' | 'INSPECTION'
export type MaintenanceStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED'

export interface IMaintenanceRecord extends Document {
  vehicle: mongoose.Types.ObjectId
  maintenanceSchedule?: mongoose.Types.ObjectId // Link to schedule if created from schedule
  type: MaintenanceType
  serviceType?: string // Service type (e.g., 'Oil Change')
  description: string
  status: MaintenanceStatus
  scheduledDate?: Date
  startDate?: Date // When maintenance actually started (for downtime tracking)
  completedDate?: Date
  cost: number
  vendorName?: string
  mileageAtService?: number // Vehicle mileage when service was performed
  downtimeHours?: number // Hours vehicle was out of service
  createdBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const MaintenanceRecordSchema = new Schema<IMaintenanceRecord>(
  {
    vehicle: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Vehicle is required'],
    },
    type: {
      type: String,
      enum: ['SERVICE', 'REPAIR', 'ACCIDENT', 'INSPECTION'],
      required: [true, 'Maintenance type is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'COMPLETED'],
      required: true,
      default: 'OPEN',
    },
    scheduledDate: {
      type: Date,
    },
    completedDate: {
      type: Date,
    },
    maintenanceSchedule: {
      type: Schema.Types.ObjectId,
      ref: 'MaintenanceSchedule',
    },
    serviceType: {
      type: String,
      trim: true,
    },
    cost: {
      type: Number,
      required: [true, 'Cost is required'],
      min: [0, 'Cost cannot be negative'],
      default: 0,
    },
    vendorName: {
      type: String,
      trim: true,
    },
    mileageAtService: {
      type: Number,
      min: [0, 'Mileage cannot be negative'],
    },
    startDate: {
      type: Date,
    },
    downtimeHours: {
      type: Number,
      min: [0, 'Downtime hours cannot be negative'],
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
MaintenanceRecordSchema.index({ vehicle: 1 })
MaintenanceRecordSchema.index({ status: 1 })
MaintenanceRecordSchema.index({ type: 1 })
MaintenanceRecordSchema.index({ createdBy: 1 })
MaintenanceRecordSchema.index({ scheduledDate: 1 })
MaintenanceRecordSchema.index({ createdAt: -1 })

const MaintenanceRecord: Model<IMaintenanceRecord> = mongoose.models.MaintenanceRecord || mongoose.model<IMaintenanceRecord>('MaintenanceRecord', MaintenanceRecordSchema)

export default MaintenanceRecord

