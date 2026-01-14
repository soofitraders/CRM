'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SectionCard from '@/components/ui/SectionCard'
import Toolbar, { ToolbarGroup, ToolbarInput } from '@/components/ui/Toolbar'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import { Search, Edit } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import ExportButtonGroup from '@/components/export/ExportButtonGroup'
import { logger } from '@/lib/utils/logger'

interface Customer {
  _id: string
  user: {
    _id: string
    name: string
    email: string
    status: string
  }
  phone: string
  drivingLicenseNumber: string
  drivingLicenseExpiry: string
}

interface CustomerWithStats extends Customer {
  activeBookings?: number
  lastBookingDate?: string | null
}

interface CustomersResponse {
  customers: Customer[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export default function ClientsList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [customers, setCustomers] = useState<CustomerWithStats[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  })
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchCustomers()
  }, [search, pagination.page])

  const fetchCustomers = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      params.append('page', pagination.page.toString())
      params.append('limit', pagination.limit.toString())

      const response = await fetch(`/api/customers?${params.toString()}`)
      if (response.ok) {
        const data: CustomersResponse = await response.json()
        // Stats are now included in the response from the API
        setCustomers(data.customers as CustomerWithStats[])
        setPagination(data.pagination)
      }
    } catch (error) {
      logger.error('Error fetching customers:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPagination((prev) => ({ ...prev, page: 1 }))
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set('search', value)
    } else {
      params.delete('search')
    }
    router.push(`/clients?${params.toString()}`)
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A'
    return format(new Date(dateString), 'MMM dd, yyyy')
  }

  return (
    <SectionCard
      title="All Customers"
      actions={
        <Toolbar>
          <ToolbarInput>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-bodyText pointer-events-none" />
              <input
                type="text"
                placeholder="Search by name, email, phone, license..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full sm:w-64 pl-9 pr-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
              />
            </div>
          </ToolbarInput>
          <ToolbarGroup>
            <ExportButtonGroup module="CLIENTS" filters={{ search, activeOnly: false }} />
          </ToolbarGroup>
        </Toolbar>
      }
    >
      {isLoading ? (
        <div className="text-center py-8 text-bodyText">Loading...</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-8 text-bodyText">No customers found</div>
      ) : (
        <>
          <Table
            headers={[
              'Name',
              'Email',
              'Phone',
              'License',
              'Active Bookings',
              'Last Booking',
              'Actions',
            ]}
          >
            {customers.map((customer) => (
              <TableRow key={customer._id}>
                <TableCell>
                  <div>
                    <div className="font-medium text-headingText">{customer.user.name}</div>
                    {customer.user.status !== 'ACTIVE' && (
                      <div className="text-xs text-danger">Inactive</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-bodyText">{customer.user.email}</div>
                </TableCell>
                <TableCell>{customer.phone}</TableCell>
                <TableCell>
                  <div>
                    <div className="text-bodyText">{customer.drivingLicenseNumber}</div>
                    <div className="text-xs text-sidebarMuted">
                      Exp: {formatDate(customer.drivingLicenseExpiry)}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="font-medium text-headingText">
                    {customer.activeBookings || 0}
                  </span>
                </TableCell>
                <TableCell className="text-sidebarMuted">
                  {formatDate(customer.lastBookingDate)}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/clients/${customer._id}`}
                    className="text-sidebarActiveBg hover:text-sidebarActiveBg/80 font-medium text-sm flex items-center gap-1"
                  >
                    <Edit className="w-4 h-4" />
                    View
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </Table>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-borderSoft">
              <div className="text-sm text-bodyText">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} customers
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                  disabled={pagination.page === 1}
                  className="p-2 bg-pageBg border border-borderSoft rounded-lg hover:bg-borderSoft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ←
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
                  →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </SectionCard>
  )
}

