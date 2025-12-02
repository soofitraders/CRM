/**
 * In-Memory Cache Service
 * Provides a Redis-like interface for caching data
 */

import { logger } from '@/lib/utils/performance'

interface CacheEntry<T = any> {
  value: T
  expiresAt: number
  createdAt: number
  hits: number
}

interface CacheOptions {
  ttl?: number // Time to live in seconds
  maxSize?: number // Maximum number of entries
}

class CacheService {
  private cache: Map<string, CacheEntry> = new Map()
  private defaultTTL: number = 300 // 5 minutes default
  private maxSize: number = 1000 // Maximum 1000 entries
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = options.ttl || 300
    this.maxSize = options.maxSize || 1000

    // Start cleanup interval (runs every minute)
    this.startCleanup()
  }

  /**
   * Get value from cache
   */
  get<T = any>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    // Update hit count
    entry.hits++

    return entry.value as T
  }

  /**
   * Set value in cache
   */
  set<T = any>(key: string, value: T, ttl?: number): boolean {
    // Check max size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      // Evict least recently used or expired entries
      this.evictLRU()
    }

    const expiresAt = Date.now() + (ttl || this.defaultTTL) * 1000

    this.cache.set(key, {
      value,
      expiresAt,
      createdAt: Date.now(),
      hits: 0,
    })

    return true
  }

  /**
   * Delete value from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Delete multiple keys matching pattern
   */
  deletePattern(pattern: string | RegExp): number {
    let count = 0
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
        count++
      }
    }

    return count
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.values())
    const now = Date.now()

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      expired: entries.filter((e) => now > e.expiresAt).length,
      active: entries.filter((e) => now <= e.expiresAt).length,
      totalHits: entries.reduce((sum, e) => sum + e.hits, 0),
      averageHits: entries.length > 0 ? entries.reduce((sum, e) => sum + e.hits, 0) / entries.length : 0,
    }
  }

  /**
   * Get or set value (cache-aside pattern)
   */
  async getOrSet<T = any>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const value = await fetcher()
    this.set(key, value, ttl)
    return value
  }

  /**
   * Increment numeric value
   */
  increment(key: string, by: number = 1): number {
    const current = this.get<number>(key) || 0
    const newValue = current + by
    this.set(key, newValue)
    return newValue
  }

  /**
   * Decrement numeric value
   */
  decrement(key: string, by: number = 1): number {
    return this.increment(key, -by)
  }

  /**
   * Evict least recently used entries
   */
  private evictLRU(): void {
    const entries = Array.from(this.cache.entries())
    
    // Sort by hits (ascending) and creation time (ascending)
    entries.sort((a, b) => {
      if (a[1].hits !== b[1].hits) {
        return a[1].hits - b[1].hits
      }
      return a[1].createdAt - b[1].createdAt
    })

    // Remove bottom 10% of entries
    const toRemove = Math.max(1, Math.floor(entries.length * 0.1))
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0])
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.log(`[Cache] Cleaned up ${cleaned} expired entries`)
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    // Clean up every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60 * 1000)
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// Singleton instance
let cacheInstance: CacheService | null = null

export function getCache(): CacheService {
  if (!cacheInstance) {
    const ttl = process.env.CACHE_TTL ? parseInt(process.env.CACHE_TTL) : undefined
    const maxSize = process.env.CACHE_MAX_SIZE ? parseInt(process.env.CACHE_MAX_SIZE) : undefined
    
    cacheInstance = new CacheService({
      ttl,
      maxSize,
    })
  }

  return cacheInstance
}

// Export for testing
export { CacheService }

