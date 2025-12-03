export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getDashboardSummary } from '@/lib/demo/dashboard'
import { getFinancialSummary } from '@/lib/services/financials'
import { cacheQuery } from '@/lib/cache/cacheUtils'
import { CacheKeys } from '@/lib/cache/cacheKeys'
import { logger } from '@/lib/utils/performance'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use cache for dashboard summary
    const cacheKey = CacheKeys.dashboardSummary(session.user.id)
    
    const result = await cacheQuery(
      cacheKey,
      async () => {
        const [summary, financialSummary] = await Promise.all([
          getDashboardSummary(),
          getFinancialSummary(),
        ])

        // Update total sales with real data
        summary.totalSales = financialSummary.totalSales

        return {
          summary,
          financialSummary,
        }
      },
      120 // Cache for 2 minutes
    )

    return NextResponse.json(result)
  } catch (error: any) {
    logger.error('Error fetching dashboard summary:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard summary' },
      { status: 500 }
    )
  }
}

