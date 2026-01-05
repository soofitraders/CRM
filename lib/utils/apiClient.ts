/**
 * Enhanced API client with automatic cache invalidation
 */

import { triggerDataSync, EntityType } from './dataSync'

/**
 * Enhanced fetch that automatically triggers data sync on updates
 */
export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    // Add cache-busting for GET requests to ensure fresh data
    cache: options.method === 'GET' ? 'no-store' : options.cache,
  })

  // Check for data update header and trigger sync
  const dataUpdated = response.headers.get('X-Data-Updated')
  if (dataUpdated) {
    const entityTypes = dataUpdated.split(',').map((t) => t.trim() as EntityType)
    entityTypes.forEach((entityType) => {
      triggerDataSync(entityType)
    })
  }

  return response
}

/**
 * Get entity type from API path
 */
function getEntityTypeFromPath(path: string): EntityType | null {
  if (path.includes('/bookings')) return 'bookings'
  if (path.includes('/vehicles') || path.includes('/units')) return 'vehicles'
  if (path.includes('/customers') || path.includes('/clients')) return 'customers'
  if (path.includes('/expenses')) return 'expenses'
  if (path.includes('/invoices')) return 'invoices'
  if (path.includes('/payments')) return 'payments'
  if (path.includes('/maintenance')) return 'maintenance'
  if (path.includes('/dashboard')) return 'dashboard'
  if (path.includes('/financials')) return 'financials'
  return null
}

