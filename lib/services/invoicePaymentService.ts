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
 * SAFE FOR SIMULTANEOUS CLICKS (double click, two finance users at once):
 *   - A unique index allows only ONE payment per invoice. Of several simultaneous
 *     requests exactly one inserts the payment; the others see "already recorded".
 *   - Only the request that created the payment writes the ledger row, so the ledger
 *     can never get two credits for one invoice.
 *   - If something fails, a request undoes ONLY what it created itself (never another
 *     request's rows), restores the booking's previous payment status, and reports
 *     whether a payment still exists (`error.paymentExists`).
 */

// One payment per invoice (only payments that carry an invoice link are covered).
let paymentIndexReady: Promise<void> | null = null
function ensurePaymentIndex(): Promise<void> {
  if (!paymentIndexReady) {
    paymentIndexReady = Payment.collection
      .createIndex(
        { invoice: 1 },
        { unique: true, name: 'invoice_unique', partialFilterExpression: { invoice: { $exists: true } } }
      )
      .then(() => undefined)
      .catch((err: any) => {
        paymentIndexReady = null // try again on the next call
        throw err
      })
  }
  return paymentIndexReady
}

export async function recordInvoicePayment(invoice: any, userId?: string) {
  await connectDB()
  await ensurePaymentIndex()

  const total = Number(invoice.total || 0)
  const bookingId = invoice.booking ? new mongoose.Types.ObjectId(String(invoice.booking._id || invoice.booking)) : undefined
  const isBank = String(invoice.transactionMethod || 'CASH').toUpperCase() === 'BANK_TRANSFER'
  const paidAt = new Date()

  let payment: any = null
  let createdPayment = false
  let ledgerId: any = null
  let previousBookingStatus: string | undefined

  try {
    // 1) Payment record (a zero-value invoice has nothing to receive)
    if (total > 0) {
      payment = await Payment.findOne({ invoice: invoice._id })
      if (!payment) {
        try {
          payment = await Payment.create({
            booking: bookingId,
            invoice: invoice._id,
            amount: total,
            method: isBank ? 'BANK_TRANSFER' : 'CASH',
            status: 'SUCCESS',
            transactionId: invoice.invoiceNumber,
            paidAt,
          })
          createdPayment = true
        } catch (insertError: any) {
          // Another simultaneous request created it first: that is fine, use theirs
          if (insertError?.code === 11000) payment = await Payment.findOne({ invoice: invoice._id })
          else throw insertError
        }
      }
    }

    // 2) Booking shows PAID
    if (bookingId) {
      const before: any = await Booking.findById(bookingId).select('paymentStatus').lean()
      previousBookingStatus = before?.paymentStatus
      await Booking.updateOne({ _id: bookingId }, { $set: { paymentStatus: 'PAID' } })
    }

    // 3) Ledger credit, right now. Only the request that CREATED the payment adds it.
    if (total > 0 && createdPayment) {
      const existing = await LedgerEntry.findOne({
        referenceModel: 'Invoice',
        referenceId: invoice._id,
        entryType: 'INVOICE_PAYMENT',
      })
      if (!existing) {
        const row = await LedgerEntry.create({
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
        ledgerId = row._id
        await recomputeLedgerBalances()
      }
    }
  } catch (error: any) {
    // Undo only what THIS call did
    try {
      if (ledgerId) await LedgerEntry.deleteOne({ _id: ledgerId })
      if (createdPayment && payment) await Payment.deleteOne({ _id: payment._id })
      const stillPaid = total > 0 ? !!(await Payment.exists({ invoice: invoice._id })) : false
      if (!stillPaid && bookingId && previousBookingStatus && previousBookingStatus !== 'PAID') {
        await Booking.updateOne({ _id: bookingId }, { $set: { paymentStatus: previousBookingStatus } })
      }
      if (ledgerId) await recomputeLedgerBalances()
      error.paymentExists = stillPaid
    } catch (undoError) {
      error.paymentExists = false
    }
    throw error
  }

  // Make the new numbers show up everywhere straight away
  invalidateBookingCache(bookingId ? String(bookingId) : undefined)
  invalidateDashboardCache()
  invalidateFinancialCache()

  return payment
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
