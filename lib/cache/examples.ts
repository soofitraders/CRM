/**
 * Cache System Usage Examples
 * 
 * This file demonstrates how to use the cache system in various scenarios
 */

import { cacheQuery } from '../cache/cacheUtils'
import { CacheKeys } from '../cache/cacheKeys'
import { invalidateBookingCache, invalidateDashboardCache } from '../cache/cacheUtils'
import connectDB from '../db'
import Booking from '../models/Booking'
import User from '../models/User'

/**
 * Example 1: Caching a database query
 */
export async function getCachedBooking(bookingId: string) {
  return cacheQuery(
    CacheKeys.booking(bookingId),
    async () => {
      await connectDB()
      return await Booking.findById(bookingId).lean()
    },
    300 // Cache for 5 minutes
  )
}

/**
 * Example 2: Caching with filters
 */
export async function getCachedBookings(filters: any) {
  const filterKey = JSON.stringify(filters)
  
  return cacheQuery(
    CacheKeys.bookings(filterKey),
    async () => {
      await connectDB()
      return await Booking.find(filters).lean()
    },
    180 // Cache for 3 minutes (shorter TTL for filtered queries)
  )
}

/**
 * Example 3: Cache invalidation after update
 */
export async function updateBookingAndInvalidateCache(bookingId: string, updates: any) {
  await connectDB()
  
  const booking = await Booking.findByIdAndUpdate(bookingId, updates, { new: true })
  
  if (!booking) {
    return null
  }
  
  // Invalidate related caches
  invalidateBookingCache(
    bookingId,
    booking.customer?.toString(),
    booking.vehicle?.toString()
  )
  invalidateDashboardCache()
  
  return booking
}

/**
 * Example 4: Using cache in API route
 */
export async function exampleAPIRoute(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  
  if (!userId) {
    return Response.json({ error: 'User ID required' }, { status: 400 })
  }
  
  // Use cache for expensive query
  const data = await cacheQuery(
    CacheKeys.dashboardSummary(userId),
    async () => {
      await connectDB()
      
      // Expensive operations
      const totalBookings = await Booking.countDocuments({ customer: userId })
      const totalRevenue = await Booking.aggregate([
        { $match: { customer: userId } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ])
      
      return {
        totalBookings,
        totalRevenue: totalRevenue[0]?.total || 0,
      }
    },
    600 // Cache for 10 minutes
  )
  
  return Response.json(data)
}

/**
 * Example 5: Cache invalidation on user update
 */
export async function updateUserAndInvalidateCache(userId: string, updates: any) {
  await connectDB()
  
  const user = await User.findByIdAndUpdate(userId, updates, { new: true })
  
  // Invalidate user-related caches
  const { invalidateUserCache } = await import('../cache/cacheUtils')
  invalidateUserCache(userId)
  
  // If user role changed, invalidate dashboard cache
  if (updates.role) {
    invalidateDashboardCache(userId)
  }
  
  return user
}

/**
 * Example 6: Batch cache operations
 */
export async function getMultipleCachedBookings(bookingIds: string[]) {
  const results = await Promise.all(
    bookingIds.map(id =>
      cacheQuery(
        CacheKeys.booking(id),
        async () => {
          await connectDB()
          return await Booking.findById(id).lean()
        },
        300
      )
    )
  )
  
  return results.filter(Boolean) // Remove nulls
}

