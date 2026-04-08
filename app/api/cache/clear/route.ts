export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { NextResponse } from 'next/server'
import { cache } from '@/lib/cache'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const prefix = body.prefix as string | undefined

    let cleared: number
    if (prefix) {
      cleared = cache.deletePrefix(prefix)
      console.log(`[CACHE] Cleared ${cleared} entries with prefix: ${prefix}`)
    } else {
      const stats = cache.stats()
      cleared = stats.size
      cache.clear()
    }

    return NextResponse.json({ success: true, cleared })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function GET() {
  try {
    const purged = cache.purgeExpired()
    const stats = cache.stats()
    return NextResponse.json({ ...stats, purged })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
