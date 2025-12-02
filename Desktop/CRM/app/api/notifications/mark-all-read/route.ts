import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import Notification from '@/lib/models/Notification'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await connectDB()

    const result = await Notification.updateMany(
      {
        user: user._id,
        read: false,
      },
      {
        read: true,
        readAt: new Date(),
      }
    )

    return NextResponse.json({
      success: true,
      updatedCount: result.modifiedCount,
    })
  } catch (error: any) {
    console.error('Error marking all notifications as read:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to mark all notifications as read' },
      { status: 500 }
    )
  }
}

