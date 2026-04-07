export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import mongoose from 'mongoose'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import LedgerEntry, { ILedgerEntry } from '@/lib/models/LedgerEntry'
import type { HydratedDocument } from 'mongoose'
import { z } from 'zod'
import { manualLedgerSchema } from '@/lib/validation/ledger'
import { recomputeAllRunningBalances } from '@/lib/services/ledgerService'
import { logger } from '@/lib/utils/performance'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 401 })
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = manualLedgerSchema.parse(body)

    await connectDB()

    if (data.entryType === 'BANK_TRANSFER_INTERNAL') {
      const sessionDb = await mongoose.startSession()
      let paired: HydratedDocument<ILedgerEntry>[] = []
      try {
        await sessionDb.withTransaction(async () => {
          const created = await LedgerEntry.create(
            [
              {
                date: new Date(data.date),
                valueDate: data.valueDate ? new Date(data.valueDate) : undefined,
                entryType: 'BANK_TRANSFER_INTERNAL',
                direction: 'DEBIT',
                amount: data.amount,
                currency: 'PKR',
                description: data.description,
                accountType: data.accountType,
                accountLabel: data.transferFromAccount || data.accountLabel,
                transferFromAccount: data.transferFromAccount,
                transferToAccount: data.transferToAccount,
                category: data.category,
                subCategory: data.subCategory,
                tags: data.tags,
                note: data.note,
                bookingId: data.bookingId ? new mongoose.Types.ObjectId(data.bookingId) : undefined,
                customerId: data.customerId ? new mongoose.Types.ObjectId(data.customerId) : undefined,
                vehicleId: data.vehicleId ? new mongoose.Types.ObjectId(data.vehicleId) : undefined,
                createdBy: user._id,
              },
              {
                date: new Date(data.date),
                valueDate: data.valueDate ? new Date(data.valueDate) : undefined,
                entryType: 'BANK_TRANSFER_INTERNAL',
                direction: 'CREDIT',
                amount: data.amount,
                currency: 'PKR',
                description: data.description,
                accountType: data.accountType,
                accountLabel: data.transferToAccount || data.accountLabel,
                transferFromAccount: data.transferFromAccount,
                transferToAccount: data.transferToAccount,
                category: data.category,
                subCategory: data.subCategory,
                tags: data.tags,
                note: data.note,
                bookingId: data.bookingId ? new mongoose.Types.ObjectId(data.bookingId) : undefined,
                customerId: data.customerId ? new mongoose.Types.ObjectId(data.customerId) : undefined,
                vehicleId: data.vehicleId ? new mongoose.Types.ObjectId(data.vehicleId) : undefined,
                createdBy: user._id,
              },
            ],
            { session: sessionDb }
          )
          paired = created
          const from = created[0]
          const to = created[1]
          await LedgerEntry.updateOne({ _id: from._id }, { $set: { pairedEntryId: to._id } }, { session: sessionDb })
          await LedgerEntry.updateOne({ _id: to._id }, { $set: { pairedEntryId: from._id } }, { session: sessionDb })
        })
      } finally {
        sessionDb.endSession()
      }

      try {
        await recomputeAllRunningBalances()
      } catch (reErr) {
        logger.error('Ledger manual: running balance recompute failed after internal transfer:', reErr)
        throw reErr
      }
      return NextResponse.json({ entries: paired }, { status: 201 })
    }

    const entry = await LedgerEntry.create({
      date: new Date(data.date),
      valueDate: data.valueDate ? new Date(data.valueDate) : undefined,
      entryType: data.entryType,
      direction: data.direction,
      amount: data.amount,
      currency: 'PKR',
      description: data.description,
      accountType: data.accountType,
      accountLabel: data.accountLabel,
      bankName: data.bankName,
      transferToAccount: data.transferToAccount,
      transferFromAccount: data.transferFromAccount,
      bookingId: data.bookingId ? new mongoose.Types.ObjectId(data.bookingId) : undefined,
      customerId: data.customerId ? new mongoose.Types.ObjectId(data.customerId) : undefined,
      vehicleId: data.vehicleId ? new mongoose.Types.ObjectId(data.vehicleId) : undefined,
      category: data.category,
      subCategory: data.subCategory,
      tags: data.tags,
      note: data.note,
      createdBy: user._id,
      isVoided: false,
      isReconciled: false,
    })
    await recomputeAllRunningBalances()
    return NextResponse.json({ entry }, { status: 201 })
  } catch (error: unknown) {
    console.error('[LEDGER_MANUAL] Error:', error)
    logger.error('Ledger manual create error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 })
  }
}
