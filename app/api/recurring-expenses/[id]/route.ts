import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import RecurringExpense from '@/lib/models/RecurringExpense'
import { calculateNextDueDate } from '@/lib/services/recurringExpenseService'
import { z } from 'zod'
import { logger } from '@/lib/utils/performance'

const updateRecurringExpenseSchema = z.object({
  category: z.string().optional(),
  description: z.string().optional(),
  amount: z.number().min(0).optional(),
  currency: z.string().optional(),
  interval: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  startDate: z.string().or(z.date()).optional(),
  endDate: z.string().or(z.date()).optional().nullable(),
  branchId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  reminderDaysBefore: z.number().min(0).optional(),
  totalOccurrences: z.number().min(1).optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const recurringExpense = await RecurringExpense.findById(params.id)
      .populate('category', 'name type code')
      .populate('createdBy', 'name email')
      .lean()

    if (!recurringExpense) {
      return NextResponse.json({ error: 'Recurring expense not found' }, { status: 404 })
    }

    return NextResponse.json({ recurringExpense })
  } catch (error: any) {
    logger.error('Error fetching recurring expense:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recurring expense' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await request.json()
    const validationResult = updateRecurringExpenseSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const data = validationResult.data
    const updateData: any = {}

    if (data.category !== undefined) updateData.category = data.category
    if (data.description !== undefined) updateData.description = data.description
    if (data.amount !== undefined) updateData.amount = data.amount
    if (data.currency !== undefined) updateData.currency = data.currency
    if (data.interval !== undefined) updateData.interval = data.interval
    if (data.branchId !== undefined) updateData.branchId = data.branchId || undefined
    if (data.isActive !== undefined) updateData.isActive = data.isActive
    if (data.reminderDaysBefore !== undefined)
      updateData.reminderDaysBefore = data.reminderDaysBefore
    if (data.totalOccurrences !== undefined)
      updateData.totalOccurrences = data.totalOccurrences || undefined
    if (data.notes !== undefined) updateData.notes = data.notes || undefined

    // Handle dates
    if (data.startDate !== undefined) {
      const startDate =
        typeof data.startDate === 'string' ? new Date(data.startDate) : data.startDate
      updateData.startDate = startDate
      // Recalculate next due date if start date or interval changed
      if (data.interval !== undefined) {
        updateData.nextDueDate = calculateNextDueDate(startDate, data.interval)
      } else {
        const existing = await RecurringExpense.findById(params.id)
        if (existing) {
          updateData.nextDueDate = calculateNextDueDate(startDate, existing.interval)
        }
      }
    }

    if (data.endDate !== undefined) {
      updateData.endDate = data.endDate
        ? typeof data.endDate === 'string'
          ? new Date(data.endDate)
          : data.endDate
        : undefined
    }

    const recurringExpense = await RecurringExpense.findByIdAndUpdate(
      params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('category', 'name type code')
      .populate('createdBy', 'name email')
      .lean()

    if (!recurringExpense) {
      return NextResponse.json({ error: 'Recurring expense not found' }, { status: 404 })
    }

    return NextResponse.json({ recurringExpense })
  } catch (error: any) {
    logger.error('Error updating recurring expense:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update recurring expense' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const recurringExpense = await RecurringExpense.findByIdAndDelete(params.id)

    if (!recurringExpense) {
      return NextResponse.json({ error: 'Recurring expense not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Recurring expense deleted successfully' })
  } catch (error: any) {
    logger.error('Error deleting recurring expense:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete recurring expense' },
      { status: 500 }
    )
  }
}

