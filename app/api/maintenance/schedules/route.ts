import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import MaintenanceSchedule from '@/lib/models/MaintenanceSchedule'
import { calculateNextServiceDate } from '@/lib/services/maintenanceService'
import { z } from 'zod'
import { logger } from '@/lib/utils/performance'

const createScheduleSchema = z.object({
  vehicle: z.string().min(1, 'Vehicle is required'),
  serviceType: z.string().min(1, 'Service type is required'),
  scheduleType: z.enum(['MILEAGE', 'TIME', 'BOTH']),
  mileageInterval: z.number().min(0).optional(),
  timeInterval: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  timeIntervalDays: z.number().min(1).optional(),
  lastServiceMileage: z.number().min(0).optional(),
  lastServiceDate: z.string().or(z.date()).optional(),
  reminderDaysBefore: z.number().min(0).default(7),
  reminderMileageBefore: z.number().min(0).default(500),
  estimatedCost: z.number().min(0).optional(),
  notes: z.string().optional(),
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

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'MANAGER'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const vehicleId = searchParams.get('vehicleId')
    const isActive = searchParams.get('isActive')

    const filter: any = {}
    if (vehicleId) filter.vehicle = vehicleId
    if (isActive !== null) filter.isActive = isActive === 'true'

    const schedules = await MaintenanceSchedule.find(filter)
      .populate('vehicle', 'plateNumber brand model mileage status')
      .populate('createdBy', 'name email')
      .sort({ nextServiceDate: 1, nextServiceMileage: 1 })
      .lean()

    return NextResponse.json({ schedules })
  } catch (error: any) {
    logger.error('Error fetching maintenance schedules:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch maintenance schedules' },
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

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'MANAGER'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await request.json()
    const validationResult = createScheduleSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Calculate next service dates/mileage
    let nextServiceDate: Date | undefined
    let nextServiceMileage: number | undefined

    const Vehicle = (await import('@/lib/models/Vehicle')).default
    const vehicle = await Vehicle.findById(data.vehicle).lean()
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    const currentMileage = (vehicle as any).mileage || 0
    const lastServiceMileage = data.lastServiceMileage || currentMileage
    const lastServiceDate = data.lastServiceDate
      ? typeof data.lastServiceDate === 'string'
        ? new Date(data.lastServiceDate)
        : data.lastServiceDate
      : new Date()

    if (data.scheduleType === 'TIME' || data.scheduleType === 'BOTH') {
      if (data.timeInterval) {
        nextServiceDate = calculateNextServiceDate(
          lastServiceDate,
          data.timeInterval,
          data.timeIntervalDays
        )
      }
    }

    if (data.scheduleType === 'MILEAGE' || data.scheduleType === 'BOTH') {
      if (data.mileageInterval) {
        nextServiceMileage = lastServiceMileage + data.mileageInterval
      }
    }

    const schedule = await MaintenanceSchedule.create({
      vehicle: data.vehicle,
      serviceType: data.serviceType,
      scheduleType: data.scheduleType,
      mileageInterval: data.mileageInterval,
      timeInterval: data.timeInterval,
      timeIntervalDays: data.timeIntervalDays,
      lastServiceMileage,
      lastServiceDate,
      nextServiceMileage,
      nextServiceDate,
      reminderDaysBefore: data.reminderDaysBefore || 7,
      reminderMileageBefore: data.reminderMileageBefore || 500,
      estimatedCost: data.estimatedCost,
      notes: data.notes,
      isActive: true,
      createdBy: user._id,
    })

    await schedule.populate('vehicle', 'plateNumber brand model mileage status')
    await schedule.populate('createdBy', 'name email')

    return NextResponse.json({ schedule }, { status: 201 })
  } catch (error: any) {
    logger.error('Error creating maintenance schedule:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create maintenance schedule' },
      { status: 500 }
    )
  }
}

