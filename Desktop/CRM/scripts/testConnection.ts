import { config } from 'dotenv'
import { resolve } from 'path'
import mongoose from 'mongoose'
import dns from 'dns'

// Load environment variables
const envLocalPath = resolve(process.cwd(), '.env.local')
const envPath = resolve(process.cwd(), '.env')

config({ path: envLocalPath })
if (!process.env.MONGODB_URI) {
  config({ path: envPath })
}

// Set DNS order
dns.setDefaultResultOrder('ipv4first')

async function testConnection() {
  const uri = process.env.MONGODB_URI
  
  if (!uri) {
    console.error('MONGODB_URI not found')
    process.exit(1)
  }

  console.log('Testing MongoDB connection...')
  console.log('URI:', uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'))
  
  // Test DNS resolution first
  try {
    const hostname = uri.match(/@([^/]+)/)?.[1]
    if (hostname) {
      console.log('\nTesting DNS resolution for:', hostname)
      
      // Try SRV record resolution
      try {
        const srvRecords = await dns.promises.resolveSrv(`_mongodb._tcp.${hostname}`)
        console.log('✓ SRV records found:', srvRecords.length)
        srvRecords.forEach((record, i) => {
          console.log(`  ${i + 1}. ${record.name}:${record.port} (priority: ${record.priority}, weight: ${record.weight})`)
        })
      } catch (srvError: any) {
        console.log('⚠ SRV resolution failed:', srvError.message)
      }
      
      // Try A record resolution
      try {
        const addresses = await dns.promises.resolve4(hostname)
        console.log('✓ A record resolution successful:', addresses[0])
      } catch (aError: any) {
        console.log('⚠ A record resolution failed:', aError.message)
      }
    }
  } catch (dnsError: any) {
    console.log('⚠ DNS resolution warning:', dnsError.message)
  }

  // Try connection with minimal options
  try {
    console.log('\nAttempting connection...')
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      family: 4,
    })
    
    console.log('✓ Connection successful!')
    console.log('Database:', mongoose.connection.db?.databaseName)
    console.log('Ready state:', mongoose.connection.readyState)
    
    await mongoose.disconnect()
    console.log('✓ Disconnected successfully')
    process.exit(0)
  } catch (error: any) {
    console.error('\n✗ Connection failed:', error.message)
    console.error('Error code:', error.code)
    console.error('Error name:', error.name)
    process.exit(1)
  }
}

testConnection()

