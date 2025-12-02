'use client'

import RevenueWidget from './widgets/RevenueWidget'
import BookingTrendsWidget from './widgets/BookingTrendsWidget'
import ActiveVehiclesWidget from './widgets/ActiveVehiclesWidget'
import TopPerformingVehiclesWidget from './widgets/TopPerformingVehiclesWidget'
import CustomerAcquisitionWidget from './widgets/CustomerAcquisitionWidget'

interface Widget {
  _id: string
  type: 'REVENUE_SUMMARY' | 'BOOKING_TRENDS' | 'ACTIVE_VEHICLES' | 'TOP_PERFORMING_VEHICLES' | 'CUSTOMER_ACQUISITION'
  title: string
  config: {
    timeRange?: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR'
    limit?: number
    [key: string]: any
  }
  position: {
    x: number
    y: number
    w: number
    h: number
  }
}

interface WidgetRendererProps {
  widget: Widget
}

export default function WidgetRenderer({ widget }: WidgetRendererProps) {
  const timeRange = widget.config?.timeRange || 'MONTH'
  const limit = widget.config?.limit || 5

  switch (widget.type) {
    case 'REVENUE_SUMMARY':
      return <RevenueWidget widgetId={widget._id} timeRange={timeRange} />
    case 'BOOKING_TRENDS':
      return <BookingTrendsWidget widgetId={widget._id} timeRange={timeRange} />
    case 'ACTIVE_VEHICLES':
      return <ActiveVehiclesWidget widgetId={widget._id} />
    case 'TOP_PERFORMING_VEHICLES':
      return <TopPerformingVehiclesWidget widgetId={widget._id} limit={limit} />
    case 'CUSTOMER_ACQUISITION':
      return <CustomerAcquisitionWidget widgetId={widget._id} />
    default:
      return <div>Unknown widget type</div>
  }
}

