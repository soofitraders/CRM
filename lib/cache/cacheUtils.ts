import { getCache } from './cacheService'
import { CacheKeys } from './cacheKeys'

/**
 * Cache utility functions for common operations
 */

/**
 * Cache a database query result
 */
export async function cacheQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cache = getCache()
  return cache.getOrSet(key, queryFn, ttl)
}

/**
 * Invalidate cache by pattern
 */
export function invalidateCache(pattern: string | RegExp): number {
  const cache = getCache()
  return cache.deletePattern(pattern)
}

/**
 * Invalidate all cache entries for a specific entity type
 */
export function invalidateEntityCache(entityType: string, id?: string): number {
  const pattern = id ? `${entityType}:${id}` : `${entityType}:*`
  return invalidateCache(pattern)
}

/**
 * Invalidate user-related cache
 */
export function invalidateUserCache(userId: string): number {
  const patterns = [
    CacheKeys.user(userId),
    CacheKeys.userSessions(userId),
    `user:*${userId}*`,
  ]
  
  let count = 0
  patterns.forEach((pattern) => {
    count += invalidateCache(pattern)
  })
  
  return count
}

/**
 * Invalidate booking-related cache
 */
export function invalidateBookingCache(bookingId?: string, customerId?: string, vehicleId?: string): number {
  let count = 0
  
  if (bookingId) {
    count += invalidateCache(CacheKeys.booking(bookingId))
  }
  
  if (customerId) {
    count += invalidateCache(CacheKeys.bookingsByCustomer(customerId))
  }
  
  if (vehicleId) {
    count += invalidateCache(CacheKeys.bookingsByVehicle(vehicleId))
  }
  
  // Invalidate general booking caches
  count += invalidateCache(/^bookings:/)
  count += invalidateCache(CacheKeys.bookingsToday())
  
  return count
}

/**
 * Invalidate customer-related cache
 */
export function invalidateCustomerCache(customerId?: string): number {
  let count = 0
  
  if (customerId) {
    count += invalidateCache(CacheKeys.customer(customerId))
    count += invalidateCache(CacheKeys.customerStats(customerId))
  }
  
  // Invalidate general customer caches
  count += invalidateCache(/^customers:/)
  
  return count
}

/**
 * Invalidate vehicle-related cache
 */
export function invalidateVehicleCache(vehicleId?: string): number {
  let count = 0
  
  if (vehicleId) {
    count += invalidateCache(CacheKeys.vehicle(vehicleId))
    count += invalidateCache(CacheKeys.vehicleMaintenance(vehicleId))
  }
  
  // Invalidate general vehicle caches
  count += invalidateCache(/^vehicles:/)
  count += invalidateCache(CacheKeys.vehiclesAvailable())
  
  return count
}

/**
 * Invalidate dashboard cache
 */
export function invalidateDashboardCache(userId?: string): number {
  const patterns = [
    /^dashboard:summary/,
    /^dashboard:widgets/,
    /^dashboard:metrics/,
  ]
  
  let count = 0
  patterns.forEach((pattern) => {
    count += invalidateCache(pattern)
  })
  
  return count
}

/**
 * Invalidate financial cache
 */
export function invalidateFinancialCache(): number {
  const patterns = [
    /^financial:/,
    /^invoices:/,
    /^payments:/,
  ]
  
  let count = 0
  patterns.forEach((pattern) => {
    count += invalidateCache(pattern)
  })
  
  return count
}

/**
 * Invalidate all cache
 */
export function invalidateAllCache(): void {
  const cache = getCache()
  cache.clear()
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const cache = getCache()
  return cache.getStats()
}

/**
 * Cache middleware for API routes
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    key: string | ((...args: Parameters<T>) => string)
    ttl?: number
    invalidateOn?: string[]
  } = {} as any
): T {
  return (async (...args: Parameters<T>) => {
    const cache = getCache()
    const key = typeof options.key === 'function' ? options.key(...args) : options.key
    
    if (!key) {
      return fn(...args)
    }

    // Try to get from cache
    const cached = cache.get(key)
    if (cached !== null) {
      return cached
    }

    // Execute function and cache result
    const result = await fn(...args)
    cache.set(key, result, options.ttl)
    
    return result
  }) as T
}

