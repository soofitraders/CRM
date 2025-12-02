'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

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

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
