'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { dataSync, EntityType } from '@/lib/utils/dataSync'

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for 5 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes - garbage collect after 10 minutes (formerly cacheTime)
            refetchOnWindowFocus: true, // Refetch when window regains focus
            refetchOnMount: true, // Refetch on component mount
            refetchOnReconnect: true, // Refetch when network reconnects
            retry: 2, // Retry failed requests 2 times
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
          },
          mutations: {
            retry: 1, // Retry mutations once
            retryDelay: 1000,
          },
        },
      })
  )

  // Listen for data sync events and invalidate React Query cache
  useEffect(() => {
    // Only set up listeners in browser
    if (typeof window === 'undefined') return

    const entityTypes: EntityType[] = [
      'bookings',
      'vehicles',
      'customers',
      'expenses',
      'invoices',
      'payments',
      'maintenance',
      'dashboard',
      'financials',
    ]

    const unsubscribes = entityTypes.map((entityType) =>
      dataSync.subscribe(entityType, () => {
        try {
          // Invalidate all queries related to this entity type
          queryClient.invalidateQueries({ queryKey: [entityType] })
          queryClient.invalidateQueries({ queryKey: [entityType, 'list'] })
          queryClient.invalidateQueries({ queryKey: [entityType, 'detail'] })
        } catch (error) {
          console.error('Error invalidating queries:', error)
        }
      })
    )

    // Also listen to 'all' events
    const unsubscribeAll = dataSync.subscribe('all', () => {
      try {
        // Invalidate all queries
        queryClient.invalidateQueries()
      } catch (error) {
        console.error('Error invalidating all queries:', error)
      }
    })

    // Listen to custom events
    const handleSync = (event: Event) => {
      try {
        const customEvent = event as CustomEvent
        const { entityType } = customEvent.detail || {}
        if (entityType) {
          queryClient.invalidateQueries({ queryKey: [entityType] })
          queryClient.invalidateQueries({ queryKey: [entityType, 'list'] })
          queryClient.invalidateQueries({ queryKey: [entityType, 'detail'] })
        } else {
          // If no specific entity type, invalidate all
          queryClient.invalidateQueries()
        }
      } catch (error) {
        console.error('Error handling data sync event:', error)
      }
    }

    window.addEventListener('data-sync', handleSync)

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe())
      unsubscribeAll()
      window.removeEventListener('data-sync', handleSync)
    }
  }, [queryClient])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
