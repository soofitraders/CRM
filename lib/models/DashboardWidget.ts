import mongoose, { Schema, Document, Model } from 'mongoose'

export type WidgetType = 
  | 'REVENUE_SUMMARY' 
  | 'BOOKING_TRENDS' 
  | 'ACTIVE_VEHICLES' 
  | 'TOP_PERFORMING_VEHICLES' 
  | 'CUSTOMER_ACQUISITION'

export type TimeRange = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'

export interface IWidgetConfig {
  timeRange?: TimeRange
  limit?: number
  [key: string]: any
}

export interface IDashboardWidget extends Document {
  userId: mongoose.Types.ObjectId
  type: WidgetType
  title: string
  config: IWidgetConfig
  position: {
    x: number
    y: number
    w: number
    h: number
  }
  isShared: boolean
  sharedWithRoles?: string[]
  createdAt: Date
  updatedAt: Date
}

const DashboardWidgetSchema = new Schema<IDashboardWidget>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    type: {
      type: String,
      enum: ['REVENUE_SUMMARY', 'BOOKING_TRENDS', 'ACTIVE_VEHICLES', 'TOP_PERFORMING_VEHICLES', 'CUSTOMER_ACQUISITION'],
      required: [true, 'Widget type is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    config: {
      type: Schema.Types.Mixed,
      default: {},
    },
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      w: { type: Number, default: 4 },
      h: { type: Number, default: 3 },
    },
    isShared: {
      type: Boolean,
      default: false,
    },
    sharedWithRoles: [{
      type: String,
    }],
  },
  {
    timestamps: true,
  }
)

// Create indexes
DashboardWidgetSchema.index({ userId: 1 })
DashboardWidgetSchema.index({ isShared: 1 })
DashboardWidgetSchema.index({ sharedWithRoles: 1 })

const DashboardWidget: Model<IDashboardWidget> =
  mongoose.models.DashboardWidget ||
  mongoose.model<IDashboardWidget>('DashboardWidget', DashboardWidgetSchema)

export default DashboardWidget

