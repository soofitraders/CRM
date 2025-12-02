import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IMileageHistory extends Document {
  vehicle: mongoose.Types.ObjectId
  mileage: number
  recordedAt: Date
  recordedBy: mongoose.Types.ObjectId
  source: 'BOOKING' | 'INVOICE' | 'MANUAL' | 'MAINTENANCE'
  booking?: mongoose.Types.ObjectId
  invoice?: mongoose.Types.ObjectId
  notes?: string
  createdAt: Date
  updatedAt: Date
}

const MileageHistorySchema = new Schema<IMileageHistory>(
  {
    vehicle: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Vehicle is required'],
    },
    mileage: {
      type: Number,
      required: [true, 'Mileage is required'],
      min: [0, 'Mileage cannot be negative'],
    },
    recordedAt: {
      type: Date,
      required: [true, 'Recorded at date is required'],
      default: Date.now,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recorded by user is required'],
    },
    source: {
      type: String,
      enum: ['BOOKING', 'INVOICE', 'MANUAL', 'MAINTENANCE'],
      required: [true, 'Source is required'],
    },
    booking: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
    },
    invoice: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes
MileageHistorySchema.index({ vehicle: 1, recordedAt: -1 })
MileageHistorySchema.index({ vehicle: 1 })
MileageHistorySchema.index({ recordedAt: -1 })
MileageHistorySchema.index({ booking: 1 })
MileageHistorySchema.index({ invoice: 1 })

const MileageHistory: Model<IMileageHistory> =
  mongoose.models.MileageHistory ||
  mongoose.model<IMileageHistory>('MileageHistory', MileageHistorySchema)

export default MileageHistory

