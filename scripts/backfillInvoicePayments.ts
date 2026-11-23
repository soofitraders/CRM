/**
 * Reconcile OLD data: invoices that were marked PAID before the app started
 * recording a payment when you click "Mark as Paid".
 *
 * For every PAID invoice whose booking has NO successful payment record at all,
 * it can create that payment record (amount = invoice total, date = when the
 * invoice was last updated, method = the invoice's method) and set the booking
 * to PAID. After that the dashboard "Total Sales" (money received), the Payments
 * tab and the ledger all agree.
 *
 *   npx tsx scripts/backfillInvoicePayments.ts            -> DRY RUN: only lists what it would do
 *   npx tsx scripts/backfillInvoicePayments.ts --apply    -> really creates the payment records
 *
 * It never changes or deletes an invoice and never touches invoices that already
 * have a payment. Review the dry-run list before applying: this creates money records.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import mongoose from 'mongoose'
import connectDB from '../lib/db'
import Invoice from '../lib/models/Invoice'
import Payment from '../lib/models/Payment'
import Booking from '../lib/models/Booking'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const apply = process.argv.includes('--apply')
  await connectDB()

  const paid: any[] = await Invoice.find({ status: 'PAID' }).lean()
  const todo: any[] = []
  for (const inv of paid) {
    if (!(inv.total > 0)) continue
    const hasInvoicePayment = await Payment.exists({ invoice: inv._id })
    const hasBookingPayment = await Payment.exists({ booking: inv.booking, status: 'SUCCESS' })
    if (!hasInvoicePayment && !hasBookingPayment) todo.push(inv)
  }

  const total = todo.reduce((s, i) => s + i.total, 0)
  console.log(`${apply ? 'APPLYING' : 'DRY RUN'}: ${todo.length} paid invoice(s) have no payment record, AED ${total.toFixed(2)} in total`)
  for (const inv of todo) {
    console.log(`  ${inv.invoiceNumber}  AED ${Number(inv.total).toFixed(2)}  (${inv.transactionMethod || 'CASH'}, paid ${new Date(inv.updatedAt).toISOString().slice(0, 10)})`)
  }

  if (apply) {
    for (const inv of todo) {
      await Payment.create({
        booking: inv.booking,
        invoice: inv._id,
        amount: inv.total,
        method: inv.transactionMethod === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'CASH',
        status: 'SUCCESS',
        transactionId: inv.invoiceNumber,
        paidAt: inv.updatedAt || new Date(),
      })
      await Booking.updateOne({ _id: new mongoose.Types.ObjectId(String(inv.booking)) }, { $set: { paymentStatus: 'PAID' } })
    }
    console.log(`✓ Created ${todo.length} payment record(s). Click "Sync" on the Ledger page to refresh it.`)
  } else if (todo.length > 0) {
    console.log('\nNothing was changed. Run again with --apply to create these payment records.')
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
