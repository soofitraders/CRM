export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { checkVehicleMaintenanceSchedule } from '@/lib/services/maintenanceService'
import Vehicle from '@/lib/models/Vehicle'
import { logger } from '@/lib/utils/performance'

/**
 * API endpoint to check maintenance schedules for all vehicles
 * This should be called by a cron job or scheduled task (e.g., daily)
 * 
 * Usage:
 * - Manual: POST /api/maintenance/check-all (requires admin auth)
 * - Cron: POST /api/maintenance/check-all with API key header
 */
export async function POST(request: NextRequest) {
  try {
    // Check for API key or admin authentication
    const authHeader = request.headers.get('authorization')
    const apiKey = process.env.MAINTENANCE_CHECK_API_KEY

    // Allow processing if API key matches or user is admin
    if (apiKey && authHeader === `Bearer ${apiKey}`) {
      // Process with API key
    } else {
      // Check user authentication
      const session = await getServerSession(authOptions)
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const user = await getCurrentUser()
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'MANAGER'])) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    await connectDB()

    // Get all vehicles
    const vehicles = await Vehicle.find({ status: { $ne: 'RETIRED' } })
      .select('_id plateNumber')
      .lean()

    let totalNotificationsSent = 0
    let totalRecordsCreated = 0
    const errors: string[] = []

    // Check maintenance schedules for each vehicle
    for (const vehicle of vehicles) {
      try {
        const result = await checkVehicleMaintenanceSchedule(vehicle._id.toString())
        totalNotificationsSent += result.notificationsSent
        totalRecordsCreated += result.recordsCreated
      } catch (error: any) {
        const errorMsg = `Error checking vehicle ${vehicle.plateNumber}: ${error.message}`
        logger.error(errorMsg, error)
        errors.push(errorMsg)
      }
    }

    return NextResponse.json({
      success: true,
      vehiclesChecked: vehicles.length,
      notificationsSent: totalNotificationsSent,
      recordsCreated: totalRecordsCreated,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    logger.error('Error checking all vehicle maintenance schedules:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check maintenance schedules' },
      { status: 500 }
    )
  }
}

