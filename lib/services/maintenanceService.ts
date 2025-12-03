import connectDB from '@/lib/db'
import MaintenanceSchedule from '@/lib/models/MaintenanceSchedule'
import MaintenanceRecord from '@/lib/models/MaintenanceRecord'
import Vehicle from '@/lib/models/Vehicle'
import { addDays, addWeeks, addMonths, addQuarters, addYears, differenceInHours, startOfDay, endOfDay } from 'date-fns'

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
            daysUntil: Math.ceil((nextMileage - currentMileage) / 100), // Rough estimate
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
  if (!maintenance) {
    throw new Error('Maintenance record not found')
  }

  const completedDate = new Date()
  const startDate = maintenance.startDate || maintenance.scheduledDate || maintenance.createdAt
  const downtimeHours = differenceInHours(completedDate, new Date(startDate))

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

