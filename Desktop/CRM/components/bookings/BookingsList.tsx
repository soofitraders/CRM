'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import StatusChip from '@/components/ui/StatusChip'
import { Search, ChevronLeft, ChevronRight, Edit, Loader2 } from 'lucide-react'
import Link from 'next/link'
import ExportButtonGroup from '@/components/export/ExportButtonGroup'

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
  const [pagination, setPagination] = useState({
    page: parseInt(searchParams.get('page') || '1'),
    limit: 10,
  })
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    search: searchParams.get('search') || '',
  })

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.status) params.append('status', filters.status)
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.append('dateTo', filters.dateTo)
    if (filters.search) params.append('search', filters.search)
    params.append('page', pagination.page.toString())
    params.append('limit', pagination.limit.toString())
    return params.toString()
  }, [filters, pagination.page, pagination.limit])

  // Use React Query for data fetching with caching
  const { data, isLoading, error } = useQuery<BookingsResponse>({
    queryKey: ['bookings', queryParams],
    queryFn: async () => {
      const response = await fetch(`/api/bookings?${queryParams}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to fetch bookings')
      }
      return response.json()
    },
    staleTime: 30000, // 30 seconds - data is fresh for 30s
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })

  const bookings = data?.bookings || []
  const paginationData = data?.pagination || {
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  }

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

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }))
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', newPage.toString())
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

  // Show loading state
  if (isLoading && !data) {
    return (
      <SectionCard>
        <div className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-sidebarMuted" />
          <p className="text-bodyText mt-4">Loading bookings...</p>
        </div>
      </SectionCard>
    )
  }

  // Show error state
  if (error) {
    return (
      <SectionCard>
        <div className="p-8 text-center">
          <p className="text-danger">Error loading bookings: {(error as Error).message}</p>
        </div>
      </SectionCard>
    )
  }

  return (
    <SectionCard
      title="All Bookings"
      actions={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-bodyText" />
            <input
              type="text"
              placeholder="Search..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-9 pr-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 w-48"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
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
            className="px-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            placeholder="To"
            className="px-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          />
          <ExportButtonGroup module="BOOKINGS" filters={filters} />
        </div>
      }
    >
      {bookings.length === 0 ? (
        <div className="text-center py-8 text-bodyText">No bookings found</div>
      ) : (
        <>
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
            {bookings.map((booking) => {
              const bookingIdDisplay = booking._id
                ? String(booking._id).slice(-6).toUpperCase()
                : 'N/A'

              return (
                <TableRow key={booking._id}>
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
                      href={`/bookings/${booking._id}`}
                      prefetch={true}
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

          {/* Pagination */}
          {paginationData.pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-borderSoft">
              <div className="text-sm text-bodyText">
                Showing {(paginationData.page - 1) * paginationData.limit + 1} to{' '}
                {Math.min(paginationData.page * paginationData.limit, paginationData.total)} of{' '}
                {paginationData.total} bookings
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(paginationData.page - 1)}
                  disabled={paginationData.page === 1}
                  className="p-2 bg-pageBg border border-borderSoft rounded-lg hover:bg-borderSoft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-bodyText px-2">
                  Page {paginationData.page} of {paginationData.pages}
                </span>
                <button
                  onClick={() => handlePageChange(paginationData.page + 1)}
                  disabled={paginationData.page === paginationData.pages}
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
