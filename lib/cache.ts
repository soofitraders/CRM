// Central in-memory cache (Node server process only).

interface CacheEntry {
  data: unknown
  expiresAt: number
}

const memoryCache = new Map<string, CacheEntry>()

export const CACHE_TTL_MS = {
  SHORT: 30 * 1000,
  MEDIUM: 5 * 60 * 1000,
  LONG: 30 * 60 * 1000,
}

export const cache = {
  get: (key: string): unknown | null => {
    const entry = memoryCache.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      memoryCache.delete(key)
      return null
    }
    return entry.data
  },

  set: (key: string, data: unknown, ttl: number = CACHE_TTL_MS.MEDIUM): void => {
    memoryCache.set(key, { data, expiresAt: Date.now() + ttl })
  },

  delete: (key: string): void => {
    memoryCache.delete(key)
  },

  deletePrefix: (prefix: string): number => {
    let count = 0
    const keys = Array.from(memoryCache.keys())
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        memoryCache.delete(key)
        count++
      }
    }
    return count
  },

  clear: (): void => {
    memoryCache.clear()
    console.log('[CACHE] All cache cleared')
  },

  purgeExpired: (): number => {
    let count = 0
    const now = Date.now()
    const entries = Array.from(memoryCache.entries())
    for (const [key, entry] of entries) {
      if (now > entry.expiresAt) {
        memoryCache.delete(key)
        count++
      }
    }
    return count
  },

  stats: () => ({
    size: memoryCache.size,
    keys: Array.from(memoryCache.keys()),
  }),
}
