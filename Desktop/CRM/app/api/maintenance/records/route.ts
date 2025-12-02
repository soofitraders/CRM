import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import MaintenanceRecord from '@/lib/models/MaintenanceRecord'
import { createMaintenanceFromSchedule, completeMaintenance } from '@/lib/services/maintenanceService'
import { z } from 'zod'

const createMaintenanceSchema = z.object({
  vehicle: z.string().min(1, 'Vehicle is required'),
  maintenanceSchedule: z.string().optional(),
  type: z.enum(['SERVICE', 'REPAIR', 'ACCIDENT', 'INSPECTION']),
  serviceType: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  scheduledDate: z.string().or(z.date()).optional(),
  cost: z.number().min(0).default(0),
  vendorName: z.string().optional(),
  mileageAtService: z.number().min(0).optional(),
})

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

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const vehicleId = searchParams.get('vehicleId')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const filter: any = {}
    if (vehicleId) filter.vehicle = vehicleId
    if (status) filter.status = status
    if (dateFrom && dateTo) {
      filter.completedDate = {
        $gte: new Date(dateFrom),
        $lte: new Date(dateTo),
      }
    }

    const records = await MaintenanceRecord.find(filter)
      .populate('vehicle', 'plateNumber brand model mileage')
      .populate('maintenanceSchedule', 'serviceType scheduleType')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json({ records })
  } catch (error: any) {
    console.error('Error fetching maintenance records:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch maintenance records' },
      { status: 500 }
    )
  }
}

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

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await request.json()

    // If creating from schedule, use the service function
    if (body.maintenanceSchedule && body.createFromSchedule) {
      const record = await createMaintenanceFromSchedule(
        body.maintenanceSchedule,
        body.cost,
        body.vendorName,
        body.notes,
        user._id.toString()
      )
      return NextResponse.json({ record }, { status: 201 })
    }

    // Otherwise, create manually
    const validationResult = createMaintenanceSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const data = validationResult.data

    const record = await MaintenanceRecord.create({
      vehicle: data.vehicle,
      maintenanceSchedule: data.maintenanceSchedule,
      type: data.type,
      serviceType: data.serviceType,
      description: data.description,
      scheduledDate: data.scheduledDate
        ? typeof data.scheduledDate === 'string'
          ? new Date(data.scheduledDate)
          : data.scheduledDate
        : new Date(),
      cost: data.cost || 0,
      vendorName: data.vendorName,
      mileageAtService: data.mileageAtService,
      status: 'OPEN',
      createdBy: user._id,
    })

    await record.populate('vehicle', 'plateNumber brand model mileage')
    await record.populate('maintenanceSchedule', 'serviceType scheduleType')
    await record.populate('createdBy', 'name email')

    return NextResponse.json({ record }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating maintenance record:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create maintenance record' },
      { status: 500 }
    )
  }
}

