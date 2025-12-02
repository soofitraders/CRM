'use client'

import { useState, useEffect } from 'react'
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import StatCard from '@/components/ui/StatCard'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import ReportExportButton from '@/components/export/ReportExportButton'
import AdvancedFilters from '@/components/reports/AdvancedFilters'
import { DollarSign, TrendingUp, FileText, BarChart3, Calendar, Save, Loader2 } from 'lucide-react'
import {
  LineChart,
  Line,
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

type ReportType = 'revenue' | 'ar' | 'investors' | 'utilization'

interface ReportPreset {
  _id: string
  name: string
  type: ReportType
  filters: Record<string, any>
}

const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#F97316']

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportType>('revenue')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Date range state
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [branchId, setBranchId] = useState<string>('')
  const [vehicleCategory, setVehicleCategory] = useState<string>('')
  const [customerType, setCustomerType] = useState<string>('')
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')
  const [commissionPercent, setCommissionPercent] = useState<number>(20)
  const [dateAsOf, setDateAsOf] = useState(format(new Date(), 'yyyy-MM-dd'))

  // Filter options
  const [branches, setBranches] = useState<string[]>([])
  const [vehicleCategories, setVehicleCategories] = useState<string[]>([])

  // Report data state
  const [revenueData, setRevenueData] = useState<any>(null)
  const [arData, setArData] = useState<any>(null)
  const [investorData, setInvestorData] = useState<any>(null)
  const [utilizationData, setUtilizationData] = useState<any>(null)

  // Presets state
  const [presets, setPresets] = useState<ReportPreset[]>([])
  const [showSavePreset, setShowSavePreset] = useState(false)
  const [presetName, setPresetName] = useState('')

  // Load filter options
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const response = await fetch('/api/reports/filter-options')
        if (response.ok) {
          const data = await response.json()
          setBranches(data.branches || [])
          setVehicleCategories(data.vehicleCategories || [])
        }
      } catch (err) {
        console.error('Failed to load filter options:', err)
      }
    }
    loadFilterOptions()
  }, [])

  // Load presets
  useEffect(() => {
    const loadPresets = async () => {
      try {
        const response = await fetch(`/api/reports/presets?type=${activeTab}`)
        if (response.ok) {
          const data = await response.json()
          setPresets(data.presets || [])
        }
      } catch (err) {
        console.error('Failed to load presets:', err)
      }
    }
    loadPresets()
  }, [activeTab])

  // Load report data
  const loadReportData = async () => {
    setLoading(true)
    setError(null)

    try {
      let response: Response
      let data: any

      if (activeTab === 'revenue') {
        const params = new URLSearchParams({
          dateFrom,
          dateTo,
          groupBy,
          ...(branchId && { branchId }),
          ...(vehicleCategory && { vehicleCategory }),
          ...(customerType && { customerType }),
        })
        response = await fetch(`/api/reports/revenue?${params}`)
        data = await response.json()
        if (response.ok) {
          setRevenueData(data)
        } else {
          throw new Error(data.error || 'Failed to load revenue report')
        }
      } else if (activeTab === 'ar') {
        response = await fetch(`/api/reports/ar?dateAsOf=${dateAsOf}`)
        data = await response.json()
        if (response.ok) {
          setArData(data)
        } else {
          throw new Error(data.error || 'Failed to load AR report')
        }
      } else if (activeTab === 'investors') {
        const params = new URLSearchParams({
          dateFrom,
          dateTo,
          commissionPercent: commissionPercent.toString(),
        })
        response = await fetch(`/api/reports/investors?${params}`)
        data = await response.json()
        if (response.ok) {
          setInvestorData(data)
        } else {
          throw new Error(data.error || 'Failed to load investor report')
        }
      } else if (activeTab === 'utilization') {
        const params = new URLSearchParams({
          dateFrom,
          dateTo,
          ...(branchId && { branchId }),
          ...(vehicleCategory && { vehicleCategory }),
        })
        response = await fetch(`/api/reports/utilization?${params}`)
        data = await response.json()
        if (response.ok) {
          setUtilizationData(data)
        } else {
          throw new Error(data.error || 'Failed to load utilization report')
        }
      }
    } catch (err: any) {
      console.error('Error loading report:', err)
      setError(err.message || 'Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReportData()
  }, [activeTab, dateFrom, dateTo, branchId, vehicleCategory, customerType, groupBy, commissionPercent, dateAsOf])

  const handlePresetSave = async () => {
    if (!presetName.trim()) return

    try {
      const filters: Record<string, any> = {
        dateFrom,
        dateTo,
        ...(branchId && { branchId }),
      }

      if (activeTab === 'revenue') {
        filters.groupBy = groupBy
      } else if (activeTab === 'investors') {
        filters.commissionPercent = commissionPercent
      } else if (activeTab === 'ar') {
        filters.dateAsOf = dateAsOf
      }

      const response = await fetch('/api/reports/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: presetName,
          type: activeTab.toUpperCase(),
          filters,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setPresets([...presets, data.preset])
        setPresetName('')
        setShowSavePreset(false)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save preset')
      }
    } catch (err: any) {
      console.error('Failed to save preset:', err)
      alert(err.message || 'Failed to save preset')
    }
  }

  const handlePresetLoad = (preset: ReportPreset) => {
    const filters = preset.filters
    setDateFrom(filters.dateFrom || dateFrom)
    setDateTo(filters.dateTo || dateTo)
    if (filters.branchId) setBranchId(filters.branchId)
    if (filters.groupBy) setGroupBy(filters.groupBy)
    if (filters.commissionPercent) setCommissionPercent(filters.commissionPercent)
    if (filters.dateAsOf) setDateAsOf(filters.dateAsOf)
  }

  const handlePresetDelete = async (presetId: string) => {
    if (!confirm('Delete this preset?')) return

    try {
      const response = await fetch(`/api/reports/presets/${presetId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setPresets(presets.filter((p) => p._id !== presetId))
      }
    } catch (err) {
      console.error('Failed to delete preset:', err)
      alert('Failed to delete preset')
    }
  }

  const applyDatePreset = (preset: '7days' | '30days' | 'month' | 'week') => {
    const today = new Date()
    if (preset === '7days') {
      setDateFrom(format(subDays(today, 7), 'yyyy-MM-dd'))
      setDateTo(format(today, 'yyyy-MM-dd'))
    } else if (preset === '30days') {
      setDateFrom(format(subDays(today, 30), 'yyyy-MM-dd'))
      setDateTo(format(today, 'yyyy-MM-dd'))
    } else if (preset === 'month') {
      setDateFrom(format(startOfMonth(today), 'yyyy-MM-dd'))
      setDateTo(format(endOfMonth(today), 'yyyy-MM-dd'))
    } else if (preset === 'week') {
      setDateFrom(format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
      setDateTo(format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'))
    }
  }

  const getExportFilters = () => {
    const base: Record<string, any> = {
      dateFrom,
      dateTo,
    }
    if (branchId) base.branchId = branchId
    if (vehicleCategory) base.vehicleCategory = vehicleCategory
    if (customerType) base.customerType = customerType
    if (activeTab === 'revenue') base.groupBy = groupBy
    if (activeTab === 'investors') base.commissionPercent = commissionPercent
    if (activeTab === 'ar') base.dateAsOf = dateAsOf
    return base
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-headingText">Financial Reports</h1>
          <p className="text-bodyText mt-2">Comprehensive financial analytics and insights</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-borderSoft">
        {(['revenue', 'ar', 'investors', 'utilization'] as ReportType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === tab
                ? 'text-headingText border-b-2 border-sidebarActiveBg'
                : 'text-bodyText hover:text-headingText'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Advanced Filters */}
      <AdvancedFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateChange={(from, to) => {
          setDateFrom(from)
          setDateTo(to)
        }}
        branchId={branchId}
        onBranchChange={setBranchId}
        vehicleCategory={vehicleCategory}
        onVehicleCategoryChange={setVehicleCategory}
        customerType={customerType}
        onCustomerTypeChange={setCustomerType}
        branches={branches}
        vehicleCategories={vehicleCategories}
        showCustomerFilter={activeTab === 'revenue'}
      />

      {/* Additional Report-Specific Filters */}
      <SectionCard>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-headingText">Report Options</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSavePreset(!showSavePreset)}
                className="flex items-center gap-2 px-4 py-2 bg-cardBg border border-borderSoft rounded-lg text-bodyText hover:bg-sidebarMuted/10"
              >
                <Save className="w-4 h-4" />
                Save Preset
              </button>
              {presets.length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      const preset = presets.find((p) => p._id === e.target.value)
                      if (preset) handlePresetLoad(preset)
                    }
                  }}
                  className="px-4 py-2 bg-cardBg border border-borderSoft rounded-lg text-bodyText"
                >
                  <option value="">Load Preset...</option>
                  {presets.map((preset) => (
                    <option key={preset._id} value={preset._id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {showSavePreset && (
            <div className="flex items-center gap-2 p-3 bg-sidebarMuted/5 rounded-lg">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name..."
                className="flex-1 px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
              />
              <button
                onClick={handlePresetSave}
                className="px-4 py-2 bg-sidebarActiveBg text-white rounded hover:opacity-90"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowSavePreset(false)
                  setPresetName('')
                }}
                className="px-4 py-2 bg-cardBg border border-borderSoft rounded text-bodyText hover:bg-sidebarMuted/10"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeTab === 'ar' && (
              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">Date As Of</label>
                <input
                  type="date"
                  value={dateAsOf}
                  onChange={(e) => setDateAsOf(e.target.value)}
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                />
              </div>
            )}
            {activeTab === 'revenue' && (
              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">Group By</label>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as 'day' | 'week' | 'month')}
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              </div>
            )}
            {activeTab === 'investors' && (
              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">
                  Commission %
                </label>
                <input
                  type="number"
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(parseFloat(e.target.value) || 20)}
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  min="0"
                  max="100"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end">
            <ReportExportButton module={activeTab} filters={getExportFilters()} />
          </div>
        </div>
      </SectionCard>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-sidebarActiveBg" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Revenue Report */}
      {activeTab === 'revenue' && revenueData && !loading && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              icon={DollarSign}
              value={`AED ${revenueData.summary.netRentalRevenue.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              label="Total Revenue"
            />
            <StatCard
              icon={TrendingUp}
              value={`AED ${revenueData.summary.grossRentalRevenue.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              label="Gross Revenue"
            />
            <StatCard
              icon={BarChart3}
              value={revenueData.summary.totalBookings}
              label="Total Bookings"
            />
            <StatCard
              icon={FileText}
              value={`AED ${revenueData.summary.averageBookingValue.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              label="Avg Booking Value"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard>
              <h3 className="text-lg font-semibold text-headingText mb-4">Revenue Over Time</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData.byPeriod}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="netRevenue" stroke="#F59E0B" name="Net Revenue" />
                  <Line type="monotone" dataKey="grossRevenue" stroke="#3B82F6" name="Gross Revenue" />
                </LineChart>
              </ResponsiveContainer>
            </SectionCard>

            <SectionCard>
              <h3 className="text-lg font-semibold text-headingText mb-4">Revenue by Branch</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueData.byBranch}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="branch" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="revenue" fill="#F59E0B" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </SectionCard>
          </div>

          {/* Tables */}
          <SectionCard>
            <h3 className="text-lg font-semibold text-headingText mb-4">Revenue by Period</h3>
            <Table
              headers={['Period', 'Gross Revenue', 'Discounts', 'Tax', 'Net Revenue', 'Bookings']}
            >
              {revenueData.byPeriod.map((period: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell>{period.period}</TableCell>
                  <TableCell>
                    AED {period.grossRevenue.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>
                    AED {period.discounts.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>
                    AED {period.tax.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>
                    AED {period.netRevenue.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>{period.bookings}</TableCell>
                </TableRow>
              ))}
            </Table>
          </SectionCard>
        </div>
      )}

      {/* AR Report */}
      {activeTab === 'ar' && arData && !loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <StatCard
              icon={DollarSign}
              value={`AED ${arData.total.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              label="Total AR"
            />
            <StatCard
              icon={FileText}
              value={`AED ${arData.buckets['0-30'].toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              label="0-30 Days"
            />
            <StatCard
              icon={FileText}
              value={`AED ${arData.buckets['31-60'].toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              label="31-60 Days"
            />
            <StatCard
              icon={FileText}
              value={`AED ${arData.buckets['61-90'].toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              label="61-90 Days"
            />
            <StatCard
              icon={FileText}
              value={`AED ${arData.buckets['90+'].toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              label="90+ Days"
            />
          </div>

          <SectionCard>
            <h3 className="text-lg font-semibold text-headingText mb-4">Aging Buckets</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: '0-30 Days', value: arData.buckets['0-30'] },
                    { name: '31-60 Days', value: arData.buckets['31-60'] },
                    { name: '61-90 Days', value: arData.buckets['61-90'] },
                    { name: '90+ Days', value: arData.buckets['90+'] },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {[0, 1, 2, 3].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard>
            <h3 className="text-lg font-semibold text-headingText mb-4">Outstanding Invoices</h3>
            <Table
              headers={[
                'Invoice #',
                'Customer',
                'Due Date',
                'Total',
                'Paid',
                'Balance',
                'Days Overdue',
                'Bucket',
              ]}
            >
              {arData.invoices.map((invoice: any) => (
                <TableRow key={invoice.invoiceNumber}>
                  <TableCell>{invoice.invoiceNumber}</TableCell>
                  <TableCell>{invoice.customerName}</TableCell>
                  <TableCell>{format(new Date(invoice.dueDate), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>
                    AED {invoice.total.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>
                    AED {invoice.paidAmount.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>
                    AED {invoice.balance.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>{invoice.daysOverdue}</TableCell>
                  <TableCell>{invoice.bucket}</TableCell>
                </TableRow>
              ))}
            </Table>
          </SectionCard>
        </div>
      )}

      {/* Investor Payout Report */}
      {activeTab === 'investors' && investorData && !loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <StatCard
              icon={DollarSign}
              value={`AED ${investorData.summary.totalRevenue.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              label="Total Revenue"
            />
            <StatCard
              icon={TrendingUp}
              value={`AED ${investorData.summary.totalCommission.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              label="Total Commission"
            />
            <StatCard
              icon={BarChart3}
              value={`AED ${investorData.summary.totalPayout.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              label="Total Payout"
            />
            <StatCard
              icon={FileText}
              value={investorData.summary.investorCount}
              label="Investors"
            />
          </div>

          <SectionCard>
            <h3 className="text-lg font-semibold text-headingText mb-4">Investor Payouts</h3>
            <Table
              headers={[
                'Investor',
                'Revenue',
                'Commission %',
                'Commission',
                'Net Amount',
                'Bookings',
              ]}
            >
              {investorData.investors.map((investor: any) => (
                <TableRow key={investor.investorId}>
                  <TableCell>{investor.investorName}</TableCell>
                  <TableCell>
                    AED {investor.revenue.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>{investor.commissionPercent}%</TableCell>
                  <TableCell>
                    AED {investor.commission.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>
                    AED {investor.netAmount.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>{investor.bookings}</TableCell>
                </TableRow>
              ))}
            </Table>
          </SectionCard>
        </div>
      )}

      {/* Utilization Report */}
      {activeTab === 'utilization' && utilizationData && !loading && (
        <div className="space-y-6">
          <SectionCard>
            <h3 className="text-lg font-semibold text-headingText mb-4">Utilization by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={utilizationData.byCategory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="avgUtilization" fill="#F59E0B" name="Avg Utilization %" />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          <SectionCard>
            <h3 className="text-lg font-semibold text-headingText mb-4">Vehicle Utilization</h3>
            <Table
              headers={[
                'Plate #',
                'Vehicle',
                'Category',
                'Ownership',
                'Days Available',
                'Days Rented',
                'Utilization %',
                'Revenue',
                'Revenue/Day',
              ]}
            >
              {utilizationData.vehicles.map((vehicle: any) => (
                <TableRow key={vehicle.vehicleId}>
                  <TableCell>{vehicle.plateNumber}</TableCell>
                  <TableCell>
                    {vehicle.brand} {vehicle.model}
                  </TableCell>
                  <TableCell>{vehicle.category}</TableCell>
                  <TableCell>{vehicle.ownershipType}</TableCell>
                  <TableCell>{vehicle.daysAvailable}</TableCell>
                  <TableCell>{vehicle.daysRented}</TableCell>
                  <TableCell>{vehicle.utilizationPercent.toFixed(1)}%</TableCell>
                  <TableCell>
                    AED {vehicle.revenue.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>
                    AED {vehicle.revenuePerDay.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          </SectionCard>
        </div>
      )}
    </div>
  )
}

