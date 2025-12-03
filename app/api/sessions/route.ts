import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/authOptions'
import {
  getUserSessions,
  revokeSessionById,
  revokeAllUserSessions,
} from '@/lib/services/sessionService'
import connectDB from '@/lib/db'
import { logger } from '@/lib/utils/performance'

// GET - Get all active sessions for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const sessions = await getUserSessions(session.user.id)

    return NextResponse.json({ sessions })
  } catch (error: any) {
    logger.error('Error fetching sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}

// DELETE - Revoke a session or all sessions
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const revokeAll = searchParams.get('revokeAll') === 'true'

    if (revokeAll) {
      // Revoke all sessions except current
      const currentSessionToken = (session as any).sessionToken as string | undefined
      await revokeAllUserSessions(session.user.id, currentSessionToken)
      return NextResponse.json({ message: 'All sessions revoked' })
    }

    if (sessionId) {
      const success = await revokeSessionById(sessionId, session.user.id)
      if (!success) {
        return NextResponse.json(
          { error: 'Session not found or unauthorized' },
          { status: 404 }
        )
      }
      return NextResponse.json({ message: 'Session revoked' })
    }

    return NextResponse.json(
      { error: 'sessionId or revokeAll parameter required' },
      { status: 400 }
    )
  } catch (error: any) {
    logger.error('Error revoking session:', error)
    return NextResponse.json(
      { error: 'Failed to revoke session' },
      { status: 500 }
    )
  }
}

