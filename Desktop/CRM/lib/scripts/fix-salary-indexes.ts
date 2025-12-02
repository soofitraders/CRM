/**
 * Utility script to fix SalaryRecord indexes
 * Run this once to update the unique index to use partial filter
 * 
 * Usage: npx ts-node lib/scripts/fix-salary-indexes.ts
 */

import mongoose from 'mongoose'
import connectDB from '@/lib/db'
import SalaryRecord from '@/lib/models/SalaryRecord'

async function fixIndexes() {
  try {
    await connectDB()
    
    console.log('Dropping old unique index...')
    try {
      await SalaryRecord.collection.dropIndex('staffUser_1_year_1_month_1')
      console.log('Old index dropped successfully')
    } catch (error: any) {
      if (error.code === 27) {
        console.log('Index does not exist, skipping drop')
      } else {
        console.error('Error dropping index:', error)
      }
    }
    
    console.log('Creating new partial unique index...')
    await SalaryRecord.collection.createIndex(
      { staffUser: 1, year: 1, month: 1 },
      {
        unique: true,
        partialFilterExpression: { isDeleted: { $ne: true } },
        name: 'staffUser_1_year_1_month_1'
      }
    )
    console.log('New index created successfully')
    
    console.log('Index fix completed!')
    process.exit(0)
  } catch (error) {
    console.error('Error fixing indexes:', error)
    process.exit(1)
  }
}

fixIndexes()

