import connectDB from '@/lib/db'
import memoryCache, { generateCacheKey } from './cache'

/**
 * Cached database query wrapper
 * Combines in-memory cache with database queries
 */
export async function cachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  options: {
    ttl?: number // Time to live in milliseconds (default: 5 minutes)
    tags?: string[] // Cache tags for invalidation
  } = {}
): Promise<T> {
  const ttl = options.ttl || 5 * 60 * 1000 // Default 5 minutes

  // Try to get from cache first
  const cached = memoryCache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // Execute query
  await connectDB()
  const result = await queryFn()

  // Cache the result
  memoryCache.set(key, result, ttl)

  return result
}

/**
 * Invalidate cache by pattern
 */
export function invalidateCache(pattern: string) {
  memoryCache.clearPattern(pattern)
}

/**
 * Cache key generators for common queries
 */
export const cacheKeys = {
  booking: (id: string) => `booking:${id}`,
  bookings: (params: Record<string, any>) => generateCacheKey('bookings', params),
  vehicle: (id: string) => `vehicle:${id}`,
  vehicles: (params: Record<string, any>) => generateCacheKey('vehicles', params),
  customer: (id: string) => `customer:${id}`,
  customers: (params: Record<string, any>) => generateCacheKey('customers', params),
  invoice: (id: string) => `invoice:${id}`,
  invoices: (params: Record<string, any>) => generateCacheKey('invoices', params),
  dashboard: (userId: string) => `dashboard:${userId}`,
  user: (id: string) => `user:${id}`,
}

