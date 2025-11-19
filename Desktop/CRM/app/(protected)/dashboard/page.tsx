import { Car, Users, DollarSign, Calendar as CalendarIcon, Search, Filter } from 'lucide-react'
import StatCard from '@/components/ui/StatCard'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import StatusChip from '@/components/ui/StatusChip'
import Calendar from '@/components/ui/Calendar'
import {
  getDashboardSummary,
  getTodayBookings,
  getUrgentMaintenance,
  getCalendarEventsForMonth,
} from '@/lib/demo/dashboard'
import { getFinancialSummary } from '@/lib/services/financials'
import { format } from 'date-fns'
import { formatDaysLeft } from '@/lib/utils/compliance'

export default async function DashboardPage() {
  const [summary, financialSummary, todayBookings, urgentMaintenance] = await Promise.all([
    getDashboardSummary(),
    getFinancialSummary(),
    getTodayBookings(),
    getUrgentMaintenance(),
  ])
  
  const currentDate = new Date()
  const calendarEvents = getCalendarEventsForMonth(
    currentDate.getFullYear(),
    currentDate.getMonth()
  )
  
  // Update total sales with real data
  summary.totalSales = financialSummary.totalSales

  const getStatusVariant = (status: string): 'yellow' | 'green' | 'red' => {
    if (status === 'In Progress') return 'yellow'
    if (status === 'Completed') return 'green'
    if (status === 'Overdue') return 'red'
    return 'yellow'
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-headingText">Dashboard</h1>
        <p className="text-bodyText mt-2">Welcome to MisterWheels CRM</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Car}
          value={summary.totalCars}
          label="Total Cars"
          subtext="Last month +10%"
        />
        <StatCard
          icon={Car}
          value={summary.rentedCars}
          label="Rented Cars"
          subtext="Last month +5%"
        />
        <StatCard
          icon={Users}
          value={summary.totalUsers}
          label="Total Users"
          subtext="Last month +12%"
        />
        <StatCard
          icon={DollarSign}
          value={`AED ${summary.totalSales.toLocaleString()}`}
          label="Total Sales"
          subtext={
            financialSummary.salesGrowth > 0
              ? `Last month +${financialSummary.salesGrowth.toFixed(1)}%`
              : financialSummary.salesGrowth < 0
              ? `Last month ${financialSummary.salesGrowth.toFixed(1)}%`
              : 'No change from last month'
          }
        />
      </div>

      {/* Today's Bookings */}
      <SectionCard
        title="Today's Bookings"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-bodyText" />
              <input
                type="text"
                placeholder="Search..."
                className="pl-9 pr-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 w-48"
              />
            </div>
            <button className="px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm font-medium text-bodyText hover:bg-borderSoft transition-colors flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>
        }
      >
        <Table
          headers={['Cars', 'Customers', 'Pick-up date', 'Drop off date', 'Pick-up Vehicles']}
        >
          {todayBookings.map((booking) => (
            <TableRow key={booking.id}>
              <TableCell className="font-medium text-headingText">{booking.car}</TableCell>
              <TableCell>{booking.customer}</TableCell>
              <TableCell>{booking.pickupDate}</TableCell>
              <TableCell>{booking.dropoffDate}</TableCell>
              <TableCell className="font-medium">{booking.pickupVehicle}</TableCell>
            </TableRow>
          ))}
        </Table>
      </SectionCard>

      {/* Urgent Compliance & Maintenance */}
      <SectionCard title="Urgent Compliance & Maintenance">
        <Table
          headers={['Vehicle #', 'Documents', 'Vehicle Issue', 'Day Left', 'Status']}
        >
          {urgentMaintenance.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium text-headingText">
                {item.vehicleNumber}
              </TableCell>
              <TableCell>{item.documents}</TableCell>
              <TableCell>{item.vehicleIssue}</TableCell>
              <TableCell>
                <span className={item.daysLeft < 0 ? 'text-danger font-medium' : item.daysLeft === 0 ? 'text-warning font-medium' : ''}>
                  {formatDaysLeft(item.daysLeft)}
                </span>
              </TableCell>
              <TableCell>
                <StatusChip status={item.status} variant={getStatusVariant(item.status)} />
              </TableCell>
            </TableRow>
          ))}
        </Table>
      </SectionCard>

      {/* Calendar */}
      <Calendar events={calendarEvents} />
    </div>
  )
}
