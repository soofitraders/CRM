export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import Booking from '@/lib/models/Booking'
import Vehicle from '@/lib/models/Vehicle'
// Import CustomerProfile to ensure it's registered with Mongoose before populate
import CustomerProfile from '@/lib/models/CustomerProfile'
import User from '@/lib/models/User'
import { createBookingSchema, bookingQuerySchema } from '@/lib/validation/booking'
import { hasRole } from '@/lib/auth'
import { UserRole } from '@/lib/models/User'
import { jsonResponse } from '@/lib/utils/apiResponse'
import { cacheQuery } from '@/lib/cache/cacheUtils'
import { CacheKeys } from '@/lib/cache/cacheKeys'
import { invalidateBookingCache, invalidateDashboardCache } from '@/lib/cache/cacheUtils'
import { logger } from '@/lib/utils/performance'

// Ensure models are registered by accessing them
// This ensures Mongoose knows about CustomerProfile when populating
if (typeof CustomerProfile !== 'undefined') {
  // Model is registered
}

// GET - List bookings with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    // Ensure CustomerProfile model is registered before populate
    // Access the model to ensure it's initialized
    if (!CustomerProfile) {
      throw new Error('CustomerProfile model not available')
    }

    const searchParams = request.nextUrl.searchParams
    const query = bookingQuerySchema.parse({
      status: searchParams.get('status') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '10',
    })

    const filter: any = {}

    // Support customer filter
    const customerId = searchParams.get('customer')
    if (customerId) {
      filter.customer = customerId
    }

    if (query.status) {
      filter.status = query.status
    }

    if (query.dateFrom || query.dateTo) {
      filter.startDateTime = {}
      if (query.dateFrom) {
        filter.startDateTime.$gte = new Date(query.dateFrom)
      }
      if (query.dateTo) {
        filter.startDateTime.$lte = new Date(query.dateTo)
      }
    }

    if (query.search) {
      filter.$or = [
        { notes: { $regex: query.search, $options: 'i' } },
      ]
    }

    const skip = (query.page - 1) * query.limit
    
    // Create cache key from filters
    const cacheKey = CacheKeys.bookings(JSON.stringify({ filter, page: query.page, limit: query.limit }))
    
    // Use cache for GET requests
    const result = await cacheQuery(
      cacheKey,
      async () => {
        // Execute queries in parallel
        const [bookings, total] = await Promise.all([
          Booking.find(filter)
            .populate({
              path: 'vehicle',
              select: 'plateNumber brand model',
            })
            .populate({
              path: 'customer',
              select: 'user',
              populate: {
                path: 'user',
                select: 'name email',
              },
            })
            .populate('bookedBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(query.limit)
            .lean()
            .exec(),
          Booking.countDocuments(filter),
        ])

        return {
          bookings,
          pagination: {
            page: query.page,
            limit: query.limit,
            total,
            pages: Math.ceil(total / query.limit),
          },
        }
      },
      60 // Cache for 1 minute
    )

    const response = jsonResponse(result, 200, { cache: 0 }) // No cache for real-time updates
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  } catch (error: any) {
    logger.error('Error fetching bookings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch bookings' },
      { status: 500 }
    )
  }
}

// POST - Create booking
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    // Check permissions - use getCurrentUser which is optimized
    const { getCurrentUser } = await import('@/lib/auth')
    const user = await getCurrentUser()
    if (!user || !hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES_AGENT'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = createBookingSchema.parse(body)

    // Calculate total amount
    const subtotal = data.baseRate - data.discounts
    const taxAmount = (subtotal * data.taxPercent) / 100
    const totalAmount = subtotal + taxAmount

    const bookingStatus = data.status || 'PENDING'
    
    const booking = new Booking({
      vehicle: data.vehicle,
      customer: data.customer,
      bookedBy: user._id,
      startDateTime: new Date(data.startDateTime),
      endDateTime: data.endDateTime ? new Date(data.endDateTime) : undefined,
      pickupBranch: data.pickupBranch,
      dropoffBranch: data.dropoffBranch,
      rentalType: data.rentalType,
      baseRate: data.baseRate,
      discounts: data.discounts,
      taxes: taxAmount,
      totalAmount,
      depositAmount: data.depositAmount,
      depositStatus: 'HELD',
      paymentStatus: 'UNPAID',
      notes: data.notes,
      status: bookingStatus,
      mileageAtBooking: (body as any).mileageAtBooking,
    })

    await booking.save()

    // Invalidate related caches
    invalidateBookingCache(
      (booking._id as any)?.toString(),
      (booking.customer as any)?.toString(),
      (booking.vehicle as any)?.toString()
    )
    invalidateDashboardCache()

    // Log activity
    try {
      const { logActivity } = await import('@/lib/services/activityLogService')
      await logActivity({
        activityType: 'BOOKING_CREATED',
        module: 'BOOKINGS',
        action: 'CREATE',
        description: `Created booking for ${data.rentalType} rental`,
        entityType: 'Booking',
        entityId: (booking._id as any)?.toString(),
        userId: user._id.toString(),
        metadata: {
          branchId: data.pickupBranch,
        },
      })
    } catch (logError) {
      logger.error('Error logging activity:', logError)
      // Don't fail booking creation if logging fails
    }

    // Update vehicle mileage if provided
    if ((body as any).mileageAtBooking !== undefined && (body as any).mileageAtBooking !== null) {
      try {
        const { updateVehicleMileage } = await import('@/lib/services/mileageTrackingService')
        await updateVehicleMileage(
          data.vehicle,
          (body as any).mileageAtBooking,
          user._id.toString(),
          'BOOKING',
          (booking._id as any)?.toString(),
          undefined,
          'Mileage updated during booking creation'
        )
      } catch (mileageError: any) {
        logger.error('Error updating vehicle mileage:', mileageError)
        // Don't fail booking creation if mileage update fails
      }
    }

    // Auto-create invoice when booking is created with CONFIRMED status
    if (bookingStatus === 'CONFIRMED') {
      try {
        const { createInvoiceFromBooking } = await import('@/lib/services/invoiceService')
        await createInvoiceFromBooking((booking._id as any)?.toString())
      } catch (error: any) {
        // Log error but don't fail the booking creation if invoice creation fails
        // (invoice might already exist or there might be a temporary issue)
        logger.error('Error auto-creating invoice:', error.message)
      }
    }

    const populatedBooking = await Booking.findById((booking._id as any))
      .populate('vehicle', 'plateNumber brand model')
      .populate('customer')
      .populate('bookedBy', 'name email')
      .lean()

    return NextResponse.json({ booking: populatedBooking }, { status: 201 })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    logger.error('Error creating booking:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create booking' },
      { status: 500 }
    )
  }
}

