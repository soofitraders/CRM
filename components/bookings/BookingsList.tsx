  'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SectionCard from '@/components/ui/SectionCard'
import Toolbar, { ToolbarGroup, ToolbarInput } from '@/components/ui/Toolbar'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import StatusChip from '@/components/ui/StatusChip'
import { Search, Filter, ChevronLeft, ChevronRight, Edit } from 'lucide-react'
import Link from 'next/link'
import ExportButtonGroup from '@/components/export/ExportButtonGroup'
import { logger } from '@/lib/utils/logger'
import { useDataSync } from '@/hooks/useDataSync'

interface Booking {
  _id: string
  vehicle: {
    plateNumber: string
    brand: string
    model: string
  }
  customer: {
    user: {
      name: string
      email: string
    }
  }
  startDateTime: string
  endDateTime: string
  status: string
  paymentStatus: string
}

interface BookingsResponse {
  bookings: Booking[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export default function BookingsList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  })
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    search: searchParams.get('search') || '',
  })
  const [isLoading, setIsLoading] = useState(true)

  // Use refs to access latest values without causing re-renders
  const filtersRef = useRef(filters)
  const paginationRef = useRef(pagination)
  
  // Update refs when values change
  useEffect(() => {
    filtersRef.current = filters
  }, [filters])
  
  useEffect(() => {
    paginationRef.current = pagination
  }, [pagination])

  // Memoize fetchBookings with stable dependencies
  const fetchBookings = useCallback(async (forceRefresh = false) => {
    setIsLoading(true)
    try {
      const currentFilters = filtersRef.current
      const currentPagination = paginationRef.current
      
      const params = new URLSearchParams()
      if (currentFilters.status) params.append('status', currentFilters.status)
      if (currentFilters.dateFrom) params.append('dateFrom', currentFilters.dateFrom)
      if (currentFilters.dateTo) params.append('dateTo', currentFilters.dateTo)
      if (currentFilters.search) params.append('search', currentFilters.search)
      params.append('page', currentPagination.page.toString())
      params.append('limit', currentPagination.limit.toString())
      
      // Add cache-busting parameter to force fresh data
      if (forceRefresh) {
        params.append('_t', Date.now().toString())
      }

      logger.log('[Bookings] Fetching bookings with params:', params.toString())
      const response = await fetch(`/api/bookings?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
      
      logger.log('[Bookings] Response status:', response.status)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        logger.error('[Bookings] Error response:', errorData)
        alert(`Failed to load bookings: ${errorData.error || 'Unknown error'}`)
        setBookings([])
        return
      }
      
      const data: BookingsResponse = await response.json()
      logger.log('[Bookings] Bookings loaded:', data.bookings?.length || 0, 'bookings')
      
      // Ensure bookings is always an array and clean up any invalid entries
      let bookingsArray: Booking[] = []
      if (Array.isArray(data.bookings)) {
        bookingsArray = data.bookings.filter((booking: any) => {
          if (!booking || typeof booking !== 'object') return false
          return booking._id != null
        })
      }
      
      setBookings(bookingsArray)
      setPagination(data.pagination || {
        page: 1,
        limit: 10,
        total: 0,
        pages: 0,
      })
    } catch (error: any) {
      logger.error('[Bookings] Error fetching bookings:', error)
      logger.error('[Bookings] Error details:', {
        message: error.message,
        stack: error.stack,
      })
      alert(`Failed to load bookings: ${error.message || 'Network error'}`)
      setBookings([])
    } finally {
      setIsLoading(false)
    }
  }, []) // Empty dependency array - function is stable

  // Fetch bookings when filters or page change
  useEffect(() => {
    fetchBookings()
  }, [filters.status, filters.dateFrom, filters.dateTo, filters.search, pagination.page, pagination.limit, fetchBookings])

  // Listen for data sync events to refresh bookings (force refresh)
  useDataSync('bookings', () => fetchBookings(true))
  
  // Also listen to window focus to refresh when user returns to tab
  useEffect(() => {
    const handleFocus = () => {
      fetchBookings(true)
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchBookings])
  
  // Listen for force refresh events
  useEffect(() => {
    const handleForceRefresh = () => {
      fetchBookings(true)
    }
    window.addEventListener('force-refresh-bookings', handleForceRefresh)
    return () => window.removeEventListener('force-refresh-bookings', handleForceRefresh)
  }, [fetchBookings])
  
  // Auto-refresh every 30 seconds when page is visible (increased from 5 to reduce load)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchBookings(true)
      }
    }, 30000) // Refresh every 30 seconds instead of 5
    
    return () => clearInterval(interval)
  }, [fetchBookings])

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPagination((prev) => ({ ...prev, page: 1 }))
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/bookings?${params.toString()}`)
  }

  const getStatusVariant = (status: string): 'yellow' | 'green' | 'red' => {
    if (status === 'CONFIRMED' || status === 'CHECKED_OUT') return 'green'
    if (status === 'CANCELLED') return 'red'
    return 'yellow'
  }

  const getPaymentStatusVariant = (status: string): 'yellow' | 'green' | 'red' => {
    if (status === 'PAID') return 'green'
    if (status === 'PARTIALLY_PAID') return 'yellow'
    return 'red'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <SectionCard
      title="All Bookings"
      actions={
        <Toolbar>
          <ToolbarInput>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-bodyText pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full sm:w-48 pl-9 pr-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
              />
            </div>
          </ToolbarInput>
          <ToolbarGroup>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full sm:w-auto min-w-[140px] px-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="CHECKED_OUT">Checked Out</option>
              <option value="CHECKED_IN">Checked In</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              placeholder="From"
              className="w-full sm:w-auto min-w-[140px] px-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              placeholder="To"
              className="w-full sm:w-auto min-w-[140px] px-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
            />
            <ExportButtonGroup module="BOOKINGS" filters={filters} />
          </ToolbarGroup>
        </Toolbar>
      }
    >
      {isLoading ? (
        <div className="text-center py-8 text-bodyText">Loading...</div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-8 text-bodyText">No bookings found</div>
      ) : (
        <>
          <div className="w-full overflow-x-auto -mx-4 sm:mx-0">
            <div className="inline-block min-w-full align-middle">
              <Table
                headers={[
                  'Booking #',
                  'Vehicle',
                  'Customer',
                  'Start',
                  'End',
                  'Status',
                  'Payment',
                  'Actions',
                ]}
              >
            {(Array.isArray(bookings) ? bookings : []).map((booking: any) => {
              // Safety check for booking ID
              let bookingIdDisplay = 'N/A'
              try {
                if (booking._id) {
                  const idStr = String(booking._id)
                  bookingIdDisplay = idStr.length >= 6 ? idStr.slice(-6).toUpperCase() : idStr.toUpperCase()
                }
              } catch (error) {
                logger.error('[Bookings] Error processing booking ID:', error)
              }
              
              return (
                <TableRow key={booking._id || `booking-${Math.random()}`}>
                  <TableCell className="font-medium text-headingText">
                    #{bookingIdDisplay}
                  </TableCell>
                  <TableCell>
                    {booking.vehicle ? (
                      <>
                        {booking.vehicle.plateNumber || 'N/A'} - {booking.vehicle.brand || ''}{' '}
                        {booking.vehicle.model || ''}
                      </>
                    ) : (
                      <span className="text-sidebarMuted">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {booking.customer?.user ? (
                      <div>
                        <div className="font-medium text-headingText">
                          {booking.customer.user.name || 'N/A'}
                        </div>
                        <div className="text-xs text-sidebarMuted">
                          {booking.customer.user.email || ''}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sidebarMuted">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {booking.startDateTime ? formatDate(booking.startDateTime) : 'N/A'}
                  </TableCell>
                  <TableCell>
                    {booking.endDateTime ? formatDate(booking.endDateTime) : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <StatusChip
                      status={booking.status || 'PENDING'}
                      variant={getStatusVariant(booking.status || 'PENDING')}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusChip
                      status={booking.paymentStatus ? booking.paymentStatus.replace('_', ' ') : 'UNPAID'}
                      variant={getPaymentStatusVariant(booking.paymentStatus || 'UNPAID')}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/bookings/${booking._id || ''}`}
                      className="text-sidebarActiveBg hover:text-sidebarActiveBg/80 font-medium text-sm flex items-center gap-1"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </Link>
                  </TableCell>
                </TableRow>
              )
            })}
          </Table>
            </div>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-borderSoft">
              <div className="text-sm text-bodyText">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} bookings
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                  disabled={pagination.page === 1}
                  className="p-2 bg-pageBg border border-borderSoft rounded-lg hover:bg-borderSoft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-bodyText px-2">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                  disabled={pagination.page === pagination.pages}
                  className="p-2 bg-pageBg border border-borderSoft rounded-lg hover:bg-borderSoft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </SectionCard>
  )
}

