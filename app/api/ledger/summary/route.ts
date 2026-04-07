export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import LedgerEntry from '@/lib/models/LedgerEntry'
import { buildLedgerMatch, computeBalance, LEDGER_ACTIVE_VOID_FILTER } from '@/lib/services/ledgerService'
import { logger } from '@/lib/utils/performance'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

const LEDGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE'] as const

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    if (!hasRole(user, [...LEDGER_ROLES])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const startDate = startDateStr ? new Date(startDateStr) : undefined
    const endDate = endDateStr ? new Date(endDateStr) : undefined

    const dimensional = buildLedgerMatch({ isVoided: false })

    const [allTimeAgg] = await LedgerEntry.aggregate([
      { $match: { ...LEDGER_ACTIVE_VOID_FILTER } },
      {
        $group: {
          _id: null,
          totalCredits: {
            $sum: { $cond: [{ $eq: ['$direction', 'CREDIT'] }, { $ifNull: ['$amount', 0] }, 0] },
          },
          totalDebits: {
            $sum: { $cond: [{ $eq: ['$direction', 'DEBIT'] }, { $ifNull: ['$amount', 0] }, 0] },
          },
        },
      },
    ])

    const periodMatch = buildLedgerMatch({
      startDate,
      endDate,
      isVoided: false,
    })
    const period = await computeBalance(periodMatch)

    const prior: Record<string, unknown> = { ...dimensional }
    if (startDate) prior.date = { $lt: startDate }
    const openingFiltered = (await computeBalance(prior)).net

    const byType = await LedgerEntry.aggregate([
      { $match: periodMatch },
      {
        $group: {
          _id: '$entryType',
          total: { $sum: { $ifNull: ['$amount', 0] } },
          count: { $sum: 1 },
        },
      },
    ])

    const byAccount = await LedgerEntry.aggregate([
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

    const now = new Date()
    const monthlyTrend: { month: string; credits: number; debits: number; net: number }[] = []

    for (let i = 11; i >= 0; i--) {
      const m = subMonths(now, i)
      const from = startOfMonth(m)
      const to = endOfMonth(m)
      const monthMatch = { ...dimensional, date: { $gte: from, $lte: to } }
      const [row] = await LedgerEntry.aggregate([
        { $match: monthMatch },
        {
          $group: {
            _id: null,
            credits: { $sum: { $cond: [{ $eq: ['$direction', 'CREDIT'] }, { $ifNull: ['$amount', 0] }, 0] } },
            debits: { $sum: { $cond: [{ $eq: ['$direction', 'DEBIT'] }, { $ifNull: ['$amount', 0] }, 0] } },
          },
        },
      ])
      const credits = row?.credits || 0
      const debits = row?.debits || 0
      monthlyTrend.push({
        month: format(from, 'yyyy-MM'),
        credits,
        debits,
        net: credits - debits,
      })
    }

    const topExpenseCategories = await LedgerEntry.aggregate([
      { $match: { direction: 'DEBIT', ...LEDGER_ACTIVE_VOID_FILTER } },
      { $group: { _id: '$category', total: { $sum: { $ifNull: ['$amount', 0] } } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
    ])

    const [unreconciledCount, depositsCount, depositRefundCount] = await Promise.all([
      LedgerEntry.countDocuments({ ...LEDGER_ACTIVE_VOID_FILTER, isReconciled: false }),
      LedgerEntry.countDocuments({ ...LEDGER_ACTIVE_VOID_FILTER, entryType: 'SECURITY_DEPOSIT' }),
      LedgerEntry.countDocuments({ ...LEDGER_ACTIVE_VOID_FILTER, entryType: 'SECURITY_DEPOSIT_REFUND' }),
    ])
    const pendingDeposits = depositsCount - depositRefundCount

    const at = allTimeAgg || { totalCredits: 0, totalDebits: 0 }

    return NextResponse.json({
      allTime: {
        totalCredits: at.totalCredits || 0,
        totalDebits: at.totalDebits || 0,
        netCashPosition: (at.totalCredits || 0) - (at.totalDebits || 0),
      },
      filteredPeriod: {
        totalCredits: period.credits,
        totalDebits: period.debits,
        netBalance: period.net,
        openingBalance: openingFiltered,
        closingBalance: openingFiltered + period.net,
      },
      byEntryType: byType.map((b) => ({
        type: b._id ?? 'UNKNOWN',
        total: b.total ?? 0,
        count: b.count ?? 0,
      })),
      byAccount: byAccount.map((a) => {
        const id = a._id as { accountLabel?: string | null; accountType?: string; bankName?: string | null }
        return {
          accountLabel: id?.accountLabel ?? 'Unlabeled',
          accountType: id?.accountType ?? 'CASH',
          bankName: id?.bankName ?? undefined,
          balance: (a.credits ?? 0) - (a.debits ?? 0),
          lastActivity: a.lastActivity,
        }
      }),
      monthlyTrend: monthlyTrend.map((m, i) => ({
        ...m,
        cumulative:
          monthlyTrend.slice(0, i + 1).reduce((sum, row) => sum + row.net, 0),
      })),
      topExpenseCategories: topExpenseCategories.map((c) => ({ category: c._id || 'Other', total: c.total })),
      unreconciledCount,
      pendingDeposits: Math.max(0, pendingDeposits),
    })
  } catch (error: unknown) {
    console.error('[LEDGER_SUMMARY] Error:', error)
    logger.error('Ledger summary error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    )
  }
}
