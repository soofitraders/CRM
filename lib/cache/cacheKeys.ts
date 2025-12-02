/**
 * Cache Key Generator
 * Centralized cache key management to avoid key collisions
 */

export const CacheKeys = {
  // User cache keys
  user: (id: string) => `user:${id}`,
  userByEmail: (email: string) => `user:email:${email.toLowerCase()}`,
  userSessions: (userId: string) => `user:sessions:${userId}`,

  // Booking cache keys
  booking: (id: string) => `booking:${id}`,
  bookings: (filters?: string) => `bookings${filters ? `:${filters}` : ''}`,
  bookingsByCustomer: (customerId: string) => `bookings:customer:${customerId}`,
  bookingsByVehicle: (vehicleId: string) => `bookings:vehicle:${vehicleId}`,
  bookingsToday: () => `bookings:today:${new Date().toISOString().split('T')[0]}`,

  // Customer cache keys
  customer: (id: string) => `customer:${id}`,
  customers: (filters?: string) => `customers${filters ? `:${filters}` : ''}`,
  customerStats: (id: string) => `customer:stats:${id}`,

  // Vehicle cache keys
  vehicle: (id: string) => `vehicle:${id}`,
  vehicles: (filters?: string) => `vehicles${filters ? `:${filters}` : ''}`,
  vehiclesAvailable: () => `vehicles:available`,
  vehicleMaintenance: (id: string) => `vehicle:maintenance:${id}`,

  // Dashboard cache keys
  dashboardSummary: (userId?: string) => `dashboard:summary${userId ? `:${userId}` : ''}`,
  dashboardWidgets: (userId?: string) => `dashboard:widgets${userId ? `:${userId}` : ''}`,
  dashboardMetrics: (timeRange?: string) => `dashboard:metrics${timeRange ? `:${timeRange}` : ''}`,

  // Financial cache keys
  financialSummary: (filters?: string) => `financial:summary${filters ? `:${filters}` : ''}`,
  invoices: (filters?: string) => `invoices${filters ? `:${filters}` : ''}`,
  invoice: (id: string) => `invoice:${id}`,
  payments: (filters?: string) => `payments${filters ? `:${filters}` : ''}`,

  // Settings cache keys
  settings: () => `settings:global`,
  settingsByKey: (key: string) => `settings:${key}`,

  // Reports cache keys
  report: (type: string, params?: string) => `report:${type}${params ? `:${params}` : ''}`,

  // Maintenance cache keys
  maintenance: (id: string) => `maintenance:${id}`,
  maintenanceUrgent: () => `maintenance:urgent`,
  maintenanceByVehicle: (vehicleId: string) => `maintenance:vehicle:${vehicleId}`,

  // Investor cache keys
  investor: (id: string) => `investor:${id}`,
  investors: (filters?: string) => `investors${filters ? `:${filters}` : ''}`,
  investorReports: (id: string, filters?: string) => `investor:reports:${id}${filters ? `:${filters}` : ''}`,
} as const

/**
 * Generate cache key with prefix
 */
export function createCacheKey(prefix: string, ...parts: (string | number | undefined)[]): string {
  const validParts = parts.filter((p) => p !== undefined && p !== null)
  return `${prefix}:${validParts.join(':')}`
}

/**
 * Generate cache key from object (for filters)
 */
export function createCacheKeyFromObject(prefix: string, obj: Record<string, any>): string {
  const sortedKeys = Object.keys(obj).sort()
  const parts = sortedKeys.map((key) => `${key}=${JSON.stringify(obj[key])}`)
  return `${prefix}:${parts.join('&')}`
}

