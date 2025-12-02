import mongoose, { Schema, Document, Model } from 'mongoose'

export type NotificationType =
  | 'MILEAGE_WARNING'
  | 'MAINTENANCE_REQUIRED'
  | 'BOOKING_REMINDER'
  | 'PAYMENT_DUE'
  | 'SYSTEM_ALERT'
  | 'GENERAL'

export interface INotification extends Document {
  user: mongoose.Types.ObjectId
  type: NotificationType
  title: string
  message: string
  data?: any
  read: boolean
  readAt?: Date
  createdAt: Date
  updatedAt: Date
}

const NotificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    type: {
      type: String,
      enum: [
        'MILEAGE_WARNING',
        'MAINTENANCE_REQUIRED',
        'BOOKING_REMINDER',
        'PAYMENT_DUE',
        'SYSTEM_ALERT',
        'GENERAL',
      ],
      required: [true, 'Notification type is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
    },
    data: {
      type: Schema.Types.Mixed,
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes
NotificationSchema.index({ user: 1, read: 1 })
NotificationSchema.index({ user: 1, createdAt: -1 })
NotificationSchema.index({ type: 1 })
NotificationSchema.index({ read: 1 })

const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>('Notification', NotificationSchema)

export default Notification
