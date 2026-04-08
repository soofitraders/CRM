export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import LedgerEntry from '@/lib/models/LedgerEntry'
import Expense from '@/lib/models/Expense'
import Payment from '@/lib/models/Payment'

const ACTIVE = { isVoided: { $ne: true } } as const

/** SUPER_ADMIN only: quick DB sanity check. Remove or lock down in production if undesired. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await getCurrentUser()
    if (!user || !hasRole(user, ['SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const [
      ledgerEntries,
      ledgerActive,
      expenses,
      payments,
      sampleLedger,
      sampleExpense,
      samplePayment,
    ] = await Promise.all([
      LedgerEntry.countDocuments({}),
      LedgerEntry.countDocuments({ ...ACTIVE }),
      Expense.countDocuments({ isDeleted: false }),
      Payment.countDocuments({}),
      LedgerEntry.findOne({ ...ACTIVE }).sort({ date: -1 }).lean(),
      Expense.findOne({ isDeleted: false }).lean(),
      Payment.findOne({}).sort({ createdAt: -1 }).lean(),
    ])

    return NextResponse.json({
      ledgerEntriesTotal: ledgerEntries,
      ledgerEntriesActiveNonVoid: ledgerActive,
      expensesNonDeleted: expenses,
      paymentsTotal: payments,
      sampleLedgerFields: sampleLedger ? Object.keys(sampleLedger) : [],
      sampleExpenseFields: sampleExpense ? Object.keys(sampleExpense) : [],
      samplePaymentFields: samplePayment ? Object.keys(samplePayment) : [],
      hint:
        ledgerActive === 0 && (expenses > 0 || payments > 0)
          ? 'Source collections have data but ledger is empty — run POST /api/ledger/sync'
          : ledgerActive > 0
            ? 'Ledger has rows; if UI is empty check date filters and isVoided query (fixed to $ne:true)'
            : 'No active ledger rows and no obvious source data — add expenses/payments or sync after creating records',
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: 'ledger-check failed', details: message }, { status: 500 })
  }
}
