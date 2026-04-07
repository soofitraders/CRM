export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import LedgerEntry from '@/lib/models/LedgerEntry'
import { buildLedgerMatch, computeBalance } from '@/lib/services/ledgerService'
import { logger } from '@/lib/utils/performance'

const LEDGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE'] as const

function toJson(e: Record<string, unknown>) {
  const refId = e.referenceId != null ? String(e.referenceId) : ''
  return {
    _id: String(e._id),
    date: e.date instanceof Date ? e.date.toISOString() : e.date,
    valueDate: e.valueDate ? (e.valueDate instanceof Date ? e.valueDate.toISOString() : e.valueDate) : undefined,
    entryType: e.entryType,
    direction: e.direction,
    amount: e.amount,
    currency: e.currency,
    description: e.description,
    referenceModel: e.referenceModel ?? '',
    referenceId: refId,
    bookingId: e.bookingId ? String(e.bookingId) : undefined,
    customerId: e.customerId ? String(e.customerId) : undefined,
    vehicleId: e.vehicleId ? String(e.vehicleId) : undefined,
    userId: e.userId ? String(e.userId) : undefined,
    accountType: e.accountType,
    accountLabel: e.accountLabel,
    bankName: e.bankName,
    transferToAccount: e.transferToAccount,
    transferFromAccount: e.transferFromAccount,
    pairedEntryId: e.pairedEntryId ? String(e.pairedEntryId) : undefined,
    category: e.category,
    subCategory: e.subCategory,
    isReconciled: !!e.isReconciled,
    isVoided: !!e.isVoided,
    voidReason: e.voidReason,
    note: e.note,
    runningBalance: e.runningBalance,
    tags: e.tags,
    attachmentUrl: e.attachmentUrl,
    createdBy: e.createdBy ? String(e.createdBy) : undefined,
    createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
  }
}

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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const direction = searchParams.get('direction') || 'ALL'
    const entryTypeParam = searchParams.get('entryType')
    const entryTypes = entryTypeParam
      ? entryTypeParam.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined
    const bookingId = searchParams.get('bookingId') || undefined
    const customerId = searchParams.get('customerId') || undefined
    const vehicleId = searchParams.get('vehicleId') || undefined
    const accountType = searchParams.get('accountType') || undefined
    const accountLabel = searchParams.get('accountLabel') || undefined
    const isReconciled = searchParams.get('isReconciled')
    const isVoided = searchParams.get('isVoided')
    const minAmount = searchParams.get('minAmount')
    const maxAmount = searchParams.get('maxAmount')
    const search = searchParams.get('search') || undefined
    const sortBy = searchParams.get('sortBy') || 'date'
    const sortDir = searchParams.get('sortOrder') === 'asc' ? 1 : -1

    const startDate = startDateStr ? new Date(startDateStr) : undefined
    const endDate = endDateStr ? new Date(endDateStr) : undefined

    const dirFilter = direction === 'ALL' ? undefined : (direction as 'CREDIT' | 'DEBIT' | 'INTERNAL')

    const dimensionalMatch = buildLedgerMatch({
      direction: dirFilter,
      entryTypes,
      bookingId,
      customerId,
      vehicleId,
      accountType,
      accountLabel,
      isReconciled: isReconciled === null ? undefined : isReconciled === 'true',
      isVoided: isVoided === null ? false : isVoided === 'true',
      minAmount: minAmount ? Number(minAmount) : undefined,
      maxAmount: maxAmount ? Number(maxAmount) : undefined,
      search,
    })

    const fullMatch = buildLedgerMatch({
      startDate,
      endDate,
      direction: dirFilter,
      entryTypes,
      bookingId,
      customerId,
      vehicleId,
      accountType,
      accountLabel,
      isReconciled: isReconciled === null ? undefined : isReconciled === 'true',
      isVoided: isVoided === null ? false : isVoided === 'true',
      minAmount: minAmount ? Number(minAmount) : undefined,
      maxAmount: maxAmount ? Number(maxAmount) : undefined,
      search,
    })

    let openingBalance = 0
    if (startDate) {
      const priorMatch = { ...dimensionalMatch, date: { $lt: startDate } }
      openingBalance = (await computeBalance(priorMatch)).net
    }

    const sortSpec: Record<string, 1 | -1> =
      sortBy === 'amount'
        ? { amount: sortDir as 1 | -1, date: -1 as const, _id: -1 as const }
        : { date: sortDir as 1 | -1, _id: sortDir as 1 | -1 }

    const skip = (page - 1) * limit

    const [entries, total, periodBalance] = await Promise.all([
      LedgerEntry.find(fullMatch).sort(sortSpec).skip(skip).limit(limit).lean(),
      LedgerEntry.countDocuments(fullMatch),
      computeBalance(fullMatch),
    ])

    const totalCredits = periodBalance.credits
    const totalDebits = periodBalance.debits
    const netPeriod = periodBalance.net
    const closingBalance = openingBalance + netPeriod

    return NextResponse.json({
      entries: entries.map((doc) => toJson(doc as unknown as Record<string, unknown>)),
      pagination: {
        total,
        page,
        limit,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
      summary: {
        totalCredits,
        totalDebits,
        netBalance: netPeriod,
        openingBalance,
        closingBalance,
        period: {
          start: startDate?.toISOString(),
          end: endDate?.toISOString(),
        },
      },
    })
  } catch (error: unknown) {
    console.error('[LEDGER_GET] Error:', error)
    logger.error('Ledger GET error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 }
    )
  }
}
