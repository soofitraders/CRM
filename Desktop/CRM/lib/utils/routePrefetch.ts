/**
 * Route prefetching utilities
 * Prefetches API data when hovering over navigation links
 */

const prefetchCache = new Set<string>()

/**
 * Prefetch API data for a route
 */
export function prefetchRouteData(route: string) {
  if (typeof window === 'undefined') return
  if (prefetchCache.has(route)) return

  prefetchCache.add(route)

  // Map routes to their API endpoints
  const routeApiMap: Record<string, string[]> = {
    '/dashboard': ['/api/dashboard/summary', '/api/dashboard/today-bookings', '/api/dashboard/urgent-maintenance'],
    '/bookings': ['/api/bookings?limit=10&page=1'],
    '/units': ['/api/vehicles?limit=10&page=1'],
    '/clients': ['/api/customers?limit=10&page=1'],
    '/financials': ['/api/invoices?limit=10&page=1'],
    '/investors': ['/api/investors?limit=10&page=1'],
    '/maintenance': ['/api/maintenance/records?limit=10&page=1'],
    '/notifications': ['/api/notifications?limit=50'],
  }

  const apiEndpoints = routeApiMap[route] || []

  // Prefetch all API endpoints for this route using low-priority fetch
  apiEndpoints.forEach((endpoint) => {
    // Use fetch with low priority to avoid blocking navigation
    fetch(endpoint, {
      method: 'GET',
      priority: 'low' as any,
      cache: 'force-cache',
      headers: {
        'Cache-Control': 'max-age=60',
      },
    })
      .then((response) => {
        // Cache the response
        if (response.ok) {
          response.clone().json().catch(() => {})
        }
      })
      .catch(() => {
        // Ignore errors - prefetch failures shouldn't break navigation
      })
  })
}

/**
 * Clear prefetch cache (useful for testing)
 */
export function clearPrefetchCache() {
  prefetchCache.clear()
}

