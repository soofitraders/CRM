import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { getUtilizationReport } from '@/lib/services/reportingService'
import { logger } from '@/lib/utils/performance'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const branchId = searchParams.get('branchId') || undefined
    const vehicleCategory = searchParams.get('vehicleCategory') || undefined

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: 'dateFrom and dateTo are required' }, { status: 400 })
    }

    const utilizationData = await getUtilizationReport({
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      branchId,
      vehicleCategory,
    })

    return NextResponse.json(utilizationData)
  } catch (error: any) {
    logger.error('Error fetching utilization report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch utilization report' },
      { status: 500 }
    )
  }
}

