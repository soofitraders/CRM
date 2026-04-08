import connectDB from '@/lib/db'
import LedgerEntry from '@/lib/models/LedgerEntry'

/** Recompute running balance for all non-voided entries, chronological order. */
export async function recomputeLedgerRunningBalances(): Promise<void> {
  await connectDB()
  const entries = await LedgerEntry.find({ isVoided: { $ne: true } })
    .sort({ date: 1, createdAt: 1, _id: 1 })
    .select('_id direction amount')
    .lean()

  let balance = 0
  const ops: { updateOne: { filter: { _id: unknown }; update: { $set: { runningBalance: number } } } }[] = []
  for (const e of entries) {
    const amt = Number(e.amount ?? 0)
    balance += e.direction === 'CREDIT' ? amt : -amt
    ops.push({
      updateOne: {
        filter: { _id: e._id },
        update: { $set: { runningBalance: Math.round(balance * 100) / 100 } },
      },
    })
  }

  const chunk = 1000
  for (let i = 0; i < ops.length; i += chunk) {
    await LedgerEntry.bulkWrite(ops.slice(i, i + chunk), { ordered: true })
  }

  await LedgerEntry.updateMany({ isVoided: true }, { $set: { runningBalance: 0 } })
}
