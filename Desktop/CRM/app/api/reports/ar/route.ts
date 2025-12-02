import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { getAccountsReceivable } from '@/lib/services/reportingService'

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

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const dateAsOf = searchParams.get('dateAsOf') || new Date().toISOString()
    const branchId = searchParams.get('branchId') || undefined

    const arData = await getAccountsReceivable({
      dateAsOf: new Date(dateAsOf),
      branchId,
    })

    return NextResponse.json(arData)
  } catch (error: any) {
    console.error('Error fetching AR report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch AR report' },
      { status: 500 }
    )
  }
}

