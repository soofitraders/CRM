import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import Notification from '@/lib/models/Notification'

export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams
    const read = searchParams.get('read')
    const limit = parseInt(searchParams.get('limit') || '50')

    const filter: any = { user: user._id }
    if (read !== null) {
      filter.read = read === 'true'
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()

    const unreadCount = await Notification.countDocuments({
      user: user._id,
      read: false,
    })

    return NextResponse.json({ notifications, unreadCount })
  } catch (error: any) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch notifications' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
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

    const body = await request.json()
    const { notificationIds, read } = body

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return NextResponse.json({ error: 'notificationIds array is required' }, { status: 400 })
    }

    const updateData: any = { read: read !== false }
    if (read) {
      updateData.readAt = new Date()
    }

    await Notification.updateMany(
      {
        _id: { $in: notificationIds },
        user: user._id,
      },
      updateData
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error updating notifications:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update notifications' },
      { status: 500 }
    )
  }
}

