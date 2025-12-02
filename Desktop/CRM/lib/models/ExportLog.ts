import mongoose, { Schema, Document, Model } from 'mongoose'

export type ExportModule = 'BOOKINGS' | 'INVOICES' | 'CLIENTS' | 'VEHICLES' | 'FINANCIALS' | 'EXPENSES' | 'CUSTOM'
export type ExportFormat = 'CSV' | 'EXCEL' | 'PDF'

export interface IExportLog extends Document {
  _id: string
  user: mongoose.Types.ObjectId
  module: ExportModule
  format: ExportFormat
  filters: Record<string, any>
  rowCount: number
  createdAt: Date
}

const ExportLogSchema = new Schema<IExportLog>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    module: {
      type: String,
      enum: ['BOOKINGS', 'INVOICES', 'CLIENTS', 'VEHICLES', 'FINANCIALS', 'EXPENSES', 'CUSTOM'],
      required: true,
    },
    format: {
      type: String,
      enum: ['CSV', 'EXCEL', 'PDF'],
      required: true,
    },
    filters: {
      type: Schema.Types.Mixed,
      default: {},
    },
    rowCount: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes
ExportLogSchema.index({ user: 1, createdAt: -1 })
ExportLogSchema.index({ module: 1, createdAt: -1 })
ExportLogSchema.index({ createdAt: -1 })

const ExportLog: Model<IExportLog> =
  mongoose.models.ExportLog || mongoose.model<IExportLog>('ExportLog', ExportLogSchema)

export default ExportLog

