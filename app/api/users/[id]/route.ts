import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import User from '@/lib/models/User'
import { updateUserSchema } from '@/lib/validation/user'
import { getCurrentUser, hasRole } from '@/lib/auth'
import { logger } from '@/lib/utils/performance'

// GET - Get single user
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check permissions - Only SUPER_ADMIN and ADMIN can view user details
    if (!hasRole(currentUser, ['SUPER_ADMIN', 'ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const user = await User.findById(params.id).select('-passwordHash').lean()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error: any) {
    logger.error('Error fetching user:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

// PATCH - Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check permissions - Only SUPER_ADMIN and ADMIN can update users
    if (!hasRole(currentUser, ['SUPER_ADMIN', 'ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const user = await User.findById(params.id)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const data = updateUserSchema.parse(body)

    // Check if email is being updated and if it's already taken
    if (data.email && data.email !== user.email) {
      const existingUser = await User.findOne({ email: data.email })
      if (existingUser) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 400 }
        )
      }
      user.email = data.email
    }

    // Update fields
    if (data.name !== undefined) {
      user.name = data.name
    }
    if (data.role !== undefined) {
      user.role = data.role
    }
    if (data.status !== undefined) {
      user.status = data.status
    }

    await user.save()

    const updatedUser = await User.findById(user._id).select('-passwordHash').lean()

    return NextResponse.json({ user: updatedUser })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    logger.error('Error updating user:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update user' },
      { status: 500 }
    )
  }
}

// DELETE - Deactivate user (set status to INACTIVE)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check permissions - Only SUPER_ADMIN and ADMIN can deactivate users
    if (!hasRole(currentUser, ['SUPER_ADMIN', 'ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const user = await User.findById(params.id)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent deactivating yourself
    if (user._id.toString() === currentUser._id.toString()) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own account' },
        { status: 400 }
      )
    }

    // Set status to INACTIVE
    user.status = 'INACTIVE'
    await user.save()

    return NextResponse.json({ message: 'User deactivated successfully' })
  } catch (error: any) {
    logger.error('Error deactivating user:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to deactivate user' },
      { status: 500 }
    )
  }
}

