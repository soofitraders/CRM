import mongoose from 'mongoose'
import connectDB from '@/lib/db'
import Booking from '@/lib/models/Booking'
import Payment from '@/lib/models/Payment'
import LedgerEntry from '@/lib/models/LedgerEntry'
import { invalidateBookingCache, invalidateDashboardCache, invalidateFinancialCache } from '@/lib/cache/cacheUtils'

/**
 * Everything that must happen together when an invoice is marked PAID:
 *
 *   1. a Payment record (SUCCESS) linked to the booking AND the invoice
 *   2. the booking's paymentStatus becomes PAID
 *   3. the General Ledger gets its credit row straight away (no need to click "Sync")
 *
 * The ledger row has the same shape the ledger "Sync" builds for a paid invoice,
 * so a later Sync simply rebuilds the same single row (never a duplicate).
 *
 * Safe to call twice for the same invoice (it never creates a second payment
 * or a second ledger row).
 */
export async function recordInvoicePayment(invoice: any, userId?: string) {
  await connectDB()

  const total = Number(invoice.total || 0)
  const bookingId = invoice.booking ? new mongoose.Types.ObjectId(String(invoice.booking._id || invoice.booking)) : undefined
  const isBank = String(invoice.transactionMethod || 'CASH').toUpperCase() === 'BANK_TRANSFER'
  const paidAt = new Date()

  // 1) Payment record (a zero-value invoice has nothing to receive)
  let payment: any = null
  if (total > 0) {
    payment = await Payment.findOne({ invoice: invoice._id })
    if (!payment) {
      payment = await Payment.create({
        booking: bookingId,
        invoice: invoice._id,
        amount: total,
        method: isBank ? 'BANK_TRANSFER' : 'CASH',
        status: 'SUCCESS',
        transactionId: invoice.invoiceNumber,
        paidAt,
      })
    }
  }

  // 2) Booking shows PAID
  if (bookingId) {
    await Booking.updateOne({ _id: bookingId }, { $set: { paymentStatus: 'PAID' } })
  }

  // 3) Ledger credit, right now (same row the ledger Sync builds for a paid invoice)
  if (total > 0) {
    const existing = await LedgerEntry.findOne({
      referenceModel: 'Invoice',
      referenceId: invoice._id,
      entryType: 'INVOICE_PAYMENT',
    })
    if (!existing) {
      await LedgerEntry.create({
        date: paidAt,
        entryType: 'INVOICE_PAYMENT',
        direction: 'CREDIT',
        amount: total,
        currency: 'AED',
        description: `Invoice ${invoice.invoiceNumber} — Paid`,
        category: 'Invoice Payment',
        accountLabel: isBank ? 'Bank Transfer' : 'Cash',
        accountType: isBank ? 'BANK' : 'CASH',
        referenceModel: 'Invoice',
        referenceId: invoice._id,
        bookingId,
        userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
        isVoided: false,
        isReconciled: true,
      })
      await recomputeLedgerBalances()
    }
  }

  // Make the new numbers show up everywhere straight away
  invalidateBookingCache(bookingId ? String(bookingId) : undefined)
  invalidateDashboardCache()
  invalidateFinancialCache()

  return payment
}

/** Undo payment + ledger row if the invoice could not be saved as PAID (keeps books consistent). */
export async function rollbackInvoicePayment(invoice: any) {
  await connectDB()
  await Payment.deleteMany({ invoice: invoice._id })
  await LedgerEntry.deleteMany({ referenceModel: 'Invoice', referenceId: invoice._id, entryType: 'INVOICE_PAYMENT' })
  await recomputeLedgerBalances()
}

/** Running balance = credits minus debits, in date order (same calculation the ledger Sync uses). */
async function recomputeLedgerBalances() {
  const all = await LedgerEntry.find({ isVoided: { $ne: true } })
    .sort({ date: 1, createdAt: 1 })
    .select('_id direction amount')
    .lean()
  let balance = 0
  const ops = all.map((e: any) => {
    balance += e.direction === 'CREDIT' ? Number(e.amount ?? 0) : -Number(e.amount ?? 0)
    return {
      updateOne: {
        filter: { _id: e._id },
        update: { $set: { runningBalance: Math.round(balance * 100) / 100 } },
      },
    }
  })
  if (ops.length > 0) await LedgerEntry.bulkWrite(ops, { ordered: false })
}
