import mongoose, { Schema, Document, Model } from 'mongoose'

export type ActivityType =
  | 'BOOKING_CREATED'
  | 'BOOKING_UPDATED'
  | 'BOOKING_DELETED'
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED'
  | 'INVOICE_PAID'
  | 'VEHICLE_CREATED'
  | 'VEHICLE_UPDATED'
  | 'VEHICLE_DELETED'
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'EXPENSE_CREATED'
  | 'EXPENSE_UPDATED'
  | 'EXPENSE_DELETED'
  | 'INVESTOR_PAYOUT_CREATED'
  | 'INVESTOR_PAYOUT_UPDATED'
  | 'MAINTENANCE_SCHEDULED'
  | 'MAINTENANCE_COMPLETED'
  | 'MILEAGE_UPDATED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'ROLE_CREATED'
  | 'ROLE_UPDATED'
  | 'ROLE_DELETED'
  | 'PERMISSION_CHANGED'
  | 'LOGIN'
  | 'LOGOUT'
  | 'OTHER'

export interface IActivityLog extends Document {
  user: mongoose.Types.ObjectId
  activityType: ActivityType
  module: string
  action: string
  description: string
  entityType?: string // e.g., 'Booking', 'Invoice', 'Vehicle'
  entityId?: mongoose.Types.ObjectId
  changes?: {
    field: string
    oldValue: any
    newValue: any
  }[]
  metadata?: {
    ipAddress?: string
    userAgent?: string
    branchId?: string
    [key: string]: any
  }
  createdAt: Date
}

const ChangeSchema = new Schema(
  {
    field: { type: String, required: true },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
  },
  { _id: false }
)

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    activityType: {
      type: String,
      enum: [
        'BOOKING_CREATED',
        'BOOKING_UPDATED',
        'BOOKING_DELETED',
        'INVOICE_CREATED',
        'INVOICE_UPDATED',
        'INVOICE_PAID',
        'VEHICLE_CREATED',
        'VEHICLE_UPDATED',
        'VEHICLE_DELETED',
        'CUSTOMER_CREATED',
        'CUSTOMER_UPDATED',
        'EXPENSE_CREATED',
        'EXPENSE_UPDATED',
        'EXPENSE_DELETED',
        'INVESTOR_PAYOUT_CREATED',
        'INVESTOR_PAYOUT_UPDATED',
        'MAINTENANCE_SCHEDULED',
        'MAINTENANCE_COMPLETED',
        'MILEAGE_UPDATED',
        'USER_CREATED',
        'USER_UPDATED',
        'USER_DELETED',
        'ROLE_CREATED',
        'ROLE_UPDATED',
        'ROLE_DELETED',
        'PERMISSION_CHANGED',
        'LOGIN',
        'LOGOUT',
        'OTHER',
      ],
      required: true,
    },
    module: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    entityType: {
      type: String,
    },
    entityId: {
      type: Schema.Types.ObjectId,
    },
    changes: {
      type: [ChangeSchema],
      default: [],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
)

// Create indexes
ActivityLogSchema.index({ user: 1, createdAt: -1 })
ActivityLogSchema.index({ activityType: 1, createdAt: -1 })
ActivityLogSchema.index({ module: 1, createdAt: -1 })
ActivityLogSchema.index({ entityType: 1, entityId: 1 })
ActivityLogSchema.index({ createdAt: -1 })
ActivityLogSchema.index({ 'metadata.branchId': 1 })

const ActivityLog: Model<IActivityLog> =
  mongoose.models.ActivityLog || mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema)

export default ActivityLog

