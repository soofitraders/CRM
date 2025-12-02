'use client'

import { useQuery } from '@tanstack/react-query'
import { Calendar } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface BookingTrendsWidgetProps {
  widgetId: string
  timeRange: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'
}

export default function BookingTrendsWidget({ widgetId, timeRange }: BookingTrendsWidgetProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-metrics', 'BOOKING_TRENDS', timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/metrics?type=BOOKING_TRENDS&timeRange=${timeRange}`)
      if (!response.ok) throw new Error('Failed to fetch booking trends')
      const result = await response.json()
      return result.metrics
    },
  })

  if (isLoading) {
    return (
      <SectionCard>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sidebarActiveBg"></div>
        </div>
      </SectionCard>
    )
  }

  if (error) {
    return (
      <SectionCard>
        <div className="text-red-500 text-center py-4">Error loading booking trends</div>
      </SectionCard>
    )
  }

  const chartData = data?.data || []

  return (
    <SectionCard>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sidebarActiveBg" />
            <h3 className="text-lg font-semibold text-headingText">Booking Trends</h3>
          </div>
          <span className="text-xs text-sidebarMuted capitalize">{timeRange.toLowerCase()}</span>
        </div>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis 
                dataKey="period" 
                stroke="#9CA3AF"
                fontSize={12}
                tick={{ fill: '#9CA3AF' }}
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={12}
                tick={{ fill: '#9CA3AF' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#F3F4F6',
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#6366F1"
                strokeWidth={2}
                dot={{ fill: '#6366F1', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </SectionCard>
  )
}

