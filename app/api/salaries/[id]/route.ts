import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import SalaryRecord from '@/lib/models/SalaryRecord'
import { updateSalaryWithExpense, deleteSalaryWithExpense } from '@/lib/services/salaryExpenseSyncService'
import { salaryUpdateSchema } from '@/lib/validation/salary'
import { logger } from '@/lib/utils/performance'

// GET - Get single salary record
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

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const salary = await SalaryRecord.findOne({
      _id: params.id,
      isDeleted: false,
    })
      .populate('staffUser', 'name email role')
      .populate('expense')
      .populate('createdBy', 'name email')
      .lean()

    if (!salary) {
      return NextResponse.json({ error: 'Salary record not found' }, { status: 404 })
    }

    return NextResponse.json({ salary })
  } catch (error: any) {
    logger.error('Error fetching salary record:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch salary record' },
      { status: 500 }
    )
  }
}

// PATCH - Update salary record
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
    
    // Validate updates
    const validationResult = salaryUpdateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const updates = validationResult.data

    // Update salary with linked expense using sync service
    const salary = await updateSalaryWithExpense(params.id, updates, user)

    return NextResponse.json({ salary })
  } catch (error: any) {
    logger.error('Error updating salary record:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update salary record' },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete salary record
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

    // Delete salary with linked expense using sync service
    const result = await deleteSalaryWithExpense(params.id, user)

    return NextResponse.json(result)
  } catch (error: any) {
    logger.error('Error deleting salary record:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete salary record' },
      { status: 500 }
    )
  }
}

