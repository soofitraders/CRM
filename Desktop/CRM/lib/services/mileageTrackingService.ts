import connectDB from '@/lib/db'
import Vehicle from '@/lib/models/Vehicle'
import MileageHistory from '@/lib/models/MileageHistory'
import MaintenanceRecord from '@/lib/models/MaintenanceRecord'
import MaintenanceSchedule from '@/lib/models/MaintenanceSchedule'
import User from '@/lib/models/User'

const MILEAGE_CAP = 10000
const MILEAGE_WARNING_THRESHOLD = 9500
const MILEAGE_REMAINING_ALERT = 500

export interface MileageUpdateResult {
  success: boolean
  vehicle: any
  previousMileage: number
  newMileage: number
  warning?: {
    type: 'WARNING' | 'MAINTENANCE_REQUIRED'
    message: string
    remainingKm?: number
  }
  maintenanceScheduled?: boolean
}

/**
 * Update vehicle mileage and create history record
 */
export async function updateVehicleMileage(
  vehicleId: string,
  newMileage: number,
  userId: string,
  source: 'BOOKING' | 'INVOICE' | 'MANUAL' | 'MAINTENANCE',
  bookingId?: string,
  invoiceId?: string,
  notes?: string
): Promise<MileageUpdateResult> {
  await connectDB()

  const vehicle = await Vehicle.findById(vehicleId)
  if (!vehicle) {
    throw new Error('Vehicle not found')
  }

  const previousMileage = vehicle.mileage || 0

  // Validate mileage is not decreasing (unless manual override)
  if (source !== 'MANUAL' && newMileage < previousMileage) {
    throw new Error(
      `New mileage (${newMileage}) cannot be less than current mileage (${previousMileage})`
    )
  }

  // Create mileage history record
  await MileageHistory.create({
    vehicle: vehicleId,
    mileage: newMileage,
    recordedAt: new Date(),
    recordedBy: userId,
    source,
    booking: bookingId,
    invoice: invoiceId,
    notes,
  })

  // Update vehicle mileage
  vehicle.mileage = newMileage
  vehicle.lastUpdatedMileage = new Date()
  await vehicle.save()

  const result: MileageUpdateResult = {
    success: true,
    vehicle: vehicle.toObject(),
    previousMileage,
    newMileage,
  }

  // Check for warnings and maintenance requirements
  if (newMileage >= MILEAGE_CAP) {
    // Vehicle reached 10,000 km - schedule maintenance
    result.warning = {
      type: 'MAINTENANCE_REQUIRED',
      message: `Vehicle has reached ${MILEAGE_CAP} km. Maintenance is required immediately.`,
    }

    // Auto-schedule maintenance if not already scheduled
    if (!vehicle.maintenanceScheduled) {
      await scheduleMaintenanceAtMileageCap(vehicleId, userId)
      result.maintenanceScheduled = true
    }
  } else if (newMileage >= MILEAGE_WARNING_THRESHOLD) {
    // Vehicle approaching 10,000 km - send warning
    const remainingKm = MILEAGE_CAP - newMileage
    result.warning = {
      type: 'WARNING',
      message: `Vehicle is approaching maintenance threshold. ${remainingKm} km remaining until ${MILEAGE_CAP} km.`,
      remainingKm,
    }

    // Send notification if not already sent
    await sendMileageWarningNotification(vehicleId, newMileage, remainingKm)
  }

  return result
}

/**
 * Schedule maintenance when vehicle reaches 10,000 km
 */
async function scheduleMaintenanceAtMileageCap(vehicleId: string, userId: string): Promise<void> {
  await connectDB()

  const vehicle = await Vehicle.findById(vehicleId)
  if (!vehicle) return

  // Update vehicle status to IN_MAINTENANCE
  vehicle.status = 'IN_MAINTENANCE'
  vehicle.maintenanceScheduled = true
  await vehicle.save()

  // Create maintenance record
  const maintenanceRecord = await MaintenanceRecord.create({
    vehicle: vehicleId,
    type: 'SERVICE',
    description: `Automatic maintenance scheduled - Vehicle reached ${MILEAGE_CAP} km mileage cap`,
    status: 'SCHEDULED',
    scheduledDate: new Date(),
    cost: 0, // To be updated when maintenance is completed
    mileageAtService: vehicle.mileage,
    createdBy: userId,
  })

  // Send notification to admins
  await sendMaintenanceRequiredNotification(vehicleId, vehicle.mileage, maintenanceRecord._id.toString())

  // Create maintenance schedule for next service (if needed)
  await MaintenanceSchedule.create({
    vehicle: vehicleId,
    maintenanceType: '10,000 km Service',
    scheduleType: 'MILEAGE',
    mileageInterval: MILEAGE_CAP,
    lastServiceMileage: vehicle.mileage,
    lastServiceDate: new Date(),
    nextServiceMileage: vehicle.mileage + MILEAGE_CAP,
    mileageReminderThreshold: MILEAGE_REMAINING_ALERT,
    isActive: true,
    createdBy: userId,
  })
}

/**
 * Send mileage warning notification (9,500 km)
 */
async function sendMileageWarningNotification(
  vehicleId: string,
  currentMileage: number,
  remainingKm: number
): Promise<void> {
  await connectDB()

  const vehicle = await Vehicle.findById(vehicleId).lean()
  if (!vehicle) return

  // Get admin and manager user IDs
  const admins = await User.find({
    role: { $in: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  })
    .select('_id')
    .lean()

  const adminIds = admins.map((admin) => admin._id.toString())

  if (adminIds.length > 0) {
    // Create notifications with email support
    const { createNotification } = await import('./notificationService')
    await createNotification({
      userId: adminIds,
      type: 'MILEAGE_WARNING',
      title: 'Vehicle Approaching Maintenance Threshold',
      message: `Vehicle ${(vehicle as any).plateNumber} (${(vehicle as any).brand} ${(vehicle as any).model}) is approaching maintenance threshold. Current mileage: ${currentMileage} km. ${remainingKm} km remaining until ${MILEAGE_CAP} km.`,
      data: {
        vehicleId,
        vehiclePlate: (vehicle as any).plateNumber,
        currentMileage,
        remainingKm,
        threshold: MILEAGE_WARNING_THRESHOLD,
      },
      sendEmail: true,
    })
  }
}

/**
 * Send maintenance required notification (10,000 km)
 */
async function sendMaintenanceRequiredNotification(
  vehicleId: string,
  currentMileage: number,
  maintenanceRecordId: string
): Promise<void> {
  await connectDB()

  const vehicle = await Vehicle.findById(vehicleId).lean()
  if (!vehicle) return

  // Get admin and manager user IDs
  const admins = await User.find({
    role: { $in: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
  })
    .select('_id')
    .lean()

  const adminIds = admins.map((admin) => admin._id.toString())

  if (adminIds.length > 0) {
    // Create notifications with email support
    const { createNotification } = await import('./notificationService')
    await createNotification({
      userId: adminIds,
      type: 'MAINTENANCE_REQUIRED',
      title: 'Maintenance Required - Vehicle Reached 10,000 km',
      message: `Vehicle ${(vehicle as any).plateNumber} (${(vehicle as any).brand} ${(vehicle as any).model}) has reached ${MILEAGE_CAP} km and requires immediate maintenance. Vehicle status has been set to IN_MAINTENANCE.`,
      data: {
        vehicleId,
        vehiclePlate: (vehicle as any).plateNumber,
        currentMileage,
        maintenanceRecordId,
      },
      sendEmail: true,
    })
  }
}

/**
 * Get mileage history for a vehicle
 */
export async function getMileageHistory(
  vehicleId: string,
  limit: number = 50
): Promise<any[]> {
  await connectDB()

  const history = await MileageHistory.find({ vehicle: vehicleId })
    .populate('recordedBy', 'name email')
    .populate('booking', 'startDateTime endDateTime')
    .populate('invoice', 'invoiceNumber issueDate')
    .sort({ recordedAt: -1 })
    .limit(limit)
    .lean()

  return history
}

/**
 * Check if mileage update is needed (3 days after booking completion)
 */
export async function checkPendingMileageUpdates(): Promise<any[]> {
  await connectDB()

  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

  // Find bookings that were completed more than 3 days ago but don't have mileage updated
  const Booking = (await import('@/lib/models/Booking')).default
  const bookings = await Booking.find({
    status: { $in: ['CHECKED_IN', 'COMPLETED'] },
    endDateTime: { $lte: threeDaysAgo },
    mileageAtBooking: { $exists: false },
  })
    .populate('vehicle', 'plateNumber brand model mileage')
    .populate('customer', 'user')
    .lean()

  return bookings
}

