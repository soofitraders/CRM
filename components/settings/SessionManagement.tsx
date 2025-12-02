'use client'

import { useEffect, useState } from 'react'
import { useSession } from '@/lib/utils/session'
import { Trash2, Monitor, Smartphone, Tablet, Globe, Calendar, Shield } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import { format } from 'date-fns'

export default function SessionManagement() {
  const { sessions, loading, fetchSessions, revokeSession, revokeAllSessions } = useSession()
  const [revoking, setRevoking] = useState<string | null>(null)

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to revoke this session?')) return

    setRevoking(sessionId)
    try {
      await revokeSession(sessionId)
    } finally {
      setRevoking(null)
    }
  }

  const handleRevokeAll = async () => {
    if (
      !confirm(
        'Are you sure you want to revoke all other sessions? You will be logged out from all devices.'
      )
    )
      return

    await revokeAllSessions()
  }

  const getDeviceIcon = (type?: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-4 h-4" />
      case 'tablet':
        return <Tablet className="w-4 h-4" />
      default:
        return <Monitor className="w-4 h-4" />
    }
  }

  const formatDeviceInfo = (session: any) => {
    const parts = []
    if (session.deviceInfo?.type) {
      parts.push(session.deviceInfo.type.charAt(0).toUpperCase() + session.deviceInfo.type.slice(1))
    }
    if (session.deviceInfo?.os) {
      parts.push(session.deviceInfo.os)
    }
    if (session.deviceInfo?.browser) {
      parts.push(session.deviceInfo.browser)
    }
    return parts.join(' • ') || 'Unknown device'
  }

  const isCurrentSession = (session: any) => {
    // You can implement logic to identify current session
    // For now, we'll mark the most recent one as current
    return sessions.length > 0 && sessions[0].id === session.id
  }

  return (
    <SectionCard
      title="Active Sessions"
      actions={
        sessions.length > 1 && (
          <button
            onClick={handleRevokeAll}
            className="px-4 py-2 text-sm font-medium text-danger hover:text-danger/80 transition-colors"
          >
            Revoke All Other Sessions
          </button>
        )
      }
    >
      {loading ? (
        <div className="text-center py-8 text-bodyText">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-8 text-bodyText">No active sessions</div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between p-4 bg-pageBg rounded-lg border border-borderSoft"
            >
              <div className="flex items-start gap-4 flex-1">
                <div className="mt-1">{getDeviceIcon(session.deviceInfo?.type)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-headingText">
                      {formatDeviceInfo(session)}
                    </h4>
                    {isCurrentSession(session) && (
                      <span className="px-2 py-0.5 text-xs font-medium bg-sidebarActiveBg/10 text-sidebarActiveBg rounded">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 text-sm text-bodyText">
                    {session.ipAddress && (
                      <div className="flex items-center gap-2">
                        <Globe className="w-3 h-3" />
                        <span>{session.ipAddress}</span>
                        {session.location?.city && (
                          <span className="text-sidebarMuted">
                            • {session.location.city}
                            {session.location.country && `, ${session.location.country}`}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      <span>
                        Last active: {format(new Date(session.lastActivity), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="w-3 h-3" />
                      <span>
                        Expires: {format(new Date(session.expiresAt), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              {!isCurrentSession(session) && (
                <button
                  onClick={() => handleRevokeSession(session.id)}
                  disabled={revoking === session.id}
                  className="ml-4 p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors disabled:opacity-50"
                  title="Revoke session"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

