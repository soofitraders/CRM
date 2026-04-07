export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import LedgerEntry from '@/lib/models/LedgerEntry'
import { logger } from '@/lib/utils/performance'
import { LEDGER_ACTIVE_VOID_FILTER } from '@/lib/services/ledgerService'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 })
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await connectDB()

    const rows = await LedgerEntry.aggregate([
      { $match: { ...LEDGER_ACTIVE_VOID_FILTER } },
      {
        $group: {
          _id: {
            accountLabel: { $ifNull: ['$accountLabel', null] },
            accountType: { $ifNull: ['$accountType', 'CASH'] },
            bankName: { $ifNull: ['$bankName', null] },
          },
          credits: {
            $sum: { $cond: [{ $eq: ['$direction', 'CREDIT'] }, { $ifNull: ['$amount', 0] }, 0] },
          },
          debits: {
            $sum: { $cond: [{ $eq: ['$direction', 'DEBIT'] }, { $ifNull: ['$amount', 0] }, 0] },
          },
          lastActivity: { $max: '$date' },
        },
      },
      { $sort: { '_id.accountLabel': 1 } },
    ])

    const accounts = (rows ?? []).map((r) => {
      const id = r._id as { accountLabel?: string | null; accountType?: string; bankName?: string | null }
      return {
        accountLabel: id?.accountLabel ?? 'Unlabeled',
        accountType: id?.accountType ?? 'CASH',
        bankName: id?.bankName ?? undefined,
        balance: (r.credits ?? 0) - (r.debits ?? 0),
        lastActivity: r.lastActivity,
      }
    })

    return NextResponse.json({ accounts })
  } catch (error: unknown) {
    console.error('[LEDGER_ACCOUNTS] Error:', error)
    logger.error('Ledger accounts error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    )
  }
}

