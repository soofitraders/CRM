import { NextResponse } from 'next/server'
import { getCacheHeaders, getNoCacheHeaders, CACHE_DURATIONS } from './apiCache'

/**
 * Create a JSON response with optional caching headers
 */
export function jsonResponse(
  data: any,
  status: number = 200,
  options: {
    cache?: 'no-store' | 'no-cache' | 'force-cache' | number // number = max-age in seconds
    revalidate?: number // For ISR
    tags?: string[] // Cache tags for revalidation
  } = {}
): NextResponse {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  // Add cache control headers
  if (options.cache === 'no-store') {
    Object.assign(headers, getNoCacheHeaders())
  } else if (options.cache === 'no-cache') {
    headers['Cache-Control'] = 'no-cache, must-revalidate'
  } else if (options.cache === 'force-cache') {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable'
  } else if (typeof options.cache === 'number') {
    Object.assign(headers, getCacheHeaders(options.cache))
  } else {
    // Default: short cache for dynamic content (1 minute)
    Object.assign(headers, getCacheHeaders(CACHE_DURATIONS.SHORT))
  }

  // Add cache tags if provided
  if (options.tags && options.tags.length > 0) {
    headers['Cache-Tags'] = options.tags.join(',')
  }

  return NextResponse.json(data, { status, headers })
}

