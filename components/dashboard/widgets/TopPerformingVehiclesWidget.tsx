'use client'

import { useQuery } from '@tanstack/react-query'
import { TrendingUp } from 'lucide-react'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'

interface TopPerformingVehiclesWidgetProps {
  widgetId: string
  limit?: number
}

export default function TopPerformingVehiclesWidget({ widgetId, limit = 5 }: TopPerformingVehiclesWidgetProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-metrics', 'TOP_PERFORMING_VEHICLES', limit],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/metrics?type=TOP_PERFORMING_VEHICLES&limit=${limit}`)
      if (!response.ok) throw new Error('Failed to fetch top vehicles')
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
        <div className="text-red-500 text-center py-4">Error loading top vehicles</div>
      </SectionCard>
    )
  }

  const formatCurrency = (amount: number) => {
    return `AED ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const vehicles = data?.vehicles || []

  return (
    <SectionCard>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-sidebarActiveBg" />
          <h3 className="text-lg font-semibold text-headingText">Top Performing Vehicles</h3>
        </div>

        {vehicles.length === 0 ? (
          <div className="text-center py-8 text-sidebarMuted">
            <p>No vehicle data available</p>
          </div>
        ) : (
          <Table headers={['Vehicle', 'Bookings', 'Revenue']}>
            {vehicles.map((vehicle: any, index: number) => (
              <TableRow key={vehicle.vehicleId}>
                <TableCell>
                  <div>
                    <div className="font-medium text-headingText">{vehicle.plateNumber}</div>
                    <div className="text-xs text-sidebarMuted">
                      {vehicle.brand} {vehicle.model}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-bodyText">{vehicle.bookingsCount}</TableCell>
                <TableCell className="font-semibold text-headingText">
                  {formatCurrency(vehicle.revenue)}
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </div>
    </SectionCard>
  )
}

