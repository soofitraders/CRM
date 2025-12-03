export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { getCacheStats } from '@/lib/cache/cacheUtils'
import { isSuperAdmin } from '@/lib/auth'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/utils/performance'

// GET - Get cache statistics (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!isSuperAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const stats = getCacheStats()

    return NextResponse.json({ stats })
  } catch (error: any) {
    logger.error('Error fetching cache stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cache stats' },
      { status: 500 }
    )
  }
}

