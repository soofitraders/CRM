export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import mongoose from 'mongoose'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import LedgerEntry from '@/lib/models/LedgerEntry'
import { recomputeLedgerRunningBalances } from '@/lib/ledger/recomputeBalances'

const num = (v: unknown) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}
const asDate = (v: unknown) => {
  if (!v) return new Date()
  const x = new Date(v as string | number | Date)
  return Number.isNaN(x.getTime()) ? new Date() : x
}
const asStr = (v: unknown, fb = '') => {
  if (v == null) return fb
  if (typeof v === 'object' && v !== null && 'name' in (v as object)) {
    const o = v as { name?: string; title?: string; label?: string }
    return String(o.name ?? o.title ?? o.label ?? fb)
  }
  return String(v)
}

async function normalizeLedgerIndexes() {
  try {
    const collection = LedgerEntry.collection
    const indexes = await collection.indexes()

    for (const idx of indexes) {
      const k = idx.key as Record<string, number> | undefined
      if (!k || !idx.name) continue

      if (idx.name === 'sourceKey_1') {
        try {
          await collection.dropIndex(idx.name)
          console.log(`[SYNC] Dropped legacy index: ${idx.name}`)
        } catch {
          /* ignore */
        }
        continue
      }

      const triple =
        k.referenceModel === 1 && k.referenceId === 1 && k.entryType === 1
      const legacyPair =
        k.referenceModel === 1 && k.referenceId === 1 && k.entryType === undefined

      if (idx.unique && (triple || legacyPair)) {
        try {
          await collection.dropIndex(idx.name)
          console.log(`[SYNC] Dropped unique index: ${idx.name}`)
        } catch (e) {
          console.log(`[SYNC] Could not drop ${idx.name}:`, e)
        }
      }
    }

    await collection.createIndex(
      { referenceModel: 1, referenceId: 1, entryType: 1 },
      { unique: false, background: true }
    )
    console.log('[SYNC] Non-unique compound index ensured')
  } catch (e) {
    console.log('[SYNC] Index normalization warning (non-fatal):', e)
  }
}

async function removeDuplicates(): Promise<number> {
  try {
    const collection = LedgerEntry.collection
    const all = await collection
      .find({ referenceModel: { $exists: true, $ne: '' } })
      .sort({ createdAt: 1 })
      .toArray()

    const seen = new Set<string>()
    const toDelete: mongoose.Types.ObjectId[] = []

    for (const doc of all) {
      const d = doc.date ? new Date(doc.date as Date) : new Date()
      const day = d.toISOString().split('T')[0]
      const key = [
        doc.referenceModel,
        doc.referenceId?.toString(),
        doc.entryType,
        doc.amount,
        day,
      ].join('|')

      if (seen.has(key)) {
        toDelete.push(doc._id as mongoose.Types.ObjectId)
      } else {
        seen.add(key)
      }
    }

    if (toDelete.length > 0) {
      await collection.deleteMany({ _id: { $in: toDelete } })
      console.log(`[SYNC] Removed ${toDelete.length} exact duplicates`)
    } else {
      console.log('[SYNC] No duplicates found')
    }

    return toDelete.length
  } catch (e) {
    console.log('[SYNC] Duplicate removal warning:', e)
    return 0
  }
}

function paymentMethodLabel(method: string) {
  const map: Record<string, string> = {
    CASH: 'Cash',
    CARD: 'Card',
    BANK_TRANSFER: 'Bank Transfer',
    ONLINE: 'Online',
  }
  return map[method] || method
}

export async function POST() {
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
    await normalizeLedgerIndexes()
    const removedDuplicates = await removeDuplicates()

    await LedgerEntry.updateMany({ currency: 'PKR' }, { $set: { currency: 'AED' } })
    await LedgerEntry.updateMany(
      { direction: { $nin: ['CREDIT', 'DEBIT'] } },
      { $set: { direction: 'DEBIT' } }
    )

    let synced = 0
    let skipped = 0
    const errors: string[] = []

    const upsert = async (
      refModel: string,
      refId: mongoose.Types.ObjectId,
      entryType: string,
      data: Record<string, unknown>
    ) => {
      try {
        const dateVal = asDate(data.date)
        const startOfDay = new Date(dateVal)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(dateVal)
        endOfDay.setHours(23, 59, 59, 999)
        const amount = num(data.amount)

        const existing = await LedgerEntry.findOne({
          referenceModel: refModel,
          referenceId: refId,
          entryType,
          amount,
          date: { $gte: startOfDay, $lte: endOfDay },
        })

        const payload = {
          ...data,
          referenceModel: refModel,
          referenceId: refId,
          entryType,
          currency: 'AED',
          isVoided: false,
          runningBalance: 0,
        }

        if (existing) {
          await LedgerEntry.findByIdAndUpdate(existing._id, { $set: payload })
        } else {
          await LedgerEntry.create(payload)
        }
        synced++
      } catch (e: unknown) {
        skipped++
        const err = e as { message?: string }
        errors.push(`${refModel}/${entryType}: ${err?.message ?? String(e)}`)
      }
    }

    // 1. Expenses
    try {
      const Expense = (await import('@/lib/models/Expense')).default
      const docs = await Expense.find({ isDeleted: false }).populate('category', 'name code').lean()
      for (const doc of docs) {
        const d = doc as Record<string, unknown>
        if (d.salaryRecord || d.investorPayout || d.maintenanceRecord) continue
        const amount = num(d.amount)
        const date = asDate(d.dateIncurred ?? d.createdAt)
        const desc = asStr(d.description, 'Expense')
        const catDoc = d.category as { name?: string; code?: string } | undefined
        const catName = catDoc?.name || asStr(d.category, 'General Expense')
        const vehicle = d.vehicle as mongoose.Types.ObjectId | undefined
        const mappedType =
          d.maintenanceRecord ? 'VEHICLE_MAINTENANCE' : catDoc?.code === 'FUEL' ? 'FUEL_EXPENSE' : 'EXPENSE_PAID'
        await upsert('Expense', doc._id as mongoose.Types.ObjectId, mappedType, {
          date,
          valueDate: date,
          direction: 'DEBIT',
          amount,
          description: desc,
          category: catName,
          accountLabel: 'Cash',
          accountType: 'CASH',
          vehicleId: vehicle,
          note: asStr(d.notes, ''),
          isReconciled: false,
        })
      }
    } catch (e) {
      errors.push(`Expense: ${e}`)
      console.error('[SYNC] Expense', e)
    }

    // 2. Payments (SUCCESS — booking payments; skip investor-linked payments)
    try {
      const Payment = (await import('@/lib/models/Payment')).default
      const InvestorPayout = (await import('@/lib/models/InvestorPayout')).default
      const docs = await Payment.find({ status: 'SUCCESS' }).lean()
      for (const doc of docs) {
        const d = doc as Record<string, unknown>
        const payout = await InvestorPayout.findOne({ payment: doc._id }).select('_id').lean()
        if (payout) continue
        const amount = num(d.amount)
        const date = asDate(d.paidAt ?? d.updatedAt ?? d.createdAt)
        const method = String(d.method ?? 'CASH')
        const bookingId = d.booking as mongoose.Types.ObjectId | undefined
        let customerId: mongoose.Types.ObjectId | undefined
        let vehicleId: mongoose.Types.ObjectId | undefined
        if (bookingId) {
          const Booking = (await import('@/lib/models/Booking')).default
          const b = await Booking.findById(bookingId).select('customer vehicle').lean()
          customerId = b?.customer as mongoose.Types.ObjectId | undefined
          vehicleId = b?.vehicle as mongoose.Types.ObjectId | undefined
        }
        await upsert('Payment', doc._id as mongoose.Types.ObjectId, 'BOOKING_PAYMENT', {
          date,
          valueDate: d.paidAt ? asDate(d.paidAt) : date,
          direction: 'CREDIT',
          amount,
          description: `Booking payment received${d.transactionId ? ` (${String(d.transactionId)})` : ''}`,
          category: 'Booking Payment',
          accountLabel: paymentMethodLabel(method),
          accountType: method === 'BANK_TRANSFER' ? 'BANK' : 'CASH',
          bookingId,
          customerId,
          vehicleId,
          note: '',
          isReconciled: false,
        })
      }
    } catch (e) {
      errors.push(`Payment: ${e}`)
      console.error('[SYNC] Payment', e)
    }

    // 3. Salaries (PAID)
    try {
      const SalaryRecord = (await import('@/lib/models/SalaryRecord')).default
      const User = (await import('@/lib/models/User')).default
      const docs = await SalaryRecord.find({ isDeleted: false, status: 'PAID' }).lean()
      for (const doc of docs) {
        const d = doc as Record<string, unknown>
        const amount = num(d.netSalary)
        const date = asDate(d.paidAt ?? d.updatedAt ?? d.createdAt)
        const staff = await User.findById(d.staffUser).select('name').lean()
        const name = staff?.name ? String(staff.name) : ''
        await upsert('SalaryRecord', doc._id as mongoose.Types.ObjectId, 'SALARY_PAID', {
          date,
          valueDate: d.paidAt ? asDate(d.paidAt) : date,
          direction: 'DEBIT',
          amount,
          description: name ? `Salary paid — ${name}` : 'Salary paid',
          category: 'Salary',
          accountLabel: 'Cash',
          accountType: 'CASH',
          userId: d.staffUser as mongoose.Types.ObjectId,
          note: asStr(d.notes, ''),
          isReconciled: false,
        })
      }
    } catch (e) {
      errors.push(`Salary: ${e}`)
      console.error('[SYNC] Salary', e)
    }

    // 4. Investor payouts (PAID)
    try {
      const InvestorPayout = (await import('@/lib/models/InvestorPayout')).default
      const InvestorProfile = (await import('@/lib/models/InvestorProfile')).default
      const docs = await InvestorPayout.find({ status: 'PAID' }).lean()
      for (const doc of docs) {
        const d = doc as Record<string, unknown>
        const totals = d.totals as { netPayout?: number } | undefined
        const amount = num(totals?.netPayout)
        if (amount <= 0) continue
        const date = asDate(d.updatedAt ?? d.createdAt)
        let iname = ''
        const inv = await InvestorProfile.findById(d.investor).populate('user', 'name').lean()
        if (inv) {
          const u = inv.user as { name?: string } | undefined
          iname = (inv.companyName && String(inv.companyName)) || (u?.name && String(u.name)) || ''
        }
        await upsert('InvestorPayout', doc._id as mongoose.Types.ObjectId, 'INVESTOR_PAYOUT', {
          date,
          valueDate: date,
          direction: 'DEBIT',
          amount,
          description: iname ? `Investor payout — ${iname}` : 'Investor payout',
          category: 'Investor Payout',
          accountLabel: 'Bank',
          accountType: 'BANK',
          note: asStr(d.notes, ''),
          isReconciled: false,
        })
      }
    } catch (e) {
      errors.push(`InvestorPayout: ${e}`)
      console.error('[SYNC] InvestorPayout', e)
    }

    // 5. Maintenance
    try {
      const MaintenanceRecord = (await import('@/lib/models/MaintenanceRecord')).default
      const docs = await MaintenanceRecord.find({ cost: { $gt: 0 } }).lean()
      for (const doc of docs) {
        const d = doc as Record<string, unknown>
        const amount = num(d.cost)
        if (amount <= 0) continue
        const date = asDate(d.scheduledDate ?? d.completedDate ?? d.createdAt)
        const desc = asStr(d.description, 'Maintenance')
        await upsert('MaintenanceRecord', doc._id as mongoose.Types.ObjectId, 'VEHICLE_MAINTENANCE', {
          date,
          valueDate: d.completedDate ? asDate(d.completedDate) : date,
          direction: 'DEBIT',
          amount,
          description: `Maintenance: ${desc}`,
          category: 'Vehicle Maintenance',
          accountLabel: 'Cash',
          accountType: 'CASH',
          vehicleId: d.vehicle as mongoose.Types.ObjectId,
          note: '',
          isReconciled: false,
        })
      }
    } catch (e) {
      errors.push(`Maintenance: ${e}`)
      console.error('[SYNC] Maintenance', e)
    }

    // 6. Fines
    try {
      const FineOrPenalty = (await import('@/lib/models/FineOrPenalty')).default
      const docs = await FineOrPenalty.find({}).lean()
      for (const doc of docs) {
        const d = doc as Record<string, unknown>
        const amount = num(d.amount)
        if (amount <= 0) continue
        const date = asDate(d.issueDate)
        const isPaid = d.status === 'PAID'
        const entryType = isPaid ? 'FINE_PAID' : 'FINE_COLLECTED'
        const direction = isPaid ? 'DEBIT' : 'CREDIT'
        await upsert('FineOrPenalty', doc._id as mongoose.Types.ObjectId, entryType, {
          date,
          valueDate: d.dueDate ? asDate(d.dueDate) : date,
          direction,
          amount,
          description: `Fine ${String(d.referenceNumber)} — ${String(d.authorityName)}`,
          category: isPaid ? 'Fine Paid' : 'Fine Collected',
          accountLabel: 'Cash',
          accountType: 'CASH',
          bookingId: d.booking as mongoose.Types.ObjectId | undefined,
          customerId: d.customer as mongoose.Types.ObjectId | undefined,
          vehicleId: d.vehicle as mongoose.Types.ObjectId,
          note: '',
          isReconciled: false,
        })
      }
    } catch (e) {
      errors.push(`Fines: ${e}`)
      console.error('[SYNC] Fines', e)
    }

    // 7. Recurring expenses
    try {
      const RecurringExpense = (await import('@/lib/models/RecurringExpense')).default
      const ExpenseCategory = (await import('@/lib/models/ExpenseCategory')).default
      const docs = await RecurringExpense.find({ isActive: true }).lean()
      for (const doc of docs) {
        const d = doc as Record<string, unknown>
        const amount = num(d.amount)
        if (amount <= 0) continue
        const date = asDate(d.lastProcessedDate ?? d.nextDueDate ?? d.createdAt)
        const desc = asStr(d.description, 'Recurring expense')
        let catName = 'Recurring Expense'
        if (d.category) {
          const c = await ExpenseCategory.findById(d.category).select('name').lean()
          if (c?.name) catName = String(c.name)
        }
        await upsert('RecurringExpense', doc._id as mongoose.Types.ObjectId, 'RECURRING_EXPENSE', {
          date,
          valueDate: date,
          direction: 'DEBIT',
          amount,
          description: desc,
          category: catName,
          accountLabel: 'Cash',
          accountType: 'CASH',
          note: asStr(d.notes, ''),
          isReconciled: false,
        })
      }
    } catch (e) {
      errors.push(`RecurringExpense: ${e}`)
      console.error('[SYNC] Recurring', e)
    }

    // 8. Booking deposits + refunds
    try {
      const Booking = (await import('@/lib/models/Booking')).default
      const docs = await Booking.find({ depositAmount: { $gt: 0 } }).lean()
      for (const doc of docs) {
        const d = doc as Record<string, unknown>
        const deposit = num(d.depositAmount)
        if (deposit <= 0) continue
        const date = asDate(d.startDateTime ?? d.createdAt)
        const bid = doc._id as mongoose.Types.ObjectId
        await upsert('Booking', bid, 'SECURITY_DEPOSIT', {
          date,
          valueDate: date,
          direction: 'CREDIT',
          amount: deposit,
          description: 'Security deposit collected',
          category: 'Security Deposit',
          accountLabel: 'Cash',
          accountType: 'CASH',
          bookingId: bid,
          customerId: d.customer as mongoose.Types.ObjectId | undefined,
          vehicleId: d.vehicle as mongoose.Types.ObjectId | undefined,
          note: '',
          isReconciled: false,
        })
        if (d.depositStatus === 'RELEASED') {
          await upsert('Booking', bid, 'SECURITY_DEPOSIT_REFUND', {
            date: asDate(d.updatedAt),
            valueDate: asDate(d.updatedAt),
            direction: 'DEBIT',
            amount: deposit,
            description: 'Security deposit refunded',
            category: 'Security Deposit Refund',
            accountLabel: 'Cash',
            accountType: 'CASH',
            bookingId: bid,
            customerId: d.customer as mongoose.Types.ObjectId | undefined,
            vehicleId: d.vehicle as mongoose.Types.ObjectId | undefined,
            note: '',
            isReconciled: false,
          })
        }
      }
    } catch (e) {
      errors.push(`Booking deposits: ${e}`)
      console.error('[SYNC] Booking', e)
    }

    try {
      await recomputeLedgerRunningBalances()
    } catch (e) {
      errors.push(`Balance recompute: ${e}`)
    }

    try {
      const { cache } = await import('@/lib/cache')
      cache.deletePrefix('ledger:')
      console.log('[SYNC] Ledger cache cleared after sync')
    } catch {
      /* non-critical */
    }

    const totalInDB = await LedgerEntry.countDocuments()
    return NextResponse.json({
      success: true,
      synced,
      skipped,
      totalInDB,
      removedDuplicates,
      errors: errors.slice(0, 15),
    })
  } catch (error) {
    console.error('[SYNC] Fatal', error)
    return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 })
  }
}
