export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getCurrentUser, isSuperAdmin } from '@/lib/auth'
import User from '@/lib/models/User'
import Vehicle from '@/lib/models/Vehicle'
import CustomerProfile from '@/lib/models/CustomerProfile'
import InvestorProfile from '@/lib/models/InvestorProfile'
import Booking from '@/lib/models/Booking'
import Payment from '@/lib/models/Payment'
import Invoice from '@/lib/models/Invoice'
import MaintenanceRecord from '@/lib/models/MaintenanceRecord'
import MaintenanceSchedule from '@/lib/models/MaintenanceSchedule'
import FineOrPenalty from '@/lib/models/FineOrPenalty'
import Document from '@/lib/models/Document'
import Notification from '@/lib/models/Notification'
import ExportLog from '@/lib/models/ExportLog'
import ReportPreset from '@/lib/models/ReportPreset'
import Expense from '@/lib/models/Expense'
import SalaryRecord from '@/lib/models/SalaryRecord'
import InvestorPayout from '@/lib/models/InvestorPayout'
import DashboardWidget from '@/lib/models/DashboardWidget'
import ActivityLog from '@/lib/models/ActivityLog'
import AuditLog from '@/lib/models/AuditLog'
import Role from '@/lib/models/Role'
import Settings from '@/lib/models/Settings'
import Session from '@/lib/models/Session'
import SupportTicket from '@/lib/models/SupportTicket'
import MileageHistory from '@/lib/models/MileageHistory'
import RecurringExpense from '@/lib/models/RecurringExpense'
import { logger } from '@/lib/utils/performance'

/**
 * POST - Clear all database data except super admin user
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

    // Only SUPER_ADMIN can clear the database
    if (!isSuperAdmin(user)) {
      return NextResponse.json({ error: 'Forbidden. Only SUPER_ADMIN can perform this action.' }, { status: 403 })
    }

    // Find super admin user
    const superAdmin = await User.findOne({ role: 'SUPER_ADMIN' })
    
    if (!superAdmin) {
      return NextResponse.json({ error: 'Super admin user not found' }, { status: 404 })
    }

    const superAdminId = superAdmin._id

    logger.log('🗑️ Starting database cleanup by SUPER_ADMIN:', user.email)

    // Delete all users except super admin
    const usersDeleted = await User.deleteMany({ _id: { $ne: superAdminId } })

    // Delete all vehicles
    const vehiclesDeleted = await Vehicle.deleteMany({})

    // Delete all customer profiles
    const customersDeleted = await CustomerProfile.deleteMany({})

    // Delete all investor profiles
    const investorsDeleted = await InvestorProfile.deleteMany({})

    // Delete all bookings
    const bookingsDeleted = await Booking.deleteMany({})

    // Delete all payments
    const paymentsDeleted = await Payment.deleteMany({})

    // Delete all invoices
    const invoicesDeleted = await Invoice.deleteMany({})

    // Delete all maintenance records
    const maintenanceRecordsDeleted = await MaintenanceRecord.deleteMany({})

    // Delete all maintenance schedules
    const maintenanceSchedulesDeleted = await MaintenanceSchedule.deleteMany({})

    // Delete all fines/penalties
    const finesDeleted = await FineOrPenalty.deleteMany({})

    // Delete all documents
    const documentsDeleted = await Document.deleteMany({})

    // Delete all notifications
    const notificationsDeleted = await Notification.deleteMany({})

    // Delete all export logs
    const exportLogsDeleted = await ExportLog.deleteMany({})

    // Delete all report presets
    const reportPresetsDeleted = await ReportPreset.deleteMany({})

    // Delete all expenses
    const expensesDeleted = await Expense.deleteMany({})

    // Delete all salary records
    const salaryRecordsDeleted = await SalaryRecord.deleteMany({})

    // Delete all investor payouts
    const investorPayoutsDeleted = await InvestorPayout.deleteMany({})

    // Delete all dashboard widgets
    const dashboardWidgetsDeleted = await DashboardWidget.deleteMany({})

    // Delete all activity logs
    const activityLogsDeleted = await ActivityLog.deleteMany({})

    // Delete all audit logs
    const auditLogsDeleted = await AuditLog.deleteMany({})

    // Delete all roles (custom roles, not system roles)
    const rolesDeleted = await Role.deleteMany({})

    // Delete all settings
    const settingsDeleted = await Settings.deleteMany({})

    // Delete all sessions
    const sessionsDeleted = await Session.deleteMany({})

    // Delete all support tickets
    const supportTicketsDeleted = await SupportTicket.deleteMany({})

    // Delete all mileage history
    const mileageHistoryDeleted = await MileageHistory.deleteMany({})

    // Delete all recurring expenses
    const recurringExpensesDeleted = await RecurringExpense.deleteMany({})

    // Verify super admin still exists
    const verifySuperAdmin = await User.findById(superAdminId)
    if (!verifySuperAdmin) {
      logger.error('❌ ERROR: Super admin user was deleted!')
      return NextResponse.json({ error: 'Critical error: Super admin user was deleted' }, { status: 500 })
    }

    logger.log('✅ Database cleanup completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Database cleared successfully. Super admin user preserved.',
      deleted: {
        users: usersDeleted.deletedCount,
        vehicles: vehiclesDeleted.deletedCount,
        customers: customersDeleted.deletedCount,
        investors: investorsDeleted.deletedCount,
        bookings: bookingsDeleted.deletedCount,
        payments: paymentsDeleted.deletedCount,
        invoices: invoicesDeleted.deletedCount,
        maintenanceRecords: maintenanceRecordsDeleted.deletedCount,
        maintenanceSchedules: maintenanceSchedulesDeleted.deletedCount,
        fines: finesDeleted.deletedCount,
        documents: documentsDeleted.deletedCount,
        notifications: notificationsDeleted.deletedCount,
        exportLogs: exportLogsDeleted.deletedCount,
        reportPresets: reportPresetsDeleted.deletedCount,
        expenses: expensesDeleted.deletedCount,
        salaryRecords: salaryRecordsDeleted.deletedCount,
        investorPayouts: investorPayoutsDeleted.deletedCount,
        dashboardWidgets: dashboardWidgetsDeleted.deletedCount,
        activityLogs: activityLogsDeleted.deletedCount,
        auditLogs: auditLogsDeleted.deletedCount,
        roles: rolesDeleted.deletedCount,
        settings: settingsDeleted.deletedCount,
        sessions: sessionsDeleted.deletedCount,
        supportTickets: supportTicketsDeleted.deletedCount,
        mileageHistory: mileageHistoryDeleted.deletedCount,
        recurringExpenses: recurringExpensesDeleted.deletedCount,
      },
      superAdmin: {
        email: verifySuperAdmin.email,
        name: verifySuperAdmin.name,
        role: verifySuperAdmin.role,
      },
    })
  } catch (error: any) {
    logger.error('Error clearing database:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to clear database' },
      { status: 500 }
    )
  }
}

