import mongoose, { Schema, Document, Model } from 'mongoose'

export type InvestorPayoutStatus = 'DRAFT' | 'PENDING' | 'PAID' | 'CANCELLED'

export interface IInvestorPayoutBreakdown {
  vehicle: mongoose.Types.ObjectId
  plateNumber: string
  brand: string
  model: string
  category: string
  bookingsCount: number
  revenue: number
}

export interface IInvestorPayoutTotals {
  totalRevenue: number
  commissionPercent: number
  commissionAmount: number
  netPayout: number
  breakdown: IInvestorPayoutBreakdown[]
}

export interface IInvestorPayout extends Document {
  investor: mongoose.Types.ObjectId
  periodFrom: Date
  periodTo: Date
  branchId?: string
  totals: IInvestorPayoutTotals
  status: InvestorPayoutStatus
  payment?: mongoose.Types.ObjectId
  expense?: mongoose.Types.ObjectId
  notes?: string
  createdBy: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const InvestorPayoutBreakdownSchema = new Schema<IInvestorPayoutBreakdown>(
  {
    vehicle: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    plateNumber: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      required: true,
    },
    model: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    bookingsCount: {
      type: Number,
      required: true,
      default: 0,
    },
    revenue: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { _id: false }
)

const InvestorPayoutTotalsSchema = new Schema<IInvestorPayoutTotals>(
  {
    totalRevenue: {
      type: Number,
      required: true,
      default: 0,
    },
    commissionPercent: {
      type: Number,
      required: true,
      default: 20,
    },
    commissionAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    netPayout: {
      type: Number,
      required: true,
      default: 0,
    },
    breakdown: {
      type: [InvestorPayoutBreakdownSchema],
      default: [],
    },
  },
  { _id: false }
)

const InvestorPayoutSchema = new Schema<IInvestorPayout>(
  {
    investor: {
      type: Schema.Types.ObjectId,
      ref: 'InvestorProfile',
      required: [true, 'Investor is required'],
    },
    periodFrom: {
      type: Date,
      required: [true, 'Period from date is required'],
    },
    periodTo: {
      type: Date,
      required: [true, 'Period to date is required'],
    },
    branchId: {
      type: String,
      trim: true,
    },
    totals: {
      type: InvestorPayoutTotalsSchema,
      required: true,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING', 'PAID', 'CANCELLED'],
      required: true,
      default: 'DRAFT',
    },
    payment: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
    },
    expense: {
      type: Schema.Types.ObjectId,
      ref: 'Expense',
    },
    notes: {
      type: String,
      trim: true,
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
InvestorPayoutSchema.index({ investor: 1, periodFrom: -1, periodTo: -1 })
InvestorPayoutSchema.index({ status: 1 })
InvestorPayoutSchema.index({ periodFrom: -1, periodTo: -1 })
InvestorPayoutSchema.index({ branchId: 1 })
InvestorPayoutSchema.index({ expense: 1 })
InvestorPayoutSchema.index({ payment: 1 })
InvestorPayoutSchema.index({ createdBy: 1 })

const InvestorPayout: Model<IInvestorPayout> =
  mongoose.models.InvestorPayout ||
  mongoose.model<IInvestorPayout>('InvestorPayout', InvestorPayoutSchema)

export default InvestorPayout
