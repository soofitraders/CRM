import connectDB from '@/lib/db'
import Session, { ISession, SessionStatus } from '@/lib/models/Session'
import User from '@/lib/models/User'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import { logger } from '@/lib/utils/performance'

export interface CreateSessionParams {
  userId: string
  sessionToken: string
  refreshToken?: string
  ipAddress?: string
  userAgent?: string
  deviceInfo?: {
    type?: 'desktop' | 'mobile' | 'tablet'
    os?: string
    browser?: string
  }
  location?: {
    country?: string
    city?: string
    region?: string
  }
  expiresAt: Date
}

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
  status: SessionStatus
  lastActivity: Date
  createdAt: Date
  expiresAt: Date
}

/**
 * Create a new session
 */
export async function createSession(params: CreateSessionParams): Promise<ISession> {
  await connectDB()

  const session = new Session({
    userId: params.userId,
    sessionToken: params.sessionToken,
    refreshToken: params.refreshToken,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    deviceInfo: params.deviceInfo,
    location: params.location,
    expiresAt: params.expiresAt,
    status: 'ACTIVE',
    lastActivity: new Date(),
  })

  await session.save()
  return session
}

/**
 * Get session by token
 */
export async function getSessionByToken(sessionToken: string): Promise<ISession | null> {
  await connectDB()

  const session = await Session.findOne({
    sessionToken,
    status: 'ACTIVE',
    expiresAt: { $gt: new Date() },
  }).lean()

  return session as ISession | null
}

/**
 * Update session last activity
 */
export async function updateSessionActivity(sessionToken: string): Promise<void> {
  await connectDB()

  await Session.updateOne(
    { sessionToken, status: 'ACTIVE' },
    { lastActivity: new Date() }
  )
}

/**
 * Get all active sessions for a user
 */
export async function getUserSessions(userId: string): Promise<SessionInfo[]> {
  await connectDB()

  const sessions = await Session.find({
    userId,
    status: 'ACTIVE',
    expiresAt: { $gt: new Date() },
  })
    .sort({ lastActivity: -1 })
    .lean()

  return sessions.map((session) => ({
    id: session._id.toString(),
    userId: session.userId.toString(),
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
    deviceInfo: session.deviceInfo,
    location: session.location,
    status: session.status,
    lastActivity: session.lastActivity,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  }))
}

/**
 * Revoke a session
 */
export async function revokeSession(sessionToken: string): Promise<void> {
  await connectDB()

  await Session.updateOne(
    { sessionToken },
    { status: 'REVOKED', updatedAt: new Date() }
  )
}

/**
 * Revoke all sessions for a user (except current session)
 */
export async function revokeAllUserSessions(
  userId: string,
  exceptSessionToken?: string
): Promise<void> {
  await connectDB()

  const query: any = {
    userId,
    status: 'ACTIVE',
  }

  if (exceptSessionToken) {
    query.sessionToken = { $ne: exceptSessionToken }
  }

  await Session.updateMany(query, {
    status: 'REVOKED',
    updatedAt: new Date(),
  })
}

/**
 * Revoke a specific session by ID
 */
export async function revokeSessionById(sessionId: string, userId: string): Promise<boolean> {
  await connectDB()

  const result = await Session.updateOne(
    { _id: sessionId, userId },
    { status: 'REVOKED', updatedAt: new Date() }
  )

  return result.modifiedCount > 0
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  await connectDB()

  const result = await Session.updateMany(
    {
      expiresAt: { $lt: new Date() },
      status: 'ACTIVE',
    },
    {
      status: 'EXPIRED',
      updatedAt: new Date(),
    }
  )

  return result.modifiedCount
}

/**
 * Get current session from request
 */
export async function getCurrentSession(): Promise<ISession | null> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return null
    }

    // Note: NextAuth JWT strategy doesn't store session tokens in DB by default
    // This is a placeholder - you may need to adjust based on your implementation
    return null
  } catch (error) {
    logger.error('Error getting current session:', error)
    return null
  }
}

/**
 * Parse user agent to extract device info
 */
export function parseUserAgent(userAgent?: string): {
  type?: 'desktop' | 'mobile' | 'tablet'
  os?: string
  browser?: string
} {
  if (!userAgent) {
    return {}
  }

  const ua = userAgent.toLowerCase()

  // Detect device type
  let type: 'desktop' | 'mobile' | 'tablet' | undefined
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    type = 'tablet'
  } else if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) {
    type = 'mobile'
  } else {
    type = 'desktop'
  }

  // Detect OS
  let os: string | undefined
  if (ua.includes('windows')) os = 'Windows'
  else if (ua.includes('mac')) os = 'macOS'
  else if (ua.includes('linux')) os = 'Linux'
  else if (ua.includes('android')) os = 'Android'
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS'

  // Detect browser
  let browser: string | undefined
  if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome'
  else if (ua.includes('firefox')) browser = 'Firefox'
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari'
  else if (ua.includes('edg')) browser = 'Edge'
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera'

  return { type, os, browser }
}

