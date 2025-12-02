'use client'

import { useState, useEffect } from 'react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import StatCard from '@/components/ui/StatCard'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import ReportExportButton from '@/components/export/ReportExportButton'
import AdvancedFilters from '@/components/reports/AdvancedFilters'
import { DollarSign, TrendingUp, Users, Percent, Loader2, BarChart3, PieChart as PieChartIcon, FileText } from 'lucide-react'
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
  LineChart,
  Line,
  ComposedChart,
  Area,
  AreaChart,
} from 'recharts'

const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#F97316', '#06B6D4', '#EC4899']

interface InvestorPerformance {
  investorId: string
  investorName: string
  companyName?: string
  totalVehicles: number
  totalRevenue: number
  totalCommission: number
  totalNetPayout: number
  averageCommissionPercent: number
  totalBookings: number
  revenuePerVehicle: number
  commissionPerVehicle: number
  vehicles: Array<{
    vehicleId: string
    plateNumber: string
    brand: string
    model: string
    category: string
    revenue: number
    bookingsCount: number
    commission: number
    netPayout: number
    revenuePerVehicle: number
    commissionPerVehicle: number
  }>
}

interface PayoutDetail {
  payoutId: string
  periodFrom: string
  periodTo: string
  totalRevenue: number
  commissionPercent: number
  commissionAmount: number
  netPayout: number
  status: string
  paymentStatus?: string
  paidAt?: string
  createdAt: string
}

interface CommissionAnalysis {
  investorId: string
  investorName: string
  commissionPercent: number
  totalRevenue: number
  commissionAmount: number
  netPayout: number
  commissionImpact: number
  effectiveRate: number
}

interface InvestorReportData {
  summary: {
    totalInvestors: number
    totalRevenue: number
    totalCommission: number
    totalNetPayout: number
    averageCommissionPercent: number
  }
  investors: InvestorPerformance[]
  payouts: PayoutDetail[]
  commissionAnalysis: CommissionAnalysis[]
}

export default function InvestorReportsPage() {
  const [reportData, setReportData] = useState<InvestorReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [branchId, setBranchId] = useState<string>('')
  const [investorId, setInvestorId] = useState<string>('')

  // Filter options
  const [branches, setBranches] = useState<string[]>([])
  const [investors, setInvestors] = useState<Array<{ _id: string; name: string; companyName?: string }>>([])
  const [vehicleCategories] = useState<string[]>([])

  // Load filter options
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [branchesRes, investorsRes] = await Promise.all([
          fetch('/api/reports/filter-options'),
          fetch('/api/investors'),
        ])

        if (branchesRes.ok) {
          const branchesData = await branchesRes.json()
          setBranches(branchesData.branches || [])
        }

        if (investorsRes.ok) {
          const investorsData = await investorsRes.json()
          setInvestors(
            investorsData.investors?.map((inv: any) => ({
              _id: inv._id,
              name: inv.user?.name || 'Unknown',
              companyName: inv.companyName,
            })) || []
          )
        }
      } catch (err) {
        console.error('Failed to load filter options:', err)
      }
    }
    loadFilterOptions()
  }, [])

  useEffect(() => {
    fetchReportData()
  }, [dateFrom, dateTo, branchId, investorId])

  const fetchReportData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        ...(branchId && { branchId }),
        ...(investorId && { investorId }),
      })

      const response = await fetch(`/api/reports/investors/performance?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch investor report')
      }

      const data: InvestorReportData = await response.json()
      setReportData(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load investor report')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return `AED ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-sidebarActiveBg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
        {error}
      </div>
    )
  }

  if (!reportData) {
    return <div className="text-center py-12 text-bodyText">No data available</div>
  }

  // Prepare chart data
  const investorChartData = reportData.investors.map((inv) => ({
    name: inv.companyName || inv.investorName,
    revenue: inv.totalRevenue,
    commission: inv.totalCommission,
    netPayout: inv.totalNetPayout,
  }))

  const commissionChartData = reportData.commissionAnalysis.map((analysis) => ({
    name: analysis.investorName,
    commissionPercent: analysis.commissionPercent,
    commissionAmount: analysis.commissionAmount,
    revenue: analysis.totalRevenue,
  }))

  const topPerformers = reportData.investors
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-headingText">Investor Reports</h1>
          <p className="text-bodyText mt-2">Comprehensive investor performance and payout analysis</p>
        </div>
        <ReportExportButton
          module="investors"
          filters={{
            dateFrom,
            dateTo,
            ...(branchId && { branchId }),
            ...(investorId && { investorId }),
          }}
        />
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
        vehicleCategory=""
        onVehicleCategoryChange={() => {}}
        customerType=""
        onCustomerTypeChange={() => {}}
        branches={branches}
        vehicleCategories={vehicleCategories}
        showCustomerFilter={false}
      />

      {/* Investor Filter */}
      <SectionCard>
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-headingText">Investor Filter</h3>
          <div>
            <label className="block text-sm font-medium text-bodyText mb-2">Select Investor</label>
            <select
              value={investorId}
              onChange={(e) => setInvestorId(e.target.value)}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            >
              <option value="">All Investors</option>
              {investors.map((inv) => (
                <option key={inv._id} value={inv._id}>
                  {inv.name} {inv.companyName ? `(${inv.companyName})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          icon={Users}
          value={reportData.summary.totalInvestors}
          label="Total Investors"
        />
        <StatCard
          icon={DollarSign}
          value={formatCurrency(reportData.summary.totalRevenue)}
          label="Total Revenue"
        />
        <StatCard
          icon={TrendingUp}
          value={formatCurrency(reportData.summary.totalCommission)}
          label="Total Commission"
        />
        <StatCard
          icon={DollarSign}
          value={formatCurrency(reportData.summary.totalNetPayout)}
          label="Total Net Payout"
        />
        <StatCard
          icon={Percent}
          value={`${reportData.summary.averageCommissionPercent.toFixed(2)}%`}
          label="Avg Commission %"
        />
      </div>

      {/* Investor Performance Chart */}
      <SectionCard>
        <h3 className="text-lg font-semibold text-headingText mb-4">Investor Performance Overview</h3>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={investorChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
            <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} angle={-45} textAnchor="end" height={100} />
            <YAxis stroke="#9CA3AF" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Legend />
            <Bar dataKey="revenue" fill="#10B981" name="Revenue" />
            <Bar dataKey="commission" fill="#F59E0B" name="Commission" />
            <Bar dataKey="netPayout" fill="#3B82F6" name="Net Payout" />
          </ComposedChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Commission Analysis */}
      <SectionCard>
        <h3 className="text-lg font-semibold text-headingText mb-4">Commission Analysis</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={commissionChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
            <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} angle={-45} textAnchor="end" height={100} />
            <YAxis stroke="#9CA3AF" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Legend />
            <Bar dataKey="commissionAmount" fill="#F59E0B" name="Commission Amount" />
            <Bar dataKey="revenue" fill="#10B981" name="Total Revenue" />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Top Performers */}
      <SectionCard>
        <h3 className="text-lg font-semibold text-headingText mb-4">Top Performing Investors</h3>
        <Table
          headers={[
            'Investor',
            'Vehicles',
            'Total Revenue',
            'Commission %',
            'Commission',
            'Net Payout',
            'Revenue/Vehicle',
            'Bookings',
          ]}
        >
          {topPerformers.map((investor) => (
            <TableRow key={investor.investorId}>
              <TableCell>
                <div>
                  <div className="font-medium text-headingText">
                    {investor.companyName || investor.investorName}
                  </div>
                  {investor.companyName && (
                    <div className="text-xs text-sidebarMuted">{investor.investorName}</div>
                  )}
                </div>
              </TableCell>
              <TableCell>{investor.totalVehicles}</TableCell>
              <TableCell className="font-semibold">{formatCurrency(investor.totalRevenue)}</TableCell>
              <TableCell>{investor.averageCommissionPercent.toFixed(2)}%</TableCell>
              <TableCell>{formatCurrency(investor.totalCommission)}</TableCell>
              <TableCell className="font-semibold text-green-600">
                {formatCurrency(investor.totalNetPayout)}
              </TableCell>
              <TableCell>{formatCurrency(investor.revenuePerVehicle)}</TableCell>
              <TableCell>{investor.totalBookings}</TableCell>
            </TableRow>
          ))}
        </Table>
      </SectionCard>

      {/* Detailed Investor Performance */}
      {reportData.investors.map((investor) => (
        <SectionCard key={investor.investorId}>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-headingText">
              {investor.companyName || investor.investorName} - Performance Details
            </h3>
            {investor.companyName && (
              <p className="text-sm text-sidebarMuted">{investor.investorName}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <p className="text-sm text-bodyText mb-1">Total Revenue</p>
              <p className="text-xl font-bold text-headingText">{formatCurrency(investor.totalRevenue)}</p>
            </div>
            <div>
              <p className="text-sm text-bodyText mb-1">Total Commission</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(investor.totalCommission)}</p>
              <p className="text-xs text-sidebarMuted">
                {investor.averageCommissionPercent.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-bodyText mb-1">Net Payout</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(investor.totalNetPayout)}</p>
            </div>
            <div>
              <p className="text-sm text-bodyText mb-1">Revenue per Vehicle</p>
              <p className="text-xl font-bold text-headingText">
                {formatCurrency(investor.revenuePerVehicle)}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="text-md font-semibold text-headingText mb-3">Vehicle Breakdown</h4>
            <Table
              headers={[
                'Plate #',
                'Vehicle',
                'Category',
                'Revenue',
                'Commission',
                'Net Payout',
                'Bookings',
              ]}
            >
              {investor.vehicles.map((vehicle) => (
                <TableRow key={vehicle.vehicleId}>
                  <TableCell className="font-medium">{vehicle.plateNumber}</TableCell>
                  <TableCell>
                    {vehicle.brand} {vehicle.model}
                  </TableCell>
                  <TableCell>{vehicle.category}</TableCell>
                  <TableCell>{formatCurrency(vehicle.revenue)}</TableCell>
                  <TableCell>{formatCurrency(vehicle.commission)}</TableCell>
                  <TableCell className="font-semibold text-green-600">
                    {formatCurrency(vehicle.netPayout)}
                  </TableCell>
                  <TableCell>{vehicle.bookingsCount}</TableCell>
                </TableRow>
              ))}
            </Table>
          </div>
        </SectionCard>
      ))}

      {/* Payout Details */}
      {reportData.payouts.length > 0 && (
        <SectionCard>
          <h3 className="text-lg font-semibold text-headingText mb-4">Payout History</h3>
          <Table
            headers={[
              'Period From',
              'Period To',
              'Total Revenue',
              'Commission %',
              'Commission',
              'Net Payout',
              'Status',
              'Payment Status',
              'Paid At',
            ]}
          >
            {reportData.payouts.map((payout) => (
              <TableRow key={payout.payoutId}>
                <TableCell>{format(new Date(payout.periodFrom), 'MMM dd, yyyy')}</TableCell>
                <TableCell>{format(new Date(payout.periodTo), 'MMM dd, yyyy')}</TableCell>
                <TableCell>{formatCurrency(payout.totalRevenue)}</TableCell>
                <TableCell>{payout.commissionPercent.toFixed(2)}%</TableCell>
                <TableCell>{formatCurrency(payout.commissionAmount)}</TableCell>
                <TableCell className="font-semibold text-green-600">
                  {formatCurrency(payout.netPayout)}
                </TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      payout.status === 'PAID'
                        ? 'bg-green-100 text-green-800'
                        : payout.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {payout.status}
                  </span>
                </TableCell>
                <TableCell>
                  {payout.paymentStatus ? (
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        payout.paymentStatus === 'SUCCESS'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {payout.paymentStatus}
                    </span>
                  ) : (
                    <span className="text-sidebarMuted">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {payout.paidAt ? format(new Date(payout.paidAt), 'MMM dd, yyyy') : '—'}
                </TableCell>
              </TableRow>
            ))}
          </Table>
        </SectionCard>
      )}
    </div>
  )
}

