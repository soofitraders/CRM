import connectDB from '@/lib/db'
import ExpenseCategory from '@/lib/models/ExpenseCategory'
import Expense from '@/lib/models/Expense'
import SalaryRecord from '@/lib/models/SalaryRecord'
import User from '@/lib/models/User'
import { endOfMonth } from 'date-fns'
import type { SalaryInput } from '@/lib/validation/salary'
import type { IUser } from '@/lib/models/User'

/**
 * Create a salary record with automatically linked expense
 */
export async function createSalaryWithExpense(
  input: SalaryInput,
  currentUser: IUser
) {
  await connectDB()

  // Ensure default categories exist
  await ExpenseCategory.ensureDefaultCategories()

  // Find the Salaries category
  const salariesCategory = await ExpenseCategory.findOne({ code: 'SALARIES' })
  if (!salariesCategory) {
    throw new Error('Salaries category not found. Please ensure default categories are created.')
  }

  // Calculate net salary
  const netSalary =
    input.netSalary !== undefined
      ? input.netSalary
      : input.grossSalary + (input.allowances || 0) - (input.deductions || 0)

  if (netSalary < 0) {
    throw new Error('Net salary cannot be negative')
  }

  // Get staff user details for description
  const staffUser = await User.findById(input.staffUser).select('name').lean()
  if (!staffUser) {
    throw new Error('Staff user not found')
  }

  // Determine dateIncurred (last day of the month)
  const dateIncurred = endOfMonth(new Date(input.year, input.month - 1))

  // Create salary record
  const salaryRecord = await SalaryRecord.create({
    staffUser: input.staffUser,
    month: input.month,
    year: input.year,
    grossSalary: input.grossSalary,
    allowances: input.allowances || 0,
    deductions: input.deductions || 0,
    netSalary,
    status: input.status || 'PENDING',
    paidAt: input.paidAt ? new Date(input.paidAt) : undefined,
    notes: input.notes,
    branchId: input.branchId,
    createdBy: currentUser._id,
  })

  // Create linked expense
  const expense = await Expense.create({
    category: salariesCategory._id,
    description: `Salary - ${staffUser.name} - ${input.month}/${input.year}`,
    amount: netSalary,
    currency: 'AED',
    dateIncurred,
    branchId: input.branchId,
    createdBy: currentUser._id,
    salaryRecord: salaryRecord._id,
  })

  // Link expense to salary record
  salaryRecord.expense = expense._id
  await salaryRecord.save()

  // Return populated salary record
  return await SalaryRecord.findById(salaryRecord._id)
    .populate('staffUser', 'name email role')
    .populate('expense')
    .populate('createdBy', 'name email')
    .lean()
}

/**
 * Update a salary record and sync the linked expense
 */
export async function updateSalaryWithExpense(
  id: string,
  updates: Partial<SalaryInput>,
  currentUser: IUser
) {
  await connectDB()

  // Load existing salary record
  const salaryRecord = await SalaryRecord.findById(id)
  if (!salaryRecord) {
    throw new Error('Salary record not found')
  }

  if (salaryRecord.isDeleted) {
    throw new Error('Cannot update deleted salary record')
  }

  // Apply updates
  if (updates.staffUser !== undefined) salaryRecord.staffUser = updates.staffUser
  if (updates.month !== undefined) salaryRecord.month = updates.month
  if (updates.year !== undefined) salaryRecord.year = updates.year
  if (updates.grossSalary !== undefined) salaryRecord.grossSalary = updates.grossSalary
  if (updates.allowances !== undefined) salaryRecord.allowances = updates.allowances
  if (updates.deductions !== undefined) salaryRecord.deductions = updates.deductions
  if (updates.status !== undefined) {
    salaryRecord.status = updates.status
    if (updates.status === 'PAID' && !salaryRecord.paidAt) {
      salaryRecord.paidAt = new Date()
    }
  }
  if (updates.paidAt !== undefined) {
    salaryRecord.paidAt = updates.paidAt ? new Date(updates.paidAt) : undefined
  }
  if (updates.notes !== undefined) salaryRecord.notes = updates.notes
  if (updates.branchId !== undefined) salaryRecord.branchId = updates.branchId

  // Recalculate net salary if amounts changed
  if (
    updates.grossSalary !== undefined ||
    updates.allowances !== undefined ||
    updates.deductions !== undefined
  ) {
    salaryRecord.netSalary =
      salaryRecord.grossSalary +
      (salaryRecord.allowances || 0) -
      (salaryRecord.deductions || 0)
  }

  if (salaryRecord.netSalary < 0) {
    throw new Error('Net salary cannot be negative')
  }

  // Ensure Salaries category exists
  await ExpenseCategory.ensureDefaultCategories()
  const salariesCategory = await ExpenseCategory.findOne({ code: 'SALARIES' })
  if (!salariesCategory) {
    throw new Error('Salaries category not found')
  }

  // Get staff user for description
  const staffUser = await User.findById(salaryRecord.staffUser).select('name').lean()
  if (!staffUser) {
    throw new Error('Staff user not found')
  }

  // Update or create linked expense
  if (salaryRecord.expense) {
    // Update existing expense
    const expense = await Expense.findById(salaryRecord.expense)
    if (expense && !expense.isDeleted) {
      expense.amount = salaryRecord.netSalary
      expense.dateIncurred = endOfMonth(
        new Date(salaryRecord.year, salaryRecord.month - 1)
      )
      expense.description = `Salary - ${staffUser.name} - ${salaryRecord.month}/${salaryRecord.year}`
      if (updates.branchId !== undefined) {
        expense.branchId = updates.branchId
      }
      await expense.save()
    }
  } else {
    // Create new expense if it doesn't exist
    const dateIncurred = endOfMonth(
      new Date(salaryRecord.year, salaryRecord.month - 1)
    )

    const expense = await Expense.create({
      category: salariesCategory._id,
      description: `Salary - ${staffUser.name} - ${salaryRecord.month}/${salaryRecord.year}`,
      amount: salaryRecord.netSalary,
      currency: 'AED',
      dateIncurred,
      branchId: salaryRecord.branchId,
      createdBy: currentUser._id,
      salaryRecord: salaryRecord._id,
    })

    salaryRecord.expense = expense._id
  }

  await salaryRecord.save()

  // Return updated salary record
  return await SalaryRecord.findById(salaryRecord._id)
    .populate('staffUser', 'name email role')
    .populate('expense')
    .populate('createdBy', 'name email')
    .lean()
}

/**
 * Delete a salary record and soft-delete the linked expense
 */
export async function deleteSalaryWithExpense(id: string, currentUser: IUser) {
  await connectDB()

  const salaryRecord = await SalaryRecord.findById(id)
  if (!salaryRecord) {
    throw new Error('Salary record not found')
  }

  // Soft delete linked expense if it exists
  if (salaryRecord.expense) {
    const expense = await Expense.findById(salaryRecord.expense)
    if (expense) {
      expense.isDeleted = true
      await expense.save()
    }
  }

  // Soft delete salary record
  salaryRecord.isDeleted = true
  await salaryRecord.save()

  return { success: true, message: 'Salary record and linked expense deleted successfully' }
}

