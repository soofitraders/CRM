export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { cache } from '@/lib/cache'

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')
  if (key !== (process.env.CACHE_PURGE_KEY || 'auto-purge-key')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const purged = cache.purgeExpired()
  return NextResponse.json({ purged, remaining: cache.stats().size })
}
