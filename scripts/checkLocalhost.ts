import { config } from 'dotenv'
import { resolve } from 'path'
import mongoose from 'mongoose'

// Load environment variables
const envLocalPath = resolve(process.cwd(), '.env.local')
const envPath = resolve(process.cwd(), '.env')

config({ path: envLocalPath })
if (!process.env.MONGODB_URI && !process.env.DATABASE_URL) {
  config({ path: envPath })
}

console.log('\n🔍 Localhost Diagnostic Check\n')
console.log('=' .repeat(50))

// Check environment variables
console.log('\n📋 Environment Variables:')
const mongodbUri = process.env.MONGODB_URI || process.env.DATABASE_URL
const nextAuthUrl = process.env.NEXTAUTH_URL
const nextAuthSecret = process.env.NEXTAUTH_SECRET

console.log(`MONGODB_URI: ${mongodbUri ? '✅ Set' : '❌ Missing'}`)
console.log(`NEXTAUTH_URL: ${nextAuthUrl || '❌ Missing'}`)
console.log(`NEXTAUTH_SECRET: ${nextAuthSecret ? '✅ Set' : '❌ Missing'}`)

// Check MongoDB connection
if (mongodbUri) {
  console.log('\n🔌 Testing MongoDB Connection...')
  mongoose
    .connect(mongodbUri, {
      serverSelectionTimeoutMS: 5000,
    })
    .then(() => {
      console.log('✅ MongoDB connection successful')
      mongoose.disconnect()
      process.exit(0)
    })
    .catch((error) => {
      console.log('❌ MongoDB connection failed:', error.message)
      console.log('\n💡 Troubleshooting:')
      console.log('1. Check if MongoDB is running')
      console.log('2. Verify MONGODB_URI in .env.local or .env')
      console.log('3. Check network connectivity if using MongoDB Atlas')
      process.exit(1)
    })
} else {
  console.log('\n❌ MONGODB_URI or DATABASE_URL not found')
  console.log('\n💡 Create .env.local file with:')
  console.log('MONGODB_URI=your-connection-string')
  console.log('NEXTAUTH_URL=http://localhost:3000')
  console.log('NEXTAUTH_SECRET=your-secret-key')
  process.exit(1)
}
