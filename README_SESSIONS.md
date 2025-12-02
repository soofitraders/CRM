# Session Management System

This document describes the comprehensive session management system implemented in the MisterWheels CRM application.

## Overview

The session system provides:
- **Session Tracking**: Track all active user sessions in the database
- **Multi-Device Support**: Users can have multiple active sessions across different devices
- **Session Management**: Users can view and revoke their active sessions
- **Security Features**: IP tracking, device information, and location data
- **Automatic Cleanup**: Expired sessions are automatically cleaned up

## Components

### 1. Session Model (`lib/models/Session.ts`)

The Session model stores:
- User ID
- Session token
- Refresh token (optional)
- IP address
- User agent
- Device information (type, OS, browser)
- Location data (country, city, region)
- Status (ACTIVE, EXPIRED, REVOKED, LOGGED_OUT)
- Last activity timestamp
- Expiration date

### 2. Session Service (`lib/services/sessionService.ts`)

Provides functions for:
- Creating new sessions
- Getting sessions by token
- Updating session activity
- Getting all user sessions
- Revoking sessions
- Cleaning up expired sessions

### 3. API Routes (`app/api/sessions/route.ts`)

**GET `/api/sessions`**
- Returns all active sessions for the current user
- Requires authentication

**DELETE `/api/sessions?sessionId=<id>`**
- Revokes a specific session
- Requires authentication

**DELETE `/api/sessions?revokeAll=true`**
- Revokes all sessions except the current one
- Requires authentication

### 4. Client Utilities (`lib/utils/session.ts`)

**`useSession()` Hook**
- Enhanced version of NextAuth's `useSession`
- Provides session management functions:
  - `fetchSessions()` - Get all user sessions
  - `revokeSession(id)` - Revoke a specific session
  - `revokeAllSessions()` - Revoke all other sessions
  - `signOut()` - Sign out with cleanup

**`useSessionExpiry()` Hook**
- Monitors session expiration
- Returns `isExpiringSoon` boolean

**`refreshSessionActivity()` Function**
- Refreshes session activity timestamp

### 5. Session Management Component (`components/settings/SessionManagement.tsx`)

A React component that displays:
- List of all active sessions
- Device information for each session
- IP address and location
- Last activity time
- Expiration time
- Ability to revoke individual sessions
- Option to revoke all other sessions

## Usage

### Viewing Active Sessions

```tsx
import SessionManagement from '@/components/settings/SessionManagement'

export default function SettingsPage() {
  return (
    <div>
      <SessionManagement />
    </div>
  )
}
```

### Using Session Hook

```tsx
import { useSession } from '@/lib/utils/session'

export default function MyComponent() {
  const { sessions, revokeSession, revokeAllSessions } = useSession()

  return (
    <div>
      {sessions.map(session => (
        <div key={session.id}>
          {session.deviceInfo?.type} - {session.ipAddress}
        </div>
      ))}
    </div>
  )
}
```

### Checking Session Expiry

```tsx
import { useSessionExpiry } from '@/lib/utils/session'

export default function MyComponent() {
  const { isExpiringSoon } = useSessionExpiry()

  if (isExpiringSoon) {
    return <div>Your session is about to expire</div>
  }

  return <div>Session is active</div>
}
```

## Security Features

1. **Session Expiration**: Sessions automatically expire after 30 days
2. **Activity Tracking**: Last activity timestamp is updated on each request
3. **IP Tracking**: IP addresses are logged for security monitoring
4. **Device Information**: Device type, OS, and browser are tracked
5. **Location Tracking**: Country, city, and region are optionally tracked
6. **Session Revocation**: Users can revoke sessions from any device
7. **Automatic Cleanup**: Expired sessions are automatically removed

## Database Indexes

The Session model includes optimized indexes:
- `userId` - For querying user sessions
- `sessionToken` - For quick session lookup
- `status` - For filtering active sessions
- `expiresAt` - For cleanup operations
- Compound indexes for common query patterns
- TTL index for automatic expiration cleanup

## Environment Variables

No additional environment variables are required. The session system uses the existing MongoDB connection and NextAuth configuration.

## Future Enhancements

Potential improvements:
1. **Session Limits**: Limit number of concurrent sessions per user
2. **Geolocation Blocking**: Block sessions from specific locations
3. **Device Fingerprinting**: Enhanced device identification
4. **Session Notifications**: Notify users of new sessions
5. **Session History**: Track session history and login patterns
6. **Two-Factor Authentication**: Integrate 2FA with session management

## Notes

- NextAuth uses JWT strategy, so session tokens are stored in cookies, not the database
- The Session model tracks sessions for management purposes
- Session activity is updated asynchronously to avoid blocking requests
- Expired sessions are automatically cleaned up by MongoDB TTL index

