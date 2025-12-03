export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { processRecurringExpenses } from '@/lib/services/recurringExpenseService'
import { logger } from '@/lib/utils/performance'

/**
 * API endpoint to process recurring expenses
 * This should be called by a cron job or scheduled task
 */
export async function POST(request: NextRequest) {
  try {
    // Check for API key or admin authentication
    const authHeader = request.headers.get('authorization')
    const apiKey = process.env.RECURRING_EXPENSE_API_KEY

    // Allow processing if API key matches or user is admin
    if (apiKey && authHeader === `Bearer ${apiKey}`) {
      // Process with API key
    } else {
      // Check user authentication
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const user = await getCurrentUser()
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    await connectDB()

    const result = await processRecurringExpenses()

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    logger.error('Error processing recurring expenses:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process recurring expenses' },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check status
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Recurring expense processor endpoint',
    status: 'active',
  })
}

