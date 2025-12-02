import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import Booking from '@/lib/models/Booking'
import Vehicle from '@/lib/models/Vehicle'
import CustomerProfile from '@/lib/models/CustomerProfile'
import { createBookingSchema, bookingQuerySchema } from '@/lib/validation/booking'
import { hasRole } from '@/lib/auth'
import { UserRole } from '@/lib/models/User'
import { jsonResponse } from '@/lib/utils/apiResponse'
import { cachedQuery, cacheKeys, invalidateCache } from '@/lib/utils/dbCache'
import { CACHE_DURATIONS, CACHE_TAGS } from '@/lib/utils/apiCache'

// Cache for 1 minute (booking data changes frequently)
export const revalidate = 60

// GET - List bookings with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

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
    console.log('[API] Bookings: Querying database with filter:', JSON.stringify(filter))
    console.log('[API] Bookings: Pagination - skip:', skip, 'limit:', query.limit)
    
    let bookings
    try {
      bookings = await Booking.find(filter)
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
        .exec()
      
      console.log('[API] Bookings: Found', bookings.length, 'bookings')
    } catch (queryError: any) {
      console.error('[API] Bookings: Database query error:', queryError)
      console.error('[API] Bookings: Error name:', queryError.name)
      console.error('[API] Bookings: Error message:', queryError.message)
      console.error('[API] Bookings: Error stack:', queryError.stack)
      
      // Try to get bookings without populate as fallback
      try {
        console.log('[API] Bookings: Attempting fallback query without populate')
        bookings = await Booking.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(query.limit)
          .lean()
          .exec()
        console.log('[API] Bookings: Fallback query successful, found', bookings.length, 'bookings')
      } catch (fallbackError: any) {
        console.error('[API] Bookings: Fallback query also failed:', fallbackError)
        return NextResponse.json(
          { 
            error: 'Failed to fetch bookings', 
            details: process.env.NODE_ENV === 'development' ? queryError.message : undefined 
          },
          { status: 500 }
        )
      }
    }

    const cacheKey = cacheKeys.bookings({ ...query, filter })

    const result = await cachedQuery(
      cacheKey,
      async () => {
        const total = await Booking.countDocuments(filter)
        console.log('[API] Bookings: Total count:', total)

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
      {
        ttl: 1 * 60 * 1000, // 1 minute (bookings change frequently)
        tags: [CACHE_TAGS.BOOKINGS],
      }
    )

    return jsonResponse(result, 200, {
      cache: CACHE_DURATIONS.SHORT,
      tags: [CACHE_TAGS.BOOKINGS],
    })
  } catch (error: any) {
    console.error('Error fetching bookings:', error)
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
      endDateTime: new Date(data.endDateTime),
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

    // Invalidate bookings cache
    invalidateCache('^bookings:')

    // Log activity
    try {
      const { logActivity } = await import('@/lib/services/activityLogService')
      await logActivity({
        activityType: 'BOOKING_CREATED',
        module: 'BOOKINGS',
        action: 'CREATE',
        description: `Created booking for ${data.rentalType} rental`,
        entityType: 'Booking',
        entityId: booking._id.toString(),
        userId: user._id.toString(),
        metadata: {
          branchId: data.pickupBranch,
        },
      })
    } catch (logError) {
      console.error('Error logging activity:', logError)
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
          booking._id.toString(),
          undefined,
          'Mileage updated during booking creation'
        )
      } catch (mileageError: any) {
        console.error('Error updating vehicle mileage:', mileageError)
        // Don't fail booking creation if mileage update fails
      }
    }

    // Auto-create invoice when booking is created with CONFIRMED status
    if (bookingStatus === 'CONFIRMED') {
      try {
        const { createInvoiceFromBooking } = await import('@/lib/services/invoiceService')
        await createInvoiceFromBooking(booking._id.toString())
      } catch (error: any) {
        // Log error but don't fail the booking creation if invoice creation fails
        // (invoice might already exist or there might be a temporary issue)
        console.error('Error auto-creating invoice:', error.message)
      }
    }

    const populatedBooking = await Booking.findById(booking._id)
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
    console.error('Error creating booking:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create booking' },
      { status: 500 }
    )
  }
}

