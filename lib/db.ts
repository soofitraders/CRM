import mongoose from 'mongoose'
import { logger } from '@/lib/utils/performance'
import { logRequiredServerEnv } from '@/lib/requiredEnv'

declare global {
  // eslint-disable-next-line no-var
  var mongoose:
    | {
        conn: typeof import('mongoose') | null
        promise: Promise<typeof import('mongoose')> | null
      }
    | undefined
}

let cached: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } =
  global.mongoose ?? { conn: null, promise: null }

if (!global.mongoose) {
  global.mongoose = cached
}

async function connectDB(): Promise<typeof mongoose> {
  logRequiredServerEnv()

  if (cached.conn) {
    return cached.conn
  }

  const uri =
    process.env.MONGODB_URI?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    process.env.MONGODB_URL?.trim()

  if (!uri) {
    const err = new Error('MongoDB URI not found. Set MONGODB_URI in .env.local')
    logger.error('[db]', err.message)
    throw err
  }

  if (!cached.promise) {
    logger.log('Connecting to MongoDB…')

    cached.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        maxPoolSize: 10,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxIdleTimeMS: 30000,
        retryWrites: true,
        retryReads: true,
      })
      .then((m) => {
        logger.log('MongoDB connected:', m.connection.db?.databaseName, m.connection.host)
        return m
      })
      .catch((error: Error) => {
        logger.error('MongoDB connection failed:', error.message)
        cached.promise = null
        throw error
      })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.conn = null
    cached.promise = null
    logger.error('connectDB: connection error (request will fail until DB is reachable):', e)
    throw e
  }

  try {
    const { startAutoPurge } = await import('@/lib/startup')
    startAutoPurge()
  } catch {
    /* cache purge is optional; avoid breaking DB if startup fails to load */
  }

  return cached.conn
}

// Register once: dev HMR can re-evaluate this module and stack listeners otherwise.
const g = globalThis as typeof globalThis & { __ledgerMongooseLogHooks?: boolean }
if (!g.__ledgerMongooseLogHooks) {
  g.__ledgerMongooseLogHooks = true
  mongoose.connection.setMaxListeners(32)
  mongoose.connection.on('connected', () => {
    logger.log('Mongoose connected to MongoDB')
  })
  mongoose.connection.on('error', (err) => {
    logger.error('Mongoose connection error:', err)
  })
  mongoose.connection.on('disconnected', () => {
    logger.log('Mongoose disconnected from MongoDB')
  })
}

export default connectDB
