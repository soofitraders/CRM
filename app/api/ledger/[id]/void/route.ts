export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import { z } from 'zod'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import LedgerEntry from '@/lib/models/LedgerEntry'
import { ledgerVoidSchema } from '@/lib/validation/ledger'
import { recomputeAllRunningBalances } from '@/lib/services/ledgerService'
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
    if (!hasRole(user, ['SUPER_ADMIN'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await connectDB()

    const body = await request.json()
    const { voidReason } = ledgerVoidSchema.parse(body)

    const entry = await LedgerEntry.findById(params.id)
    if (!entry) return NextResponse.json({ error: 'Ledger entry not found' }, { status: 404 })

    entry.isVoided = true
    entry.voidedAt = new Date()
    entry.voidedBy = new mongoose.Types.ObjectId(String(user._id))
    entry.voidReason = voidReason
    await entry.save()

    if (entry.pairedEntryId) {
      await LedgerEntry.updateOne(
        { _id: entry.pairedEntryId },
        { $set: { isVoided: true, voidedAt: new Date(), voidedBy: user._id, voidReason } }
      )
    }
    await recomputeAllRunningBalances()
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('[LEDGER_VOID] Error:', error)
    logger.error('Ledger void error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 })
  }
}

