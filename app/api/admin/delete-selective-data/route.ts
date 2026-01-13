export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getCurrentUser, isSuperAdmin } from '@/lib/auth'
import User from '@/lib/models/User'
import Booking from '@/lib/models/Booking'
import Payment from '@/lib/models/Payment'
import Invoice from '@/lib/models/Invoice'
import Expense from '@/lib/models/Expense'
import MaintenanceRecord from '@/lib/models/MaintenanceRecord'
import ActivityLog from '@/lib/models/ActivityLog'
import AuditLog from '@/lib/models/AuditLog'
import { logger } from '@/lib/utils/performance'
import { invalidateDashboardCache, invalidateFinancialCache, invalidateBookingCache } from '@/lib/cache/cacheUtils'
import { z } from 'zod'

const deleteDataSchema = z.object({
  dataTypes: z.array(z.enum([
    'sales',      // Invoices + Payments (sales data)
    'invoices',   // Invoices only
    'payments',   // Payments only
    'bookings',   // Bookings
    'expenses',   // Expenses
    'maintenance', // Maintenance records
  ])),
})

/**
 * POST - Delete selective data from database
 * Only accessible to SUPER_ADMIN
 */
export async function POST(request: NextRequest) {
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

    // Only SUPER_ADMIN can delete selective data
    if (!isSuperAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden. Only SUPER_ADMIN can perform this action.' }, { status: 403 })
    }

    const body = await request.json()
    const { dataTypes } = deleteDataSchema.parse(body)

    logger.log('🗑️ Starting selective data deletion by SUPER_ADMIN:', user.email, 'Types:', dataTypes)

    const deleted: Record<string, number> = {}

    // Process each data type
    for (const dataType of dataTypes) {
      switch (dataType) {
        case 'sales':
          // Delete all invoices (PAID, ISSUED, DRAFT) - these contribute to sales
          const invoicesDeleted = await Invoice.deleteMany({})
          deleted.invoices = invoicesDeleted.deletedCount

          // Delete all payments (SUCCESS, PENDING, FAILED, REFUNDED) - these contribute to sales
          const paymentsDeleted = await Payment.deleteMany({})
          deleted.payments = paymentsDeleted.deletedCount
          break

        case 'invoices':
          const invoicesOnlyDeleted = await Invoice.deleteMany({})
          deleted.invoices = (deleted.invoices || 0) + invoicesOnlyDeleted.deletedCount
          break

        case 'payments':
          const paymentsOnlyDeleted = await Payment.deleteMany({})
          deleted.payments = (deleted.payments || 0) + paymentsOnlyDeleted.deletedCount
          break

        case 'bookings':
          const bookingsDeleted = await Booking.deleteMany({})
          deleted.bookings = bookingsDeleted.deletedCount
          break

        case 'expenses':
          const expensesDeleted = await Expense.deleteMany({})
          deleted.expenses = expensesDeleted.deletedCount
          break

        case 'maintenance':
          const maintenanceDeleted = await MaintenanceRecord.deleteMany({})
          deleted.maintenance = maintenanceDeleted.deletedCount
          break
      }
    }

    // Log activity and audit
    try {
      await ActivityLog.create({
        user: user._id,
        activityType: 'OTHER',
        module: 'ADMIN',
        action: 'DELETE_SELECTIVE_DATA',
        description: `Deleted selective data: ${dataTypes.join(', ')}`,
        metadata: {
          dataTypes,
          deleted,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })

      await AuditLog.create({
        user: user._id,
        auditType: 'SENSITIVE_DATA_ACCESS',
        severity: 'CRITICAL',
        title: 'Selective Data Deletion',
        description: `Deleted selective data: ${dataTypes.join(', ')}`,
        metadata: {
          dataTypes,
          deleted,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      })
    } catch (logError) {
      logger.error('Error logging activity/audit:', logError)
      // Don't fail the request if logging fails
    }

    // Invalidate relevant caches
    invalidateDashboardCache()
    invalidateFinancialCache()
    if (dataTypes.includes('bookings') || dataTypes.includes('sales')) {
      invalidateBookingCache()
    }

    logger.log('✅ Selective data deletion completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Selected data deleted successfully',
      deleted,
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    logger.error('Error deleting selective data:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete selective data' },
      { status: 500 }
    )
  }
}
