import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { updateSessionActivity } from '@/lib/services/sessionService'
import { logger } from '@/lib/utils/performance'

/**
 * Track session activity in middleware
 * Call this in your middleware to update last activity timestamp
 */
export async function trackSessionActivity(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    
    if (!token?.sessionToken) {
      return
    }

    // Update session activity asynchronously (don't block request)
    updateSessionActivity(token.sessionToken as string).catch((error) => {
      logger.error('Error tracking session activity:', error)
    })
  } catch (error) {
    // Silently fail - don't break the request
    logger.error('Error in session tracker:', error)
  }
}

