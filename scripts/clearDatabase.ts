import { config } from 'dotenv'
import { resolve } from 'path'
import mongoose from 'mongoose'
import dns from 'dns'
import User from '../lib/models/User'

// Set DNS order to IPv4 first to avoid IPv6 timeout issues
dns.setDefaultResultOrder('ipv4first')
import Vehicle from '../lib/models/Vehicle'
import CustomerProfile from '../lib/models/CustomerProfile'
import InvestorProfile from '../lib/models/InvestorProfile'
import Booking from '../lib/models/Booking'
import Payment from '../lib/models/Payment'
import Invoice from '../lib/models/Invoice'
import MaintenanceRecord from '../lib/models/MaintenanceRecord'
import MaintenanceSchedule from '../lib/models/MaintenanceSchedule'
import FineOrPenalty from '../lib/models/FineOrPenalty'
import Document from '../lib/models/Document'
import Notification from '../lib/models/Notification'
import ExportLog from '../lib/models/ExportLog'
import ReportPreset from '../lib/models/ReportPreset'
import ExpenseCategory from '../lib/models/ExpenseCategory'
import Expense from '../lib/models/Expense'
import SalaryRecord from '../lib/models/SalaryRecord'
import InvestorPayout from '../lib/models/InvestorPayout'
import DashboardWidget from '../lib/models/DashboardWidget'
import ActivityLog from '../lib/models/ActivityLog'
import AuditLog from '../lib/models/AuditLog'
import Role from '../lib/models/Role'
import Settings from '../lib/models/Settings'
import Session from '../lib/models/Session'
import SupportTicket from '../lib/models/SupportTicket'
import MileageHistory from '../lib/models/MileageHistory'
import RecurringExpense from '../lib/models/RecurringExpense'

// Load environment variables from .env
const envPath = resolve(process.cwd(), '.env')
config({ path: envPath })

async function clearDatabase() {
  try {
    console.log('🗑️  Starting database cleanup...\n')
    console.log('Connecting to MongoDB...')
    
    // Connect directly with increased timeouts
    const MONGODB_URI = process.env.MONGODB_URI
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI not found in environment variables')
    }
    
    // Try connecting with retries
    let connected = false
    let retries = 3
    let lastError: Error | null = null
    
    while (!connected && retries > 0) {
      try {
        await mongoose.connect(MONGODB_URI, {
          serverSelectionTimeoutMS: 60000, // 60 seconds
          socketTimeoutMS: 60000,
          connectTimeoutMS: 60000,
          maxPoolSize: 10,
          retryWrites: true,
          retryReads: true,
        })
        connected = true
        console.log('✓ Connected successfully\n')
      } catch (error: any) {
        lastError = error
        retries--
        if (retries > 0) {
          console.log(`⚠ Connection failed, retrying... (${retries} attempts left)`)
          await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds
        }
      }
    }
    
    if (!connected) {
      throw lastError || new Error('Failed to connect to MongoDB after multiple attempts')
    }

    // Find super admin user
    const superAdmin = await User.findOne({ role: 'SUPER_ADMIN' })
    
    if (!superAdmin) {
      console.error('❌ Super admin user not found!')
      console.error('Please ensure a SUPER_ADMIN user exists before running this script.')
      process.exit(1)
    }

    console.log('✓ Found super admin user:')
    console.log(`  Email: ${superAdmin.email}`)
    console.log(`  Name: ${superAdmin.name}`)
    console.log(`  ID: ${superAdmin._id}\n`)

    const superAdminId = superAdmin._id
    const superAdminEmail = superAdmin.email

    console.log('Deleting all data except super admin...\n')

    // Delete all users except super admin
    const usersDeleted = await User.deleteMany({ _id: { $ne: superAdminId } })
    console.log(`✓ Deleted ${usersDeleted.deletedCount} users (excluding super admin)`)

    // Delete all vehicles
    const vehiclesDeleted = await Vehicle.deleteMany({})
    console.log(`✓ Deleted ${vehiclesDeleted.deletedCount} vehicles`)

    // Delete all customer profiles
    const customersDeleted = await CustomerProfile.deleteMany({})
    console.log(`✓ Deleted ${customersDeleted.deletedCount} customer profiles`)

    // Delete all investor profiles
    const investorsDeleted = await InvestorProfile.deleteMany({})
    console.log(`✓ Deleted ${investorsDeleted.deletedCount} investor profiles`)

    // Delete all bookings
    const bookingsDeleted = await Booking.deleteMany({})
    console.log(`✓ Deleted ${bookingsDeleted.deletedCount} bookings`)

    // Delete all payments
    const paymentsDeleted = await Payment.deleteMany({})
    console.log(`✓ Deleted ${paymentsDeleted.deletedCount} payments`)

    // Delete all invoices
    const invoicesDeleted = await Invoice.deleteMany({})
    console.log(`✓ Deleted ${invoicesDeleted.deletedCount} invoices`)

    // Delete all maintenance records
    const maintenanceRecordsDeleted = await MaintenanceRecord.deleteMany({})
    console.log(`✓ Deleted ${maintenanceRecordsDeleted.deletedCount} maintenance records`)

    // Delete all maintenance schedules
    const maintenanceSchedulesDeleted = await MaintenanceSchedule.deleteMany({})
    console.log(`✓ Deleted ${maintenanceSchedulesDeleted.deletedCount} maintenance schedules`)

    // Delete all fines/penalties
    const finesDeleted = await FineOrPenalty.deleteMany({})
    console.log(`✓ Deleted ${finesDeleted.deletedCount} fines/penalties`)

    // Delete all documents
    const documentsDeleted = await Document.deleteMany({})
    console.log(`✓ Deleted ${documentsDeleted.deletedCount} documents`)

    // Delete all notifications
    const notificationsDeleted = await Notification.deleteMany({})
    console.log(`✓ Deleted ${notificationsDeleted.deletedCount} notifications`)

    // Delete all export logs
    const exportLogsDeleted = await ExportLog.deleteMany({})
    console.log(`✓ Deleted ${exportLogsDeleted.deletedCount} export logs`)

    // Delete all report presets
    const reportPresetsDeleted = await ReportPreset.deleteMany({})
    console.log(`✓ Deleted ${reportPresetsDeleted.deletedCount} report presets`)

    // Delete all expenses
    const expensesDeleted = await Expense.deleteMany({})
    console.log(`✓ Deleted ${expensesDeleted.deletedCount} expenses`)

    // Delete all salary records
    const salaryRecordsDeleted = await SalaryRecord.deleteMany({})
    console.log(`✓ Deleted ${salaryRecordsDeleted.deletedCount} salary records`)

    // Delete all investor payouts
    const investorPayoutsDeleted = await InvestorPayout.deleteMany({})
    console.log(`✓ Deleted ${investorPayoutsDeleted.deletedCount} investor payouts`)

    // Delete all dashboard widgets
    const dashboardWidgetsDeleted = await DashboardWidget.deleteMany({})
    console.log(`✓ Deleted ${dashboardWidgetsDeleted.deletedCount} dashboard widgets`)

    // Delete all activity logs
    const activityLogsDeleted = await ActivityLog.deleteMany({})
    console.log(`✓ Deleted ${activityLogsDeleted.deletedCount} activity logs`)

    // Delete all audit logs
    const auditLogsDeleted = await AuditLog.deleteMany({})
    console.log(`✓ Deleted ${auditLogsDeleted.deletedCount} audit logs`)

    // Delete all roles (custom roles, not system roles)
    const rolesDeleted = await Role.deleteMany({})
    console.log(`✓ Deleted ${rolesDeleted.deletedCount} custom roles`)

    // Delete all settings
    const settingsDeleted = await Settings.deleteMany({})
    console.log(`✓ Deleted ${settingsDeleted.deletedCount} settings`)

    // Delete all sessions
    const sessionsDeleted = await Session.deleteMany({})
    console.log(`✓ Deleted ${sessionsDeleted.deletedCount} sessions`)

    // Delete all support tickets
    const supportTicketsDeleted = await SupportTicket.deleteMany({})
    console.log(`✓ Deleted ${supportTicketsDeleted.deletedCount} support tickets`)

    // Delete all mileage history
    const mileageHistoryDeleted = await MileageHistory.deleteMany({})
    console.log(`✓ Deleted ${mileageHistoryDeleted.deletedCount} mileage history records`)

    // Delete all recurring expenses
    const recurringExpensesDeleted = await RecurringExpense.deleteMany({})
    console.log(`✓ Deleted ${recurringExpensesDeleted.deletedCount} recurring expenses`)

    // Note: ExpenseCategory is kept as it contains default categories needed by the system
    console.log(`\n⚠️  Note: ExpenseCategory collection was preserved (contains default categories)`)

    // Verify super admin still exists
    const verifySuperAdmin = await User.findById(superAdminId)
    if (!verifySuperAdmin) {
      console.error('\n❌ ERROR: Super admin user was deleted! This should not happen.')
      process.exit(1)
    }

    console.log('\n✅ Database cleanup completed successfully!')
    console.log(`\nSuper admin user preserved:`)
    console.log(`  Email: ${verifySuperAdmin.email}`)
    console.log(`  Name: ${verifySuperAdmin.name}`)
    console.log(`  Role: ${verifySuperAdmin.role}`)
    console.log(`  Status: ${verifySuperAdmin.status}`)
    
    // Close connection
    await mongoose.connection.close()
    console.log('\n✓ Database connection closed')
    
    process.exit(0)
  } catch (error: any) {
    console.error('\n❌ Error during database cleanup:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

clearDatabase()

