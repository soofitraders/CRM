import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { getTodayBookings } from '@/lib/demo/dashboard'
import { logger } from '@/lib/utils/performance'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bookings = await getTodayBookings()

    return NextResponse.json({ bookings })
  } catch (error: any) {
    logger.error('Error fetching today bookings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch today bookings' },
      { status: 500 }
    )
  }
}

