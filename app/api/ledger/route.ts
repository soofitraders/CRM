export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import LedgerEntry from '@/lib/models/LedgerEntry'

const LEDGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE'] as const

function serializeEntry(doc: Record<string, unknown>) {
  const refId = doc.referenceId != null ? String(doc.referenceId) : undefined
  return {
    ...doc,
    _id: String(doc._id),
    date: doc.date instanceof Date ? doc.date.toISOString() : doc.date,
    valueDate: doc.valueDate instanceof Date ? (doc.valueDate as Date).toISOString() : doc.valueDate,
    referenceId: refId,
    bookingId: doc.bookingId ? String(doc.bookingId) : undefined,
    customerId: doc.customerId ? String(doc.customerId) : undefined,
    vehicleId: doc.vehicleId ? String(doc.vehicleId) : undefined,
    userId: doc.userId ? String(doc.userId) : undefined,
    createdAt: doc.createdAt instanceof Date ? (doc.createdAt as Date).toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? (doc.updatedAt as Date).toISOString() : doc.updatedAt,
    reconciledAt: doc.reconciledAt instanceof Date ? (doc.reconciledAt as Date).toISOString() : doc.reconciledAt,
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

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const skip = (page - 1) * limit

    const filter: Record<string, unknown> = { isVoided: { $ne: true } }

    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    if (startDate || endDate) {
      filter.date = {} as Record<string, Date>
      if (startDate) (filter.date as { $gte: Date }).$gte = new Date(startDate)
      if (endDate) {
        const e = new Date(endDate)
        e.setHours(23, 59, 59, 999)
        ;(filter.date as { $lte?: Date }).$lte = e
      }
    }

    const direction = searchParams.get('direction')
    if (direction && direction !== 'ALL') {
      filter.direction = direction
    }

    const entryType = searchParams.get('entryType')
    if (entryType && entryType !== 'ALL') {
      filter.entryType = entryType
    }

    const category = searchParams.get('category')
    if (category && category !== 'ALL') {
      filter.category = { $regex: category, $options: 'i' }
    }

    const search = searchParams.get('search')
    if (search?.trim()) {
      const q = search.trim()
      filter.$or = [
        { description: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
        { note: { $regex: q, $options: 'i' } },
        { accountLabel: { $regex: q, $options: 'i' } },
        { entryType: { $regex: q, $options: 'i' } },
      ]
    }

    const [rows, total] = await Promise.all([
      LedgerEntry.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      LedgerEntry.countDocuments(filter),
    ])

    const agg = await LedgerEntry.aggregate([
      { $match: filter as never },
      {
        $group: {
          _id: null,
          totalCredits: {
            $sum: { $cond: [{ $eq: ['$direction', 'CREDIT'] }, { $ifNull: ['$amount', 0] }, 0] },
          },
          totalDebits: {
            $sum: { $cond: [{ $eq: ['$direction', 'DEBIT'] }, { $ifNull: ['$amount', 0] }, 0] },
          },
          count: { $sum: 1 },
        },
      },
    ])

    const cr = Number(agg[0]?.totalCredits ?? 0)
    const dr = Number(agg[0]?.totalDebits ?? 0)

    const unreconciledCount = await LedgerEntry.countDocuments({
      ...filter,
      isReconciled: false,
    })

    return NextResponse.json({
      entries: rows.map((r) => serializeEntry(r as unknown as Record<string, unknown>)),
      pagination: {
        total,
        page,
        limit,
        pages: total === 0 ? 0 : Math.ceil(total / limit),
      },
      summary: {
        totalCredits: cr,
        totalDebits: dr,
        netBalance: cr - dr,
        totalEntries: Number(agg[0]?.count ?? 0),
        unreconciledCount,
      },
    })
  } catch (error) {
    console.error('[GET /api/ledger]', error)
    return NextResponse.json(
      { error: 'Failed to load ledger', details: String(error) },
      { status: 500 }
    )
  }
}
