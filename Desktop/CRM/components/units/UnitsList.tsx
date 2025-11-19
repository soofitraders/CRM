'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import StatusChip from '@/components/ui/StatusChip'
import { Search, Edit, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { isExpiringSoon, daysLeft, formatDaysLeft } from '@/lib/utils/compliance'
import { format } from 'date-fns'

interface Vehicle {
  _id: string
  plateNumber: string
  brand: string
  model: string
  year: number
  ownershipType: 'COMPANY' | 'INVESTOR'
  investor?: {
    user: {
      name: string
    }
  }
  status: string
  dailyRate: number
  registrationExpiry: string
  insuranceExpiry: string
  currentBranch: string
}

interface VehiclesResponse {
  vehicles: Vehicle[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export default function UnitsList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  })
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    ownershipType: searchParams.get('ownershipType') || '',
    branch: searchParams.get('branch') || '',
    search: searchParams.get('search') || '',
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchVehicles()
  }, [filters, pagination.page])

  const fetchVehicles = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.append('status', filters.status)
      if (filters.ownershipType) params.append('ownershipType', filters.ownershipType)
      if (filters.branch) params.append('branch', filters.branch)
      if (filters.search) params.append('search', filters.search)
      params.append('page', pagination.page.toString())
      params.append('limit', pagination.limit.toString())

      const response = await fetch(`/api/vehicles?${params.toString()}`)
      if (response.ok) {
        const data: VehiclesResponse = await response.json()
        setVehicles(data.vehicles)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error)
    } finally {
      setIsLoading(false)
    }
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
    router.push(`/units?${params.toString()}`)
  }

  const getStatusVariant = (status: string): 'yellow' | 'green' | 'red' => {
    if (status === 'AVAILABLE') return 'green'
    if (status === 'BOOKED') return 'yellow'
    if (status === 'IN_MAINTENANCE') return 'yellow'
    if (status === 'INACTIVE') return 'red'
    return 'yellow'
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy')
  }

  return (
    <SectionCard
      title="All Vehicles"
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
            <option value="AVAILABLE">Available</option>
            <option value="BOOKED">Booked</option>
            <option value="IN_MAINTENANCE">In Maintenance</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select
            value={filters.ownershipType}
            onChange={(e) => handleFilterChange('ownershipType', e.target.value)}
            className="px-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
          >
            <option value="">All Ownership</option>
            <option value="COMPANY">Company</option>
            <option value="INVESTOR">Investor</option>
          </select>
        </div>
      }
    >
      {isLoading ? (
        <div className="text-center py-8 text-bodyText">Loading...</div>
      ) : vehicles.length === 0 ? (
        <div className="text-center py-8 text-bodyText">No vehicles found</div>
      ) : (
        <>
          <Table
            headers={[
              'Plate #',
              'Brand/Model',
              'Ownership',
              'Current Status',
              'Daily Rate',
              'Registration Expiry',
              'Insurance Expiry',
              'Actions',
            ]}
          >
            {vehicles.map((vehicle) => {
              const regExpiring = isExpiringSoon(vehicle.registrationExpiry, 30)
              const insExpiring = isExpiringSoon(vehicle.insuranceExpiry, 30)
              const regDaysLeft = daysLeft(vehicle.registrationExpiry)
              const insDaysLeft = daysLeft(vehicle.insuranceExpiry)

              return (
                <TableRow key={vehicle._id}>
                  <TableCell className="font-medium text-headingText">
                    {vehicle.plateNumber}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-headingText">
                        {vehicle.brand} {vehicle.model}
                      </div>
                      <div className="text-xs text-sidebarMuted">{vehicle.year}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="text-sm text-bodyText">
                        {vehicle.ownershipType === 'COMPANY' ? 'Company' : 'Investor'}
                      </div>
                      {vehicle.ownershipType === 'INVESTOR' && vehicle.investor && (
                        <div className="text-xs text-sidebarMuted">
                          {vehicle.investor.user.name}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusChip
                      status={vehicle.status.replace('_', ' ')}
                      variant={getStatusVariant(vehicle.status)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    AED {vehicle.dailyRate.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{formatDate(vehicle.registrationExpiry)}</span>
                      {regExpiring && (
                        <span
                          className={`text-xs flex items-center gap-1 ${
                            regDaysLeft < 0
                              ? 'text-danger'
                              : regDaysLeft <= 7
                              ? 'text-warning'
                              : 'text-sidebarMuted'
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {formatDaysLeft(regDaysLeft)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{formatDate(vehicle.insuranceExpiry)}</span>
                      {insExpiring && (
                        <span
                          className={`text-xs flex items-center gap-1 ${
                            insDaysLeft < 0
                              ? 'text-danger'
                              : insDaysLeft <= 7
                              ? 'text-warning'
                              : 'text-sidebarMuted'
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {formatDaysLeft(insDaysLeft)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/units/${vehicle._id}`}
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
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-borderSoft">
              <div className="text-sm text-bodyText">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} vehicles
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

