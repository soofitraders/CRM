import mongoose, { Schema, Document, Model } from 'mongoose'

export interface IExpense extends Document {
  category: mongoose.Types.ObjectId
  description: string
  amount: number
  currency: string
  dateIncurred: Date
  branchId?: string
  createdBy: mongoose.Types.ObjectId
  salaryRecord?: mongoose.Types.ObjectId
  investorPayout?: mongoose.Types.ObjectId
  investor?: mongoose.Types.ObjectId
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
}

const ExpenseSchema = new Schema<IExpense>(
  {
    category: {
      type: Schema.Types.ObjectId,
      ref: 'ExpenseCategory',
      required: [true, 'Category is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'AED',
      trim: true,
      uppercase: true,
    },
    dateIncurred: {
      type: Date,
      required: [true, 'Date incurred is required'],
      default: Date.now,
    },
    branchId: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created by user is required'],
    },
    salaryRecord: {
      type: Schema.Types.ObjectId,
      ref: 'SalaryRecord',
    },
    investorPayout: {
      type: Schema.Types.ObjectId,
      ref: 'InvestorPayout',
    },
    investor: {
      type: Schema.Types.ObjectId,
      ref: 'InvestorProfile',
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
ExpenseSchema.index({ category: 1 })
ExpenseSchema.index({ dateIncurred: -1 })
ExpenseSchema.index({ branchId: 1 })
ExpenseSchema.index({ createdBy: 1 })
ExpenseSchema.index({ salaryRecord: 1 })
ExpenseSchema.index({ investorPayout: 1 })
ExpenseSchema.index({ investor: 1 })
ExpenseSchema.index({ isDeleted: 1 })
ExpenseSchema.index({ dateIncurred: 1, category: 1 })

const Expense: Model<IExpense> =
  mongoose.models.Expense || mongoose.model<IExpense>('Expense', ExpenseSchema)

export default Expense

