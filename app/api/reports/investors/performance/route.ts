export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { getInvestorPerformanceReport } from '@/lib/services/investorReportService'
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

    // Allow INVESTOR role to view their own reports
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'INVESTOR'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const investorId = searchParams.get('investorId') || undefined
    const branchId = searchParams.get('branchId') || undefined

    // If user is INVESTOR, only show their own data
    let actualInvestorId = investorId
    if (user.role === 'INVESTOR' && !investorId) {
      const InvestorProfile = (await import('@/lib/models/InvestorProfile')).default
      const profile = await InvestorProfile.findOne({ user: user._id }).lean()
      if (profile) {
        actualInvestorId = String(profile._id)
      } else {
        return NextResponse.json({ error: 'Investor profile not found' }, { status: 404 })
      }
    }

    const reportData = await getInvestorPerformanceReport({
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      investorId: actualInvestorId,
      branchId,
    })

    return NextResponse.json(reportData)
  } catch (error: any) {
    logger.error('Error fetching investor performance report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch investor performance report' },
      { status: 500 }
    )
  }
}

