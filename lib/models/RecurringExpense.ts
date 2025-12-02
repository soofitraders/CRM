import mongoose, { Schema, Document, Model } from 'mongoose'

export type RecurrenceInterval = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

export interface IRecurringExpense extends Document {
  category: mongoose.Types.ObjectId
  description: string
  amount: number
  currency: string
  interval: RecurrenceInterval
  startDate: Date
  nextDueDate: Date
  endDate?: Date
  branchId?: string
  createdBy: mongoose.Types.ObjectId
  isActive: boolean
  reminderDaysBefore: number // Days before due date to send reminder
  lastProcessedDate?: Date
  totalOccurrences?: number // Total number of times this expense should occur (optional)
  currentOccurrence: number // Current occurrence count
  notes?: string
  createdAt: Date
  updatedAt: Date
}

const RecurringExpenseSchema = new Schema<IRecurringExpense>(
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
    interval: {
      type: String,
      enum: ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'],
      required: [true, 'Interval is required'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    nextDueDate: {
      type: Date,
      required: [true, 'Next due date is required'],
    },
    endDate: {
      type: Date,
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
    isActive: {
      type: Boolean,
      default: true,
    },
    reminderDaysBefore: {
      type: Number,
      default: 3, // Default 3 days before
      min: [0, 'Reminder days cannot be negative'],
    },
    lastProcessedDate: {
      type: Date,
    },
    totalOccurrences: {
      type: Number,
      min: [1, 'Total occurrences must be at least 1'],
    },
    currentOccurrence: {
      type: Number,
      default: 0,
      min: [0, 'Current occurrence cannot be negative'],
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
RecurringExpenseSchema.index({ isActive: 1, nextDueDate: 1 })
RecurringExpenseSchema.index({ createdBy: 1 })
RecurringExpenseSchema.index({ branchId: 1 })
RecurringExpenseSchema.index({ category: 1 })
RecurringExpenseSchema.index({ nextDueDate: 1 })

const RecurringExpense: Model<IRecurringExpense> =
  mongoose.models.RecurringExpense ||
  mongoose.model<IRecurringExpense>('RecurringExpense', RecurringExpenseSchema)

export default RecurringExpense

