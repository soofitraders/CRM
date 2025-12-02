import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { getDashboardSummary } from '@/lib/demo/dashboard'
import { getFinancialSummary } from '@/lib/services/financials'
import { cachedQuery, cacheKeys } from '@/lib/utils/dbCache'
import { jsonResponse } from '@/lib/utils/apiResponse'
import { CACHE_DURATIONS, CACHE_TAGS } from '@/lib/utils/apiCache'

// Cache for 2 minutes (dashboard data changes frequently)
export const revalidate = 120

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id || session.user.email
    const cacheKey = cacheKeys.dashboard(userId)

    const result = await cachedQuery(
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
      {
        ttl: 2 * 60 * 1000, // 2 minutes
        tags: [CACHE_TAGS.DASHBOARD],
      }
    )

    return jsonResponse(result, 200, {
      cache: CACHE_DURATIONS.SHORT,
      tags: [CACHE_TAGS.DASHBOARD],
    })
  } catch (error: any) {
    console.error('Error fetching dashboard summary:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard summary' },
      { status: 500 }
    )
  }
}

