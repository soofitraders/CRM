import { config } from 'dotenv'
import { resolve } from 'path'
import { createOptimalIndexes } from '../lib/utils/dbIndexes'

// Load environment variables
const envPath = resolve(process.cwd(), '.env')
config({ path: envPath })

async function optimize() {
  console.log('🚀 Starting performance optimization...')
  
  try {
    console.log('📊 Creating database indexes...')
    await createOptimalIndexes()
    
    console.log('✅ Performance optimization complete!')
  } catch (error) {
    console.error('❌ Error during optimization:', error)
    process.exit(1)
  }
}

optimize()

