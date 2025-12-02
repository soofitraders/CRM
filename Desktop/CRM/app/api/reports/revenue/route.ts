import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { getRevenueOverview } from '@/lib/services/reportingService'

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
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const branchId = searchParams.get('branchId') || undefined
    const vehicleCategory = searchParams.get('vehicleCategory') || undefined
    const customerType = searchParams.get('customerType') || undefined
    const groupBy = (searchParams.get('groupBy') || 'day') as 'day' | 'week' | 'month'

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: 'dateFrom and dateTo are required' }, { status: 400 })
    }

    const revenueData = await getRevenueOverview({
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      branchId,
      vehicleCategory: vehicleCategory as any,
      customerType: customerType as any,
      groupBy,
    })

    return NextResponse.json(revenueData)
  } catch (error: any) {
    console.error('Error fetching revenue report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch revenue report' },
      { status: 500 }
    )
  }
}

