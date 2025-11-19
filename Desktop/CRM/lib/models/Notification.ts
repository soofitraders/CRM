import mongoose, { Schema, Document, Model } from 'mongoose'

export type NotificationType = 'SYSTEM' | 'BOOKING' | 'PAYMENT' | 'MAINTENANCE' | 'COMPLIANCE'

export interface INotification extends Document {
  user: mongoose.Types.ObjectId
  title: string
  message: string
  type: NotificationType
  read: boolean
  createdAt: Date
}

const NotificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
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
    type: {
      type: String,
      enum: ['SYSTEM', 'BOOKING', 'PAYMENT', 'MAINTENANCE', 'COMPLIANCE'],
      required: [true, 'Notification type is required'],
      default: 'SYSTEM',
    },
    read: {
      type: Boolean,
      required: true,
      default: false,
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
NotificationSchema.index({ createdAt: -1 })

const Notification: Model<INotification> = mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema)

export default Notification

