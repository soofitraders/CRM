import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import RecurringExpense from '@/lib/models/RecurringExpense'
import { calculateNextDueDate } from '@/lib/services/recurringExpenseService'
import { z } from 'zod'
import { logger } from '@/lib/utils/performance'

const createRecurringExpenseSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required'),
  amount: z.number().min(0, 'Amount must be positive'),
  currency: z.string().default('AED'),
  interval: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()).optional(),
  branchId: z.string().optional(),
  reminderDaysBefore: z.number().min(0).default(3),
  totalOccurrences: z.number().min(1).optional(),
  notes: z.string().optional(),
})

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams
    const isActive = searchParams.get('isActive')
    const branchId = searchParams.get('branchId')

    const filter: any = {}
    if (isActive !== null) {
      filter.isActive = isActive === 'true'
    }
    if (branchId) {
      filter.branchId = branchId
    }

    const recurringExpenses = await RecurringExpense.find(filter)
      .populate('category', 'name type code')
      .populate('createdBy', 'name email')
      .sort({ nextDueDate: 1 })
      .lean()

    return NextResponse.json({ recurringExpenses })
  } catch (error: any) {
    logger.error('Error fetching recurring expenses:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recurring expenses' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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
    const validationResult = createRecurringExpenseSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Parse dates
    const startDate = typeof data.startDate === 'string' ? new Date(data.startDate) : data.startDate
    const endDate = data.endDate
      ? typeof data.endDate === 'string'
        ? new Date(data.endDate)
        : data.endDate
      : undefined

    // Calculate next due date
    const nextDueDate = calculateNextDueDate(startDate, data.interval)

    const recurringExpense = await RecurringExpense.create({
      category: data.category,
      description: data.description,
      amount: data.amount,
      currency: data.currency || 'AED',
      interval: data.interval,
      startDate,
      nextDueDate,
      endDate,
      branchId: data.branchId || undefined,
      createdBy: user._id,
      isActive: true,
      reminderDaysBefore: data.reminderDaysBefore || 3,
      totalOccurrences: data.totalOccurrences,
      currentOccurrence: 0,
      notes: data.notes,
    })

    await recurringExpense.populate('category', 'name type code')
    await recurringExpense.populate('createdBy', 'name email')

    return NextResponse.json({ recurringExpense }, { status: 201 })
  } catch (error: any) {
    logger.error('Error creating recurring expense:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create recurring expense' },
      { status: 500 }
    )
  }
}

