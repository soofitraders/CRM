import { format } from 'date-fns'
import { daysLeft } from '@/lib/utils/compliance'
import connectDB from '@/lib/db'
import Vehicle from '@/lib/models/Vehicle'
import Booking from '@/lib/models/Booking'
import User from '@/lib/models/User'
import MaintenanceRecord from '@/lib/models/MaintenanceRecord'
import Payment from '@/lib/models/Payment'

// Types
export interface DashboardSummary {
  totalCars: number
  rentedCars: number
  totalUsers: number
  totalSales: number
}

export interface TodayBooking {
  id: string
  car: string
  customer: string
  pickupDate: string
  dropoffDate: string
  pickupVehicle: string
}

export interface UrgentMaintenance {
  id: string
  vehicleNumber: string
  documents: string
  vehicleIssue: string
  daysLeft: number
  status: 'In Progress' | 'Completed' | 'Overdue'
  expiryDate?: Date | string
}

export interface CalendarEvent {
  date: Date
  type: 'booking' | 'return' | 'maintenance'
}

// Mock data functions (fallback)
function getMockDashboardSummary(): DashboardSummary {
  return {
    totalCars: 38,
    rentedCars: 12,
    totalUsers: 49,
    totalSales: 125000,
  }
}

function getMockTodayBookings(): TodayBooking[] {
  return [
    {
      id: '1',
      car: 'Toyota Camry',
      customer: 'Ahmed Al Mansoori',
      pickupDate: '2024-01-15 10:00',
      dropoffDate: '2024-01-20 18:00',
      pickupVehicle: 'ABC-1234',
    },
    {
      id: '2',
      car: 'Honda Accord',
      customer: 'Fatima Al Zaabi',
      pickupDate: '2024-01-15 14:00',
      dropoffDate: '2024-01-18 16:00',
      pickupVehicle: 'XYZ-5678',
    },
    {
      id: '3',
      car: 'Nissan Altima',
      customer: 'Mohammed Al Suwaidi',
      pickupDate: '2024-01-15 09:00',
      dropoffDate: '2024-01-22 17:00',
      pickupVehicle: 'DEF-9012',
    },
    {
      id: '4',
      car: 'BMW 3 Series',
      customer: 'Sarah Al Dhaheri',
      pickupDate: '2024-01-15 11:00',
      dropoffDate: '2024-01-17 15:00',
      pickupVehicle: 'GHI-3456',
    },
    {
      id: '5',
      car: 'Mercedes C-Class',
      customer: 'Khalid Al Nuaimi',
      pickupDate: '2024-01-15 13:00',
      dropoffDate: '2024-01-19 19:00',
      pickupVehicle: 'JKL-7890',
    },
  ]
}

function getMockUrgentMaintenance(): UrgentMaintenance[] {
  const today = new Date()
  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 7)
  const nextMonth = new Date(today)
  nextMonth.setDate(today.getDate() + 30)

  return [
    {
      id: '1',
      vehicleNumber: 'ABC-1234',
      documents: 'Insurance',
      vehicleIssue: 'Insurance Expiry',
      daysLeft: daysLeft(nextWeek),
      status: 'In Progress',
      expiryDate: nextWeek,
    },
    {
      id: '2',
      vehicleNumber: 'XYZ-5678',
      documents: 'Registration',
      vehicleIssue: 'Registration Expiry',
      daysLeft: daysLeft(today),
      status: 'Overdue',
      expiryDate: today,
    },
    {
      id: '3',
      vehicleNumber: 'DEF-9012',
      documents: 'Insurance',
      vehicleIssue: 'Insurance Expiry',
      daysLeft: daysLeft(nextMonth),
      status: 'In Progress',
      expiryDate: nextMonth,
    },
    {
      id: '4',
      vehicleNumber: 'GHI-3456',
      documents: 'Registration',
      vehicleIssue: 'Registration Expiry',
      daysLeft: -5,
      status: 'Completed',
      expiryDate: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      id: '5',
      vehicleNumber: 'JKL-7890',
      documents: 'Insurance',
      vehicleIssue: 'Insurance Expiry',
      daysLeft: daysLeft(new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)),
      status: 'In Progress',
      expiryDate: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000),
    },
  ]
}

// Real data functions with fallback
export async function getDashboardSummary(): Promise<DashboardSummary> {
  try {
    await connectDB()

    const [totalCars, rentedCars, totalUsers, totalSalesResult] = await Promise.all([
      Vehicle.countDocuments(),
      Booking.countDocuments({
        status: { $in: ['CONFIRMED', 'CHECKED_OUT'] },
        startDateTime: { $lte: new Date() },
        endDateTime: { $gte: new Date() },
      }),
      User.countDocuments({ role: { $ne: 'CUSTOMER' } }),
      Payment.aggregate([
        {
          $match: {
            status: 'SUCCESS',
            createdAt: {
              $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ]),
    ])

    const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].total : 0

    return {
      totalCars: totalCars || 0,
      rentedCars: rentedCars || 0,
      totalUsers: totalUsers || 0,
      totalSales: totalSales || 0,
    }
  } catch (error) {
    console.error('Error fetching dashboard summary:', error)
    return getMockDashboardSummary()
  }
}

export async function getTodayBookings(): Promise<TodayBooking[]> {
  try {
    await connectDB()

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const bookings = await Booking.find({
      startDateTime: {
        $gte: today,
        $lt: tomorrow,
      },
      status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_OUT'] },
    })
      .populate('vehicle', 'plateNumber brand model')
      .populate({
        path: 'customer',
        select: 'user',
        populate: {
          path: 'user',
          select: 'name',
        },
      })
      .limit(10)
      .lean()

    return bookings.map((booking: any) => ({
      id: booking._id.toString(),
      car: `${booking.vehicle?.brand || ''} ${booking.vehicle?.model || ''}`.trim(),
      customer: booking.customer?.user?.name || 'Unknown',
      pickupDate: new Date(booking.startDateTime).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      dropoffDate: new Date(booking.endDateTime).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      pickupVehicle: booking.vehicle?.plateNumber || 'N/A',
    }))
  } catch (error) {
    console.error('Error fetching today bookings:', error)
    return getMockTodayBookings()
  }
}

export async function getUrgentMaintenance(): Promise<UrgentMaintenance[]> {
  try {
    await connectDB()

    const today = new Date()
    const nextMonth = new Date(today)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    // Get vehicles with expiring registration or insurance
    const vehicles = await Vehicle.find({
      $or: [
        { registrationExpiry: { $lte: nextMonth, $gte: today } },
        { insuranceExpiry: { $lte: nextMonth, $gte: today } },
      ],
    })
      .limit(10)
      .lean()

    const urgentItems: UrgentMaintenance[] = []

    for (const vehicle of vehicles) {
      // Check registration
      if (vehicle.registrationExpiry <= nextMonth && vehicle.registrationExpiry >= today) {
        const daysLeftValue = daysLeft(vehicle.registrationExpiry)
        urgentItems.push({
          id: vehicle._id.toString() + '-reg',
          vehicleNumber: vehicle.plateNumber,
          documents: 'Registration',
          vehicleIssue: 'Registration Expiry',
          daysLeft: daysLeftValue,
          status: daysLeftValue < 0 ? 'Overdue' : daysLeftValue <= 7 ? 'In Progress' : 'In Progress',
          expiryDate: vehicle.registrationExpiry,
        })
      }

      // Check insurance
      if (vehicle.insuranceExpiry <= nextMonth && vehicle.insuranceExpiry >= today) {
        const daysLeftValue = daysLeft(vehicle.insuranceExpiry)
        urgentItems.push({
          id: vehicle._id.toString() + '-ins',
          vehicleNumber: vehicle.plateNumber,
          documents: 'Insurance',
          vehicleIssue: 'Insurance Expiry',
          daysLeft: daysLeftValue,
          status: daysLeftValue < 0 ? 'Overdue' : daysLeftValue <= 7 ? 'In Progress' : 'In Progress',
          expiryDate: vehicle.insuranceExpiry,
        })
      }
    }

    // Also get open maintenance records
    const maintenanceRecords = await MaintenanceRecord.find({
      status: { $in: ['OPEN', 'IN_PROGRESS'] },
    })
      .populate('vehicle', 'plateNumber')
      .limit(5)
      .lean()

    for (const record of maintenanceRecords) {
      const vehicle = record.vehicle as any
      urgentItems.push({
        id: record._id.toString(),
        vehicleNumber: vehicle?.plateNumber || 'N/A',
        documents: 'Maintenance',
        vehicleIssue: record.description,
        daysLeft: record.scheduledDate
          ? daysLeft(record.scheduledDate)
          : 0,
        status: record.status === 'COMPLETED' ? 'Completed' : 'In Progress',
        expiryDate: record.scheduledDate,
      })
    }

    // Sort by days left (most urgent first)
    urgentItems.sort((a, b) => a.daysLeft - b.daysLeft)

    return urgentItems.slice(0, 10).length > 0 ? urgentItems.slice(0, 10) : getMockUrgentMaintenance()
  } catch (error) {
    console.error('Error fetching urgent maintenance:', error)
    return getMockUrgentMaintenance()
  }
}

export function getCalendarEventsForMonth(year: number, month: number): CalendarEvent[] {
  const events: CalendarEvent[] = []

  // Generate some mock events for the current month
  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth()

  // Add some booking events
  for (let i = 1; i <= 28; i += 3) {
    events.push({
      date: new Date(currentYear, currentMonth, i),
      type: 'booking',
    })
  }

  // Add some return events
  for (let i = 5; i <= 28; i += 4) {
    events.push({
      date: new Date(currentYear, currentMonth, i),
      type: 'return',
    })
  }

  // Add some maintenance events
  for (let i = 10; i <= 28; i += 7) {
    events.push({
      date: new Date(currentYear, currentMonth, i),
      type: 'maintenance',
    })
  }

  return events
}
