export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import LedgerEntry from '@/lib/models/LedgerEntry'
import { getCurrentUser, hasRole } from '@/lib/auth'

const LEDGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE'] as const

export async function GET() {
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
    const [categories, entryTypes, accountLabels] = await Promise.all([
      LedgerEntry.distinct('category', { category: { $nin: [null, ''] } }),
      LedgerEntry.distinct('entryType', { entryType: { $nin: [null, ''] } }),
      LedgerEntry.distinct('accountLabel', { accountLabel: { $nin: [null, ''] } }),
    ])
    return NextResponse.json({
      categories: (categories as string[]).sort((a, b) => a.localeCompare(b)),
      entryTypes: (entryTypes as string[]).sort((a, b) => a.localeCompare(b)),
      accountLabels: (accountLabels as string[]).sort((a, b) => a.localeCompare(b)),
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
