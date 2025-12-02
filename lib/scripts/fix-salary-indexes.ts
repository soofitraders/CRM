/**
 * Utility script to fix SalaryRecord indexes
 * Run this once to update the unique index to use partial filter
 * 
 * Usage: npx ts-node lib/scripts/fix-salary-indexes.ts
 */

import mongoose from 'mongoose'
import connectDB from '@/lib/db'
import SalaryRecord from '@/lib/models/SalaryRecord'
import { logger } from '@/lib/utils/performance'

async function fixIndexes() {
  try {
    await connectDB()
    
    logger.log('Dropping old unique index...')
    try {
      await SalaryRecord.collection.dropIndex('staffUser_1_year_1_month_1')
      logger.log('Old index dropped successfully')
    } catch (error: any) {
      if (error.code === 27) {
        logger.log('Index does not exist, skipping drop')
      } else {
        logger.error('Error dropping index:', error)
      }
    }
    
    logger.log('Creating new partial unique index...')
    await SalaryRecord.collection.createIndex(
      { staffUser: 1, year: 1, month: 1 },
      {
        unique: true,
        partialFilterExpression: { isDeleted: { $ne: true } },
        name: 'staffUser_1_year_1_month_1'
      }
    )
    logger.log('New index created successfully')
    
    logger.log('Index fix completed!')
    process.exit(0)
  } catch (error) {
    logger.error('Error fixing indexes:', error)
    process.exit(1)
  }
}

fixIndexes()

