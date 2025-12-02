import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import User from '@/lib/models/User'
import { updateNotificationPreferencesSchema } from '@/lib/validation/settings'
import { getCurrentUser } from '@/lib/auth'
import { logger } from '@/lib/utils/performance'

// PATCH - Update current user's notification preferences
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const data = updateNotificationPreferencesSchema.parse(body)

    // Update notification preferences
    if (data.emailNotifications !== undefined) {
      user.emailNotifications = data.emailNotifications
    }
    if (data.smsNotifications !== undefined) {
      user.smsNotifications = data.smsNotifications
    }

    await user.save()

    const updatedUser = await User.findById(user._id)
      .select('-passwordHash')
      .lean()

    return NextResponse.json({ user: updatedUser })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    logger.error('Error updating notification preferences:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update preferences' },
      { status: 500 }
    )
  }
}

// GET - Get current user's notification preferences
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      emailNotifications: user.emailNotifications ?? true,
      smsNotifications: user.smsNotifications ?? false,
    })
  } catch (error: any) {
    logger.error('Error fetching notification preferences:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch preferences' },
      { status: 500 }
    )
  }
}

