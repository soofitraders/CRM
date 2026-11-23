/**
 * One-off data fix for BUG-013.
 *
 * Older invoices were saved with `booking` as a TEXT string instead of an
 * ObjectId, which broke duplicate detection and any `$lookup` on bookings.
 *
 *   1. Converts every string `booking` to an ObjectId (safe, idempotent).
 *   2. REPORTS bookings that have more than one invoice. It never deletes
 *      anything - decide per booking which invoice to keep (VOID or delete the
 *      other from the app).
 *
 * Run:  npx tsx scripts/migrateInvoiceBookingIds.ts
 */
import { config } from 'dotenv'
import { resolve } from 'path'
import connectDB from '../lib/db'
import Invoice from '../lib/models/Invoice'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  await connectDB()
  const col = Invoice.collection

  const before = await col.countDocuments({ booking: { $type: 'string' } } as any)
  console.log(`Invoices with booking stored as text: ${before}`)

  if (before > 0) {
    const res = await col.updateMany(
      { booking: { $type: 'string' } } as any,
      [{ $set: { booking: { $toObjectId: '$booking' } } }] as any
    )
    console.log(`✓ Converted ${res.modifiedCount} invoice(s) to ObjectId`)
  }

  const after = await col.countDocuments({ booking: { $type: 'string' } } as any)
  console.log(`Remaining text references: ${after}`)

  const dupes = await col
    .aggregate([
      { $group: { _id: '$booking', n: { $sum: 1 }, invoices: { $push: { number: '$invoiceNumber', status: '$status', total: '$total' } } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray()

  if (dupes.length === 0) {
    console.log('✓ No booking has more than one invoice')
  } else {
    console.log(`\n⚠ ${dupes.length} booking(s) have more than one invoice (not changed - review manually):`)
    for (const d of dupes) {
      console.log(`  booking ${d._id}:`)
      for (const i of d.invoices) console.log(`    ${i.number}  ${i.status}  AED ${i.total}`)
    }
  }
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
