import mongoose, { Schema, Document, Model } from 'mongoose'

export type SalaryStatus = 'PENDING' | 'PAID'

export interface ISalaryRecord extends Document {
  staffUser: mongoose.Types.ObjectId
  month: number
  year: number
  grossSalary: number
  allowances?: number
  deductions?: number
  netSalary: number
  status: SalaryStatus
  paidAt?: Date
  notes?: string
  branchId?: string
  expense?: mongoose.Types.ObjectId
  createdBy: mongoose.Types.ObjectId
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
}

const SalaryRecordSchema = new Schema<ISalaryRecord>(
  {
    staffUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Staff user is required'],
    },
    month: {
      type: Number,
      required: [true, 'Month is required'],
      min: [1, 'Month must be between 1 and 12'],
      max: [12, 'Month must be between 1 and 12'],
    },
    year: {
      type: Number,
      required: [true, 'Year is required'],
      min: [2000, 'Year must be valid'],
      max: [2100, 'Year must be valid'],
    },
    grossSalary: {
      type: Number,
      required: [true, 'Gross salary is required'],
      min: [0, 'Gross salary cannot be negative'],
    },
    allowances: {
      type: Number,
      default: 0,
      min: [0, 'Allowances cannot be negative'],
    },
    deductions: {
      type: Number,
      default: 0,
      min: [0, 'Deductions cannot be negative'],
    },
    netSalary: {
      type: Number,
      required: [true, 'Net salary is required'],
      min: [0, 'Net salary cannot be negative'],
    },
    status: {
      type: String,
      enum: ['PENDING', 'PAID'],
      required: true,
      default: 'PENDING',
    },
    paidAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
    branchId: {
      type: String,
      trim: true,
    },
    expense: {
      type: Schema.Types.ObjectId,
      ref: 'Expense',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by user is required'],
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes
SalaryRecordSchema.index({ staffUser: 1 })
SalaryRecordSchema.index({ year: -1, month: -1 })
SalaryRecordSchema.index({ status: 1 })
SalaryRecordSchema.index({ isDeleted: 1 })
SalaryRecordSchema.index({ expense: 1 })
SalaryRecordSchema.index({ branchId: 1 })
// Unique index only for non-deleted records - allows soft-deleted records to be replaced
SalaryRecordSchema.index(
  { staffUser: 1, year: 1, month: 1 },
  { 
    unique: true,
    partialFilterExpression: { isDeleted: { $ne: true } }
  }
)

const SalaryRecord: Model<ISalaryRecord> =
  mongoose.models.SalaryRecord ||
  mongoose.model<ISalaryRecord>('SalaryRecord', SalaryRecordSchema)

export default SalaryRecord

