'use client'

import { useEffect, useRef } from 'react'
import { dataSync, EntityType } from '@/lib/utils/dataSync'

/**
 * React hook to listen for data sync events
 * Automatically refetches data when related entities are updated
 */
export function useDataSync(entityType: EntityType, refetch: () => void): void {
  // Use ref to store the latest refetch function to avoid dependency issues
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch

  useEffect(() => {
    // Only set up listeners in browser
    if (typeof window === 'undefined') return

    const handleRefetch = () => {
      try {
        refetchRef.current()
      } catch (error) {
        console.error('Error in data sync refetch:', error)
      }
    }

    const unsubscribe = dataSync.subscribe(entityType, handleRefetch)
    const unsubscribeAll = dataSync.subscribe('all', handleRefetch)

    // Also listen to custom events
    const handleSync = (event: Event) => {
      try {
        const customEvent = event as CustomEvent
        const { entityType: eventType } = customEvent.detail || {}
        if (eventType === entityType || eventType === 'all') {
          refetchRef.current()
        }
      } catch (error) {
        console.error('Error handling data sync event:', error)
      }
    }

    window.addEventListener('data-sync', handleSync)

    return () => {
      unsubscribe()
      unsubscribeAll()
      if (typeof window !== 'undefined') {
        window.removeEventListener('data-sync', handleSync)
      }
    }
  }, [entityType]) // Only depend on entityType, not refetch
}

