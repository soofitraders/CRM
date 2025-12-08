export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import Invoice from '@/lib/models/Invoice'
import { invoiceQuerySchema, createInvoiceSchema, createInvoiceFromBookingSchema } from '@/lib/validation/invoice'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { createInvoiceFromBooking, createCustomInvoice } from '@/lib/services/invoiceService'
import { jsonResponse } from '@/lib/utils/apiResponse'
import { cacheQuery } from '@/lib/cache/cacheUtils'
import { CacheKeys } from '@/lib/cache/cacheKeys'
import { invalidateFinancialCache } from '@/lib/cache/cacheUtils'
import { logger } from '@/lib/utils/performance'

// GET - List invoices with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const query = invoiceQuerySchema.parse({
      status: searchParams.get('status') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '10',
    })

    const filter: any = {}

    // Support booking filter
    const bookingId = searchParams.get('booking')
    if (bookingId) {
      filter.booking = bookingId
    }

    if (query.status) {
      filter.status = query.status
    }

    if (query.dateFrom || query.dateTo) {
      filter.issueDate = {}
      if (query.dateFrom) {
        filter.issueDate.$gte = new Date(query.dateFrom)
      }
      if (query.dateTo) {
        filter.issueDate.$lte = new Date(query.dateTo)
      }
    }

    if (query.search) {
      filter.$or = [
        { invoiceNumber: { $regex: query.search, $options: 'i' } },
      ]
    }

    const skip = (query.page - 1) * query.limit
    
    // Create cache key
    const cacheKey = CacheKeys.invoices(JSON.stringify({ filter, page: query.page, limit: query.limit }))
    
    // Use cache for GET requests
    const result = await cacheQuery(
      cacheKey,
      async () => {
        // Execute queries in parallel
        const [invoices, total] = await Promise.all([
          Invoice.find(filter)
            .populate({
              path: 'booking',
              select: '_id',
              populate: {
                path: 'customer',
                select: 'user',
                populate: {
                  path: 'user',
                  select: 'name email',
                },
              },
            })
            .sort({ issueDate: -1 })
            .skip(skip)
            .limit(query.limit)
            .lean()
            .exec()
            .catch(() => {
              // Fallback without populate
              return Invoice.find(filter)
                .sort({ issueDate: -1 })
                .skip(skip)
                .limit(query.limit)
                .lean()
                .exec()
            }),
          Invoice.countDocuments(filter),
        ])

        return { invoices, total }
      },
      60 // Cache for 1 minute
    )

    const { invoices, total } = result

    // Format customer info - handle cases where populate might have failed
    const invoicesWithCustomer = invoices.map((invoice: any) => {
      // Check if booking was populated (populated objects have properties, ObjectIds don't)
      if (invoice.booking && typeof invoice.booking === 'object' && invoice.booking._id && invoice.booking.customer) {
        // Booking is populated, check for customer
        if (invoice.booking.customer?.user) {
          invoice.customer = {
            name: invoice.booking.customer.user.name,
            email: invoice.booking.customer.user.email,
          }
        } else {
          // Booking exists but customer/user not populated
          invoice.customer = null
        }
      } else {
        // Booking not populated (might be ObjectId or null)
        invoice.customer = null
      }
      return invoice
    })

    return jsonResponse({
      invoices: invoicesWithCustomer,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    }, 200, { cache: 60 })
  } catch (error: any) {
    logger.error('[API] Invoices: Top-level error caught:', error)
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch invoices',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// POST - Create invoice
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check permissions - Only FINANCE, ADMIN, and SUPER_ADMIN can create invoices
    if (!hasRole(user, ['FINANCE', 'ADMIN', 'SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    // Check if it's a simple "create from booking" request or a custom invoice
    let invoice
    if (body.items) {
      // Custom invoice creation
      const data = createInvoiceSchema.parse(body)
      invoice = await createCustomInvoice({
        bookingId: data.booking,
        items: data.items,
        issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        taxPercent: data.taxPercent,
        createdBy: user._id.toString(),
      })
    } else {
      // Create invoice from booking (auto-generate items from booking)
      const data = createInvoiceFromBookingSchema.parse(body)
      invoice = await createInvoiceFromBooking(data.booking)
    }

    // Invalidate cache
    invalidateFinancialCache()

    const populatedInvoice = await Invoice.findById(invoice._id)
      .populate({
        path: 'booking',
        populate: [
          {
            path: 'vehicle',
            select: 'plateNumber brand model year',
          },
          {
            path: 'customer',
            select: 'user',
            populate: {
              path: 'user',
              select: 'name email phone',
            },
          },
        ],
      })
      .lean()

    return NextResponse.json({ invoice: populatedInvoice }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    if (error.name === 'ValidationError') {
      // Mongoose validation error
      const errors: any = {}
      if (error.errors) {
        Object.keys(error.errors).forEach((key) => {
          errors[key] = error.errors[key].message
        })
      }
      return NextResponse.json(
        { error: 'Invoice validation failed', details: errors },
        { status: 400 }
      )
    }
    logger.error('Error creating invoice:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create invoice' },
      { status: 500 }
    )
  }
}

