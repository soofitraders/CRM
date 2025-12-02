import mongoose, { Schema, Document, Model } from 'mongoose'

export type ReportType = 'REVENUE' | 'AR' | 'INVESTOR' | 'UTILIZATION'

export interface IReportPreset extends Document {
  _id: string
  user: mongoose.Types.ObjectId
  name: string
  type: ReportType
  filters: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

const ReportPresetSchema = new Schema<IReportPreset>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Preset name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['REVENUE', 'AR', 'INVESTOR', 'UTILIZATION'],
      required: true,
    },
    filters: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes
ReportPresetSchema.index({ user: 1, type: 1 })
ReportPresetSchema.index({ user: 1, createdAt: -1 })

const ReportPreset: Model<IReportPreset> =
  mongoose.models.ReportPreset || mongoose.model<IReportPreset>('ReportPreset', ReportPresetSchema)

export default ReportPreset

