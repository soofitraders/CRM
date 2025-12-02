'use client'

import { Car, Users, DollarSign, Calendar as CalendarIcon, Search, Filter, Plus } from 'lucide-react'
import StatCard from '@/components/ui/StatCard'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import StatusChip from '@/components/ui/StatusChip'
import Calendar from '@/components/ui/Calendar'
import { format } from 'date-fns'
import { formatDaysLeft } from '@/lib/utils/compliance'
import { useQuery } from '@tanstack/react-query'
import DashboardErrorBoundary from '@/components/dashboard/DashboardErrorBoundary'
import CustomMetricsSection from '@/components/dashboard/CustomMetricsSection'

export default function DashboardPage() {
  // Fetch dashboard summary
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/summary')
      if (!response.ok) throw new Error('Failed to fetch summary')
      return response.json()
    },
  })

  // Fetch today's bookings
  const { data: todayBookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['today-bookings'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/today-bookings')
      if (!response.ok) throw new Error('Failed to fetch bookings')
      return response.json()
    },
  })

  // Fetch urgent maintenance
  const { data: urgentMaintenance, isLoading: maintenanceLoading } = useQuery({
    queryKey: ['urgent-maintenance'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/urgent-maintenance')
      if (!response.ok) throw new Error('Failed to fetch maintenance')
      return response.json()
    },
  })

  // Fetch calendar events
  const { data: calendarEvents } = useQuery({
    queryKey: ['calendar-events'],
    queryFn: async () => {
      const currentDate = new Date()
      const response = await fetch(
        `/api/dashboard/calendar-events?year=${currentDate.getFullYear()}&month=${currentDate.getMonth()}`
      )
      if (!response.ok) return []
      const result = await response.json()
      return result.events || []
    },
  })

  const getStatusVariant = (status: string): 'yellow' | 'green' | 'red' => {
    if (status === 'In Progress') return 'yellow'
    if (status === 'Completed') return 'green'
    if (status === 'Overdue') return 'red'
    return 'yellow'
  }

  const summaryData = summary?.summary || {
    totalCars: 0,
    rentedCars: 0,
    totalUsers: 0,
    totalSales: 0,
  }

  const financialSummary = summary?.financialSummary || {
    salesGrowth: 0,
  }

  return (
    <DashboardErrorBoundary>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="mb-2">
          <h1 className="text-4xl font-bold text-headingText mb-2">Dashboard</h1>
          <p className="text-bodyText text-base">Welcome to MisterWheels CRM</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={Car}
            value={summaryLoading ? '...' : summaryData.totalCars}
            label="Total Cars"
            subtext="Last month +10%"
          />
          <StatCard
            icon={Car}
            value={summaryLoading ? '...' : summaryData.rentedCars}
            label="Rented Cars"
            subtext="Last month +5%"
          />
          <StatCard
            icon={Users}
            value={summaryLoading ? '...' : summaryData.totalUsers}
            label="Total Users"
            subtext="Last month +12%"
          />
          <StatCard
            icon={DollarSign}
            value={
              summaryLoading
                ? '...'
                : `AED ${summaryData.totalSales.toLocaleString()}`
            }
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
          {bookingsLoading ? (
            <div className="text-center py-8 text-bodyText">Loading bookings...</div>
          ) : todayBookings?.bookings?.length === 0 ? (
            <div className="text-center py-8 text-bodyText">No bookings for today</div>
          ) : (
            <Table
              headers={['Cars', 'Customers', 'Pick-up date', 'Drop off date', 'Pick-up Vehicles']}
            >
              {todayBookings?.bookings?.map((booking: any) => (
                <TableRow key={booking.id}>
                  <TableCell className="font-medium text-headingText">{booking.car}</TableCell>
                  <TableCell>{booking.customer}</TableCell>
                  <TableCell>{booking.pickupDate}</TableCell>
                  <TableCell>{booking.dropoffDate}</TableCell>
                  <TableCell className="font-medium">{booking.pickupVehicle}</TableCell>
                </TableRow>
              ))}
            </Table>
          )}
        </SectionCard>

        {/* Urgent Compliance & Maintenance */}
        <SectionCard title="Urgent Compliance & Maintenance">
          {maintenanceLoading ? (
            <div className="text-center py-8 text-bodyText">Loading maintenance data...</div>
          ) : urgentMaintenance?.items?.length === 0 ? (
            <div className="text-center py-8 text-bodyText">No urgent maintenance items</div>
          ) : (
            <Table
              headers={['Vehicle #', 'Documents', 'Vehicle Issue', 'Day Left', 'Status']}
            >
              {urgentMaintenance?.items?.map((item: any) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-headingText">
                    {item.vehicleNumber}
                  </TableCell>
                  <TableCell>{item.documents}</TableCell>
                  <TableCell>{item.vehicleIssue}</TableCell>
                  <TableCell>
                    <span
                      className={
                        item.daysLeft < 0
                          ? 'text-danger font-medium'
                          : item.daysLeft === 0
                          ? 'text-warning font-medium'
                          : ''
                      }
                    >
                      {formatDaysLeft(item.daysLeft)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusChip status={item.status} variant={getStatusVariant(item.status)} />
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          )}
        </SectionCard>

        {/* Calendar */}
        {calendarEvents && <Calendar events={calendarEvents} />}

        {/* Custom Metrics Section */}
        <CustomMetricsSection />
      </div>
    </DashboardErrorBoundary>
  )
}
