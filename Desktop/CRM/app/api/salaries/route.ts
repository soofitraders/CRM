import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import SalaryRecord from '@/lib/models/SalaryRecord'
import Expense from '@/lib/models/Expense'
import { createSalaryWithExpense } from '@/lib/services/salaryExpenseSyncService'
import { salaryInputSchema } from '@/lib/validation/salary'

// GET - List salary records with filters
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
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const staffUser = searchParams.get('staffUser')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const filter: any = {
      isDeleted: false,
    }

    if (year) {
      filter.year = parseInt(year)
    }

    if (month) {
      filter.month = parseInt(month)
    }

    if (staffUser) {
      filter.staffUser = staffUser
    }

    if (status) {
      filter.status = status
    }

    const skip = (page - 1) * limit

    let salaries
    try {
      salaries = await SalaryRecord.find(filter)
        .populate('staffUser', 'name email role')
        .populate({
          path: 'expense',
          select: 'amount dateIncurred description',
        })
        .populate('createdBy', 'name email')
        .sort({ year: -1, month: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    } catch (populateError: any) {
      console.error('Error populating salaries:', populateError)
      console.error('Error details:', {
        message: populateError.message,
        stack: populateError.stack,
        name: populateError.name,
      })
      // Fallback: try without expense populate
      try {
        salaries = await SalaryRecord.find(filter)
          .populate('staffUser', 'name email role')
          .populate('createdBy', 'name email')
          .sort({ year: -1, month: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
      } catch (fallbackError: any) {
        console.error('Fallback query also failed:', fallbackError)
        throw new Error('Failed to fetch salaries: ' + fallbackError.message)
      }
    }

    const total = await SalaryRecord.countDocuments(filter)

    return NextResponse.json({
      salaries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('Error fetching salaries:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch salaries' },
      { status: 500 }
    )
  }
}

// POST - Create new salary record
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
    
    // Validate input
    const validationResult = salaryInputSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const input = validationResult.data

    // Check if active (non-deleted) record already exists
    // The unique index allows different employees to have records in the same month/year
    // but prevents the same employee from having multiple active records in the same month/year
    const existing = await SalaryRecord.findOne({
      staffUser: input.staffUser,
      month: input.month,
      year: input.year,
      $or: [
        { isDeleted: false },
        { isDeleted: { $exists: false } },
        { isDeleted: null }
      ],
    })
      .populate('staffUser', 'name email')
      .lean()

    if (existing) {
      // Get staff name for better error message
      const staffUser = existing.staffUser as any
      const staffName = staffUser?.name || 'this staff member'
      const staffEmail = staffUser?.email || ''
      
      return NextResponse.json(
        { 
          error: `A salary record for ${staffName}${staffEmail ? ` (${staffEmail})` : ''} already exists for ${input.month}/${input.year}. Please edit the existing record instead, or use a different month/year.`,
          existingRecordId: existing._id,
          existingRecord: {
            id: existing._id,
            staffName,
            staffEmail,
            month: existing.month,
            year: existing.year,
            status: existing.status,
          }
        },
        { status: 400 }
      )
    }

    // Create salary with linked expense using sync service
    const salary = await createSalaryWithExpense(input, user)

    return NextResponse.json({ salary }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating salary record:', error)
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Salary record for this staff member, month, and year already exists' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error.message || 'Failed to create salary record' },
      { status: 500 }
    )
  }
}

