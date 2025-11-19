import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import Vehicle from '@/lib/models/Vehicle'
import { updateVehicleSchema } from '@/lib/validation/vehicle'
import { hasRole, getCurrentUser } from '@/lib/auth'

// GET - Get single vehicle
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

    const vehicle = await Vehicle.findById(params.id)
      .populate('investor', 'user')
      .lean()

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    return NextResponse.json({ vehicle })
  } catch (error: any) {
    console.error('Error fetching vehicle:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch vehicle' },
      { status: 500 }
    )
  }
}

// PATCH - Update vehicle
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

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check permissions
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const vehicle = await Vehicle.findById(params.id)
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    const body = await request.json()
    const data = updateVehicleSchema.parse(body)

    // Update fields
    if (data.plateNumber !== undefined) vehicle.plateNumber = data.plateNumber
    if (data.vin !== undefined) vehicle.vin = data.vin
    if (data.brand !== undefined) vehicle.brand = data.brand
    if (data.model !== undefined) vehicle.model = data.model
    if (data.year !== undefined) vehicle.year = data.year
    if (data.category !== undefined) vehicle.category = data.category
    if (data.ownershipType !== undefined) vehicle.ownershipType = data.ownershipType
    if (data.investor !== undefined) vehicle.investor = data.investor
    if (data.status !== undefined) vehicle.status = data.status
    if (data.mileage !== undefined) vehicle.mileage = data.mileage
    if (data.fuelType !== undefined) vehicle.fuelType = data.fuelType
    if (data.transmission !== undefined) vehicle.transmission = data.transmission
    if (data.registrationExpiry !== undefined) {
      vehicle.registrationExpiry = new Date(data.registrationExpiry)
    }
    if (data.insuranceExpiry !== undefined) {
      vehicle.insuranceExpiry = new Date(data.insuranceExpiry)
    }
    if (data.dailyRate !== undefined) vehicle.dailyRate = data.dailyRate
    if (data.weeklyRate !== undefined) vehicle.weeklyRate = data.weeklyRate
    if (data.monthlyRate !== undefined) vehicle.monthlyRate = data.monthlyRate
    if (data.currentBranch !== undefined) vehicle.currentBranch = data.currentBranch

    // Validate investor if ownership type is INVESTOR
    if (vehicle.ownershipType === 'INVESTOR' && !vehicle.investor) {
      return NextResponse.json(
        { error: 'Investor is required for investor-owned vehicles' },
        { status: 400 }
      )
    }

    await vehicle.save()

    const updatedVehicle = await Vehicle.findById(vehicle._id)
      .populate('investor', 'user')
      .lean()

    return NextResponse.json({ vehicle: updatedVehicle })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0]
      return NextResponse.json(
        { error: `${field} already exists` },
        { status: 400 }
      )
    }
    console.error('Error updating vehicle:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update vehicle' },
      { status: 500 }
    )
  }
}

// DELETE - Mark vehicle as INACTIVE (soft delete)
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

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check permissions
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const vehicle = await Vehicle.findById(params.id)
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    // Soft delete by setting status to INACTIVE
    vehicle.status = 'INACTIVE'
    await vehicle.save()

    return NextResponse.json({ message: 'Vehicle marked as inactive successfully' })
  } catch (error: any) {
    console.error('Error deleting vehicle:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete vehicle' },
      { status: 500 }
    )
  }
}

