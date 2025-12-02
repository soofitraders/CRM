import mongoose, { Schema, Document, Model } from 'mongoose'
import connectDB from '@/lib/db'
import { logger } from '@/lib/utils/performance'

export type ExpenseCategoryType = 'COGS' | 'OPEX'

export interface IExpenseCategory extends Document {
  name: string
  code: string
  type: ExpenseCategoryType
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface IExpenseCategoryModel extends Model<IExpenseCategory> {
  ensureDefaultCategories(): Promise<void>
}

const ExpenseCategorySchema = new Schema<IExpenseCategory>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Category code is required'],
      trim: true,
      unique: true,
      uppercase: true,
    },
    type: {
      type: String,
      enum: ['COGS', 'OPEX'],
      required: [true, 'Category type is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
)

// Create indexes
ExpenseCategorySchema.index({ code: 1 }, { unique: true })
ExpenseCategorySchema.index({ name: 1 })
ExpenseCategorySchema.index({ type: 1 })
ExpenseCategorySchema.index({ isActive: 1 })

// Static method to ensure default categories exist
// Use a simple flag to prevent concurrent calls
let ensuringCategories = false
let categoriesEnsured = false

ExpenseCategorySchema.statics.ensureDefaultCategories = async function () {
  // If already ensured in this process, skip
  if (categoriesEnsured) {
    return
  }

  // If currently ensuring, wait a bit and check again
  if (ensuringCategories) {
    // Wait up to 2 seconds for the other call to finish
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      if (categoriesEnsured) {
        return
      }
    }
  }

  ensuringCategories = true

  try {
    await connectDB()
    
    const defaultCategories = [
      { code: 'SALARIES', name: 'Salaries', type: 'OPEX' as ExpenseCategoryType },
      { code: 'RENT', name: 'Rent', type: 'OPEX' as ExpenseCategoryType },
      { code: 'FUEL', name: 'Fuel', type: 'COGS' as ExpenseCategoryType },
      { code: 'MAINTENANCE', name: 'Maintenance', type: 'COGS' as ExpenseCategoryType },
      { code: 'MARKETING', name: 'Marketing', type: 'OPEX' as ExpenseCategoryType },
      { code: 'SOFTWARE', name: 'Software', type: 'OPEX' as ExpenseCategoryType },
      { code: 'INVESTOR_PAYOUTS', name: 'Investor Payouts', type: 'COGS' as ExpenseCategoryType },
    ]

    for (const cat of defaultCategories) {
      try {
        // First check if category with this code exists
        const existing = await this.findOne({ code: cat.code }).lean()
        
        if (existing) {
          // Update if needed (e.g., if name or type changed)
          if (existing.name !== cat.name || existing.type !== cat.type || existing.isActive !== true) {
            await this.findByIdAndUpdate(existing._id, {
              name: cat.name,
              type: cat.type,
              isActive: true,
            })
          }
        } else {
          // Check if category with same name exists (to avoid duplicate name error)
          const existingByName = await this.findOne({ name: cat.name }).lean()
          
          if (existingByName) {
            // Update existing category to use the correct code
            await this.findByIdAndUpdate(existingByName._id, {
              code: cat.code,
              type: cat.type,
              isActive: true,
            })
          } else {
            // Create new category
            await this.create({ ...cat, isActive: true })
          }
        }
      } catch (error: any) {
        // If there's a duplicate key error, try to find and update existing
        if (error.code === 11000) {
          logger.warn(`Category ${cat.code} already exists, skipping...`)
          // Try to find by code or name and update
          const existing = await this.findOne({
            $or: [{ code: cat.code }, { name: cat.name }],
          })
          if (existing) {
            await this.findByIdAndUpdate(existing._id, {
              code: cat.code,
              name: cat.name,
              type: cat.type,
              isActive: true,
            })
          }
        } else {
          logger.error(`Error ensuring category ${cat.code}:`, error)
          // Don't throw - just log and continue
        }
      }
    }

    categoriesEnsured = true
  } finally {
    ensuringCategories = false
  }
}

const ExpenseCategory: IExpenseCategoryModel =
  (mongoose.models.ExpenseCategory as IExpenseCategoryModel) ||
  mongoose.model<IExpenseCategory, IExpenseCategoryModel>('ExpenseCategory', ExpenseCategorySchema)

export default ExpenseCategory

