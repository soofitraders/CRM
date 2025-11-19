import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import User, { IUser, UserRole } from '@/lib/models/User'
import connectDB from '@/lib/db'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
  status: string
}

/**
 * Get the current authenticated user from the session (server-side)
 * Optimized to only fetch necessary fields
 */
export async function getCurrentUser(): Promise<IUser | null> {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.email) {
      return null
    }

    await connectDB()
    
    // Only select fields needed for authorization checks
    const user = await User.findOne({ email: session.user.email })
      .select('_id name email role status')
      .lean()
    
    if (!user) {
      return null
    }

    // Convert lean document to IUser-like object
    return user as IUser
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Check if a user has one of the allowed roles
 */
export function hasRole(user: IUser | null, allowedRoles: UserRole[]): boolean {
  if (!user) {
    return false
  }

  if (user.status !== 'ACTIVE') {
    return false
  }

  return allowedRoles.includes(user.role)
}

/**
 * Check if user is a super admin
 */
export function isSuperAdmin(user: IUser | null): boolean {
  return hasRole(user, ['SUPER_ADMIN'])
}

/**
 * Check if user is an admin (super admin or admin)
 */
export function isAdmin(user: IUser | null): boolean {
  return hasRole(user, ['SUPER_ADMIN', 'ADMIN'])
}

