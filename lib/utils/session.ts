'use client'

import { useSession as useNextAuthSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { logger } from '@/lib/utils/performance'

export interface SessionInfo {
  id: string
  userId: string
  ipAddress?: string
  userAgent?: string
  deviceInfo?: {
    type?: string
    os?: string
    browser?: string
  }
  location?: {
    country?: string
    city?: string
    region?: string
  }
  status: string
  lastActivity: Date
  createdAt: Date
  expiresAt: Date
}

/**
 * Custom hook to use session with additional utilities
 */
export function useSession() {
  const session = useNextAuthSession()
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch user sessions
  const fetchSessions = async () => {
    if (!session.data?.user) return

    try {
      setLoading(true)
      const response = await fetch('/api/sessions')
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
      }
    } catch (error) {
      logger.error('Error fetching sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  // Revoke a session
  const revokeSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions?sessionId=${sessionId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchSessions()
        return true
      }
      return false
    } catch (error) {
      logger.error('Error revoking session:', error)
      return false
    }
  }

  // Revoke all sessions
  const revokeAllSessions = async () => {
    try {
      const response = await fetch('/api/sessions?revokeAll=true', {
        method: 'DELETE',
      })

      if (response.ok) {
        // Sign out current session
        await signOut({ redirect: true, callbackUrl: '/login' })
        return true
      }
      return false
    } catch (error) {
      logger.error('Error revoking all sessions:', error)
      return false
    }
  }

  // Sign out with session cleanup
  const signOutWithCleanup = async () => {
    try {
      await signOut({ redirect: true, callbackUrl: '/login' })
    } catch (error) {
      logger.error('Error signing out:', error)
    }
  }

  return {
    ...session,
    sessions,
    loading,
    fetchSessions,
    revokeSession,
    revokeAllSessions,
    signOut: signOutWithCleanup,
  }
}

/**
 * Check if session is about to expire (within 5 minutes)
 */
export function useSessionExpiry() {
  const { data: session } = useNextAuthSession()
  const [isExpiringSoon, setIsExpiringSoon] = useState(false)

  useEffect(() => {
    if (!session?.expires) return

    const checkExpiry = () => {
      const expiresAt = new Date(session.expires)
      const now = new Date()
      const timeUntilExpiry = expiresAt.getTime() - now.getTime()
      const fiveMinutes = 5 * 60 * 1000

      setIsExpiringSoon(timeUntilExpiry < fiveMinutes && timeUntilExpiry > 0)
    }

    checkExpiry()
    const interval = setInterval(checkExpiry, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [session?.expires])

  return { isExpiringSoon }
}

/**
 * Refresh session activity
 */
export async function refreshSessionActivity() {
  try {
    await fetch('/api/auth/session', { method: 'GET' })
  } catch (error) {
    logger.error('Error refreshing session:', error)
  }
}

