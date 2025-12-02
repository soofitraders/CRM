/**
 * Environment variable utilities
 * Handles environment-specific configurations for both localhost and production
 */

/**
 * Get the application URL based on environment
 * Automatically detects localhost vs production
 */
export function getAppUrl(): string {
  // If NEXTAUTH_URL is explicitly set, use it
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL
  }

  // For server-side rendering
  if (typeof window === 'undefined') {
    // In production (Render), use the RENDER_EXTERNAL_URL if available
    if (process.env.RENDER_EXTERNAL_URL) {
      return process.env.RENDER_EXTERNAL_URL
    }
    
    // Fallback to localhost for development
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  }

  // For client-side, use current location
  return window.location.origin
}

/**
 * Get MongoDB URI with fallback
 */
export function getMongoDBUri(): string {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required')
  }
  return uri
}

/**
 * Get NextAuth secret with validation
 */
export function getNextAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET environment variable is required')
  }
  return secret
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * Check if running on Render
 */
export function isRender(): boolean {
  return !!process.env.RENDER
}

/**
 * Get cache TTL with default
 */
export function getCacheTTL(): number {
  return parseInt(process.env.CACHE_TTL || '300', 10)
}

/**
 * Get cache max size with default
 */
export function getCacheMaxSize(): number {
  return parseInt(process.env.CACHE_MAX_SIZE || '1000', 10)
}

