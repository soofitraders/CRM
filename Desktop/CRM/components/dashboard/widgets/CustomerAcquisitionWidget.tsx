'use client'

import { useQuery } from '@tanstack/react-query'
import { Users, TrendingUp, TrendingDown } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'

interface CustomerAcquisitionWidgetProps {
  widgetId: string
}

export default function CustomerAcquisitionWidget({ widgetId }: CustomerAcquisitionWidgetProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-metrics', 'CUSTOMER_ACQUISITION'],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/metrics?type=CUSTOMER_ACQUISITION`)
      if (!response.ok) throw new Error('Failed to fetch customer data')
      const result = await response.json()
      return result.metrics
    },
  })

  if (isLoading) {
    return (
      <SectionCard>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sidebarActiveBg"></div>
        </div>
      </SectionCard>
    )
  }

  if (error) {
    return (
      <SectionCard>
        <div className="text-red-500 text-center py-4">Error loading customer data</div>
      </SectionCard>
    )
  }

  const growth = data?.growth || 0
  const isPositive = growth >= 0

  return (
    <SectionCard>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-sidebarActiveBg" />
            <h3 className="text-lg font-semibold text-headingText">New Customers</h3>
          </div>
          <span className="text-xs text-sidebarMuted">This Month</span>
        </div>
        
        <div>
          <p className="text-3xl font-bold text-headingText">{data?.current || 0}</p>
          <div className="flex items-center gap-2 mt-2">
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className={`text-sm font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? '+' : ''}{growth.toFixed(1)}%
            </span>
            <span className="text-xs text-sidebarMuted">vs last month</span>
          </div>
        </div>

        {data?.previous !== undefined && (
          <div className="pt-2 border-t border-borderSoft">
            <p className="text-xs text-sidebarMuted">Last Month: {data.previous}</p>
          </div>
        )}
      </div>
    </SectionCard>
  )
}

