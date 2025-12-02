import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import ExpenseCategory from '@/lib/models/ExpenseCategory'

// PATCH - Update expense category
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

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await request.json()
    const { name, code, type, isActive } = body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    // Code cannot be changed after creation (it's unique and used programmatically)
    if (code !== undefined) {
      return NextResponse.json(
        { error: 'Category code cannot be changed after creation' },
        { status: 400 }
      )
    }
    if (type !== undefined) updateData.type = type
    if (isActive !== undefined) updateData.isActive = isActive

    const category = await ExpenseCategory.findByIdAndUpdate(
      params.id,
      updateData,
      { new: true, runValidators: true }
    )

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json({ category })
  } catch (error: any) {
    console.error('Error updating expense category:', error)
    if (error.code === 11000) {
      return NextResponse.json({ error: 'Category name already exists' }, { status: 400 })
    }
    return NextResponse.json(
      { error: error.message || 'Failed to update expense category' },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete (deactivate) expense category
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

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const category = await ExpenseCategory.findByIdAndUpdate(
      params.id,
      { isActive: false },
      { new: true }
    )

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Category deactivated successfully' })
  } catch (error: any) {
    console.error('Error deactivating expense category:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to deactivate expense category' },
      { status: 500 }
    )
  }
}

