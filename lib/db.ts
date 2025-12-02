import mongoose from 'mongoose'
import { logger } from '@/lib/utils/performance'

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var mongoose: MongooseCache | undefined
}

let cached: MongooseCache = global.mongoose || { conn: null, promise: null }

if (!global.mongoose) {
  global.mongoose = cached
}

async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    // Connection already exists, return immediately
    return cached.conn
  }

  const MONGODB_URI = process.env.MONGODB_URI
  if (!MONGODB_URI) {
    throw new Error('Please define MONGODB_URI in your .env file')
  }

  if (!cached.promise) {
    logger.log('🔄 Connecting to MongoDB Atlas...')
    
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      maxPoolSize: 10,
      minPoolSize: 2, // Keep minimum connections for faster response
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxIdleTimeMS: 30000, // Close idle connections after 30s
      retryWrites: true,
      retryReads: true,
    }).then((mongoose) => {
      logger.log('✓ MongoDB connected successfully')
      logger.log('✓ Database:', mongoose.connection.db?.databaseName)
      logger.log('✓ Host:', mongoose.connection.host)
      return mongoose
    }).catch((error) => {
      logger.error('✗ MongoDB connection failed:', error.message)
      cached.promise = null
      throw error
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

mongoose.connection.on('connected', () => {
  logger.log('📊 Mongoose connected to MongoDB Atlas')
})

mongoose.connection.on('error', (err) => {
  logger.error('❌ Mongoose connection error:', err)
})

mongoose.connection.on('disconnected', () => {
  logger.log('📴 Mongoose disconnected from MongoDB')
})

export default connectDB
