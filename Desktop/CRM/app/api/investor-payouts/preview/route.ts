import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { calculateInvestorPayoutPreview } from '@/lib/services/investorPayoutService'

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

    // Only internal roles can preview payouts
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const investorId = searchParams.get('investorId')
    const periodFrom = searchParams.get('periodFrom')
    const periodTo = searchParams.get('periodTo')
    const branchId = searchParams.get('branchId') || undefined

    if (!investorId || !periodFrom || !periodTo) {
      return NextResponse.json(
        { error: 'investorId, periodFrom, and periodTo are required' },
        { status: 400 }
      )
    }

    const preview = await calculateInvestorPayoutPreview({
      investorId,
      periodFrom: new Date(periodFrom),
      periodTo: new Date(periodTo),
      branchId,
    })

    return NextResponse.json(preview)
  } catch (error: any) {
    console.error('Error calculating payout preview:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to calculate payout preview' },
      { status: 500 }
    )
  }
}

