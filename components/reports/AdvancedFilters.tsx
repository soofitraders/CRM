'use client'

import { useState } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subWeeks, subDays } from 'date-fns'
import { Calendar, X } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'

export type DatePreset = 'CUSTOM' | 'THIS_WEEK' | 'LAST_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'YEAR_TO_DATE' | 'LAST_12_MONTHS'

interface AdvancedFiltersProps {
  dateFrom: string
  dateTo: string
  onDateChange: (from: string, to: string) => void
  branchId: string
  onBranchChange: (branchId: string) => void
  vehicleCategory: string
  onVehicleCategoryChange: (category: string) => void
  customerType: string
  onCustomerTypeChange: (type: string) => void
  branches: string[]
  vehicleCategories: string[]
  showCustomerFilter?: boolean
}

export default function AdvancedFilters({
  dateFrom,
  dateTo,
  onDateChange,
  branchId,
  onBranchChange,
  vehicleCategory,
  onVehicleCategoryChange,
  customerType,
  onCustomerTypeChange,
  branches,
  vehicleCategories,
  showCustomerFilter = true,
}: AdvancedFiltersProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>('CUSTOM')
  const [showCustomDate, setShowCustomDate] = useState(false)

  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset)
    
    // Handle CUSTOM preset separately
    if (preset === 'CUSTOM') {
      setShowCustomDate(true)
      return
    }
    
    const today = new Date()
    let from: Date
    let to: Date = new Date()

    switch (preset) {
      case 'THIS_WEEK':
        from = startOfWeek(today, { weekStartsOn: 0 })
        to = endOfWeek(today, { weekStartsOn: 0 })
        break
      case 'LAST_WEEK':
        from = startOfWeek(subWeeks(today, 1), { weekStartsOn: 0 })
        to = endOfWeek(subWeeks(today, 1), { weekStartsOn: 0 })
        break
      case 'THIS_MONTH':
        from = startOfMonth(today)
        to = endOfMonth(today)
        break
      case 'LAST_MONTH':
        from = startOfMonth(subMonths(today, 1))
        to = endOfMonth(subMonths(today, 1))
        break
      case 'YEAR_TO_DATE':
        from = startOfYear(today)
        to = today
        break
      case 'LAST_12_MONTHS':
        from = subMonths(today, 12)
        to = today
        break
      default:
        setShowCustomDate(true)
        return
    }

    onDateChange(format(from, 'yyyy-MM-dd'), format(to, 'yyyy-MM-dd'))
    setShowCustomDate(false)
  }

  const handleCustomDateChange = (from: string, to: string) => {
    onDateChange(from, to)
    if (from && to) {
      setDatePreset('CUSTOM')
    }
  }

  return (
    <SectionCard>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-headingText">Advanced Filters</h3>
        </div>

        {/* Date Range Filters */}
        <div>
          <label className="block text-sm font-medium text-bodyText mb-2">Date Range</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {(['THIS_WEEK', 'LAST_WEEK', 'THIS_MONTH', 'LAST_MONTH', 'YEAR_TO_DATE', 'LAST_12_MONTHS', 'CUSTOM'] as DatePreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => applyDatePreset(preset)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  datePreset === preset
                    ? 'bg-sidebarActiveBg text-white'
                    : 'bg-cardBg border border-borderSoft text-bodyText hover:bg-sidebarMuted/10'
                }`}
              >
                {preset.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </button>
            ))}
          </div>

          {(showCustomDate || datePreset === 'CUSTOM') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-sidebarMuted mb-1">From Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebarMuted" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => handleCustomDateChange(e.target.value, dateTo)}
                    className="w-full pl-10 pr-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-sidebarMuted mb-1">To Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebarMuted" />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => handleCustomDateChange(dateFrom, e.target.value)}
                    className="w-full pl-10 pr-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Branch Filter */}
        <div>
          <label className="block text-sm font-medium text-bodyText mb-2">Branch</label>
          <select
            value={branchId}
            onChange={(e) => onBranchChange(e.target.value)}
            className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
          >
            <option value="">All Branches</option>
            {branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        </div>

        {/* Vehicle Category Filter */}
        <div>
          <label className="block text-sm font-medium text-bodyText mb-2">Vehicle Category</label>
          <select
            value={vehicleCategory}
            onChange={(e) => onVehicleCategoryChange(e.target.value)}
            className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
          >
            <option value="">All Categories</option>
            {vehicleCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        {/* Customer Type Filter */}
        {showCustomerFilter && (
          <div>
            <label className="block text-sm font-medium text-bodyText mb-2">Customer Type</label>
            <select
              value={customerType}
              onChange={(e) => onCustomerTypeChange(e.target.value)}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            >
              <option value="">All Customer Types</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="CORPORATE">Corporate</option>
            </select>
          </div>
        )}

        {/* Clear Filters */}
        {(branchId || vehicleCategory || customerType || datePreset !== 'CUSTOM') && (
          <button
            onClick={() => {
              onBranchChange('')
              onVehicleCategoryChange('')
              onCustomerTypeChange('')
              applyDatePreset('THIS_MONTH')
            }}
            className="w-full px-4 py-2 bg-cardBg border border-borderSoft rounded-lg text-bodyText hover:bg-sidebarMuted/10 flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            Clear All Filters
          </button>
        )}
      </div>
    </SectionCard>
  )
}

