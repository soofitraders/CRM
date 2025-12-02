'use client'

import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns'
import StatCard from '@/components/ui/StatCard'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import ReportExportButton from '@/components/export/ReportExportButton'
import AdvancedFilters from '@/components/reports/AdvancedFilters'
import { DollarSign, TrendingUp, TrendingDown, Percent, Loader2, BarChart3, PieChart as PieChartIcon } from 'lucide-react'
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
  ComposedChart,
  Area,
  AreaChart,
} from 'recharts'

type PeriodType = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR'
type ComparisonType = 'PREVIOUS_PERIOD' | 'YEAR_OVER_YEAR' | null

interface PnLData {
  period: {
    from: Date
    to: Date
    type: PeriodType
    label: string
  }
  revenue: {
    total: number
    breakdown: Array<{ period: string; amount: number }>
  }
  cogs: {
    total: number
    byCategory: Array<{
      categoryId: string
      categoryName: string
      categoryCode: string
      amount: number
      percentage: number
    }>
    maintenance: {
      total: number
      byType: Array<{ type: string; amount: number }>
    }
  }
  opex: {
    total: number
    byCategory: Array<{
      categoryId: string
      categoryName: string
      categoryCode: string
      amount: number
      percentage: number
    }>
    fixedCosts: {
      salaries: number
      rent: number
      utilities: number
      other: number
      total: number
    }
  }
  profit: {
    grossProfit: number
    netProfit: number
    grossMargin: number
    netMargin: number
  }
  comparison?: {
    current: {
      revenue: number
      cogs: number
      opex: number
      grossProfit: number
      netProfit: number
      grossMargin: number
      netMargin: number
    }
    previous: {
      revenue: number
      cogs: number
      opex: number
      grossProfit: number
      netProfit: number
      grossMargin: number
      netMargin: number
    }
    change: {
      revenue: number
      revenuePercent: number
      cogs: number
      cogsPercent: number
      opex: number
      opexPercent: number
      grossProfit: number
      grossProfitPercent: number
      netProfit: number
      netProfitPercent: number
      grossMargin: number
      netMargin: number
    }
  }
}

const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#F97316', '#06B6D4', '#EC4899']

export default function ProfitAndLossPage() {
  const [pnlData, setPnLData] = useState<PnLData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [branchId, setBranchId] = useState<string>('')
  const [periodType, setPeriodType] = useState<PeriodType>('MONTH')
  const [compareWith, setCompareWith] = useState<ComparisonType>(null)
  
  // Filter options
  const [branches, setBranches] = useState<string[]>([])
  const [vehicleCategories] = useState<string[]>([])

  // Load filter options
  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const response = await fetch('/api/reports/filter-options')
        if (response.ok) {
          const data = await response.json()
          setBranches(data.branches || [])
        }
      } catch (err) {
        console.error('Failed to load filter options:', err)
      }
    }
    loadFilterOptions()
  }, [])

  useEffect(() => {
    fetchPnLData()
  }, [dateFrom, dateTo, branchId, periodType, compareWith])

  const fetchPnLData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        dateFrom,
        dateTo,
        periodType,
        ...(branchId && { branchId }),
        ...(compareWith && { compareWith }),
      })

      const response = await fetch(`/api/reports/pnl?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch P&L data')
      }

      const data: PnLData = await response.json()
      setPnLData(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load P&L data')
    } finally {
      setLoading(false)
    }
  }

  const applyPeriodPreset = (type: PeriodType) => {
    setPeriodType(type)
    const today = new Date()
    let from: Date
    let to: Date

    switch (type) {
      case 'WEEK':
        from = startOfWeek(today, { weekStartsOn: 0 })
        to = endOfWeek(today, { weekStartsOn: 0 })
        break
      case 'MONTH':
        from = startOfMonth(today)
        to = endOfMonth(today)
        break
      case 'QUARTER':
        from = startOfQuarter(today)
        to = endOfQuarter(today)
        break
      case 'YEAR':
        from = startOfYear(today)
        to = endOfYear(today)
        break
    }

    setDateFrom(format(from, 'yyyy-MM-dd'))
    setDateTo(format(to, 'yyyy-MM-dd'))
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

  if (!pnlData) {
    return <div className="text-center py-12 text-bodyText">No data available</div>
  }

  // Prepare chart data
  const revenueChartData = pnlData.revenue.breakdown.map((rev) => ({
    period: rev.period,
    revenue: rev.amount,
  }))

  const profitMarginData = [
    {
      name: 'Gross Margin',
      value: pnlData.profit.grossMargin,
      color: '#10B981',
    },
    {
      name: 'Net Margin',
      value: pnlData.profit.netMargin,
      color: '#3B82F6',
    },
  ]

  const cogsChartData = pnlData.cogs.byCategory.map((cat) => ({
    name: cat.categoryName,
    value: cat.amount,
    percentage: cat.percentage,
  }))

  const opexChartData = pnlData.opex.byCategory.map((cat) => ({
    name: cat.categoryName,
    value: cat.amount,
    percentage: cat.percentage,
  }))

  const fixedCostsData = [
    { name: 'Salaries', value: pnlData.opex.fixedCosts.salaries, color: '#F59E0B' },
    { name: 'Rent', value: pnlData.opex.fixedCosts.rent, color: '#3B82F6' },
    { name: 'Utilities', value: pnlData.opex.fixedCosts.utilities, color: '#10B981' },
    { name: 'Other', value: pnlData.opex.fixedCosts.other, color: '#EF4444' },
  ]

  const comparisonData = pnlData.comparison
    ? [
        {
          metric: 'Revenue',
          current: pnlData.comparison.current.revenue,
          previous: pnlData.comparison.previous.revenue,
          change: pnlData.comparison.change.revenue,
          changePercent: pnlData.comparison.change.revenuePercent,
        },
        {
          metric: 'COGS',
          current: pnlData.comparison.current.cogs,
          previous: pnlData.comparison.previous.cogs,
          change: pnlData.comparison.change.cogs,
          changePercent: pnlData.comparison.change.cogsPercent,
        },
        {
          metric: 'OPEX',
          current: pnlData.comparison.current.opex,
          previous: pnlData.comparison.previous.opex,
          change: pnlData.comparison.change.opex,
          changePercent: pnlData.comparison.change.opexPercent,
        },
        {
          metric: 'Gross Profit',
          current: pnlData.comparison.current.grossProfit,
          previous: pnlData.comparison.previous.grossProfit,
          change: pnlData.comparison.change.grossProfit,
          changePercent: pnlData.comparison.change.grossProfitPercent,
        },
        {
          metric: 'Net Profit',
          current: pnlData.comparison.current.netProfit,
          previous: pnlData.comparison.previous.netProfit,
          change: pnlData.comparison.change.netProfit,
          changePercent: pnlData.comparison.change.netProfitPercent,
        },
      ]
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-headingText">Profit & Loss</h1>
          <p className="text-bodyText mt-2">Detailed financial performance analysis</p>
        </div>
        <ReportExportButton
          module="pnl"
          filters={{
            dateFrom,
            dateTo,
            periodType,
            ...(branchId && { branchId }),
            ...(compareWith && { compareWith }),
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

      {/* Period Type and Comparison Controls */}
      <SectionCard>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-headingText">Report Period</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-bodyText mb-2">Period Type</label>
              <div className="flex gap-2">
                {(['WEEK', 'MONTH', 'QUARTER', 'YEAR'] as PeriodType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => applyPeriodPreset(type)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      periodType === type
                        ? 'bg-sidebarActiveBg text-white'
                        : 'bg-cardBg border border-borderSoft text-bodyText hover:bg-sidebarMuted/10'
                    }`}
                  >
                    {type.charAt(0) + type.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-bodyText mb-2">Compare With</label>
              <select
                value={compareWith || ''}
                onChange={(e) => setCompareWith(e.target.value as ComparisonType)}
                className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
              >
                <option value="">No Comparison</option>
                <option value="PREVIOUS_PERIOD">Previous Period</option>
                <option value="YEAR_OVER_YEAR">Year Over Year</option>
              </select>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={DollarSign}
          value={formatCurrency(pnlData.revenue.total)}
          label="Total Revenue"
        />
        <StatCard
          icon={TrendingDown}
          value={formatCurrency(pnlData.cogs.total + pnlData.opex.total)}
          label="Total Expenses"
        />
        <StatCard
          icon={pnlData.profit.netProfit >= 0 ? TrendingUp : TrendingDown}
          value={formatCurrency(pnlData.profit.netProfit)}
          label="Net Profit"
        />
        <StatCard
          icon={Percent}
          value={`${pnlData.profit.netMargin.toFixed(2)}%`}
          label="Net Profit Margin"
        />
      </div>

      {/* Profit Margins */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard>
          <h3 className="text-lg font-semibold text-headingText mb-4">Profit Margins</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-bodyText">Gross Profit Margin</span>
                <span className="text-lg font-semibold text-headingText">
                  {pnlData.profit.grossMargin.toFixed(2)}%
                </span>
              </div>
              <div className="w-full bg-sidebarMuted/10 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{ width: `${Math.min(pnlData.profit.grossMargin, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-sidebarMuted mt-1">
                Gross Profit: {formatCurrency(pnlData.profit.grossProfit)}
              </p>
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-bodyText">Net Profit Margin</span>
                <span className="text-lg font-semibold text-headingText">
                  {pnlData.profit.netMargin.toFixed(2)}%
                </span>
              </div>
              <div className="w-full bg-sidebarMuted/10 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all"
                  style={{ width: `${Math.min(pnlData.profit.netMargin, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-sidebarMuted mt-1">
                Net Profit: {formatCurrency(pnlData.profit.netProfit)}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <h3 className="text-lg font-semibold text-headingText mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="period" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.3}
                name="Revenue"
              />
            </AreaChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Period Comparison */}
      {pnlData.comparison && (
        <SectionCard>
          <h3 className="text-lg font-semibold text-headingText mb-4">Period Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis dataKey="metric" stroke="#9CA3AF" fontSize={12} />
              <YAxis stroke="#9CA3AF" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="current" fill="#10B981" name="Current Period" />
              <Bar dataKey="previous" fill="#6B7280" name="Previous Period" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4">
            <Table
              headers={['Metric', 'Current', 'Previous', 'Change', 'Change %']}
            >
              {comparisonData.map((item) => (
                <TableRow key={item.metric}>
                  <TableCell className="font-medium text-headingText">{item.metric}</TableCell>
                  <TableCell>{formatCurrency(item.current)}</TableCell>
                  <TableCell>{formatCurrency(item.previous)}</TableCell>
                  <TableCell
                    className={
                      item.change >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'
                    }
                  >
                    {item.change >= 0 ? '+' : ''}
                    {formatCurrency(item.change)}
                  </TableCell>
                  <TableCell
                    className={
                      item.changePercent >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'
                    }
                  >
                    {item.changePercent >= 0 ? '+' : ''}
                    {item.changePercent.toFixed(2)}%
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          </div>
        </SectionCard>
      )}

      {/* Cost Breakdown Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard>
          <h3 className="text-lg font-semibold text-headingText mb-4">COGS by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={cogsChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {cogsChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard>
          <h3 className="text-lg font-semibold text-headingText mb-4">OPEX by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={opexChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage.toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {opexChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      {/* Fixed Costs Breakdown */}
      <SectionCard>
        <h3 className="text-lg font-semibold text-headingText mb-4">Fixed Costs Breakdown</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={fixedCostsData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
            <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
            <YAxis stroke="#9CA3AF" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {fixedCostsData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      {/* Detailed Breakdown Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard>
          <h3 className="text-lg font-semibold text-headingText mb-4">
            Cost of Goods Sold (COGS)
          </h3>
          <Table headers={['Category', 'Amount', 'Percentage']}>
            {pnlData.cogs.byCategory.map((cat) => (
              <TableRow key={cat.categoryId}>
                <TableCell>{cat.categoryName}</TableCell>
                <TableCell>{formatCurrency(cat.amount)}</TableCell>
                <TableCell>{cat.percentage.toFixed(2)}%</TableCell>
              </TableRow>
            ))}
            {pnlData.cogs.maintenance.total > 0 && (
              <>
                <TableRow>
                  <TableCell className="font-medium">Maintenance Costs</TableCell>
                  <TableCell>{formatCurrency(pnlData.cogs.maintenance.total)}</TableCell>
                  <TableCell>
                    {pnlData.cogs.total > 0
                      ? ((pnlData.cogs.maintenance.total / pnlData.cogs.total) * 100).toFixed(2)
                      : 0}
                    %
                  </TableCell>
                </TableRow>
                {pnlData.cogs.maintenance.byType.map((maint) => (
                  <TableRow key={maint.type}>
                    <TableCell className="pl-6 text-sm text-sidebarMuted">
                      - {maint.type}
                    </TableCell>
                    <TableCell className="text-sm">{formatCurrency(maint.amount)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                ))}
              </>
            )}
            <TableRow>
              <TableCell className="font-semibold">Total COGS</TableCell>
              <TableCell className="font-semibold">{formatCurrency(pnlData.cogs.total)}</TableCell>
              <TableCell className="font-semibold">100%</TableCell>
            </TableRow>
          </Table>
        </SectionCard>

        <SectionCard>
          <h3 className="text-lg font-semibold text-headingText mb-4">
            Operating Expenses (OPEX)
          </h3>
          <Table headers={['Category', 'Amount', 'Percentage']}>
            {pnlData.opex.byCategory.map((cat) => (
              <TableRow key={cat.categoryId}>
                <TableCell>{cat.categoryName}</TableCell>
                <TableCell>{formatCurrency(cat.amount)}</TableCell>
                <TableCell>{cat.percentage.toFixed(2)}%</TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className="font-semibold">Total OPEX</TableCell>
              <TableCell className="font-semibold">{formatCurrency(pnlData.opex.total)}</TableCell>
              <TableCell className="font-semibold">100%</TableCell>
            </TableRow>
          </Table>

          <div className="mt-6 pt-6 border-t border-borderSoft">
            <h4 className="text-md font-semibold text-headingText mb-3">Fixed Costs Detail</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-bodyText">Salaries</span>
                <span className="text-sm font-medium text-headingText">
                  {formatCurrency(pnlData.opex.fixedCosts.salaries)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-bodyText">Rent</span>
                <span className="text-sm font-medium text-headingText">
                  {formatCurrency(pnlData.opex.fixedCosts.rent)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-bodyText">Utilities</span>
                <span className="text-sm font-medium text-headingText">
                  {formatCurrency(pnlData.opex.fixedCosts.utilities)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-bodyText">Other Fixed Costs</span>
                <span className="text-sm font-medium text-headingText">
                  {formatCurrency(pnlData.opex.fixedCosts.other)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-borderSoft">
                <span className="text-sm font-semibold text-headingText">Total Fixed Costs</span>
                <span className="text-sm font-semibold text-headingText">
                  {formatCurrency(pnlData.opex.fixedCosts.total)}
                </span>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Profit Summary */}
      <SectionCard>
        <h3 className="text-lg font-semibold text-headingText mb-4">Profit Summary</h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-bodyText mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-headingText">
                {formatCurrency(pnlData.revenue.total)}
              </p>
            </div>
            <div>
              <p className="text-sm text-bodyText mb-1">Total COGS</p>
              <p className="text-2xl font-bold text-red-600">
                -{formatCurrency(pnlData.cogs.total)}
              </p>
            </div>
            <div>
              <p className="text-sm text-bodyText mb-1">Gross Profit</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(pnlData.profit.grossProfit)}
              </p>
              <p className="text-sm text-sidebarMuted mt-1">
                Gross Margin: {pnlData.profit.grossMargin.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-sm text-bodyText mb-1">Total OPEX</p>
              <p className="text-2xl font-bold text-red-600">
                -{formatCurrency(pnlData.opex.total)}
              </p>
            </div>
          </div>
          <div className="border-t border-borderSoft pt-4">
            <div className="flex justify-between items-center">
              <p className="text-lg font-semibold text-headingText">Net Profit</p>
              <p
                className={`text-3xl font-bold ${
                  pnlData.profit.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(pnlData.profit.netProfit)}
              </p>
            </div>
            <p className="text-sm text-sidebarMuted mt-2">
              Net Profit Margin: {pnlData.profit.netMargin.toFixed(2)}%
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
