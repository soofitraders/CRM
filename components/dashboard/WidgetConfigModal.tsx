'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'

export type WidgetType = 
  | 'REVENUE_SUMMARY' 
  | 'BOOKING_TRENDS' 
  | 'ACTIVE_VEHICLES' 
  | 'TOP_PERFORMING_VEHICLES' 
  | 'CUSTOMER_ACQUISITION'

export type TimeRange = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'

interface WidgetConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (config: {
    type: WidgetType
    title: string
    config: {
      timeRange?: TimeRange
      limit?: number
    }
  }) => void
  existingWidget?: {
    type: WidgetType
    title: string
    config: {
      timeRange?: TimeRange
      limit?: number
    }
  }
}

const widgetTypes: { value: WidgetType; label: string; description: string }[] = [
  { value: 'REVENUE_SUMMARY', label: 'Revenue Summary', description: 'Total revenue for selected period' },
  { value: 'BOOKING_TRENDS', label: 'Booking Trends', description: 'Number of bookings over time' },
  { value: 'ACTIVE_VEHICLES', label: 'Active Vehicles', description: 'Vehicle status breakdown' },
  { value: 'TOP_PERFORMING_VEHICLES', label: 'Top Performing Vehicles', description: 'Vehicles with highest revenue' },
  { value: 'CUSTOMER_ACQUISITION', label: 'Customer Acquisition', description: 'New customers this month' },
]

export default function WidgetConfigModal({ isOpen, onClose, onSave, existingWidget }: WidgetConfigModalProps) {
  const [type, setType] = useState<WidgetType>(existingWidget?.type || 'REVENUE_SUMMARY')
  const [title, setTitle] = useState(existingWidget?.title || '')
  const [timeRange, setTimeRange] = useState<TimeRange>(existingWidget?.config?.timeRange || 'MONTH')
  const [limit, setLimit] = useState(existingWidget?.config?.limit || 5)

  if (!isOpen) return null

  const handleSave = () => {
    const widgetTitle = title || widgetTypes.find((wt) => wt.value === type)?.label || 'Widget'
    onSave({
      type,
      title: widgetTitle,
      config: {
        ...(type === 'REVENUE_SUMMARY' || type === 'BOOKING_TRENDS' ? { timeRange } : {}),
        ...(type === 'TOP_PERFORMING_VEHICLES' ? { limit } : {}),
      },
    })
    onClose()
  }

  const selectedWidget = widgetTypes.find((wt) => wt.value === type)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-cardBg rounded-lg shadow-lg w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-borderSoft flex items-center justify-between">
          <h2 className="text-xl font-semibold text-headingText">
            {existingWidget ? 'Edit Widget' : 'Add Widget'}
          </h2>
          <button
            onClick={onClose}
            className="text-bodyText hover:text-headingText transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-bodyText mb-2">
              Widget Type *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as WidgetType)}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            >
              {widgetTypes.map((wt) => (
                <option key={wt.value} value={wt.value}>
                  {wt.label}
                </option>
              ))}
            </select>
            {selectedWidget && (
              <p className="text-xs text-sidebarMuted mt-1">{selectedWidget.description}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-bodyText mb-2">
              Widget Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={widgetTypes.find((wt) => wt.value === type)?.label}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            />
          </div>

          {(type === 'REVENUE_SUMMARY' || type === 'BOOKING_TRENDS') && (
            <div>
              <label className="block text-sm font-medium text-bodyText mb-2">
                Time Range *
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
              >
                <option value="DAY">Day</option>
                <option value="WEEK">Week</option>
                <option value="MONTH">Month</option>
                <option value="YEAR">Year</option>
              </select>
            </div>
          )}

          {type === 'TOP_PERFORMING_VEHICLES' && (
            <div>
              <label className="block text-sm font-medium text-bodyText mb-2">
                Number of Vehicles
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 5)}
                className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
              />
            </div>
          )}

          <div className="flex justify-end gap-4 pt-4 border-t border-borderSoft">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-cardBg border border-borderSoft rounded-lg text-bodyText hover:bg-sidebarMuted/10"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg hover:opacity-90"
            >
              {existingWidget ? 'Update' : 'Add'} Widget
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

