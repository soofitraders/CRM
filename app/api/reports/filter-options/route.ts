import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import Vehicle from '@/lib/models/Vehicle'
import Booking from '@/lib/models/Booking'
import { logger } from '@/lib/utils/performance'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    // Get unique branches from vehicles
    const branches = await Vehicle.distinct('currentBranch')
    const sortedBranches = branches.filter(Boolean).sort()

    // Get unique vehicle categories
    const categories = await Vehicle.distinct('category')
    const sortedCategories = categories.filter(Boolean).sort()

    return NextResponse.json({
      branches: sortedBranches,
      vehicleCategories: sortedCategories,
    })
  } catch (error: any) {
    logger.error('Error fetching filter options:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch filter options' },
      { status: 500 }
    )
  }
}

