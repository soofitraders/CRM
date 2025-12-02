import { invalidateCache, cacheKeys } from './dbCache'
import { revalidateTag } from './apiCache'
import { CACHE_TAGS } from './apiCache'

/**
 * Cache invalidation utilities
 * Call these functions when data is created, updated, or deleted
 */

export const cacheInvalidation = {
  /**
   * Invalidate booking-related caches
   */
  bookings: {
    all: () => {
      invalidateCache('^bookings:')
      revalidateTag(CACHE_TAGS.BOOKINGS)
    },
    byId: (bookingId: string) => {
      invalidateCache(cacheKeys.booking(bookingId))
      invalidateCache('^bookings:')
      revalidateTag(CACHE_TAGS.BOOKINGS)
    },
    byCustomer: (customerId: string) => {
      invalidateCache(`^bookings:.*customer:${customerId}`)
      revalidateTag(CACHE_TAGS.BOOKINGS)
    },
  },

  /**
   * Invalidate vehicle-related caches
   */
  vehicles: {
    all: () => {
      invalidateCache('^vehicles:')
      revalidateTag(CACHE_TAGS.VEHICLES)
    },
    byId: (vehicleId: string) => {
      invalidateCache(cacheKeys.vehicle(vehicleId))
      invalidateCache('^vehicles:')
      revalidateTag(CACHE_TAGS.VEHICLES)
    },
  },

  /**
   * Invalidate customer-related caches
   */
  customers: {
    all: () => {
      invalidateCache('^customers:')
      revalidateTag(CACHE_TAGS.CUSTOMERS)
    },
    byId: (customerId: string) => {
      invalidateCache(cacheKeys.customer(customerId))
      invalidateCache('^customers:')
      revalidateTag(CACHE_TAGS.CUSTOMERS)
    },
  },

  /**
   * Invalidate invoice-related caches
   */
  invoices: {
    all: () => {
      invalidateCache('^invoices:')
      revalidateTag(CACHE_TAGS.INVOICES)
    },
    byId: (invoiceId: string) => {
      invalidateCache(cacheKeys.invoice(invoiceId))
      invalidateCache('^invoices:')
      revalidateTag(CACHE_TAGS.INVOICES)
    },
    byBooking: (bookingId: string) => {
      invalidateCache(`^invoices:.*booking:${bookingId}`)
      revalidateTag(CACHE_TAGS.INVOICES)
    },
  },

  /**
   * Invalidate dashboard caches
   */
  dashboard: {
    all: () => {
      invalidateCache('^dashboard:')
      revalidateTag(CACHE_TAGS.DASHBOARD)
    },
    byUser: (userId: string) => {
      invalidateCache(cacheKeys.dashboard(userId))
      revalidateTag(CACHE_TAGS.DASHBOARD)
    },
  },

  /**
   * Invalidate expense-related caches
   */
  expenses: {
    all: () => {
      invalidateCache('^expenses:')
      revalidateTag(CACHE_TAGS.EXPENSES)
    },
  },

  /**
   * Invalidate maintenance-related caches
   */
  maintenance: {
    all: () => {
      invalidateCache('^maintenance:')
      revalidateTag(CACHE_TAGS.MAINTENANCE)
    },
    byVehicle: (vehicleId: string) => {
      invalidateCache(`^maintenance:.*vehicle:${vehicleId}`)
      revalidateTag(CACHE_TAGS.MAINTENANCE)
    },
  },

  /**
   * Invalidate user-related caches
   */
  users: {
    all: () => {
      invalidateCache('^user:')
      revalidateTag(CACHE_TAGS.USERS)
    },
    byId: (userId: string) => {
      invalidateCache(cacheKeys.user(userId))
      invalidateCache('^user:')
      revalidateTag(CACHE_TAGS.USERS)
    },
  },

  /**
   * Invalidate all caches (use sparingly)
   */
  all: () => {
    invalidateCache('.*')
    Object.values(CACHE_TAGS).forEach((tag) => revalidateTag(tag))
  },
}

