import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import Invoice from '@/lib/models/Invoice'
import { updateVehicleMileage } from '@/lib/services/mileageTrackingService'
import { z } from 'zod'
import { logger } from '@/lib/utils/performance'

const updateMileageSchema = z.object({
  mileage: z.number().min(0, 'Mileage must be positive'),
  notes: z.string().optional(),
})

/**
 * Update vehicle mileage when invoice is being generated/confirmed
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES_AGENT', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const invoice = await Invoice.findById(params.id)
      .populate('booking', 'vehicle')
      .lean()

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const booking = invoice.booking as any
    if (!booking || !booking.vehicle) {
      return NextResponse.json({ error: 'Booking or vehicle not found' }, { status: 404 })
    }

    const body = await request.json()
    const validationResult = updateMileageSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const data = validationResult.data

    const result = await updateVehicleMileage(
      booking.vehicle.toString(),
      data.mileage,
      user._id.toString(),
      'INVOICE',
      booking._id.toString(),
      params.id,
      data.notes || 'Mileage updated during invoice generation'
    )

    return NextResponse.json(result)
  } catch (error: any) {
    logger.error('Error updating vehicle mileage from invoice:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update vehicle mileage' },
      { status: 500 }
    )
  }
}

