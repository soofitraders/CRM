'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import ReportExportButton from '@/components/export/ReportExportButton'
import {
  Plus,
  X,
  Edit,
  Trash2,
  Calendar,
  Bell,
  Wrench,
  DollarSign,
  Clock,
  Loader2,
  CheckCircle,
  AlertCircle,
  TrendingUp,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#F97316']

interface MaintenanceSchedule {
  _id: string
  vehicle: {
    _id: string
    plateNumber: string
    brand: string
    model: string
    mileage: number
    status: string
  }
  serviceType: string
  scheduleType: 'MILEAGE' | 'TIME' | 'BOTH'
  mileageInterval?: number
  timeInterval?: string
  nextServiceMileage?: number
  nextServiceDate?: string
  reminderDaysBefore: number
  isActive: boolean
}

interface MaintenanceRecord {
  _id: string
  vehicle: {
    plateNumber: string
    brand: string
    model: string
  }
  serviceType?: string
  type: string
  description: string
  status: string
  scheduledDate?: string
  startDate?: string
  completedDate?: string
  cost: number
  downtimeHours?: number
  mileageAtService?: number
}

export default function MaintenancePage() {
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([])
  const [records, setRecords] = useState<MaintenanceRecord[]>([])
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'schedules' | 'records' | 'reports'>('schedules')

  // Due maintenance alerts
  const [dueMaintenance, setDueMaintenance] = useState<any>({ dueByMileage: [], dueByTime: [], upcomingReminders: [] })

  // Reports
  const [costReport, setCostReport] = useState<any>(null)
  const [downtimeReport, setDowntimeReport] = useState<any>(null)

  // Filters
  const [vehicleFilter, setVehicleFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [dateFrom, setDateFrom] = useState(format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))

  // Modal states
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<MaintenanceSchedule | null>(null)
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null)

  const [scheduleFormData, setScheduleFormData] = useState({
    vehicle: '',
    serviceType: '',
    scheduleType: 'TIME' as 'MILEAGE' | 'TIME' | 'BOTH',
    mileageInterval: '',
    timeInterval: 'MONTHLY',
    timeIntervalDays: '',
    reminderDaysBefore: '7',
    reminderMileageBefore: '500',
    estimatedCost: '',
    notes: '',
  })

  const [recordFormData, setRecordFormData] = useState({
    vehicle: '',
    maintenanceSchedule: '',
    type: 'SERVICE',
    serviceType: '',
    description: '',
    scheduledDate: format(new Date(), 'yyyy-MM-dd'),
    cost: '',
    vendorName: '',
    mileageAtService: '',
  })

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        await Promise.all([
          fetchSchedules(),
          fetchRecords(),
          fetchVehicles(),
          checkDueMaintenance(),
        ])
      } catch (err) {
        console.error('Error loading data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [vehicleFilter, statusFilter, dateFrom, dateTo])

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchCostReport()
      fetchDowntimeReport()
    }
  }, [activeTab, dateFrom, dateTo])

  const fetchSchedules = async () => {
    try {
      const params = new URLSearchParams()
      if (vehicleFilter) params.append('vehicleId', vehicleFilter)
      params.append('isActive', 'true')

      const response = await fetch(`/api/maintenance/schedules?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch schedules')
      }

      const data = await response.json()
      setSchedules(data.schedules || [])
    } catch (err: any) {
      console.error('Error fetching schedules:', err)
      setError(err.message || 'Failed to load schedules')
      setSchedules([])
    }
  }

  const fetchRecords = async () => {
    try {
      const params = new URLSearchParams()
      if (vehicleFilter) params.append('vehicleId', vehicleFilter)
      if (statusFilter) params.append('status', statusFilter)
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)

      const response = await fetch(`/api/maintenance/records?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch records')
      }

      const data = await response.json()
      setRecords(data.records || [])
    } catch (err: any) {
      console.error('Error fetching records:', err)
      setError(err.message || 'Failed to load records')
      setRecords([])
    }
  }

  const fetchVehicles = async () => {
    try {
      const response = await fetch('/api/vehicles')
      if (response.ok) {
        const data = await response.json()
        setVehicles(data.vehicles || [])
      } else {
        console.warn('Failed to fetch vehicles, response not ok')
        setVehicles([])
      }
    } catch (err) {
      console.error('Failed to load vehicles:', err)
      setVehicles([])
    }
  }

  const checkDueMaintenance = async () => {
    try {
      const response = await fetch('/api/maintenance/check-due')
      if (response.ok) {
        const data = await response.json()
        setDueMaintenance(data || { dueByMileage: [], dueByTime: [], upcomingReminders: [] })
      } else {
        console.warn('Failed to check due maintenance, response not ok')
        setDueMaintenance({ dueByMileage: [], dueByTime: [], upcomingReminders: [] })
      }
    } catch (err) {
      console.error('Failed to check due maintenance:', err)
      setDueMaintenance({ dueByMileage: [], dueByTime: [], upcomingReminders: [] })
    }
  }

  const fetchCostReport = async () => {
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)
      if (vehicleFilter) params.append('vehicleId', vehicleFilter)

      const response = await fetch(`/api/maintenance/cost-report?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setCostReport(data)
      }
    } catch (err) {
      console.error('Failed to load cost report:', err)
    }
  }

  const fetchDowntimeReport = async () => {
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)
      if (vehicleFilter) params.append('vehicleId', vehicleFilter)

      const response = await fetch(`/api/maintenance/downtime-report?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setDowntimeReport(data)
      }
    } catch (err) {
      console.error('Failed to load downtime report:', err)
    }
  }

  const handleCreateFromSchedule = async (scheduleId: string) => {
    if (!confirm('Create maintenance record from this schedule?')) return

    try {
      const response = await fetch('/api/maintenance/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenanceSchedule: scheduleId,
          createFromSchedule: true,
        }),
      })

      if (!response.ok) throw new Error('Failed to create maintenance record')

      alert('Maintenance record created successfully')
      fetchRecords()
      fetchSchedules()
      checkDueMaintenance()
    } catch (err: any) {
      alert(err.message || 'Failed to create maintenance record')
    }
  }

  const handleCompleteMaintenance = async (recordId: string) => {
    try {
      const response = await fetch(`/api/maintenance/records/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'COMPLETED',
          complete: true,
        }),
      })

      if (!response.ok) throw new Error('Failed to complete maintenance')

      alert('Maintenance completed successfully')
      fetchRecords()
      fetchSchedules()
    } catch (err: any) {
      alert(err.message || 'Failed to complete maintenance')
    }
  }

  const formatCurrency = (amount: number) => {
    return `AED ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const totalDue = dueMaintenance.dueByMileage.length + dueMaintenance.dueByTime.length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-sidebarActiveBg" />
        <span className="ml-3 text-bodyText">Loading maintenance data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-headingText">Vehicle Maintenance</h1>
          <p className="text-bodyText mt-2">Automated maintenance scheduling and tracking</p>
        </div>
        <div className="flex gap-2">
          <ReportExportButton
            module="maintenance"
            filters={{
              vehicleId: vehicleFilter,
              status: statusFilter,
              dateFrom,
              dateTo,
            }}
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">{error}</div>
      )}

      {/* Due Maintenance Alerts */}
      {totalDue > 0 && (
        <SectionCard>
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-headingText">
              Due Maintenance ({totalDue})
            </h3>
          </div>
          <div className="space-y-2">
            {dueMaintenance.dueByMileage.map((item: any) => (
              <div
                key={item.schedule._id}
                className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-headingText">
                    {item.vehicle.plateNumber} - {item.schedule.serviceType}
                  </p>
                  <p className="text-sm text-bodyText">
                    Due by mileage: {item.vehicle.mileage} / {item.schedule.nextServiceMileage} km
                  </p>
                </div>
                <button
                  onClick={() => handleCreateFromSchedule(item.schedule._id)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Create Maintenance
                </button>
              </div>
            ))}
            {dueMaintenance.dueByTime.map((item: any) => (
              <div
                key={item.schedule._id}
                className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-headingText">
                    {item.vehicle.plateNumber} - {item.schedule.serviceType}
                  </p>
                  <p className="text-sm text-bodyText">
                    Due by date: {format(new Date(item.schedule.nextServiceDate), 'MMM dd, yyyy')}
                  </p>
                </div>
                <button
                  onClick={() => handleCreateFromSchedule(item.schedule._id)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Create Maintenance
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-borderSoft">
        <button
          onClick={() => setActiveTab('schedules')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'schedules'
              ? 'border-b-2 border-sidebarActiveBg text-sidebarActiveBg'
              : 'text-bodyText'
          }`}
        >
          Schedules
        </button>
        <button
          onClick={() => setActiveTab('records')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'records'
              ? 'border-b-2 border-sidebarActiveBg text-sidebarActiveBg'
              : 'text-bodyText'
          }`}
        >
          Records
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'reports'
              ? 'border-b-2 border-sidebarActiveBg text-sidebarActiveBg'
              : 'text-bodyText'
          }`}
        >
          Reports
        </button>
      </div>

      {/* Filters */}
      <SectionCard>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-bodyText mb-1">Vehicle</label>
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            >
              <option value="">All Vehicles</option>
              {vehicles.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.plateNumber} - {v.brand} {v.model}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-bodyText mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-bodyText mb-1">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-bodyText mb-1">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            />
          </div>
        </div>
      </SectionCard>

      {/* Schedules Tab */}
      {activeTab === 'schedules' && (
        <SectionCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-headingText">Maintenance Schedules</h3>
            <button
              onClick={() => {
                setEditingSchedule(null)
                setScheduleFormData({
                  vehicle: '',
                  serviceType: '',
                  scheduleType: 'TIME',
                  mileageInterval: '',
                  timeInterval: 'MONTHLY',
                  timeIntervalDays: '',
                  reminderDaysBefore: '7',
                  reminderMileageBefore: '500',
                  estimatedCost: '',
                  notes: '',
                })
                setShowScheduleForm(true)
              }}
              className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg hover:bg-sidebarActiveBg/90 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Schedule
            </button>
          </div>

          <Table
            headers={[
              'Vehicle',
              'Service Type',
              'Schedule Type',
              'Next Service',
              'Reminder',
              'Status',
              'Actions',
            ]}
          >
            {schedules.map((schedule) => (
              <TableRow key={schedule._id}>
                <TableCell>
                  {schedule.vehicle.plateNumber} - {schedule.vehicle.brand} {schedule.vehicle.model}
                </TableCell>
                <TableCell className="font-medium">{schedule.serviceType}</TableCell>
                <TableCell>{schedule.scheduleType}</TableCell>
                <TableCell>
                  {schedule.nextServiceDate && (
                    <div className="text-sm">
                      {format(new Date(schedule.nextServiceDate), 'MMM dd, yyyy')}
                    </div>
                  )}
                  {schedule.nextServiceMileage && (
                    <div className="text-xs text-sidebarMuted">
                      {schedule.nextServiceMileage} km
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {schedule.reminderDaysBefore} days / {schedule.reminderMileageBefore} km
                </TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      schedule.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {schedule.isActive ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => handleCreateFromSchedule(schedule._id)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    Create Now
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </Table>
        </SectionCard>
      )}

      {/* Records Tab */}
      {activeTab === 'records' && (
        <SectionCard>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-headingText">Maintenance Records</h3>
            <button
              onClick={() => {
                setEditingRecord(null)
                setRecordFormData({
                  vehicle: '',
                  maintenanceSchedule: '',
                  type: 'SERVICE',
                  serviceType: '',
                  description: '',
                  scheduledDate: format(new Date(), 'yyyy-MM-dd'),
                  cost: '',
                  vendorName: '',
                  mileageAtService: '',
                })
                setShowRecordForm(true)
              }}
              className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg hover:bg-sidebarActiveBg/90 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Record
            </button>
          </div>

          <Table
            headers={[
              'Vehicle',
              'Service Type',
              'Description',
              'Status',
              'Cost',
              'Downtime',
              'Completed',
              'Actions',
            ]}
          >
            {records.map((record) => (
              <TableRow key={record._id}>
                <TableCell>
                  {record.vehicle.plateNumber} - {record.vehicle.brand} {record.vehicle.model}
                </TableCell>
                <TableCell>{record.serviceType || record.type}</TableCell>
                <TableCell className="max-w-xs truncate">{record.description}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      record.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-800'
                        : record.status === 'IN_PROGRESS'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {record.status}
                  </span>
                </TableCell>
                <TableCell className="font-semibold">{formatCurrency(record.cost)}</TableCell>
                <TableCell>
                  {record.downtimeHours ? `${record.downtimeHours.toFixed(1)}h` : '—'}
                </TableCell>
                <TableCell>
                  {record.completedDate
                    ? format(new Date(record.completedDate), 'MMM dd, yyyy')
                    : '—'}
                </TableCell>
                <TableCell>
                  {record.status !== 'COMPLETED' && (
                    <button
                      onClick={() => handleCompleteMaintenance(record._id)}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      Complete
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </Table>
        </SectionCard>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Cost Report */}
          {costReport && (
            <SectionCard>
              <h3 className="text-lg font-semibold text-headingText mb-4">Maintenance Cost Report</h3>
              <div className="mb-4">
                <p className="text-2xl font-bold text-headingText">
                  Total Cost: {formatCurrency(costReport.totalCost)}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-headingText mb-3">By Vehicle</h4>
                  <Table headers={['Vehicle', 'Count', 'Total Cost', 'Avg Cost']}>
                    {costReport.byVehicle.map((v: any) => (
                      <TableRow key={v.vehicleId}>
                        <TableCell>
                          {v.plateNumber} - {v.brand} {v.model}
                        </TableCell>
                        <TableCell>{v.maintenanceCount}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(v.totalCost)}</TableCell>
                        <TableCell>{formatCurrency(v.averageCost)}</TableCell>
                      </TableRow>
                    ))}
                  </Table>
                </div>

                <div>
                  <h4 className="font-semibold text-headingText mb-3">By Service Type</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={costReport.byType}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ type, totalCost }) => `${type}: ${formatCurrency(totalCost)}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="totalCost"
                      >
                        {costReport.byType.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </SectionCard>
          )}

          {/* Downtime Report */}
          {downtimeReport && (
            <SectionCard>
              <h3 className="text-lg font-semibold text-headingText mb-4">Downtime Report</h3>
              <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-bodyText">Total Downtime</p>
                  <p className="text-2xl font-bold text-headingText">
                    {downtimeReport.totalDowntimeHours.toFixed(1)} hours
                  </p>
                </div>
                <div>
                  <p className="text-sm text-bodyText">Estimated Lost Revenue</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(downtimeReport.totalLostRevenue)}
                  </p>
                </div>
              </div>

              <Table
                headers={[
                  'Vehicle',
                  'Downtime (Hours)',
                  'Maintenance Count',
                  'Daily Rate',
                  'Lost Revenue',
                ]}
              >
                {downtimeReport.byVehicle.map((v: any) => (
                  <TableRow key={v.vehicleId}>
                    <TableCell>
                      {v.plateNumber} - {v.brand} {v.model}
                    </TableCell>
                    <TableCell className="font-semibold">{v.downtimeHours.toFixed(1)}</TableCell>
                    <TableCell>{v.maintenanceCount}</TableCell>
                    <TableCell>{formatCurrency(v.dailyRate)}</TableCell>
                    <TableCell className="font-semibold text-red-600">
                      {formatCurrency(v.lostRevenue)}
                    </TableCell>
                  </TableRow>
                ))}
              </Table>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  )
}

