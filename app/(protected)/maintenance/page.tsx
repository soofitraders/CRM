'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
// import ReportExportButton from '@/components/export/ReportExportButton' // Not available for maintenance module
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
  reminderMileageBefore?: number
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
          {/* Export functionality can be added later when API endpoint is available */}
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
                        label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
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

      {/* Maintenance Record Form Modal */}
      {showRecordForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cardBg rounded-xl shadow-xl border border-borderSoft max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-borderSoft flex items-center justify-between">
              <h2 className="text-2xl font-bold text-headingText">
                {editingRecord ? 'Edit Maintenance Record' : 'Add Maintenance Record'}
              </h2>
              <button
                onClick={() => {
                  setShowRecordForm(false)
                  setEditingRecord(null)
                }}
                className="p-2 hover:bg-pageBg rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-bodyText" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                try {
                  // Validate required fields
                  if (!recordFormData.vehicle) {
                    alert('Please select a vehicle')
                    return
                  }
                  if (!recordFormData.description.trim()) {
                    alert('Please enter a description')
                    return
                  }

                  const submitData: any = {
                    vehicle: recordFormData.vehicle,
                    type: recordFormData.type,
                    description: recordFormData.description.trim(),
                    scheduledDate: recordFormData.scheduledDate || new Date().toISOString().split('T')[0],
                    cost: recordFormData.cost && recordFormData.cost.toString().trim() 
                      ? parseFloat(recordFormData.cost.toString()) 
                      : 0,
                  }

                  if (recordFormData.maintenanceSchedule && recordFormData.maintenanceSchedule.trim()) {
                    submitData.maintenanceSchedule = recordFormData.maintenanceSchedule
                  }
                  if (recordFormData.serviceType && recordFormData.serviceType.trim()) {
                    submitData.serviceType = recordFormData.serviceType.trim()
                  }
                  if (recordFormData.vendorName && recordFormData.vendorName.trim()) {
                    submitData.vendorName = recordFormData.vendorName.trim()
                  }
                  if (recordFormData.mileageAtService && recordFormData.mileageAtService.toString().trim()) {
                    const mileage = parseFloat(recordFormData.mileageAtService.toString())
                    if (!isNaN(mileage) && mileage >= 0) {
                      submitData.mileageAtService = mileage
                    }
                  }

                  const response = await fetch('/api/maintenance/records', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(submitData),
                  })

                  if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}))
                    const errorMessage = errorData.error || 
                      (errorData.details && Array.isArray(errorData.details) && errorData.details.length > 0
                        ? errorData.details[0].message || errorData.details[0].path
                        : 'Failed to create maintenance record')
                    throw new Error(errorMessage)
                  }

                  const result = await response.json()
                  
                  // Reset form
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
                  setShowRecordForm(false)
                  setEditingRecord(null)
                  
                  // Refresh records list
                  await fetchRecords()
                  
                  alert('Maintenance record created successfully')
                } catch (err: any) {
                  console.error('Error creating maintenance record:', err)
                  alert(err.message || 'Failed to create maintenance record. Please check the console for details.')
                }
              }}
              className="p-6 space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Vehicle */}
                <div>
                  <label className="block text-sm font-medium text-headingText mb-2">
                    Vehicle *
                  </label>
                  <select
                    value={recordFormData.vehicle}
                    onChange={(e) => setRecordFormData({ ...recordFormData, vehicle: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                  >
                    <option value="">Select vehicle</option>
                    {vehicles.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.plateNumber} - {v.brand} {v.model}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-headingText mb-2">
                    Maintenance Type *
                  </label>
                  <select
                    value={recordFormData.type}
                    onChange={(e) => setRecordFormData({ ...recordFormData, type: e.target.value as any })}
                    required
                    className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                  >
                    <option value="SERVICE">Service</option>
                    <option value="REPAIR">Repair</option>
                    <option value="ACCIDENT">Accident</option>
                    <option value="INSPECTION">Inspection</option>
                  </select>
                </div>

                {/* Service Type */}
                <div>
                  <label className="block text-sm font-medium text-headingText mb-2">
                    Service Type
                  </label>
                  <input
                    type="text"
                    value={recordFormData.serviceType}
                    onChange={(e) => setRecordFormData({ ...recordFormData, serviceType: e.target.value })}
                    placeholder="e.g., Oil Change, Tire Rotation"
                    className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                  />
                </div>

                {/* Scheduled Date */}
                <div>
                  <label className="block text-sm font-medium text-headingText mb-2">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    value={recordFormData.scheduledDate}
                    onChange={(e) => setRecordFormData({ ...recordFormData, scheduledDate: e.target.value })}
                    className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                  />
                </div>

                {/* Cost */}
                <div>
                  <label className="block text-sm font-medium text-headingText mb-2">
                    Cost (AED)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={recordFormData.cost}
                    onChange={(e) => setRecordFormData({ ...recordFormData, cost: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                  />
                </div>

                {/* Vendor Name */}
                <div>
                  <label className="block text-sm font-medium text-headingText mb-2">
                    Vendor Name
                  </label>
                  <input
                    type="text"
                    value={recordFormData.vendorName}
                    onChange={(e) => setRecordFormData({ ...recordFormData, vendorName: e.target.value })}
                    placeholder="Vendor/Service provider"
                    className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                  />
                </div>

                {/* Mileage at Service */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-headingText mb-2">
                    Mileage at Service
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={recordFormData.mileageAtService}
                    onChange={(e) => setRecordFormData({ ...recordFormData, mileageAtService: e.target.value })}
                    placeholder="Vehicle mileage"
                    className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                  />
                </div>

                {/* Description */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-headingText mb-2">
                    Description *
                  </label>
                  <textarea
                    value={recordFormData.description}
                    onChange={(e) => setRecordFormData({ ...recordFormData, description: e.target.value })}
                    required
                    rows={4}
                    placeholder="Describe the maintenance work..."
                    className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 resize-none"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-4 pt-4 border-t border-borderSoft">
                <button
                  type="button"
                  onClick={() => {
                    setShowRecordForm(false)
                    setEditingRecord(null)
                  }}
                  className="px-6 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText font-medium hover:bg-borderSoft transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-sidebarActiveBg text-white rounded-lg font-medium hover:bg-sidebarActiveBg/90 transition-colors"
                >
                  {editingRecord ? 'Update Record' : 'Create Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Maintenance Schedule Form Modal */}
      {showScheduleForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-cardBg rounded-xl shadow-xl border border-borderSoft max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-borderSoft flex items-center justify-between">
              <h2 className="text-2xl font-bold text-headingText">
                {editingSchedule ? 'Edit Maintenance Schedule' : 'Add Maintenance Schedule'}
              </h2>
              <button
                onClick={() => {
                  setShowScheduleForm(false)
                  setEditingSchedule(null)
                }}
                className="p-2 hover:bg-pageBg rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-bodyText" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                try {
                  // Validate required fields
                  if (!scheduleFormData.vehicle) {
                    alert('Please select a vehicle')
                    return
                  }
                  if (!scheduleFormData.serviceType.trim()) {
                    alert('Please enter a service type')
                    return
                  }
                  if (scheduleFormData.scheduleType === 'MILEAGE' || scheduleFormData.scheduleType === 'BOTH') {
                    if (!scheduleFormData.mileageInterval || parseFloat(scheduleFormData.mileageInterval.toString()) <= 0) {
                      alert('Please enter a mileage interval')
                      return
                    }
                  }
                  if (scheduleFormData.scheduleType === 'TIME' || scheduleFormData.scheduleType === 'BOTH') {
                    if (!scheduleFormData.timeInterval) {
                      alert('Please select a time interval')
                      return
                    }
                  }

                  const submitData: any = {
                    vehicle: scheduleFormData.vehicle,
                    serviceType: scheduleFormData.serviceType.trim(),
                    scheduleType: scheduleFormData.scheduleType,
                    reminderDaysBefore: scheduleFormData.reminderDaysBefore ? parseFloat(scheduleFormData.reminderDaysBefore.toString()) : 7,
                    reminderMileageBefore: scheduleFormData.reminderMileageBefore ? parseFloat(scheduleFormData.reminderMileageBefore.toString()) : 500,
                  }

                  if (scheduleFormData.scheduleType === 'MILEAGE' || scheduleFormData.scheduleType === 'BOTH') {
                    submitData.mileageInterval = parseFloat(scheduleFormData.mileageInterval.toString())
                  }
                  if (scheduleFormData.scheduleType === 'TIME' || scheduleFormData.scheduleType === 'BOTH') {
                    submitData.timeInterval = scheduleFormData.timeInterval
                    if (scheduleFormData.timeIntervalDays && scheduleFormData.timeIntervalDays.trim()) {
                      submitData.timeIntervalDays = parseFloat(scheduleFormData.timeIntervalDays.toString())
                    }
                  }
                  if (scheduleFormData.estimatedCost && scheduleFormData.estimatedCost.toString().trim()) {
                    submitData.estimatedCost = parseFloat(scheduleFormData.estimatedCost.toString())
                  }
                  if (scheduleFormData.notes && scheduleFormData.notes.trim()) {
                    submitData.notes = scheduleFormData.notes.trim()
                  }

                  const response = await fetch('/api/maintenance/schedules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(submitData),
                  })

                  if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}))
                    const errorMessage = errorData.error || 
                      (errorData.details && Array.isArray(errorData.details) && errorData.details.length > 0
                        ? errorData.details[0].message || errorData.details[0].path
                        : 'Failed to create maintenance schedule')
                    throw new Error(errorMessage)
                  }

                  // Reset form
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
                  setShowScheduleForm(false)
                  setEditingSchedule(null)
                  
                  // Refresh schedules list
                  await fetchSchedules()
                  
                  alert('Maintenance schedule created successfully')
                } catch (err: any) {
                  console.error('Error creating maintenance schedule:', err)
                  alert(err.message || 'Failed to create maintenance schedule. Please check the console for details.')
                }
              }}
              className="p-6 space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Vehicle */}
                <div>
                  <label className="block text-sm font-medium text-headingText mb-2">
                    Vehicle *
                  </label>
                  <select
                    value={scheduleFormData.vehicle}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, vehicle: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                  >
                    <option value="">Select vehicle</option>
                    {vehicles.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.plateNumber} - {v.brand} {v.model}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Service Type */}
                <div>
                  <label className="block text-sm font-medium text-headingText mb-2">
                    Service Type *
                  </label>
                  <input
                    type="text"
                    value={scheduleFormData.serviceType}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, serviceType: e.target.value })}
                    required
                    placeholder="e.g., Oil Change, Tire Rotation"
                    className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                  />
                </div>

                {/* Schedule Type */}
                <div>
                  <label className="block text-sm font-medium text-headingText mb-2">
                    Schedule Type *
                  </label>
                  <select
                    value={scheduleFormData.scheduleType}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, scheduleType: e.target.value as any })}
                    required
                    className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                  >
                    <option value="TIME">Time Based</option>
                    <option value="MILEAGE">Mileage Based</option>
                    <option value="BOTH">Both Time & Mileage</option>
                  </select>
                </div>

                {/* Time Interval */}
                {(scheduleFormData.scheduleType === 'TIME' || scheduleFormData.scheduleType === 'BOTH') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-headingText mb-2">
                        Time Interval *
                      </label>
                      <select
                        value={scheduleFormData.timeInterval}
                        onChange={(e) => setScheduleFormData({ ...scheduleFormData, timeInterval: e.target.value as any })}
                        required
                        className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                      >
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                        <option value="QUARTERLY">Quarterly</option>
                        <option value="YEARLY">Yearly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-headingText mb-2">
                        Custom Days (Optional)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={scheduleFormData.timeIntervalDays}
                        onChange={(e) => setScheduleFormData({ ...scheduleFormData, timeIntervalDays: e.target.value })}
                        placeholder="Custom number of days"
                        className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                      />
                    </div>
                  </>
                )}

                {/* Mileage Interval */}
                {(scheduleFormData.scheduleType === 'MILEAGE' || scheduleFormData.scheduleType === 'BOTH') && (
                  <div>
                    <label className="block text-sm font-medium text-headingText mb-2">
                      Mileage Interval (km) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={scheduleFormData.mileageInterval}
                      onChange={(e) => setScheduleFormData({ ...scheduleFormData, mileageInterval: e.target.value })}
                      required={scheduleFormData.scheduleType === 'MILEAGE' || scheduleFormData.scheduleType === 'BOTH'}
                      placeholder="e.g., 5000"
                      className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                    />
                  </div>
                )}

                {/* Reminder Days Before */}
                <div>
                  <label className="block text-sm font-medium text-headingText mb-2">
                    Reminder Days Before
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={scheduleFormData.reminderDaysBefore}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, reminderDaysBefore: e.target.value })}
                    placeholder="7"
                    className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                  />
                </div>

                {/* Reminder Mileage Before */}
                <div>
                  <label className="block text-sm font-medium text-headingText mb-2">
                    Reminder Mileage Before (km)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={scheduleFormData.reminderMileageBefore}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, reminderMileageBefore: e.target.value })}
                    placeholder="500"
                    className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                  />
                </div>

                {/* Estimated Cost */}
                <div>
                  <label className="block text-sm font-medium text-headingText mb-2">
                    Estimated Cost (AED)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={scheduleFormData.estimatedCost}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, estimatedCost: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                  />
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-headingText mb-2">
                    Notes
                  </label>
                  <textarea
                    value={scheduleFormData.notes}
                    onChange={(e) => setScheduleFormData({ ...scheduleFormData, notes: e.target.value })}
                    rows={3}
                    placeholder="Additional notes..."
                    className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 resize-none"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-4 pt-4 border-t border-borderSoft">
                <button
                  type="button"
                  onClick={() => {
                    setShowScheduleForm(false)
                    setEditingSchedule(null)
                  }}
                  className="px-6 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText font-medium hover:bg-borderSoft transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-sidebarActiveBg text-white rounded-lg font-medium hover:bg-sidebarActiveBg/90 transition-colors"
                >
                  {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

