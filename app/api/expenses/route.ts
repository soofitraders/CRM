export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import Expense from '@/lib/models/Expense'
import ExpenseCategory from '@/lib/models/ExpenseCategory'
import SalaryRecord from '@/lib/models/SalaryRecord'
import { startOfDay, endOfDay } from 'date-fns'
import { cacheQuery } from '@/lib/cache/cacheUtils'
import { CacheKeys } from '@/lib/cache/cacheKeys'
import { invalidateFinancialCache } from '@/lib/cache/cacheUtils'
import { logger } from '@/lib/utils/performance'

// GET - List expenses with filters
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
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const categoryId = searchParams.get('categoryId')
    const branchId = searchParams.get('branchId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const filter: any = {
      isDeleted: false,
    }

    if (dateFrom && dateTo) {
      filter.dateIncurred = {
        $gte: startOfDay(new Date(dateFrom)),
        $lte: endOfDay(new Date(dateTo)),
      }
    }

    if (categoryId) {
      filter.category = categoryId
    }

    if (branchId) {
      filter.branchId = branchId
    }

    const skip = (page - 1) * limit

    // Create cache key
    const cacheKey = CacheKeys.financialSummary(JSON.stringify({ filter, page, limit }))
    
    // Use cache
    const result = await cacheQuery(
      cacheKey,
      async () => {
        // Execute queries in parallel
        const [expenses, total] = await Promise.all([
          Expense.find(filter)
            .populate({
              path: 'category',
              select: 'name type code',
            })
            .populate({
              path: 'salaryRecord',
              select: 'month year staffUser',
              populate: {
                path: 'staffUser',
                select: 'name',
              },
            })
            .populate({
              path: 'investorPayout',
              select: 'periodFrom periodTo investor',
              populate: {
                path: 'investor',
                select: 'user',
                populate: {
                  path: 'user',
                  select: 'name',
                },
              },
            })
            .populate('createdBy', 'name email')
            .sort({ dateIncurred: -1 })
            .skip(skip)
            .limit(limit)
            .lean()
            .catch(() => {
              // Fallback without complex populate
              return Expense.find(filter)
                .populate('category', 'name type code')
                .populate('createdBy', 'name email')
                .sort({ dateIncurred: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
            }),
          Expense.countDocuments(filter),
        ])

        return { expenses, total }
      },
      60 // Cache for 1 minute
    )

    const { expenses, total } = result

    return NextResponse.json({
      expenses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    logger.error('Error fetching expenses:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch expenses' },
      { status: 500 }
    )
  }
}

// POST - Create new expense
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
    const { category, description, amount, currency, dateIncurred, branchId, salaryRecord, investorPayout, investor } = body

    // Block manual creation of salary expenses
    if (salaryRecord) {
      return NextResponse.json(
        { error: 'Salary expenses must be created via Salary APIs only. Please use the Salaries module to create salary records.' },
        { status: 400 }
      )
    }

    // Block manual creation of investor payout expenses
    if (investorPayout) {
      return NextResponse.json(
        { error: 'Investor payout expenses must be created via Investor Payout APIs only. Please use the Investor Payouts module to create payout records.' },
        { status: 400 }
      )
    }

    if (!category || !description || amount === undefined || !dateIncurred) {
      return NextResponse.json(
        { error: 'category, description, amount, and dateIncurred are required' },
        { status: 400 }
      )
    }

    // Check if trying to create expense with Salaries or Investor Payouts category
    const categoryDoc = await ExpenseCategory.findById(category).lean()
    if (categoryDoc) {
      if (categoryDoc.code === 'SALARIES') {
        return NextResponse.json(
          { error: 'Salary expenses must be created via Salary APIs only. Please use the Salaries module to create salary records.' },
          { status: 400 }
        )
      }
      if (categoryDoc.code === 'INVESTOR_PAYOUTS') {
        return NextResponse.json(
          { error: 'Investor payout expenses must be created via Investor Payout APIs only. Please use the Investor Payouts module to create payout records.' },
          { status: 400 }
        )
      }
    }

    const expense = await Expense.create({
      category,
      description,
      amount: parseFloat(amount),
      currency: currency || 'AED',
      dateIncurred: new Date(dateIncurred),
      branchId: branchId || undefined,
      investor: investor || undefined,
      createdBy: user._id,
    })

    // Invalidate cache
    invalidateFinancialCache()

    const populatedExpense = await Expense.findById(expense._id)
      .populate('category', 'name type code')
      .populate('salaryRecord')
      .populate('createdBy', 'name email')
      .lean()

    return NextResponse.json({ expense: populatedExpense }, { status: 201 })
  } catch (error: any) {
      logger.error('Error creating expense:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create expense' },
      { status: 500 }
    )
  }
}

