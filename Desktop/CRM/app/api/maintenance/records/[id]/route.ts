import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import MaintenanceRecord from '@/lib/models/MaintenanceRecord'
import { completeMaintenance } from '@/lib/services/maintenanceService'

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

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const record = await MaintenanceRecord.findById(params.id)
      .populate('vehicle', 'plateNumber brand model mileage')
      .populate('maintenanceSchedule', 'serviceType scheduleType')
      .populate('createdBy', 'name email')
      .lean()

    if (!record) {
      return NextResponse.json({ error: 'Maintenance record not found' }, { status: 404 })
    }

    return NextResponse.json({ record })
  } catch (error: any) {
    console.error('Error fetching maintenance record:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch maintenance record' },
      { status: 500 }
    )
  }
}

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

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await request.json()

    // If completing maintenance, use the service function
    if (body.status === 'COMPLETED' && body.complete) {
      const record = await completeMaintenance(
        params.id,
        body.cost,
        body.notes
      )
      return NextResponse.json({ record })
    }

    // Otherwise, update normally
    const updateData: any = {}
    if (body.status !== undefined) updateData.status = body.status
    if (body.description !== undefined) updateData.description = body.description
    if (body.cost !== undefined) updateData.cost = body.cost
    if (body.vendorName !== undefined) updateData.vendorName = body.vendorName
    if (body.startDate !== undefined)
      updateData.startDate = typeof body.startDate === 'string' ? new Date(body.startDate) : body.startDate
    if (body.completedDate !== undefined)
      updateData.completedDate =
        typeof body.completedDate === 'string' ? new Date(body.completedDate) : body.completedDate

    const record = await MaintenanceRecord.findByIdAndUpdate(params.id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate('vehicle', 'plateNumber brand model mileage')
      .populate('maintenanceSchedule', 'serviceType scheduleType')
      .populate('createdBy', 'name email')
      .lean()

    if (!record) {
      return NextResponse.json({ error: 'Maintenance record not found' }, { status: 404 })
    }

    return NextResponse.json({ record })
  } catch (error: any) {
    console.error('Error updating maintenance record:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update maintenance record' },
      { status: 500 }
    )
  }
}

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

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const record = await MaintenanceRecord.findByIdAndDelete(params.id)

    if (!record) {
      return NextResponse.json({ error: 'Maintenance record not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Maintenance record deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting maintenance record:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete maintenance record' },
      { status: 500 }
    )
  }
}

