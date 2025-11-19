'use client'

import { useState } from 'react'
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameMonth, isToday, isSameDay } from 'date-fns'

interface CalendarEvent {
  date: Date
  type: 'booking' | 'return' | 'maintenance'
}

interface CalendarProps {
  events?: CalendarEvent[]
  onDateClick?: (date: Date) => void
}

export default function Calendar({ events = [], onDateClick }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Get first day of month to calculate offset
  const firstDayOfWeek = monthStart.getDay()
  const daysBeforeMonth = Array.from({ length: firstDayOfWeek }, (_, i) => null)

  const getEventColor = (date: Date) => {
    const dayEvents = events.filter((e) => isSameDay(e.date, date))
    if (dayEvents.length === 0) return null

    // Priority: maintenance > return > booking
    if (dayEvents.some((e) => e.type === 'maintenance')) return 'bg-danger'
    if (dayEvents.some((e) => e.type === 'return')) return 'bg-success'
    if (dayEvents.some((e) => e.type === 'booking')) return 'bg-sidebarActiveBg'
    return null
  }

  return (
    <div className="bg-cardBg rounded-card shadow-card border border-borderSoft p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-headingText">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              view === 'month'
                ? 'bg-sidebarActiveBg text-white'
                : 'bg-pageBg text-bodyText hover:bg-borderSoft'
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setView('week')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              view === 'week'
                ? 'bg-sidebarActiveBg text-white'
                : 'bg-pageBg text-bodyText hover:bg-borderSoft'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => setView('day')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              view === 'day'
                ? 'bg-sidebarActiveBg text-white'
                : 'bg-pageBg text-bodyText hover:bg-borderSoft'
            }`}
          >
            Day
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      {view === 'month' && (
        <div>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="text-center text-xs font-semibold text-bodyText py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before month start */}
            {daysBeforeMonth.map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square" />
            ))}

            {/* Days in month */}
            {daysInMonth.map((day) => {
              const eventColor = getEventColor(day)
              const isCurrentDay = isToday(day)

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => onDateClick?.(day)}
                  className={`aspect-square p-1 cursor-pointer rounded-lg transition-colors ${
                    isCurrentDay
                      ? 'bg-sidebarActiveBg/10 border-2 border-sidebarActiveBg'
                      : 'hover:bg-pageBg'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center h-full">
                    <span
                      className={`text-sm font-medium ${
                        isCurrentDay
                          ? 'text-sidebarActiveBg'
                          : isSameMonth(day, currentDate)
                          ? 'text-headingText'
                          : 'text-sidebarMuted'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {eventColor && (
                      <div className={`w-1.5 h-1.5 rounded-full mt-1 ${eventColor}`} />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Week and Day views (placeholder) */}
      {(view === 'week' || view === 'day') && (
        <div className="text-center py-8 text-bodyText">
          {view === 'week' ? 'Week view coming soon' : 'Day view coming soon'}
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-borderSoft flex items-center gap-4 text-xs text-bodyText">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sidebarActiveBg" />
          <span>Bookings</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success" />
          <span>Returns</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-danger" />
          <span>Maintenance</span>
        </div>
      </div>
    </div>
  )
}

