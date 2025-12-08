'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import SectionCard from '@/components/ui/SectionCard'
import { Loader2, ArrowLeft, Calendar, TrendingUp, Car, Coins, DollarSign, Target, TrendingDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils/format'

export default function VehiclePerformancePage() {
  const params = useParams()
  const router = useRouter()
  const vehicleId = params.id as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reportData, setReportData] = useState<any>(null)
  const [period, setPeriod] = useState<'WEEK' | 'MONTH' | 'YEAR'>('MONTH')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    fetchReportData()
  }, [vehicleId, period, dateFrom, dateTo])

  const fetchReportData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        vehicleId,
        period,
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      })

      const response = await fetch(`/api/reports/vehicle-performance?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch vehicle performance')
      }

      const data = await response.json()
      setReportData(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load vehicle performance')
    } finally {
      setLoading(false)
    }
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

  const { vehicle, period: periodInfo, purchaseCost, metrics, weeklyBreakdown, monthlyBreakdown, yearlyBreakdown, bookings } = reportData

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-pageBg rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-bodyText" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-headingText">Vehicle Performance Report</h1>
            <p className="text-bodyText mt-1">
              {vehicle.plateNumber} - {vehicle.brand} {vehicle.model}
              {vehicle.color && ` (${vehicle.color})`}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <SectionCard>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-headingText mb-2">Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as 'WEEK' | 'MONTH' | 'YEAR')}
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20"
            >
              <option value="WEEK">This Week</option>
              <option value="MONTH">This Month</option>
              <option value="YEAR">This Year</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-headingText mb-2">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-headingText mb-2">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setDateFrom('')
                setDateTo('')
                setPeriod('MONTH')
              }}
              className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText hover:bg-borderSoft transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SectionCard>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Coins className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-sidebarMuted">Total Revenue</p>
              <p className="text-2xl font-bold text-headingText">
                {formatCurrency(metrics.totalRevenue)}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Car className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-sidebarMuted">Total Bookings</p>
              <p className="text-2xl font-bold text-headingText">{metrics.totalBookings}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-sidebarMuted">Utilization Rate</p>
              <p className="text-2xl font-bold text-headingText">{metrics.utilizationRate.toFixed(1)}%</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-sidebarMuted">Days Rented</p>
              <p className="text-2xl font-bold text-headingText">
                {metrics.daysRented} / {periodInfo.days}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Purchase Cost & Break-Even Metrics */}
      {purchaseCost !== undefined && (
        <SectionCard>
          <h3 className="text-lg font-semibold text-headingText mb-4">Purchase Cost & Break-Even Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-gray-600" />
                <p className="text-sm text-sidebarMuted">Purchase Cost</p>
              </div>
              <p className="text-2xl font-bold text-headingText">
                {purchaseCost.hasPurchaseCost ? formatCurrency(purchaseCost.amount) : 'Not Recorded'}
              </p>
              {!purchaseCost.hasPurchaseCost && (
                <p className="text-xs text-sidebarMuted mt-1">
                  Add expense with "PURCHASE PRICE FROM AUCTION" category
                </p>
              )}
            </div>

            <div className={`p-4 rounded-lg ${
              metrics.breakEvenStatus === 'BREAK_EVEN' 
                ? 'bg-green-50' 
                : metrics.breakEvenStatus === 'NOT_BREAK_EVEN'
                ? 'bg-yellow-50'
                : 'bg-gray-50'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Target className={`w-5 h-5 ${
                  metrics.breakEvenStatus === 'BREAK_EVEN' 
                    ? 'text-green-600' 
                    : metrics.breakEvenStatus === 'NOT_BREAK_EVEN'
                    ? 'text-yellow-600'
                    : 'text-gray-600'
                }`} />
                <p className="text-sm text-sidebarMuted">Break-Even Status</p>
              </div>
              <p className={`text-xl font-bold ${
                metrics.breakEvenStatus === 'BREAK_EVEN' 
                  ? 'text-green-600' 
                  : metrics.breakEvenStatus === 'NOT_BREAK_EVEN'
                  ? 'text-yellow-600'
                  : 'text-headingText'
              }`}>
                {metrics.breakEvenStatus === 'BREAK_EVEN' 
                  ? '✓ Break-Even Reached' 
                  : metrics.breakEvenStatus === 'NOT_BREAK_EVEN'
                  ? 'Not Yet Break-Even'
                  : 'No Purchase Cost'}
              </p>
              <p className="text-sm text-sidebarMuted mt-1">
                {metrics.breakEvenPercentage.toFixed(1)}% of purchase cost recovered
              </p>
            </div>

            {metrics.breakEvenStatus === 'NOT_BREAK_EVEN' && (
              <div className="p-4 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-5 h-5 text-yellow-600" />
                  <p className="text-sm text-sidebarMuted">Remaining to Break-Even</p>
                </div>
                <p className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(metrics.remainingToBreakEven)}
                </p>
              </div>
            )}

            {metrics.breakEvenStatus === 'BREAK_EVEN' && (
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  <p className="text-sm text-sidebarMuted">Profit After Break-Even</p>
                </div>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(metrics.profitAfterBreakEven)}
                </p>
              </div>
            )}

            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-5 h-5 text-blue-600" />
                <p className="text-sm text-sidebarMuted">Net Profit/Loss</p>
              </div>
              <p className={`text-2xl font-bold ${
                metrics.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(metrics.netProfit)}
              </p>
              <p className="text-xs text-sidebarMuted mt-1">
                Revenue - Purchase Cost
              </p>
            </div>
          </div>

          {/* Break-Even Progress Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-headingText">Break-Even Progress</p>
              <p className="text-sm text-sidebarMuted">{metrics.breakEvenPercentage.toFixed(1)}%</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  metrics.breakEvenStatus === 'BREAK_EVEN'
                    ? 'bg-green-500'
                    : 'bg-yellow-500'
                }`}
                style={{ width: `${Math.min(100, metrics.breakEvenPercentage)}%` }}
              />
            </div>
          </div>
        </SectionCard>
      )}

      {/* Additional Metrics */}
      <SectionCard>
        <h3 className="text-lg font-semibold text-headingText mb-4">Performance Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-sidebarMuted">Average Daily Revenue</p>
            <p className="text-xl font-bold text-headingText">
              {formatCurrency(metrics.averageDailyRevenue)}
            </p>
          </div>
          <div>
            <p className="text-sm text-sidebarMuted">Average Revenue per Booking</p>
            <p className="text-xl font-bold text-headingText">
              {formatCurrency(metrics.averageRevenuePerBooking)}
            </p>
          </div>
          <div>
            <p className="text-sm text-sidebarMuted">Days Available</p>
            <p className="text-xl font-bold text-headingText">{metrics.daysAvailable}</p>
          </div>
        </div>
      </SectionCard>

      {/* Revenue Breakdown Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Breakdown */}
        {weeklyBreakdown && weeklyBreakdown.length > 0 && (
          <SectionCard>
            <h3 className="text-lg font-semibold text-headingText mb-4">Weekly Revenue Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={weeklyBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="period" 
                  tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(value) => `Week of ${format(new Date(value), 'MMM dd, yyyy')}`}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#3B82F6" name="Revenue (AED)" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-sidebarMuted">Total Weeks</p>
                <p className="font-semibold text-headingText">{weeklyBreakdown.length}</p>
              </div>
              <div>
                <p className="text-sidebarMuted">Avg Weekly Revenue</p>
                <p className="font-semibold text-headingText">
                  {formatCurrency(
                    weeklyBreakdown.length > 0
                      ? weeklyBreakdown.reduce((sum: number, w: any) => sum + w.revenue, 0) / weeklyBreakdown.length
                      : 0
                  )}
                </p>
              </div>
              <div>
                <p className="text-sidebarMuted">Best Week</p>
                <p className="font-semibold text-headingText">
                  {formatCurrency(
                    weeklyBreakdown.length > 0
                      ? Math.max(...weeklyBreakdown.map((w: any) => w.revenue))
                      : 0
                  )}
                </p>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Monthly Breakdown */}
        {monthlyBreakdown && monthlyBreakdown.length > 0 && (
          <SectionCard>
            <h3 className="text-lg font-semibold text-headingText mb-4">Monthly Revenue Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="period" 
                  tickFormatter={(value) => format(new Date(value + '-01'), 'MMM yyyy')}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(value) => format(new Date(value + '-01'), 'MMMM yyyy')}
                />
                <Legend />
                <Bar dataKey="revenue" fill="#F97316" name="Revenue (AED)" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-sidebarMuted">Total Months</p>
                <p className="font-semibold text-headingText">{monthlyBreakdown.length}</p>
              </div>
              <div>
                <p className="text-sidebarMuted">Avg Monthly Revenue</p>
                <p className="font-semibold text-headingText">
                  {formatCurrency(
                    monthlyBreakdown.length > 0
                      ? monthlyBreakdown.reduce((sum: number, m: any) => sum + m.revenue, 0) / monthlyBreakdown.length
                      : 0
                  )}
                </p>
              </div>
              <div>
                <p className="text-sidebarMuted">Best Month</p>
                <p className="font-semibold text-headingText">
                  {formatCurrency(
                    monthlyBreakdown.length > 0
                      ? Math.max(...monthlyBreakdown.map((m: any) => m.revenue))
                      : 0
                  )}
                </p>
              </div>
            </div>
          </SectionCard>
        )}
      </div>

      {/* Yearly Breakdown */}
      {yearlyBreakdown && yearlyBreakdown.length > 0 && (
        <SectionCard>
          <h3 className="text-lg font-semibold text-headingText mb-4">Yearly Revenue Breakdown</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={yearlyBreakdown}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="revenue" fill="#10B981" name="Revenue (AED)" />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-sidebarMuted">Total Years</p>
              <p className="font-semibold text-headingText">{yearlyBreakdown.length}</p>
            </div>
            <div>
              <p className="text-sidebarMuted">Avg Yearly Revenue</p>
              <p className="font-semibold text-headingText">
                {formatCurrency(
                  yearlyBreakdown.length > 0
                    ? yearlyBreakdown.reduce((sum: number, y: any) => sum + y.revenue, 0) / yearlyBreakdown.length
                    : 0
                )}
              </p>
            </div>
            <div>
              <p className="text-sidebarMuted">Best Year</p>
              <p className="font-semibold text-headingText">
                {formatCurrency(
                  yearlyBreakdown.length > 0
                    ? Math.max(...yearlyBreakdown.map((y: any) => y.revenue))
                    : 0
                )}
              </p>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Revenue Summary Table */}
      <SectionCard>
        <h3 className="text-lg font-semibold text-headingText mb-4">Revenue Summary by Period</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-borderSoft">
                <th className="text-left py-3 px-4 text-sm font-semibold text-headingText">Period</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-headingText">Revenue</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-headingText">Bookings</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-headingText">Days Rented</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-headingText">Avg Daily Revenue</th>
              </tr>
            </thead>
            <tbody>
              {period === 'WEEK' && weeklyBreakdown && weeklyBreakdown.map((week: any) => (
                <tr key={week.period} className="border-b border-borderSoft hover:bg-pageBg">
                  <td className="py-3 px-4 text-bodyText">
                    Week of {format(new Date(week.period), 'MMM dd, yyyy')}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-headingText">
                    {formatCurrency(week.revenue)}
                  </td>
                  <td className="py-3 px-4 text-right text-bodyText">{week.bookings}</td>
                  <td className="py-3 px-4 text-right text-bodyText">{week.days}</td>
                  <td className="py-3 px-4 text-right text-bodyText">
                    {formatCurrency(week.days > 0 ? week.revenue / week.days : 0)}
                  </td>
                </tr>
              ))}
              {period === 'MONTH' && monthlyBreakdown && monthlyBreakdown.map((month: any) => (
                <tr key={month.period} className="border-b border-borderSoft hover:bg-pageBg">
                  <td className="py-3 px-4 text-bodyText">
                    {format(new Date(month.period + '-01'), 'MMMM yyyy')}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-headingText">
                    {formatCurrency(month.revenue)}
                  </td>
                  <td className="py-3 px-4 text-right text-bodyText">{month.bookings}</td>
                  <td className="py-3 px-4 text-right text-bodyText">{month.days}</td>
                  <td className="py-3 px-4 text-right text-bodyText">
                    {formatCurrency(month.days > 0 ? month.revenue / month.days : 0)}
                  </td>
                </tr>
              ))}
              {period === 'YEAR' && yearlyBreakdown && yearlyBreakdown.map((year: any) => (
                <tr key={year.period} className="border-b border-borderSoft hover:bg-pageBg">
                  <td className="py-3 px-4 text-bodyText font-medium">{year.period}</td>
                  <td className="py-3 px-4 text-right font-semibold text-headingText">
                    {formatCurrency(year.revenue)}
                  </td>
                  <td className="py-3 px-4 text-right text-bodyText">{year.bookings}</td>
                  <td className="py-3 px-4 text-right text-bodyText">{year.days}</td>
                  <td className="py-3 px-4 text-right text-bodyText">
                    {formatCurrency(year.days > 0 ? year.revenue / year.days : 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Bookings List */}
      {bookings.length > 0 && (
        <SectionCard>
          <h3 className="text-lg font-semibold text-headingText mb-4">Booking Details</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-borderSoft">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-headingText">Start Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-headingText">End Date</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-headingText">Days</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-headingText">Revenue</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-headingText">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking: any) => (
                  <tr key={booking.bookingId} className="border-b border-borderSoft hover:bg-pageBg">
                    <td className="py-3 px-4 text-bodyText">
                      {format(new Date(booking.startDate), 'MMM dd, yyyy')}
                    </td>
                    <td className="py-3 px-4 text-bodyText">
                      {booking.endDate ? format(new Date(booking.endDate), 'MMM dd, yyyy') : 'Open'}
                    </td>
                    <td className="py-3 px-4 text-bodyText">{booking.days}</td>
                    <td className="py-3 px-4 font-semibold text-headingText">
                      {formatCurrency(booking.revenue)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  )
}

