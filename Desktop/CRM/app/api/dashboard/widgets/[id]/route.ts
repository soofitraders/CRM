import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import DashboardWidget from '@/lib/models/DashboardWidget'

// GET - Get single widget
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const widget = await DashboardWidget.findById(params.id).lean()

    if (!widget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 })
    }

    // Check if user owns the widget or it's shared with them
    if (String(widget.userId) !== String(user._id)) {
      if (!widget.isShared) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      if (widget.sharedWithRoles && widget.sharedWithRoles.length > 0) {
        if (!widget.sharedWithRoles.includes(user.role)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
    }

    return NextResponse.json({ widget })
  } catch (error: any) {
    console.error('Error fetching widget:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch widget' },
      { status: 500 }
    )
  }
}

// PATCH - Update widget
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only SUPER_ADMIN and ADMIN can update widgets
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const widget = await DashboardWidget.findById(params.id)
    if (!widget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 })
    }

    // Check ownership
    if (String(widget.userId) !== String(user._id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { title, config, position, isShared, sharedWithRoles } = body

    if (title !== undefined) widget.title = title
    if (config !== undefined) widget.config = config
    if (position !== undefined) widget.position = position
    if (isShared !== undefined) widget.isShared = isShared
    if (sharedWithRoles !== undefined) widget.sharedWithRoles = sharedWithRoles

    await widget.save()

    return NextResponse.json({ widget })
  } catch (error: any) {
    console.error('Error updating widget:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update widget' },
      { status: 500 }
    )
  }
}

// DELETE - Delete widget
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only SUPER_ADMIN and ADMIN can delete widgets
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const widget = await DashboardWidget.findById(params.id)
    if (!widget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 })
    }

    // Check ownership
    if (String(widget.userId) !== String(user._id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await DashboardWidget.findByIdAndDelete(params.id)

    return NextResponse.json({ message: 'Widget deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting widget:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete widget' },
      { status: 500 }
    )
  }
}

