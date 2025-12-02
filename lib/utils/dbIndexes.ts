/**
 * Database Index Optimization
 * Run this script to create optimal indexes for performance
 */

import connectDB from '../db'
import Booking from '../models/Booking'
import CustomerProfile from '../models/CustomerProfile'
import Vehicle from '../models/Vehicle'
import Invoice from '../models/Invoice'
import User from '../models/User'
import { logger } from '@/lib/utils/performance'

/**
 * Create index safely (skip if exists or conflicts)
 */
async function createIndexSafe(
  collection: any,
  indexSpec: any,
  options: any = {}
): Promise<void> {
  try {
    await collection.createIndex(indexSpec, { ...options, background: true })
  } catch (error: any) {
    // Ignore if index already exists or conflicts
    if (error.code === 86 || error.codeName === 'IndexKeySpecsConflict') {
      // Index already exists with different options, skip
      return
    }
    if (error.code === 85 || error.message?.includes('already exists')) {
      // Index already exists, skip
      return
    }
    // Re-throw other errors
    throw error
  }
}

export async function createOptimalIndexes() {
  try {
    await connectDB()

    logger.log('Creating Booking indexes...')
    await createIndexSafe(Booking.collection, { createdAt: -1 })
    await createIndexSafe(Booking.collection, { customer: 1, status: 1 })
    await createIndexSafe(Booking.collection, { vehicle: 1, status: 1 })
    await createIndexSafe(Booking.collection, { startDateTime: 1, endDateTime: 1 })
    await createIndexSafe(Booking.collection, { status: 1, createdAt: -1 })
    await createIndexSafe(Booking.collection, { bookedBy: 1, createdAt: -1 })

    logger.log('Creating Customer indexes...')
    // Skip user index if it already exists (might be unique)
    try {
      await CustomerProfile.collection.createIndex({ user: 1 }, { background: true })
    } catch (e: any) {
      if (e.code !== 86 && e.code !== 85) throw e
    }
    await createIndexSafe(CustomerProfile.collection, { createdAt: -1 })
    await createIndexSafe(CustomerProfile.collection, { phone: 1 })
    await createIndexSafe(CustomerProfile.collection, { drivingLicenseNumber: 1 })

    logger.log('Creating Vehicle indexes...')
    await createIndexSafe(Vehicle.collection, { status: 1 })
    // Skip plateNumber and vin if they already exist (might be unique)
    try {
      await Vehicle.collection.createIndex({ plateNumber: 1 }, { background: true })
    } catch (e: any) {
      if (e.code !== 86 && e.code !== 85) throw e
    }
    try {
      await Vehicle.collection.createIndex({ vin: 1 }, { background: true })
    } catch (e: any) {
      if (e.code !== 86 && e.code !== 85) throw e
    }
    await createIndexSafe(Vehicle.collection, { createdAt: -1 })
    await createIndexSafe(Vehicle.collection, { investor: 1 })

    logger.log('Creating Invoice indexes...')
    await createIndexSafe(Invoice.collection, { booking: 1 })
    await createIndexSafe(Invoice.collection, { issueDate: -1 })
    await createIndexSafe(Invoice.collection, { status: 1, issueDate: -1 })
    // Skip invoiceNumber if it already exists (might be unique)
    try {
      await Invoice.collection.createIndex({ invoiceNumber: 1 }, { background: true })
    } catch (e: any) {
      if (e.code !== 86 && e.code !== 85) throw e
    }

    logger.log('Creating User indexes...')
    // Skip email index if it already exists (it's unique)
    try {
      await User.collection.createIndex({ email: 1 }, { unique: true, background: true })
    } catch (e: any) {
      if (e.code !== 86 && e.code !== 85) throw e
    }
    await createIndexSafe(User.collection, { role: 1, status: 1 })

    logger.log('✓ Database indexes created/verified successfully')
  } catch (error) {
    logger.error('Error creating indexes:', error)
    throw error
  }
}

// Run if called directly
if (require.main === module) {
  createOptimalIndexes()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error(error)
      process.exit(1)
    })
}

