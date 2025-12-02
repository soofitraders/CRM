import { NextRequest, NextResponse } from 'next/server'
import { CACHE_DURATIONS, CACHE_TAGS } from '@/lib/utils/apiCache'

/**
 * Middleware to add caching headers to API responses
 */
export function withCache(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: {
    duration?: number
    tags?: string[]
    revalidate?: number
  } = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const response = await handler(request)

    // Add cache headers
    if (options.duration) {
      response.headers.set(
        'Cache-Control',
        `public, s-maxage=${options.duration}, stale-while-revalidate=${options.duration * 2}`
      )
    }

    if (options.tags && options.tags.length > 0) {
      response.headers.set('Cache-Tags', options.tags.join(','))
    }

    return response
  }
}

/**
 * Route segment config for caching
 */
export function getRouteConfig(options: {
  revalidate?: number
  dynamic?: 'auto' | 'force-dynamic' | 'force-static' | 'error'
}) {
  return {
    revalidate: options.revalidate || 60,
    dynamic: options.dynamic || 'auto',
  }
}

