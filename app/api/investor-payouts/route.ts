import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import InvestorPayout from '@/lib/models/InvestorPayout'
import InvestorProfile from '@/lib/models/InvestorProfile'
import {
  createInvestorPayoutWithExpenseAndPayment,
  calculateInvestorPayoutPreview,
} from '@/lib/services/investorPayoutService'
import { investorPayoutInputSchema } from '@/lib/validation/investorPayout'
import { startOfDay, endOfDay } from 'date-fns'
import { logger } from '@/lib/utils/performance'

// GET - List investor payouts
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

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const investorId = searchParams.get('investorId')
    const status = searchParams.get('status')
    const periodFrom = searchParams.get('periodFrom')
    const periodTo = searchParams.get('periodTo')
    const year = searchParams.get('year')
    const month = searchParams.get('month')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build filter
    const filter: any = {}

    // For INVESTOR role, only show their own payouts
    if (user.role === 'INVESTOR') {
      const investorProfile = await InvestorProfile.findOne({ user: user._id }).lean()
      if (!investorProfile) {
        return NextResponse.json({ payouts: [], pagination: { page, limit, total: 0, pages: 0 } })
      }
      filter.investor = investorProfile._id
    } else if (investorId) {
      // Internal roles can filter by investor
      filter.investor = investorId
    }

    if (status) {
      filter.status = status
    }

    if (periodFrom && periodTo) {
      filter.periodFrom = { $lte: new Date(periodTo) }
      filter.periodTo = { $gte: new Date(periodFrom) }
    }

    if (year) {
      const yearNum = parseInt(year)
      if (month) {
        const monthNum = parseInt(month)
        filter.periodFrom = {
          $gte: startOfDay(new Date(yearNum, monthNum - 1, 1)),
          $lte: endOfDay(new Date(yearNum, monthNum, 0)),
        }
      } else {
        filter.periodFrom = {
          $gte: startOfDay(new Date(yearNum, 0, 1)),
          $lte: endOfDay(new Date(yearNum, 11, 31)),
        }
      }
    }

    const skip = (page - 1) * limit

    const payouts = await InvestorPayout.find(filter)
      .populate({
        path: 'investor',
        populate: {
          path: 'user',
          select: 'name email phone',
        },
      })
      .populate('expense', 'amount dateIncurred description')
      .populate('payment', 'amount method status transactionId paidAt')
      .populate('createdBy', 'name email')
      .sort({ periodFrom: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()

    const total = await InvestorPayout.countDocuments(filter)

    return NextResponse.json({
      payouts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    logger.error('Error fetching investor payouts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch investor payouts' },
      { status: 500 }
    )
  }
}

// POST - Create new investor payout
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

    // Only internal roles can create payouts
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await request.json()

    // Validate input
    const validationResult = investorPayoutInputSchema.safeParse(body)
    if (!validationResult.success) {
      logger.error('Validation errors:', validationResult.error.issues)
      const errorMessages = validationResult.error.issues.map((err) => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ')
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.issues,
          message: errorMessages
        },
        { status: 400 }
      )
    }

    const input = validationResult.data

    // Convert date strings to Date objects
    let periodFrom: Date
    let periodTo: Date
    
    if (typeof input.periodFrom === 'string') {
      // Handle both ISO datetime and yyyy-MM-dd format
      periodFrom = input.periodFrom.includes('T') 
        ? new Date(input.periodFrom) 
        : new Date(input.periodFrom + 'T00:00:00.000Z')
    } else {
      periodFrom = input.periodFrom
    }
    
    if (typeof input.periodTo === 'string') {
      // Handle both ISO datetime and yyyy-MM-dd format
      periodTo = input.periodTo.includes('T')
        ? new Date(input.periodTo)
        : new Date(input.periodTo + 'T23:59:59.999Z')
    } else {
      periodTo = input.periodTo
    }

    // Create payout with expense and optional payment
    const payout = await createInvestorPayoutWithExpenseAndPayment(
      {
        investorId: input.investorId,
        periodFrom,
        periodTo,
        branchId: input.branchId,
        notes: input.notes,
        createPayment: input.createPayment,
        paymentMethod: input.paymentMethod,
      },
      user
    )

    return NextResponse.json({ payout }, { status: 201 })
  } catch (error: any) {
    logger.error('Error creating investor payout:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create investor payout' },
      { status: 500 }
    )
  }
}
