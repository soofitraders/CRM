export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { invalidateAllCache, invalidateCache } from '@/lib/cache/cacheUtils'
import { isSuperAdmin } from '@/lib/auth'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/utils/performance'

// POST - Clear cache (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!isSuperAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { pattern } = body

    if (pattern) {
      const count = invalidateCache(pattern)
      return NextResponse.json({ 
        message: `Cleared ${count} cache entries matching pattern: ${pattern}` 
      })
    } else {
      invalidateAllCache()
      return NextResponse.json({ message: 'All cache cleared' })
    }
  } catch (error: any) {
    logger.error('Error clearing cache:', error)
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    )
  }
}

