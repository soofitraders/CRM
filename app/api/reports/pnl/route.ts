import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { getEnhancedProfitAndLoss, PeriodType, ComparisonType } from '@/lib/services/pnlService'
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
    const periodType = (searchParams.get('periodType') || 'MONTH') as PeriodType
    const compareWith = searchParams.get('compareWith') as ComparisonType | null

    const pnlData = await getEnhancedProfitAndLoss({
      dateFrom: dateFrom ? new Date(dateFrom) : new Date(),
      dateTo: dateTo ? new Date(dateTo) : new Date(),
      branchId,
      periodType,
      compareWith: compareWith || undefined,
    })

    return NextResponse.json(pnlData)
  } catch (error: any) {
    logger.error('Error fetching P&L report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch P&L report' },
      { status: 500 }
    )
  }
}

