export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import MaintenanceRecord from '@/lib/models/MaintenanceRecord'
import { createMaintenanceFromSchedule, completeMaintenance } from '@/lib/services/maintenanceService'
import { z } from 'zod'
import { logger } from '@/lib/utils/performance'

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

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'MANAGER'])) {
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
      // Filter by scheduledDate, completedDate, or createdAt
      // This ensures all records are included regardless of their status
      const dateFromObj = new Date(dateFrom)
      const dateToObj = new Date(dateTo)
      
      filter.$or = [
        { scheduledDate: { $gte: dateFromObj, $lte: dateToObj } },
        { completedDate: { $gte: dateFromObj, $lte: dateToObj } },
        { createdAt: { $gte: dateFromObj, $lte: dateToObj } },
      ]
    }

    const records = await MaintenanceRecord.find(filter)
      .populate('vehicle', 'plateNumber brand model mileage')
      .populate('maintenanceSchedule', 'serviceType scheduleType')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json({ records })
  } catch (error: any) {
    logger.error('Error fetching maintenance records:', error)
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

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'MANAGER'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await request.json()

    // If creating from schedule, use the service function
    if (body.maintenanceSchedule && body.createFromSchedule) {
      const record = await createMaintenanceFromSchedule(
        body.maintenanceSchedule,
        user._id.toString(),
        body.cost,
        body.vendorName,
        body.notes
      )
      return NextResponse.json({ record }, { status: 201 })
    }

    // Otherwise, create manually
    // Pre-process body to ensure numeric fields are numbers
    const processedBody = {
      ...body,
      cost: body.cost !== undefined && body.cost !== null && body.cost !== '' 
        ? (typeof body.cost === 'string' ? parseFloat(body.cost) : body.cost)
        : 0,
      mileageAtService: body.mileageAtService !== undefined && body.mileageAtService !== null && body.mileageAtService !== ''
        ? (typeof body.mileageAtService === 'string' ? parseFloat(body.mileageAtService) : body.mileageAtService)
        : undefined,
    }

    const validationResult = createMaintenanceSchema.safeParse(processedBody)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
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

    // Create expense record if cost > 0
    if (data.cost > 0) {
      try {
        const { default: Expense } = await import('@/lib/models/Expense')
        const { default: ExpenseCategory } = await import('@/lib/models/ExpenseCategory')
        const { default: Vehicle } = await import('@/lib/models/Vehicle')
        
        // Ensure default categories exist
        await ExpenseCategory.ensureDefaultCategories()
        
        // Find or create MAINTENANCE category
        let maintenanceCategory = await ExpenseCategory.findOne({ code: 'MAINTENANCE' }).lean()
        if (!maintenanceCategory) {
          await ExpenseCategory.create({
            code: 'MAINTENANCE',
            name: 'Maintenance',
            type: 'COGS',
            isActive: true,
          })
          maintenanceCategory = await ExpenseCategory.findOne({ code: 'MAINTENANCE' }).lean()
        }

        // Get vehicle details for branch
        const vehicle = await Vehicle.findById(data.vehicle).select('plateNumber currentBranch').lean()
        const scheduledDate = data.scheduledDate
          ? typeof data.scheduledDate === 'string'
            ? new Date(data.scheduledDate)
            : data.scheduledDate
          : new Date()

        // Create expense linked to maintenance record
        if (maintenanceCategory) {
          await Expense.create({
            category: maintenanceCategory._id,
            description: `Maintenance - ${vehicle?.plateNumber || 'Vehicle'} - ${data.description}`,
            amount: data.cost,
            currency: 'AED',
            dateIncurred: scheduledDate,
            branchId: vehicle?.currentBranch,
            createdBy: user._id,
            maintenanceRecord: record._id,
          })
        }
      } catch (expenseError: any) {
        // Log error but don't fail maintenance creation
        logger.error('Error creating expense for maintenance:', expenseError)
      }
    }

    await record.populate('vehicle', 'plateNumber brand model mileage')
    await record.populate('maintenanceSchedule', 'serviceType scheduleType')
    await record.populate('createdBy', 'name email')

    return NextResponse.json({ record }, { status: 201 })
  } catch (error: any) {
    logger.error('Error creating maintenance record:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create maintenance record' },
      { status: 500 }
    )
  }
}

