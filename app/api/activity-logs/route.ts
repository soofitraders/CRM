import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { getAllActivityLogs, getUserActivityLogs } from '@/lib/services/activityLogService'
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

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')
    const userId = searchParams.get('userId')
    const moduleName = searchParams.get('module') || undefined
    const activityType = searchParams.get('activityType') || undefined
    const dateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : undefined
    const dateTo = searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : undefined

    // Check if user can view all logs or only their own
    const canViewAll = hasRole(user, ['SUPER_ADMIN', 'ADMIN'])

    let logs
    if (canViewAll) {
      logs = await getAllActivityLogs({
        limit,
        userId: userId || undefined,
        module: moduleName,
        activityType: activityType as any,
        dateFrom,
        dateTo,
      })
    } else {
      // Users can only view their own logs
      logs = await getUserActivityLogs(user._id.toString(), {
        limit,
        module: moduleName,
        activityType: activityType as any,
        dateFrom,
        dateTo,
      })
    }

    return NextResponse.json({ logs })
  } catch (error: any) {
    logger.error('Error fetching activity logs:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch activity logs' },
      { status: 500 }
    )
  }
}

