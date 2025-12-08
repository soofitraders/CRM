import connectDB from '@/lib/db'
import MaintenanceSchedule from '@/lib/models/MaintenanceSchedule'
import MaintenanceRecord from '@/lib/models/MaintenanceRecord'
import Vehicle from '@/lib/models/Vehicle'
import { addDays, addWeeks, addMonths, addQuarters, addYears, differenceInHours, startOfDay, endOfDay, format } from 'date-fns'
import { logger } from '@/lib/utils/performance'

export type TimeInterval = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

/**
 * Calculate next service date based on time interval
 */
export function calculateNextServiceDate(
  lastServiceDate: Date,
  interval: TimeInterval,
  customDays?: number
): Date {
  if (customDays) {
    return addDays(lastServiceDate, customDays)
  }

  switch (interval) {
    case 'DAILY':
      return addDays(lastServiceDate, 1)
    case 'WEEKLY':
      return addWeeks(lastServiceDate, 1)
    case 'MONTHLY':
      return addMonths(lastServiceDate, 1)
    case 'QUARTERLY':
      return addQuarters(lastServiceDate, 1)
    case 'YEARLY':
      return addYears(lastServiceDate, 1)
    default:
      return addMonths(lastServiceDate, 1)
  }
}

/**
 * Check if maintenance is due based on mileage or time
 */
export async function checkMaintenanceDue(): Promise<{
  dueByMileage: any[]
  dueByTime: any[]
  upcomingReminders: any[]
}> {
  await connectDB()

  const today = startOfDay(new Date())
  const activeSchedules = await MaintenanceSchedule.find({ isActive: true })
    .populate('vehicle', 'plateNumber brand model mileage status')
    .lean()

  const dueByMileage: any[] = []
  const dueByTime: any[] = []
  const upcomingReminders: any[] = []

  for (const schedule of activeSchedules) {
    const vehicle = schedule.vehicle as any
    if (!vehicle) continue

    const currentMileage = vehicle.mileage || 0
    const lastMileage = schedule.lastServiceMileage || 0
    const mileageInterval = schedule.mileageInterval || 0

    // Check mileage-based due
    if (
      schedule.scheduleType === 'MILEAGE' ||
      schedule.scheduleType === 'BOTH'
    ) {
      if (mileageInterval > 0) {
        const nextMileage = (schedule.nextServiceMileage || lastMileage + mileageInterval)
        const remainingKm = nextMileage - currentMileage
        
        if (currentMileage >= nextMileage) {
          dueByMileage.push({ schedule, vehicle, reason: 'mileage' })
        } else if (
          schedule.reminderMileageBefore &&
          currentMileage >= nextMileage - schedule.reminderMileageBefore
        ) {
          upcomingReminders.push({
            schedule,
            vehicle,
            reason: 'mileage',
            remainingKm,
            nextMileage,
            currentMileage,
          })
        }
      }
    }

    // Check time-based due
    if (
      schedule.scheduleType === 'TIME' ||
      schedule.scheduleType === 'BOTH'
    ) {
      const lastServiceDate = schedule.lastServiceDate || schedule.createdAt
      const nextServiceDate = schedule.nextServiceDate || calculateNextServiceDate(
        new Date(lastServiceDate),
        schedule.timeInterval!,
        schedule.timeIntervalDays
      )

      if (new Date(nextServiceDate) <= today) {
        dueByTime.push({ schedule, vehicle, reason: 'time' })
      } else if (schedule.reminderDaysBefore) {
        const reminderDate = addDays(new Date(nextServiceDate), -schedule.reminderDaysBefore)
        if (reminderDate <= today && today < new Date(nextServiceDate)) {
          const daysUntil = Math.ceil(
            (new Date(nextServiceDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          )
          upcomingReminders.push({
            schedule,
            vehicle,
            reason: 'time',
            daysUntil,
          })
        }
      }
    }
  }

  return { dueByMileage, dueByTime, upcomingReminders }
}

/**
 * Check maintenance schedules for a specific vehicle and send notifications/create records
 */
export async function checkVehicleMaintenanceSchedule(vehicleId: string): Promise<{
  notificationsSent: number
  recordsCreated: number
}> {
  await connectDB()

  const Vehicle = (await import('@/lib/models/Vehicle')).default
  const Notification = (await import('@/lib/models/Notification')).default
  const User = (await import('@/lib/models/User')).default

  const vehicle = await Vehicle.findById(vehicleId).lean()
  if (!vehicle) {
    throw new Error('Vehicle not found')
  }

  const currentMileage = (vehicle as any).mileage || 0
  const activeSchedules = await MaintenanceSchedule.find({
    vehicle: vehicleId,
    isActive: true,
  }).lean()

  let notificationsSent = 0
  let recordsCreated = 0

  // Get admin and manager users for notifications
  const admins = await User.find({
    role: { $in: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'FINANCE'] },
  }).lean()

  for (const schedule of activeSchedules) {
    const mileageInterval = schedule.mileageInterval || 0
    const lastMileage = schedule.lastServiceMileage || 0
    const nextMileage = schedule.nextServiceMileage || (lastMileage + mileageInterval)
    const reminderMileageBefore = schedule.reminderMileageBefore || 500

    // Check mileage-based maintenance
    if (
      (schedule.scheduleType === 'MILEAGE' || schedule.scheduleType === 'BOTH') &&
      mileageInterval > 0
    ) {
      const remainingKm = nextMileage - currentMileage
      const reminderThreshold = nextMileage - reminderMileageBefore

      // If maintenance is due (reached or exceeded limit)
      if (currentMileage >= nextMileage) {
        // Check if maintenance record already exists for this schedule
        const existingRecord = await MaintenanceRecord.findOne({
          maintenanceSchedule: schedule._id,
          status: { $in: ['OPEN', 'IN_PROGRESS'] },
        }).lean()

        if (!existingRecord) {
          // Automatically create maintenance record
          try {
            const systemUser = await User.findOne({ role: 'SUPER_ADMIN' }).lean()
            const userId = systemUser?._id?.toString() || admins[0]?._id?.toString()
            
            if (userId) {
              await createMaintenanceFromSchedule(
                schedule._id.toString(),
                userId,
                schedule.estimatedCost,
                undefined,
                `Automatically created - Vehicle reached ${currentMileage} km (scheduled at ${nextMileage} km)`
              )
              recordsCreated++

              // Send notification that maintenance record was created
              const notifications = admins.map((admin) => ({
                user: admin._id,
                type: 'MAINTENANCE_REQUIRED' as const,
                title: 'Maintenance Record Created Automatically',
                message: `Vehicle ${(vehicle as any).plateNumber} (${(vehicle as any).brand} ${(vehicle as any).model}) has reached ${currentMileage} km. Maintenance record has been automatically created from schedule "${schedule.serviceType}".`,
                data: {
                  vehicleId,
                  vehiclePlate: (vehicle as any).plateNumber,
                  scheduleId: schedule._id.toString(),
                  currentMileage,
                  nextMileage,
                },
                read: false,
              }))

              await Notification.insertMany(notifications)
              notificationsSent += notifications.length
            }
          } catch (error: any) {
            logger.error('Error creating automatic maintenance record:', error)
          }
        }
      }
      // If approaching maintenance (within reminder threshold)
      else if (currentMileage >= reminderThreshold && currentMileage < nextMileage) {
        // Check if notification was already sent (avoid duplicates)
        const recentNotification = await Notification.findOne({
          type: 'MAINTENANCE_REQUIRED',
          'data.scheduleId': schedule._id.toString(),
          'data.vehicleId': vehicleId,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Within last 24 hours
        }).lean()

        if (!recentNotification) {
          // Send reminder notification
          const notifications = admins.map((admin) => ({
            user: admin._id,
            type: 'MAINTENANCE_REQUIRED' as const,
            title: 'Maintenance Reminder - Vehicle Approaching Service Limit',
            message: `Vehicle ${(vehicle as any).plateNumber} (${(vehicle as any).brand} ${(vehicle as any).model}) is approaching maintenance. Current: ${currentMileage} km, Next service: ${nextMileage} km (${remainingKm} km remaining).`,
            data: {
              vehicleId,
              vehiclePlate: (vehicle as any).plateNumber,
              scheduleId: schedule._id.toString(),
              currentMileage,
              nextMileage,
              remainingKm,
              reminderThreshold,
            },
            read: false,
          }))

          await Notification.insertMany(notifications)
          notificationsSent += notifications.length
        }
      }
    }

    // Check time-based maintenance
    if (schedule.scheduleType === 'TIME' || schedule.scheduleType === 'BOTH') {
      const lastServiceDate = schedule.lastServiceDate || schedule.createdAt
      const nextServiceDate = schedule.nextServiceDate || calculateNextServiceDate(
        new Date(lastServiceDate),
        schedule.timeInterval!,
        schedule.timeIntervalDays
      )
      const today = startOfDay(new Date())
      const reminderDaysBefore = schedule.reminderDaysBefore || 7
      const reminderDate = addDays(new Date(nextServiceDate), -reminderDaysBefore)

      // If maintenance is due
      if (new Date(nextServiceDate) <= today) {
        // Check if maintenance record already exists
        const existingRecord = await MaintenanceRecord.findOne({
          maintenanceSchedule: schedule._id,
          status: { $in: ['OPEN', 'IN_PROGRESS'] },
        }).lean()

        if (!existingRecord) {
          // Automatically create maintenance record
          try {
            const systemUser = await User.findOne({ role: 'SUPER_ADMIN' }).lean()
            const userId = systemUser?._id?.toString() || admins[0]?._id?.toString()
            
            if (userId) {
              await createMaintenanceFromSchedule(
                schedule._id.toString(),
                userId,
                schedule.estimatedCost,
                undefined,
                `Automatically created - Scheduled maintenance due on ${format(new Date(nextServiceDate), 'MMM dd, yyyy')}`
              )
              recordsCreated++

              // Send notification
              const notifications = admins.map((admin) => ({
                user: admin._id,
                type: 'MAINTENANCE_REQUIRED' as const,
                title: 'Maintenance Record Created Automatically',
                message: `Vehicle ${(vehicle as any).plateNumber} (${(vehicle as any).brand} ${(vehicle as any).model}) maintenance is due. Maintenance record has been automatically created from schedule "${schedule.serviceType}".`,
                data: {
                  vehicleId,
                  vehiclePlate: (vehicle as any).plateNumber,
                  scheduleId: schedule._id.toString(),
                  nextServiceDate,
                },
                read: false,
              }))

              await Notification.insertMany(notifications)
              notificationsSent += notifications.length
            }
          } catch (error: any) {
            logger.error('Error creating automatic maintenance record:', error)
          }
        }
      }
      // If approaching maintenance (within reminder days)
      else if (reminderDate <= today && today < new Date(nextServiceDate)) {
        const daysUntil = Math.ceil(
          (new Date(nextServiceDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        )

        // Check if notification was already sent
        const recentNotification = await Notification.findOne({
          type: 'MAINTENANCE_REQUIRED',
          'data.scheduleId': schedule._id.toString(),
          'data.vehicleId': vehicleId,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        }).lean()

        if (!recentNotification) {
          // Send reminder notification
          const notifications = admins.map((admin) => ({
            user: admin._id,
            type: 'MAINTENANCE_REQUIRED' as const,
            title: 'Maintenance Reminder - Service Due Soon',
            message: `Vehicle ${(vehicle as any).plateNumber} (${(vehicle as any).brand} ${(vehicle as any).model}) maintenance is due in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}. Next service: ${format(new Date(nextServiceDate), 'MMM dd, yyyy')}.`,
            data: {
              vehicleId,
              vehiclePlate: (vehicle as any).plateNumber,
              scheduleId: schedule._id.toString(),
              nextServiceDate,
              daysUntil,
            },
            read: false,
          }))

          await Notification.insertMany(notifications)
          notificationsSent += notifications.length
        }
      }
    }
  }

  return { notificationsSent, recordsCreated }
}

/**
 * Create maintenance record from schedule
 */
export async function createMaintenanceFromSchedule(
  scheduleId: string,
  userId: string,
  actualCost?: number,
  vendorName?: string,
  notes?: string
): Promise<any> {
  await connectDB()

  const schedule = await MaintenanceSchedule.findById(scheduleId)
    .populate('vehicle')
    .lean()

  if (!schedule) {
    throw new Error('Maintenance schedule not found')
  }

  const vehicle = schedule.vehicle as any
  const now = new Date()

  // Create maintenance record
  const maintenanceRecord = await MaintenanceRecord.create({
    vehicle: vehicle._id,
    maintenanceSchedule: scheduleId,
    type: 'SERVICE',
    serviceType: schedule.serviceType,
    description: `${schedule.serviceType} - Scheduled maintenance`,
    status: 'IN_PROGRESS',
    scheduledDate: schedule.nextServiceDate || now,
    startDate: now,
    cost: actualCost || schedule.estimatedCost || 0,
    vendorName,
    mileageAtService: vehicle.mileage || 0,
    createdBy: userId,
  })

  // Update vehicle status to IN_MAINTENANCE
  await Vehicle.findByIdAndUpdate(vehicle._id, {
    status: 'IN_MAINTENANCE',
  })

  // Update schedule
  const lastServiceDate = now
  const lastServiceMileage = vehicle.mileage || 0

  let nextServiceDate: Date | undefined
  let nextServiceMileage: number | undefined

  if (schedule.scheduleType === 'TIME' || schedule.scheduleType === 'BOTH') {
    nextServiceDate = calculateNextServiceDate(
      lastServiceDate,
      schedule.timeInterval!,
      schedule.timeIntervalDays
    )
  }

  if (schedule.scheduleType === 'MILEAGE' || schedule.scheduleType === 'BOTH') {
    nextServiceMileage = lastServiceMileage + (schedule.mileageInterval || 0)
  }

  await MaintenanceSchedule.findByIdAndUpdate(scheduleId, {
    lastServiceDate,
    lastServiceMileage,
    nextServiceDate,
    nextServiceMileage,
  })

  return maintenanceRecord
}

/**
 * Complete maintenance and calculate downtime
 */
export async function completeMaintenance(
  maintenanceId: string,
  actualCost?: number,
  notes?: string
): Promise<any> {
  await connectDB()

  const maintenance = await MaintenanceRecord.findById(maintenanceId)
    .populate('vehicle', 'currentBranch')
    .populate('createdBy')
    .lean()
  
  if (!maintenance) {
    throw new Error('Maintenance record not found')
  }

  const completedDate = new Date()
  const startDate = maintenance.startDate || maintenance.scheduledDate || maintenance.createdAt
  const downtimeHours = differenceInHours(completedDate, new Date(startDate))

  // Use actualCost if provided, otherwise use existing cost
  const finalCost = actualCost !== undefined ? actualCost : (maintenance.cost || 0)

  // Update maintenance record
  const updated = await MaintenanceRecord.findByIdAndUpdate(
    maintenanceId,
    {
      status: 'COMPLETED',
      completedDate,
      downtimeHours,
      ...(actualCost !== undefined && { cost: actualCost }),
      ...(notes && { description: `${maintenance.description}\n${notes}` }),
    },
    { new: true }
  )

  // Update vehicle status back to AVAILABLE
  await Vehicle.findByIdAndUpdate(maintenance.vehicle, {
    status: 'AVAILABLE',
  })

  // Create or update expense record if cost > 0
  if (finalCost > 0) {
    try {
      const { default: Expense } = await import('@/lib/models/Expense')
      const { default: ExpenseCategory } = await import('@/lib/models/ExpenseCategory')
      
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

      const vehicle = maintenance.vehicle as any
      const createdBy = maintenance.createdBy as any

      // Check if expense already exists for this maintenance record
      const existingExpense = await Expense.findOne({ 
        maintenanceRecord: maintenanceId,
        isDeleted: false 
      }).lean()

      if (existingExpense) {
        // Update existing expense with final cost and completion date
        await Expense.findByIdAndUpdate(existingExpense._id, {
          amount: finalCost,
          dateIncurred: completedDate,
        })
      } else if (maintenanceCategory) {
        // Create new expense linked to maintenance record
        await Expense.create({
          category: maintenanceCategory._id,
          description: `Maintenance - ${vehicle?.plateNumber || 'Vehicle'} - ${maintenance.description}`,
          amount: finalCost,
          currency: 'AED',
          dateIncurred: completedDate,
          branchId: vehicle?.currentBranch,
          createdBy: createdBy?._id || maintenance.createdBy,
          maintenanceRecord: maintenanceId,
        })
      }
    } catch (expenseError: any) {
      // Log error but don't fail maintenance completion
      logger.error('Error creating/updating expense for maintenance:', expenseError)
    }
  }

  return updated
}

/**
 * Get maintenance history for a vehicle
 */
export async function getMaintenanceHistory(
  vehicleId: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<any[]> {
  await connectDB()

  const filter: any = { vehicle: vehicleId }

  if (dateFrom && dateTo) {
    filter.completedDate = {
      $gte: startOfDay(dateFrom),
      $lte: endOfDay(dateTo),
    }
  }

  const history = await MaintenanceRecord.find(filter)
    .populate('maintenanceSchedule', 'serviceType scheduleType')
    .populate('createdBy', 'name email')
    .sort({ completedDate: -1, createdAt: -1 })
    .lean()

  return history
}

/**
 * Get maintenance cost report
 */
export async function getMaintenanceCostReport(
  dateFrom?: Date,
  dateTo?: Date,
  vehicleId?: string
): Promise<{
  totalCost: number
  byVehicle: Array<{
    vehicleId: string
    plateNumber: string
    brand: string
    model: string
    totalCost: number
    maintenanceCount: number
    averageCost: number
  }>
  byType: Array<{
    type: string
    totalCost: number
    count: number
  }>
}> {
  await connectDB()

  const filter: any = {
    status: 'COMPLETED',
  }

  if (dateFrom && dateTo) {
    filter.completedDate = {
      $gte: startOfDay(dateFrom),
      $lte: endOfDay(dateTo),
    }
  }

  if (vehicleId) {
    filter.vehicle = vehicleId
  }

  const maintenanceRecords = await MaintenanceRecord.find(filter)
    .populate('vehicle', 'plateNumber brand model')
    .lean()

  // Calculate totals
  const totalCost = maintenanceRecords.reduce((sum, record: any) => sum + (record.cost || 0), 0)

  // Group by vehicle
  const vehicleMap = new Map<string, any>()
  maintenanceRecords.forEach((record: any) => {
    const vehicle = record.vehicle as any
    if (!vehicle) return

    const vid = String(vehicle._id)
    if (!vehicleMap.has(vid)) {
      vehicleMap.set(vid, {
        vehicleId: vid,
        plateNumber: vehicle.plateNumber,
        brand: vehicle.brand,
        model: vehicle.model,
        totalCost: 0,
        maintenanceCount: 0,
      })
    }

    const vehicleData = vehicleMap.get(vid)!
    vehicleData.totalCost += record.cost || 0
    vehicleData.maintenanceCount += 1
  })

  const byVehicle = Array.from(vehicleMap.values()).map((v) => ({
    ...v,
    averageCost: v.maintenanceCount > 0 ? v.totalCost / v.maintenanceCount : 0,
  }))

  // Group by type
  const typeMap = new Map<string, { type: string; totalCost: number; count: number }>()
  maintenanceRecords.forEach((record: any) => {
    const type = record.serviceType || record.type || 'UNKNOWN'
    if (!typeMap.has(type)) {
      typeMap.set(type, { type, totalCost: 0, count: 0 })
    }

    const typeData = typeMap.get(type)!
    typeData.totalCost += record.cost || 0
    typeData.count += 1
  })

  const byType = Array.from(typeMap.values())

  return {
    totalCost,
    byVehicle: byVehicle.sort((a, b) => b.totalCost - a.totalCost),
    byType: byType.sort((a, b) => b.totalCost - a.totalCost),
  }
}

/**
 * Get downtime report
 */
export async function getDowntimeReport(
  dateFrom?: Date,
  dateTo?: Date,
  vehicleId?: string
): Promise<{
  totalDowntimeHours: number
  totalLostRevenue: number
  byVehicle: Array<{
    vehicleId: string
    plateNumber: string
    brand: string
    model: string
    downtimeHours: number
    maintenanceCount: number
    lostRevenue: number
    dailyRate: number
  }>
}> {
  await connectDB()

  const filter: any = {
    status: 'COMPLETED',
    downtimeHours: { $exists: true, $gt: 0 },
  }

  if (dateFrom && dateTo) {
    filter.completedDate = {
      $gte: startOfDay(dateFrom),
      $lte: endOfDay(dateTo),
    }
  }

  if (vehicleId) {
    filter.vehicle = vehicleId
  }

  const maintenanceRecords = await MaintenanceRecord.find(filter)
    .populate('vehicle', 'plateNumber brand model dailyRate')
    .lean()

  // Calculate totals
  const totalDowntimeHours = maintenanceRecords.reduce(
    (sum, record: any) => sum + (record.downtimeHours || 0),
    0
  )

  // Group by vehicle and calculate lost revenue
  const vehicleMap = new Map<string, any>()
  let totalLostRevenue = 0

  maintenanceRecords.forEach((record: any) => {
    const vehicle = record.vehicle as any
    if (!vehicle) return

    const vid = String(vehicle._id)
    if (!vehicleMap.has(vid)) {
      vehicleMap.set(vid, {
        vehicleId: vid,
        plateNumber: vehicle.plateNumber,
        brand: vehicle.brand,
        model: vehicle.model,
        dailyRate: vehicle.dailyRate || 0,
        downtimeHours: 0,
        maintenanceCount: 0,
        lostRevenue: 0,
      })
    }

    const vehicleData = vehicleMap.get(vid)!
    const downtimeHours = record.downtimeHours || 0
    const downtimeDays = downtimeHours / 24
    const lostRevenue = downtimeDays * vehicleData.dailyRate

    vehicleData.downtimeHours += downtimeHours
    vehicleData.maintenanceCount += 1
    vehicleData.lostRevenue += lostRevenue
    totalLostRevenue += lostRevenue
  })

  const byVehicle = Array.from(vehicleMap.values()).sort(
    (a, b) => b.downtimeHours - a.downtimeHours
  )

  return {
    totalDowntimeHours,
    totalLostRevenue,
    byVehicle,
  }
}

