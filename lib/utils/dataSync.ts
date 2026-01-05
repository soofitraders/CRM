/**
 * Data synchronization utilities
 * Helps keep data in sync across all pages when updates occur
 */

// Event emitter for cross-page data synchronization
class DataSyncEmitter {
  private listeners: Map<string, Set<() => void>> = new Map()

  /**
   * Subscribe to data change events
   */
  subscribe(entityType: string, callback: () => void): () => void {
    if (!this.listeners.has(entityType)) {
      this.listeners.set(entityType, new Set())
    }
    this.listeners.get(entityType)!.add(callback)

    // Return unsubscribe function
    return () => {
      this.listeners.get(entityType)?.delete(callback)
    }
  }

  /**
   * Emit data change event
   */
  emit(entityType: string): void {
    const callbacks = this.listeners.get(entityType)
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback()
        } catch (error) {
          console.error('Error in data sync callback:', error)
        }
      })
    }
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear()
  }
}

// Global data sync emitter instance
export const dataSync = new DataSyncEmitter()

/**
 * Entity types that can trigger sync events
 */
export type EntityType = 
  | 'bookings'
  | 'vehicles'
  | 'customers'
  | 'expenses'
  | 'invoices'
  | 'payments'
  | 'maintenance'
  | 'dashboard'
  | 'financials'
  | 'all'

/**
 * Trigger data sync for a specific entity type
 * This should be called after any create/update/delete operation
 */
export function triggerDataSync(entityType: EntityType): void {
  if (typeof window !== 'undefined') {
    // Emit sync event
    dataSync.emit(entityType)
    
    // Also emit 'all' event for global refresh
    if (entityType !== 'all') {
      dataSync.emit('all')
    }

    // Dispatch custom event for pages that listen to it
    window.dispatchEvent(new CustomEvent('data-sync', { detail: { entityType } }))
  }
}

// React hook is exported from hooks/useDataSync.ts

