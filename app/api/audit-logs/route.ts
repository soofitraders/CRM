import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { getAuditLogs, getFinancialAuditLogs } from '@/lib/services/auditLogService'
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

    // Only SUPER_ADMIN and ADMIN can view audit logs
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')
    const userId = searchParams.get('userId') || undefined
    const auditType = searchParams.get('auditType') || undefined
    const severity = searchParams.get('severity') || undefined
    const financialOnly = searchParams.get('financialOnly') === 'true'
    const dateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined
    const dateTo = searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined
    const minAmount = searchParams.get('minAmount') ? parseFloat(searchParams.get('minAmount')!) : undefined

    let logs
    if (financialOnly) {
      logs = await getFinancialAuditLogs({
        limit,
        dateFrom,
        dateTo,
        minAmount,
      })
    } else {
      logs = await getAuditLogs({
        limit,
        userId,
        auditType: auditType as any,
        severity: severity as any,
        dateFrom,
        dateTo,
      })
    }

    return NextResponse.json({ logs })
  } catch (error: any) {
    logger.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}

