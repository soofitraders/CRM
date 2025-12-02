# Cache System Documentation

This document describes the comprehensive caching system implemented in the MisterWheels CRM application.

## Overview

The cache system provides:
- **In-Memory Caching**: Fast, in-memory cache with TTL support
- **Automatic Cleanup**: Expired entries are automatically removed
- **LRU Eviction**: Least recently used entries are evicted when cache is full
- **Cache Invalidation**: Pattern-based cache invalidation
- **React Query Integration**: Client-side caching with React Query
- **API Route Caching**: Server-side caching for API responses

## Components

### 1. Cache Service (`lib/cache/cacheService.ts`)

The core caching service provides:

**Features:**
- TTL (Time To Live) support
- Maximum size limit with LRU eviction
- Automatic cleanup of expired entries
- Hit tracking for statistics
- Cache-aside pattern support

**Methods:**
- `get<T>(key: string): T | null` - Get value from cache
- `set<T>(key: string, value: T, ttl?: number): boolean` - Set value in cache
- `delete(key: string): boolean` - Delete value from cache
- `deletePattern(pattern: string | RegExp): number` - Delete multiple keys matching pattern
- `has(key: string): boolean` - Check if key exists
- `clear(): void` - Clear all cache
- `getOrSet<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T>` - Get or fetch and cache
- `increment(key: string, by?: number): number` - Increment numeric value
- `decrement(key: string, by?: number): number` - Decrement numeric value
- `getStats()` - Get cache statistics

### 2. Cache Keys (`lib/cache/cacheKeys.ts`)

Centralized cache key management:

```typescript
CacheKeys.user(id)
CacheKeys.booking(id)
CacheKeys.bookings(filters)
CacheKeys.dashboardSummary(userId)
// ... and more
```

**Helper Functions:**
- `createCacheKey(prefix, ...parts)` - Create cache key from parts
- `createCacheKeyFromObject(prefix, obj)` - Create cache key from object

### 3. Cache Utilities (`lib/cache/cacheUtils.ts`)

High-level utility functions:

**Query Caching:**
```typescript
const data = await cacheQuery('key', async () => {
  return await fetchData()
}, 300) // 5 minutes TTL
```

**Cache Invalidation:**
```typescript
invalidateUserCache(userId)
invalidateBookingCache(bookingId)
invalidateCustomerCache(customerId)
invalidateVehicleCache(vehicleId)
invalidateDashboardCache(userId)
invalidateFinancialCache()
invalidateAllCache()
```

**Cache Middleware:**
```typescript
const handler = withCache(async (id: string) => {
  return await fetchData(id)
}, {
  key: (id) => `data:${id}`,
  ttl: 300
})
```

### 4. Cache Middleware (`lib/middleware/cacheMiddleware.ts`)

Middleware for API routes:

```typescript
export async function GET(request: NextRequest) {
  return cacheMiddleware({
    ttl: 300,
    keyGenerator: (req) => `api:${req.url}`,
  })(request, async (req) => {
    // Your handler logic
    return NextResponse.json(data)
  })
}
```

### 5. React Query Configuration (`components/providers/QueryProvider.tsx`)

Enhanced React Query setup:
- **staleTime**: 5 minutes - Data is considered fresh for 5 minutes
- **gcTime**: 10 minutes - Garbage collect unused data after 10 minutes
- **refetchOnWindowFocus**: Automatically refetch when window regains focus
- **retry**: Automatic retry with exponential backoff

## Usage Examples

### Server-Side Caching

```typescript
import { cacheQuery } from '@/lib/cache/cacheUtils'
import { CacheKeys } from '@/lib/cache/cacheKeys'

// Cache a database query
export async function getBooking(id: string) {
  return cacheQuery(
    CacheKeys.booking(id),
    async () => {
      await connectDB()
      return await Booking.findById(id).lean()
    },
    300 // 5 minutes
  )
}
```

### Cache Invalidation

```typescript
import { invalidateBookingCache } from '@/lib/cache/cacheUtils'

// After creating/updating a booking
export async function createBooking(data: any) {
  const booking = await Booking.create(data)
  
  // Invalidate related caches
  invalidateBookingCache(booking._id.toString(), booking.customer, booking.vehicle)
  invalidateDashboardCache()
  
  return booking
}
```

### API Route Caching

```typescript
import { cachedHandler } from '@/lib/middleware/cacheMiddleware'

export const GET = cachedHandler(async (request: NextRequest) => {
  const data = await fetchData()
  return NextResponse.json(data)
}, {
  ttl: 300,
  key: 'api:data'
})
```

### Client-Side Caching (React Query)

```typescript
import { useQuery } from '@tanstack/react-query'

export function useBookings() {
  return useQuery({
    queryKey: ['bookings'],
    queryFn: async () => {
      const response = await fetch('/api/bookings')
      return response.json()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
```

## Cache Invalidation Strategies

### 1. On Create/Update/Delete

```typescript
// After creating a booking
invalidateBookingCache(bookingId, customerId, vehicleId)
invalidateDashboardCache()
```

### 2. Pattern-Based Invalidation

```typescript
// Invalidate all booking-related cache
invalidateCache(/^bookings:/)
```

### 3. Entity-Based Invalidation

```typescript
// Invalidate all cache for a specific entity
invalidateEntityCache('booking', bookingId)
```

## Environment Variables

Optional cache configuration:

```env
CACHE_TTL=300          # Default TTL in seconds (5 minutes)
CACHE_MAX_SIZE=1000    # Maximum number of cache entries
```

## Cache Statistics

Get cache statistics (admin only):

```bash
GET /api/cache/stats
```

Response:
```json
{
  "stats": {
    "size": 150,
    "maxSize": 1000,
    "expired": 5,
    "active": 145,
    "totalHits": 1234,
    "averageHits": 8.23
  }
}
```

## Clear Cache

Clear cache (admin only):

```bash
POST /api/cache/clear
Content-Type: application/json

{
  "pattern": "bookings:*"  // Optional: clear specific pattern
}
```

## Best Practices

1. **Use Cache Keys**: Always use `CacheKeys` for consistent key naming
2. **Set Appropriate TTL**: Use shorter TTL for frequently changing data
3. **Invalidate on Updates**: Always invalidate cache when data changes
4. **Monitor Cache Size**: Keep an eye on cache statistics
5. **Use React Query**: Leverage React Query for client-side caching
6. **Cache at Right Level**: Cache expensive operations, not simple lookups

## Cache Patterns

### Cache-Aside Pattern

```typescript
const data = await cache.getOrSet('key', async () => {
  return await expensiveOperation()
}, 300)
```

### Write-Through Pattern

```typescript
async function updateData(id: string, data: any) {
  const updated = await DataModel.updateOne({ _id: id }, data)
  cache.set(`data:${id}`, updated, 300)
  return updated
}
```

### Invalidation Pattern

```typescript
async function deleteData(id: string) {
  await DataModel.deleteOne({ _id: id })
  cache.delete(`data:${id}`)
  invalidateEntityCache('data', id)
}
```

## Performance Considerations

1. **Memory Usage**: Monitor cache size to avoid memory issues
2. **TTL Selection**: Balance between freshness and performance
3. **Cache Warming**: Pre-populate cache for frequently accessed data
4. **Cache Hit Rate**: Aim for >80% cache hit rate for optimal performance

## Future Enhancements

Potential improvements:
1. **Redis Integration**: Replace in-memory cache with Redis for distributed caching
2. **Cache Compression**: Compress large cache entries
3. **Cache Analytics**: Detailed analytics and monitoring
4. **Smart Invalidation**: Automatic cache invalidation based on data relationships
5. **Cache Warming**: Pre-populate cache on application startup
6. **Multi-Layer Caching**: Combine in-memory and distributed caching

