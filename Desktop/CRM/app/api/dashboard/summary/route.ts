import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getDashboardSummary } from '@/lib/demo/dashboard'
import { getFinancialSummary } from '@/lib/services/financials'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [summary, financialSummary] = await Promise.all([
      getDashboardSummary(),
      getFinancialSummary(),
    ])

    // Update total sales with real data
    summary.totalSales = financialSummary.totalSales

    return NextResponse.json({
      summary,
      financialSummary,
    })
  } catch (error: any) {
    console.error('Error fetching dashboard summary:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard summary' },
      { status: 500 }
    )
  }
}

