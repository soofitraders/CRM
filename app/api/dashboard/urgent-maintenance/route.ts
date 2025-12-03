export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { getUrgentMaintenance } from '@/lib/demo/dashboard'
import { logger } from '@/lib/utils/performance'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const items = await getUrgentMaintenance()

    return NextResponse.json({ items })
  } catch (error: any) {
    logger.error('Error fetching urgent maintenance:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch urgent maintenance' },
      { status: 500 }
    )
  }
}

