export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import LedgerEntry from '@/lib/models/LedgerEntry'
import { recomputeLedgerRunningBalances } from '@/lib/ledger/recomputeBalances'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()
    const body = await request.json()
    const { date, entryType, direction, amount, description, accountLabel, note } = body as Record<
      string,
      unknown
    >
    if (!date || !entryType || !direction || amount == null || !description) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const dir = direction === 'CREDIT' || direction === 'DEBIT' ? direction : null
    if (!dir) {
      return NextResponse.json({ error: 'Invalid direction' }, { status: 400 })
    }

    const label = typeof accountLabel === 'string' && accountLabel.trim() ? accountLabel.trim() : 'Cash'
    const low = label.toLowerCase()
    const accountType =
      low.includes('bank') ? 'BANK' : low.includes('mobile') ? 'MOBILE_WALLET' : 'CASH'

    await LedgerEntry.create({
      date: new Date(String(date)),
      entryType: String(entryType),
      direction: dir,
      amount: Number(amount),
      currency: 'AED',
      description: String(description),
      category: String(entryType).replace(/_/g, ' '),
      accountLabel: label,
      accountType,
      note: note != null ? String(note) : '',
      referenceModel: 'Manual',
      isVoided: false,
      isReconciled: false,
      runningBalance: 0,
    })

    await recomputeLedgerRunningBalances()
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
