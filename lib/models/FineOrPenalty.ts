import mongoose, { Schema, Document, Model } from 'mongoose'

export type FineStatus = 'PENDING' | 'DISPUTED' | 'PAID'

export interface IFineOrPenalty extends Document {
  vehicle: mongoose.Types.ObjectId
  booking?: mongoose.Types.ObjectId
  customer?: mongoose.Types.ObjectId
  authorityName: string
  referenceNumber: string
  issueDate: Date
  dueDate: Date
  amount: number
  status: FineStatus
  document?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const FineOrPenaltySchema = new Schema<IFineOrPenalty>(
  {
    vehicle: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Vehicle is required'],
    },
    booking: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'CustomerProfile',
    },
    authorityName: {
      type: String,
      required: [true, 'Authority name is required'],
      trim: true,
    },
    referenceNumber: {
      type: String,
      required: [true, 'Reference number is required'],
      trim: true,
    },
    issueDate: {
      type: Date,
      required: [true, 'Issue date is required'],
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    status: {
      type: String,
      enum: ['PENDING', 'DISPUTED', 'PAID'],
      required: true,
      default: 'PENDING',
    },
    document: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes
FineOrPenaltySchema.index({ vehicle: 1 })
FineOrPenaltySchema.index({ booking: 1 })
FineOrPenaltySchema.index({ customer: 1 })
FineOrPenaltySchema.index({ status: 1 })
FineOrPenaltySchema.index({ referenceNumber: 1 })
FineOrPenaltySchema.index({ dueDate: 1 })
FineOrPenaltySchema.index({ createdAt: -1 })

const FineOrPenalty: Model<IFineOrPenalty> = mongoose.models.FineOrPenalty || mongoose.model<IFineOrPenalty>('FineOrPenalty', FineOrPenaltySchema)

export default FineOrPenalty

