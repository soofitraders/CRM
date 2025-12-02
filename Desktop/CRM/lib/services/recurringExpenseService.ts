import connectDB from '@/lib/db'
import RecurringExpense, { RecurrenceInterval } from '@/lib/models/RecurringExpense'
import Expense from '@/lib/models/Expense'
import { addWeeks, addMonths, addQuarters, addYears, addDays, isBefore, isAfter, startOfDay, endOfDay } from 'date-fns'

/**
 * Calculate next due date based on interval
 */
export function calculateNextDueDate(
  currentDate: Date,
  interval: RecurrenceInterval
): Date {
  switch (interval) {
    case 'WEEKLY':
      return addWeeks(currentDate, 1)
    case 'MONTHLY':
      return addMonths(currentDate, 1)
    case 'QUARTERLY':
      return addQuarters(currentDate, 1)
    case 'YEARLY':
      return addYears(currentDate, 1)
    default:
      return addMonths(currentDate, 1)
  }
}

/**
 * Process recurring expenses that are due
 */
export async function processRecurringExpenses(): Promise<{
  processed: number
  errors: number
  details: Array<{ recurringExpenseId: string; expenseId: string; error?: string }>
}> {
  await connectDB()

  const today = startOfDay(new Date())
  const results = {
    processed: 0,
    errors: 0,
    details: [] as Array<{ recurringExpenseId: string; expenseId: string; error?: string }>,
  }

  // Find all active recurring expenses that are due
  const dueRecurringExpenses = await RecurringExpense.find({
    isActive: true,
    nextDueDate: { $lte: endOfDay(today) },
    $or: [
      { endDate: { $exists: false } },
      { endDate: { $gte: today } },
    ],
  })
    .populate('category')
    .populate('createdBy')
    .lean()

  for (const recurringExpense of dueRecurringExpenses) {
    try {
      // Check if we've reached the total occurrences limit
      if (
        recurringExpense.totalOccurrences &&
        recurringExpense.currentOccurrence >= recurringExpense.totalOccurrences
      ) {
        // Deactivate this recurring expense
        await RecurringExpense.updateOne(
          { _id: recurringExpense._id },
          { isActive: false }
        )
        continue
      }

      // Check if end date has passed
      if (recurringExpense.endDate && isAfter(today, recurringExpense.endDate)) {
        await RecurringExpense.updateOne(
          { _id: recurringExpense._id },
          { isActive: false }
        )
        continue
      }

      // Create the expense
      const expense = await Expense.create({
        category: recurringExpense.category,
        description: recurringExpense.description,
        amount: recurringExpense.amount,
        currency: recurringExpense.currency,
        dateIncurred: recurringExpense.nextDueDate,
        branchId: recurringExpense.branchId,
        createdBy: recurringExpense.createdBy,
        isDeleted: false,
      })

      // Calculate next due date
      const nextDueDate = calculateNextDueDate(
        recurringExpense.nextDueDate,
        recurringExpense.interval
      )

      // Update recurring expense
      await RecurringExpense.updateOne(
        { _id: recurringExpense._id },
        {
          nextDueDate,
          lastProcessedDate: today,
          currentOccurrence: recurringExpense.currentOccurrence + 1,
        }
      )

      results.processed++
      results.details.push({
        recurringExpenseId: String(recurringExpense._id),
        expenseId: String(expense._id),
      })
    } catch (error: any) {
      console.error(
        `Error processing recurring expense ${recurringExpense._id}:`,
        error
      )
      results.errors++
      results.details.push({
        recurringExpenseId: String(recurringExpense._id),
        expenseId: '',
        error: error.message,
      })
    }
  }

  return results
}

/**
 * Get upcoming recurring expenses that need reminders
 */
export async function getUpcomingRecurringExpenses(
  daysAhead: number = 7
): Promise<any[]> {
  await connectDB()

  const today = startOfDay(new Date())
  const reminderDate = addDays(today, daysAhead)

  const upcomingExpenses = await RecurringExpense.find({
    isActive: true,
    nextDueDate: {
      $gte: today,
      $lte: reminderDate,
    },
  })
    .populate('category', 'name type code')
    .populate('createdBy', 'name email')
    .sort({ nextDueDate: 1 })
    .lean()

  return upcomingExpenses
}

/**
 * Get recurring expense history
 */
export async function getRecurringExpenseHistory(
  recurringExpenseId: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<any[]> {
  await connectDB()

  const filter: any = {
    category: (await RecurringExpense.findById(recurringExpenseId))?.category,
    description: (await RecurringExpense.findById(recurringExpenseId))?.description,
    amount: (await RecurringExpense.findById(recurringExpenseId))?.amount,
    isDeleted: false,
  }

  if (dateFrom && dateTo) {
    filter.dateIncurred = {
      $gte: startOfDay(dateFrom),
      $lte: endOfDay(dateTo),
    }
  }

  const expenses = await Expense.find(filter)
    .populate('category', 'name type code')
    .populate('createdBy', 'name email')
    .sort({ dateIncurred: -1 })
    .lean()

  return expenses
}


