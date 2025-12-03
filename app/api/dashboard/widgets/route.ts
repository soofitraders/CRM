export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import DashboardWidget from '@/lib/models/DashboardWidget'
import { logger } from '@/lib/utils/performance'

// GET - Get user's dashboard widgets
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
    const includeShared = searchParams.get('includeShared') === 'true'

    // Get user's own widgets
    const userWidgets = await DashboardWidget.find({ userId: user._id }).lean()

    // Get shared widgets if requested
    let sharedWidgets: any[] = []
    if (includeShared && hasRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      sharedWidgets = await DashboardWidget.find({
        isShared: true,
        $or: [
          { sharedWithRoles: { $in: [user.role] } },
          { sharedWithRoles: { $size: 0 } }, // Shared with all
        ],
      }).lean()
    }

    return NextResponse.json({
      widgets: [...userWidgets, ...sharedWidgets],
    })
  } catch (error: any) {
    logger.error('Error fetching dashboard widgets:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard widgets' },
      { status: 500 }
    )
  }
}

// POST - Create new widget
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

    // Only SUPER_ADMIN and ADMIN can create widgets
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await request.json()
    const { type, title, config, position, isShared, sharedWithRoles } = body

    if (!type || !title) {
      return NextResponse.json(
        { error: 'Type and title are required' },
        { status: 400 }
      )
    }

    const widget = await DashboardWidget.create({
      userId: user._id,
      type,
      title,
      config: config || {},
      position: position || { x: 0, y: 0, w: 4, h: 3 },
      isShared: isShared || false,
      sharedWithRoles: sharedWithRoles || [],
    })

    return NextResponse.json({ widget }, { status: 201 })
  } catch (error: any) {
    logger.error('Error creating dashboard widget:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create dashboard widget' },
      { status: 500 }
    )
  }
}

