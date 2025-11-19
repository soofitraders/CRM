import { NextResponse } from 'next/server'

/**
 * Create a JSON response with optional caching headers
 */
export function jsonResponse(
  data: any,
  status: number = 200,
  options: {
    cache?: 'no-store' | 'no-cache' | 'force-cache' | number // number = max-age in seconds
    revalidate?: number // For ISR
  } = {}
): NextResponse {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  // Add cache control headers
  if (options.cache === 'no-store') {
    headers['Cache-Control'] = 'no-store, must-revalidate'
  } else if (options.cache === 'no-cache') {
    headers['Cache-Control'] = 'no-cache, must-revalidate'
  } else if (options.cache === 'force-cache') {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable'
  } else if (typeof options.cache === 'number') {
    headers['Cache-Control'] = `public, max-age=${options.cache}, must-revalidate`
  } else {
    // Default: short cache for dynamic content
    headers['Cache-Control'] = 'private, no-cache, no-store, must-revalidate'
  }

  return NextResponse.json(data, { status, headers })
}

