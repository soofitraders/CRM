/**
 * One-time: drop unique compound indexes on ledgerentries and remove exact duplicates.
 * Run: npx tsx scripts/fixLedgerIndex.ts
 * Requires MONGODB_URI or DATABASE_URL in .env
 */
import mongoose from 'mongoose'

async function fix() {
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL || ''
  if (!uri) {
    console.error('Set MONGODB_URI or DATABASE_URL')
    process.exit(1)
  }
  await mongoose.connect(uri)

  try {
    const collection = mongoose.connection.collection('ledgerentries')
    const indexes = await collection.indexes()
    console.log('Current indexes:', JSON.stringify(indexes, null, 2))

    for (const idx of indexes) {
      const k = idx.key as Record<string, number> | undefined
      if (!idx.unique || !k) continue
      const triple =
        k.referenceModel === 1 && k.referenceId === 1 && k.entryType === 1
      const pair =
        k.referenceModel === 1 && k.referenceId === 1 && k.entryType === undefined
      if (triple || pair) {
        console.log(`Dropping index: ${idx.name}`)
        await collection.dropIndex(idx.name as string)
        console.log(`Dropped: ${idx.name}`)
      }
    }

    const all = await collection.find({}).sort({ createdAt: 1 }).toArray()
    const seen = new Set<string>()
    const toDelete: mongoose.Types.ObjectId[] = []
    for (const doc of all) {
      const key = `${doc.referenceModel}|${doc.referenceId}|${doc.entryType}|${doc.amount}`
      if (seen.has(key)) {
        toDelete.push(doc._id as mongoose.Types.ObjectId)
      } else {
        seen.add(key)
      }
    }
    if (toDelete.length > 0) {
      await collection.deleteMany({ _id: { $in: toDelete } })
      console.log(`Removed ${toDelete.length} duplicates`)
    }

    console.log('Fix complete')
  } catch (e) {
    console.error('Error:', e)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect()
  }
}

void fix()
