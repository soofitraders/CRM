import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import Booking from '@/lib/models/Booking'
import { updateBookingSchema } from '@/lib/validation/booking'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { createInvoiceFromBooking } from '@/lib/services/invoiceService'
import { logger } from '@/lib/utils/performance'

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

    // Update fields
    if (data.status !== undefined) {
      const previousStatus = booking.status
      booking.status = data.status
      
      // Auto-create invoice when booking is confirmed (if not already created)
      if (previousStatus !== 'CONFIRMED' && data.status === 'CONFIRMED') {
        try {
          await createInvoiceFromBooking(String(booking._id))
        } catch (error: any) {
          // Log error but don't fail the booking update if invoice creation fails
          // (invoice might already exist)
          logger.error('Error auto-creating invoice:', error.message)
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
    if (data.taxPercent !== undefined) {
      // Recalculate taxes and total
      const subtotal = booking.baseRate - booking.discounts
      booking.taxes = (subtotal * data.taxPercent) / 100
      booking.totalAmount = subtotal + booking.taxes
    }
    if (data.depositAmount !== undefined) {
      booking.depositAmount = data.depositAmount
    }
    if (data.notes !== undefined) {
      booking.notes = data.notes
    }

    await booking.save()

    const updatedBooking = await Booking.findById(booking._id)
      .populate('vehicle', 'plateNumber brand model')
      .populate('customer')
      .populate('bookedBy', 'name email')
      .lean()

    return NextResponse.json({ booking: updatedBooking })
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

    // Soft delete by setting status to CANCELLED
    booking.status = 'CANCELLED'
    await booking.save()

    return NextResponse.json({ message: 'Booking cancelled successfully' })
  } catch (error: any) {
    logger.error('Error cancelling booking:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to cancel booking' },
      { status: 500 }
    )
  }
}

