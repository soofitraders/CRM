import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { updateVehicleMileage, getMileageHistory } from '@/lib/services/mileageTrackingService'
import { z } from 'zod'

const updateMileageSchema = z.object({
  mileage: z.number().min(0, 'Mileage must be positive'),
  source: z.enum(['BOOKING', 'INVOICE', 'MANUAL', 'MAINTENANCE']).default('MANUAL'),
  notes: z.string().optional(),
})

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

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES_AGENT', 'OPERATIONS'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await request.json()
    const validationResult = updateMileageSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const data = validationResult.data
    const searchParams = request.nextUrl.searchParams
    const bookingId = searchParams.get('bookingId')
    const invoiceId = searchParams.get('invoiceId')

    const result = await updateVehicleMileage(
      params.id,
      data.mileage,
      user._id.toString(),
      data.source,
      bookingId || undefined,
      invoiceId || undefined,
      data.notes
    )

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error updating vehicle mileage:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update vehicle mileage' },
      { status: 500 }
    )
  }
}

export async function GET(
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

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')

    const history = await getMileageHistory(params.id, limit)

    return NextResponse.json({ history })
  } catch (error: any) {
    console.error('Error fetching mileage history:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch mileage history' },
      { status: 500 }
    )
  }
}

