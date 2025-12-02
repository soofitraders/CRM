import { NextRequest, NextResponse } from 'next/server'
import { getCache } from '../cache/cacheService'
import { createCacheKeyFromObject } from '../cache/cacheKeys'

interface CacheMiddlewareOptions {
  ttl?: number // Time to live in seconds
  keyGenerator?: (req: NextRequest) => string
  skipCache?: (req: NextRequest) => boolean
  invalidateOnMethods?: string[] // Methods that invalidate cache
}

/**
 * Cache middleware for Next.js API routes
 */
export function cacheMiddleware(options: CacheMiddlewareOptions = {}) {
  const {
    ttl = 300, // 5 minutes default
    keyGenerator,
    skipCache,
    invalidateOnMethods = ['POST', 'PUT', 'PATCH', 'DELETE'],
  } = options

  return async (req: NextRequest, handler: (req: NextRequest) => Promise<NextResponse>) => {
    const cache = getCache()
    const method = req.method

    // Skip cache for methods that modify data
    if (invalidateOnMethods.includes(method)) {
      // Invalidate related cache before handling request
      const url = new URL(req.url)
      const pathname = url.pathname
      
      // Invalidate cache based on pathname
      if (pathname.includes('/bookings')) {
        cache.deletePattern(/^bookings:/)
      } else if (pathname.includes('/customers')) {
        cache.deletePattern(/^customers:/)
      } else if (pathname.includes('/vehicles')) {
        cache.deletePattern(/^vehicles:/)
      } else if (pathname.includes('/dashboard')) {
        cache.deletePattern(/^dashboard:/)
      } else if (pathname.includes('/financials')) {
        cache.deletePattern(/^financial:/)
      }

      return handler(req)
    }

    // Skip cache if skipCache function returns true
    if (skipCache && skipCache(req)) {
      return handler(req)
    }

    // Generate cache key
    let cacheKey: string
    if (keyGenerator) {
      cacheKey = keyGenerator(req)
    } else {
      const url = new URL(req.url)
      const params = Object.fromEntries(url.searchParams.entries())
      cacheKey = createCacheKeyFromObject(url.pathname, params)
    }

    // Try to get from cache
    const cached = cache.get<NextResponse>(cacheKey)
    if (cached) {
      // Clone response and add cache headers
      const response = NextResponse.json(cached.body, {
        status: cached.status,
        headers: {
          ...cached.headers,
          'X-Cache': 'HIT',
          'Cache-Control': `public, max-age=${ttl}`,
        },
      })
      return response
    }

    // Execute handler
    const response = await handler(req)

    // Clone response to read body
    const clonedResponse = response.clone()
    const data = await clonedResponse.json()

    // Cache successful responses only
    if (response.status >= 200 && response.status < 300) {
      cache.set(cacheKey, {
        body: data,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
      }, ttl)
    }

    // Add cache headers to response
    const headers = new Headers(response.headers)
    headers.set('X-Cache', 'MISS')
    headers.set('Cache-Control', `public, max-age=${ttl}`)

    return NextResponse.json(data, {
      status: response.status,
      headers,
    })
  }
}

/**
 * Simple cache wrapper for API route handlers
 */
export function cachedHandler<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
  options: {
    ttl?: number
    key?: string
  } = {}
): T {
  return (async (...args: Parameters<T>) => {
    const req = args[0] as NextRequest
    const cache = getCache()
    
    if (req.method !== 'GET') {
      return handler(...args)
    }

    const cacheKey = options.key || req.url
    const cached = cache.get<NextResponse>(cacheKey)
    
    if (cached) {
      return NextResponse.json(cached.body, {
        status: cached.status,
        headers: {
          ...cached.headers,
          'X-Cache': 'HIT',
        },
      })
    }

    const response = await handler(...args)
    const clonedResponse = response.clone()
    const data = await clonedResponse.json()

    if (response.status >= 200 && response.status < 300) {
      cache.set(cacheKey, {
        body: data,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
      }, options.ttl)
    }

    const headers = new Headers(response.headers)
    headers.set('X-Cache', 'MISS')

    return NextResponse.json(data, {
      status: response.status,
      headers,
    })
  }) as T
}

