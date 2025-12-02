import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { getUpcomingRecurringExpenses } from '@/lib/services/recurringExpenseService'

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
    const daysAhead = searchParams.get('daysAhead')
      ? parseInt(searchParams.get('daysAhead')!)
      : 7

    const upcomingExpenses = await getUpcomingRecurringExpenses(daysAhead)

    return NextResponse.json({ upcomingExpenses })
  } catch (error: any) {
    console.error('Error fetching upcoming recurring expenses:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch upcoming recurring expenses' },
      { status: 500 }
    )
  }
}

