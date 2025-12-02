'use client'

import { useQuery } from '@tanstack/react-query'
import { Car } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface ActiveVehiclesWidgetProps {
  widgetId: string
}

export default function ActiveVehiclesWidget({ widgetId }: ActiveVehiclesWidgetProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-metrics', 'ACTIVE_VEHICLES'],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/metrics?type=ACTIVE_VEHICLES`)
      if (!response.ok) throw new Error('Failed to fetch vehicle data')
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
        <div className="text-red-500 text-center py-4">Error loading vehicle data</div>
      </SectionCard>
    )
  }

  const chartData = [
    { name: 'Available', value: data?.available || 0, color: '#10B981' },
    { name: 'Booked', value: data?.booked || 0, color: '#F59E0B' },
    { name: 'Maintenance', value: data?.maintenance || 0, color: '#EF4444' },
    { name: 'Inactive', value: data?.inactive || 0, color: '#6B7280' },
  ]

  return (
    <SectionCard>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="w-5 h-5 text-sidebarActiveBg" />
            <h3 className="text-lg font-semibold text-headingText">Active Vehicles</h3>
          </div>
          <span className="text-sm font-semibold text-headingText">Total: {data?.total || 0}</span>
        </div>

        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
              <XAxis 
                dataKey="name" 
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
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-borderSoft">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }}></div>
              <span className="text-xs text-sidebarMuted">{item.name}:</span>
              <span className="text-sm font-semibold text-headingText">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  )
}

