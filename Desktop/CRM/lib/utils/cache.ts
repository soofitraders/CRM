/**
 * In-Memory Cache Utility
 * Provides fast caching for frequently accessed data
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private maxSize: number = 1000 // Maximum number of entries

  /**
   * Get cached data
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if entry has expired
    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cached data
   */
  set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  }

  /**
   * Delete cached data
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Clear cache by pattern
   */
  clearPattern(pattern: string): void {
    const regex = new RegExp(pattern)
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
    }
  }
}

// Singleton instance
const memoryCache = new MemoryCache()

/**
 * Generate cache key from parameters
 */
export function generateCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}:${JSON.stringify(params[key])}`)
    .join('|')
  return `${prefix}:${sortedParams}`
}

/**
 * Cache decorator for async functions
 */
export function cached<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    keyPrefix: string
    ttl?: number
    keyGenerator?: (...args: Parameters<T>) => string
  }
): T {
  return (async (...args: Parameters<T>) => {
    const key = options.keyGenerator
      ? options.keyGenerator(...args)
      : generateCacheKey(options.keyPrefix, { args: JSON.stringify(args) })
    
    // Try to get from cache
    const cached = memoryCache.get(key)
    if (cached !== null) {
      return cached
    }

    // Execute function and cache result
    const result = await fn(...args)
    memoryCache.set(key, result, options.ttl || 5 * 60 * 1000)
    return result
  }) as T
}

/**
 * Cache utilities for common use cases
 */
export const cacheUtils = {
  /**
   * Cache user-specific data
   */
  userKey: (userId: string, suffix: string) => `user:${userId}:${suffix}`,

  /**
   * Cache booking data
   */
  bookingKey: (bookingId: string) => `booking:${bookingId}`,

  /**
   * Cache vehicle data
   */
  vehicleKey: (vehicleId: string) => `vehicle:${vehicleId}`,

  /**
   * Cache customer data
   */
  customerKey: (customerId: string) => `customer:${customerId}`,

  /**
   * Cache dashboard data
   */
  dashboardKey: (userId: string) => `dashboard:${userId}`,

  /**
   * Invalidate cache
   */
  invalidate: (key: string) => memoryCache.delete(key),

  /**
   * Invalidate pattern
   */
  invalidatePattern: (pattern: string) => memoryCache.clearPattern(pattern),

  /**
   * Clear all cache
   */
  clearAll: () => memoryCache.clear(),

  /**
   * Get cache stats
   */
  getStats: () => memoryCache.getStats(),
}

export default memoryCache

