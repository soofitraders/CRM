import mongoose, { Schema, Document, Model } from 'mongoose'

export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'ONLINE'
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED'

export interface IPayment extends Document {
  booking: mongoose.Types.ObjectId
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  transactionId?: string
  gatewayReference?: string
  paidAt?: Date
  createdAt: Date
  updatedAt: Date
}

const PaymentSchema = new Schema<IPayment>(
  {
    booking: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking is required'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    method: {
      type: String,
      enum: ['CASH', 'CARD', 'BANK_TRANSFER', 'ONLINE'],
      required: [true, 'Payment method is required'],
    },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
      required: true,
      default: 'PENDING',
    },
    transactionId: {
      type: String,
      trim: true,
    },
    gatewayReference: {
      type: String,
      trim: true,
    },
    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes
PaymentSchema.index({ booking: 1 })
PaymentSchema.index({ status: 1 })
PaymentSchema.index({ method: 1 })
PaymentSchema.index({ transactionId: 1 })
PaymentSchema.index({ createdAt: -1 })

const Payment: Model<IPayment> = mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema)

export default Payment

