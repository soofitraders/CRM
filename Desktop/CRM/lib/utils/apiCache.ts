import { NextResponse } from 'next/server'

/**
 * Cache duration constants (in seconds)
 */
export const CACHE_DURATIONS = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 1800, // 30 minutes
  VERY_LONG: 3600, // 1 hour
  STATIC: 86400, // 24 hours
}

/**
 * Create cached response headers
 */
export function getCacheHeaders(
  duration: number = CACHE_DURATIONS.MEDIUM,
  revalidate: number | false = false
): HeadersInit {
  const headers: HeadersInit = {
    'Cache-Control': `public, s-maxage=${duration}, stale-while-revalidate=${duration * 2}`,
  }

  if (revalidate !== false) {
    headers['Cache-Control'] += `, max-age=${revalidate}`
  }

  return headers
}

/**
 * Create no-cache headers for dynamic data
 */
export function getNoCacheHeaders(): HeadersInit {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  }
}

/**
 * Create response with caching
 */
export function cachedResponse<T>(
  data: T,
  status: number = 200,
  cacheDuration: number = CACHE_DURATIONS.MEDIUM
): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: getCacheHeaders(cacheDuration),
  })
}

/**
 * Create response without caching
 */
export function uncachedResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: getNoCacheHeaders(),
  })
}

/**
 * Cache tags for Next.js revalidation
 */
export const CACHE_TAGS = {
  BOOKINGS: 'bookings',
  VEHICLES: 'vehicles',
  CUSTOMERS: 'customers',
  INVOICES: 'invoices',
  EXPENSES: 'expenses',
  INVESTORS: 'investors',
  MAINTENANCE: 'maintenance',
  USERS: 'users',
  DASHBOARD: 'dashboard',
  REPORTS: 'reports',
} as const

/**
 * Revalidate cache by tag
 */
export async function revalidateTag(tag: string) {
  if (typeof window === 'undefined') {
    // Server-side revalidation
    const { revalidateTag: nextRevalidateTag } = await import('next/cache')
    nextRevalidateTag(tag)
  }
}

