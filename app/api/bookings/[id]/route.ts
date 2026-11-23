import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import Booking from '@/lib/models/Booking'
// Import models to ensure they're registered with Mongoose before populate
import CustomerProfile from '@/lib/models/CustomerProfile'
import Vehicle from '@/lib/models/Vehicle'
import User from '@/lib/models/User'
import { updateBookingSchema } from '@/lib/validation/booking'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { createInvoiceFromBooking, getPaidInvoiceForBooking, voidOpenInvoicesForBooking } from '@/lib/services/invoiceService'
import { logger } from '@/lib/utils/performance'
import { invalidateBookingCache, invalidateDashboardCache, invalidateFinancialCache } from '@/lib/cache/cacheUtils'
import { canMoveBooking, transitionMessage, startsBeforeToday, PAST_START_MESSAGE, depositMessage } from '@/lib/utils/bookingRules'
import { calculateBookingAmounts, bookingTaxPercent } from '@/lib/utils/bookingPricing'
import { BLOCKING_STATUSES, findConflictingBooking, conflictMessage } from '@/lib/services/bookingAvailability'

// Ensure models are registered by accessing them
// This ensures Mongoose knows about CustomerProfile when populating
if (typeof CustomerProfile !== 'undefined') {
  // Model is registered
}

// GET - Get single booking
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    logger.log('[API] Booking GET request for ID:', params.id)
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      logger.log('[API] Booking: Unauthorized - no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.log('[API] Booking: Connecting to database...')
    await connectDB()
    logger.log('[API] Booking: Database connected')

    let booking
    try {
      logger.log('[API] Booking: Querying database...')
      booking = await Booking.findById(params.id)
        .populate('vehicle', 'plateNumber brand model year category')
        .populate({
          path: 'customer',
          select: 'user',
          populate: {
            path: 'user',
            select: 'name email phone',
          },
        })
        .populate('bookedBy', 'name email')
        .lean()
        .exec()
      
      logger.log('[API] Booking: Query completed, booking found:', !!booking)
    } catch (queryError: any) {
      logger.error('[API] Booking: Database query error:', queryError)
      logger.error('[API] Booking: Error name:', queryError.name)
      logger.error('[API] Booking: Error message:', queryError.message)
      logger.error('[API] Booking: Error stack:', queryError.stack)
      
      // Try to get booking without populate as fallback
      try {
        logger.log('[API] Booking: Attempting fallback query without populate')
        booking = await Booking.findById(params.id).lean().exec()
        logger.log('[API] Booking: Fallback query successful')
      } catch (fallbackError: any) {
        logger.error('[API] Booking: Fallback query also failed:', fallbackError)
        return NextResponse.json(
          { 
            error: 'Failed to fetch booking', 
            details: process.env.NODE_ENV === 'development' ? queryError.message : undefined 
          },
          { status: 500 }
        )
      }
    }

    if (!booking) {
      logger.log('[API] Booking: Booking not found for ID:', params.id)
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    logger.log('[API] Booking: Successfully fetched booking:', booking._id)
    return NextResponse.json({ booking })
  } catch (error: any) {
    logger.error('[API] Booking: Top-level error:', error)
    logger.error('[API] Booking: Error name:', error.name)
    logger.error('[API] Booking: Error message:', error.message)
    logger.error('[API] Booking: Error stack:', error.stack)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch booking',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// PATCH - Update booking
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const booking = await Booking.findById(params.id)
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const body = await request.json()
    const data = updateBookingSchema.parse(body)

    // Check permissions based on what's being updated
    if (data.paymentStatus !== undefined) {
      // Only FINANCE can change payment status, or admins
      if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      // Other updates require admin/sales permissions
      if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES_AGENT'])) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // ---- Booking rules (all checked BEFORE anything is changed) --------------
    const statusBefore = booking.status

    // 1) Follow the life of a booking: no skipping steps, no going backwards
    if (data.status !== undefined && !canMoveBooking(statusBefore, data.status)) {
      return NextResponse.json({ error: transitionMessage(statusBefore, data.status) }, { status: 409 })
    }

    // 2) A booking with a PAID invoice can't just be cancelled: the money has to be refunded first
    if (data.status === 'CANCELLED' && statusBefore !== 'CANCELLED') {
      const paid = await getPaidInvoiceForBooking(String(booking._id))
      if (paid) {
        return NextResponse.json(
          { error: `This booking cannot be cancelled yet: invoice ${paid.invoiceNumber} is already PAID. Please refund the customer (finance) first, then cancel.` },
          { status: 409 }
        )
      }
    }

    // 3) Moving the start date into the past needs an Admin (only checked when the start really changed)
    if (data.startDateTime !== undefined) {
      const minuteOf = (d: any) => Math.floor(new Date(d).getTime() / 60000)
      const startChanged = minuteOf(data.startDateTime) !== minuteOf(booking.startDateTime)
      if (startChanged && startsBeforeToday(data.startDateTime) && !hasRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
        return NextResponse.json({ error: PAST_START_MESSAGE }, { status: 400 })
      }
    }

    // 4) The deposit can't be more than the booking total (with the new price / dates / deposit)
    if (
      data.depositAmount !== undefined || data.baseRate !== undefined || data.discounts !== undefined ||
      data.taxPercent !== undefined || data.startDateTime !== undefined || data.endDateTime !== undefined
    ) {
      const newTotal = calculateBookingAmounts({
        rentalType: booking.rentalType,
        baseRate: data.baseRate ?? booking.baseRate,
        discounts: data.discounts ?? booking.discounts,
        taxPercent: data.taxPercent ?? bookingTaxPercent(booking as any),
        startDateTime: data.startDateTime ?? booking.startDateTime,
        endDateTime: data.endDateTime ?? booking.endDateTime,
      }).totalAmount
      const newDeposit = data.depositAmount ?? booking.depositAmount
      if (newDeposit > newTotal + 0.005) {
        return NextResponse.json({ error: depositMessage(newDeposit, newTotal) }, { status: 400 })
      }
    }

    // The car must still be free for the NEW dates / status. Check BEFORE changing
    // anything (a refused change must not trigger an invoice or any other side effect).
    // Needed when dates change, or when a cancelled / checked-in booking is brought back.
    {
      const newStatus = data.status ?? booking.status
      const newStart = data.startDateTime ?? booking.startDateTime
      const newEnd = data.endDateTime ?? booking.endDateTime
      const nowHoldsCar = BLOCKING_STATUSES.includes(newStatus as any)
      const heldCarBefore = BLOCKING_STATUSES.includes(booking.status as any)
      const datesChanged = data.startDateTime !== undefined || data.endDateTime !== undefined
      if (nowHoldsCar && (datesChanged || !heldCarBefore)) {
        const clash = await findConflictingBooking({
          vehicleId: String(booking.vehicle),
          startDateTime: newStart,
          endDateTime: newEnd,
          excludeBookingId: String(booking._id),
        })
        if (clash) {
          const car: any = await Vehicle.findById(booking.vehicle).select('plateNumber brand model').lean()
          const carLabel = car ? `${car.plateNumber} (${car.brand} ${car.model})` : 'This car'
          return NextResponse.json(
            { error: conflictMessage(carLabel, clash), conflictingBookingId: String(clash._id) },
            { status: 409 }
          )
        }
      }
    }

    // Update fields
    if (data.status !== undefined) {
      const previousStatus = booking.status
      booking.status = data.status
      
      // Auto-create invoice when booking is confirmed (if not already created)
      // Do this asynchronously to not block the status update
      if (previousStatus !== 'CONFIRMED' && data.status === 'CONFIRMED') {
        // Check if invoice already exists first (quick check)
        const { default: Invoice } = await import('@/lib/models/Invoice')
        const existingInvoice = await Invoice.findOne({ booking: booking._id }).lean()
        
        if (!existingInvoice) {
          // Create invoice asynchronously (don't await - let it run in background)
          createInvoiceFromBooking(String(booking._id)).catch((error: any) => {
            // Log error but don't fail the booking update
            logger.error('Error auto-creating invoice:', error.message)
          })
        }
      }
    }
    if (data.startDateTime !== undefined) {
      booking.startDateTime = new Date(data.startDateTime)
    }
    if (data.endDateTime !== undefined) {
      booking.endDateTime = new Date(data.endDateTime)
    }
    if (data.paymentStatus !== undefined) {
      booking.paymentStatus = data.paymentStatus
    }
    if (data.depositStatus !== undefined) {
      booking.depositStatus = data.depositStatus
    }
    if (data.baseRate !== undefined) {
      booking.baseRate = data.baseRate
    }
    if (data.discounts !== undefined) {
      booking.discounts = data.discounts
    }
    // Re-price the booking whenever anything that affects the price changed
    // (rate, discount, tax %, start or end date), so the total is always right.
    const pricingChanged =
      data.baseRate !== undefined ||
      data.discounts !== undefined ||
      data.taxPercent !== undefined ||
      data.startDateTime !== undefined ||
      data.endDateTime !== undefined
    if (pricingChanged) {
      const taxPercent = data.taxPercent ?? bookingTaxPercent(booking as any)
      const amounts = calculateBookingAmounts({
        rentalType: booking.rentalType,
        baseRate: booking.baseRate,
        discounts: booking.discounts,
        taxPercent,
        startDateTime: booking.startDateTime,
        endDateTime: booking.endDateTime,
      })
      if (booking.discounts > amounts.rentalAmount) {
        return NextResponse.json(
          { error: `Discount (AED ${booking.discounts}) cannot be more than the rental amount (AED ${amounts.rentalAmount})` },
          { status: 400 }
        )
      }
      booking.taxPercent = taxPercent
      booking.taxes = amounts.taxAmount
      booking.totalAmount = amounts.totalAmount
    }
    if (data.depositAmount !== undefined) {
      booking.depositAmount = data.depositAmount
    }
    if (data.notes !== undefined) {
      booking.notes = data.notes
    }

    await booking.save()

    // A cancelled booking must not keep an open invoice (it would still count as sales / money owed)
    if (data.status === 'CANCELLED' && statusBefore !== 'CANCELLED') {
      const voided = await voidOpenInvoicesForBooking(String(booking._id))
      if (voided.length > 0) {
        invalidateFinancialCache()
        try {
          const { logActivity } = await import('@/lib/services/activityLogService')
          await logActivity({
            activityType: 'INVOICE_UPDATED',
            module: 'INVOICES',
            action: 'UPDATE',
            description: `Invoice ${voided.join(', ')} voided because booking was cancelled`,
            entityType: 'Booking',
            entityId: String(booking._id),
            userId: user._id.toString(),
          })
        } catch (logError) {
          logger.error('Error logging invoice void:', logError)
        }
      }
    }

    // Invalidate cache to ensure bookings list refreshes
    invalidateBookingCache(
      String(booking._id),
      booking.customer ? String(booking.customer) : undefined,
      booking.vehicle ? String(booking.vehicle) : undefined
    )
    invalidateDashboardCache()

    const updatedBooking = await Booking.findById(booking._id)
      .populate('vehicle', 'plateNumber brand model')
      .populate('customer')
      .populate('bookedBy', 'name email')
      .lean()

    // Add cache-busting header to trigger client-side refresh
    const response = NextResponse.json({ booking: updatedBooking })
    response.headers.set('X-Data-Updated', 'bookings')
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    
    return response
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    logger.error('Error updating booking:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update booking' },
      { status: 500 }
    )
  }
}

// DELETE - Cancel booking (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check permissions
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES_AGENT'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const booking = await Booking.findById(params.id)
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Only a booking that has not left yet can be cancelled
    if (!canMoveBooking(booking.status, 'CANCELLED')) {
      return NextResponse.json({ error: transitionMessage(booking.status, 'CANCELLED') }, { status: 409 })
    }
    if (booking.status !== 'CANCELLED') {
      const paid = await getPaidInvoiceForBooking(String(booking._id))
      if (paid) {
        return NextResponse.json(
          { error: `This booking cannot be cancelled yet: invoice ${paid.invoiceNumber} is already PAID. Please refund the customer (finance) first, then cancel.` },
          { status: 409 }
        )
      }
    }

    // Soft delete by setting status to CANCELLED, and void its open invoice(s)
    const wasCancelled = booking.status === 'CANCELLED'
    booking.status = 'CANCELLED'
    await booking.save()
    if (!wasCancelled) {
      await voidOpenInvoicesForBooking(String(booking._id))
      invalidateFinancialCache()
      invalidateBookingCache(String(booking._id), booking.customer ? String(booking.customer) : undefined, booking.vehicle ? String(booking.vehicle) : undefined)
      invalidateDashboardCache()
    }

    return NextResponse.json({ message: 'Booking cancelled successfully' })
  } catch (error: any) {
    logger.error('Error cancelling booking:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to cancel booking' },
      { status: 500 }
    )
  }
}

