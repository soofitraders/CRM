export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import LedgerEntry from '@/lib/models/LedgerEntry'
import { z } from 'zod'
import { ledgerReconcileSchema } from '@/lib/validation/ledger'
import { logger } from '@/lib/utils/performance'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 })
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()
    const body = await request.json()
    const { isReconciled } = ledgerReconcileSchema.parse(body)

    const updated = await LedgerEntry.findByIdAndUpdate(
      params.id,
      {
        $set: {
          isReconciled,
          reconciledAt: isReconciled ? new Date() : null,
          reconciledBy: isReconciled ? user._id : null,
        },
      },
      { new: true }
    ).lean()

    if (!updated) return NextResponse.json({ error: 'Ledger entry not found' }, { status: 404 })
    return NextResponse.json({ entry: updated })
  } catch (error: unknown) {
    console.error('[LEDGER_RECONCILE] Error:', error)
    logger.error('Ledger reconcile error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 })
  }
}

