import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import Payment from '@/lib/models/Payment'
import { paymentQuerySchema } from '@/lib/validation/payment'

// GET - List payments with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const query = paymentQuerySchema.parse({
      status: searchParams.get('status') || undefined,
      method: searchParams.get('method') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '10',
    })

    const filter: any = {}

    if (query.status) {
      filter.status = query.status
    }

    if (query.method) {
      filter.method = query.method
    }

    if (query.dateFrom || query.dateTo) {
      filter.createdAt = {}
      if (query.dateFrom) {
        filter.createdAt.$gte = new Date(query.dateFrom)
      }
      if (query.dateTo) {
        filter.createdAt.$lte = new Date(query.dateTo)
      }
    }

    if (query.search) {
      filter.$or = [
        { transactionId: { $regex: query.search, $options: 'i' } },
        { gatewayReference: { $regex: query.search, $options: 'i' } },
      ]
    }

    const skip = (query.page - 1) * query.limit
    const payments = await Payment.find(filter)
      .populate({
        path: 'booking',
        select: '_id',
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean()

    const total = await Payment.countDocuments(filter)

    return NextResponse.json({
      payments,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error fetching payments:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}

