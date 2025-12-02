'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import CustomerForm from '@/components/customers/CustomerForm'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import StatusChip from '@/components/ui/StatusChip'
import { CreateCustomerInput, UpdateCustomerInput } from '@/lib/validation/customer'
import { format } from 'date-fns'

interface Customer {
  _id: string
  user: {
    _id: string
    name: string
    email: string
    status: string
  }
  nationalId?: string
  passportNumber?: string
  drivingLicenseNumber: string
  drivingLicenseCountry: string
  drivingLicenseExpiry: string
  phone: string
  alternatePhone?: string
  addressLine1: string
  city: string
  country: string
  emergencyContactName: string
  emergencyContactPhone: string
}

interface CustomerStats {
  activeBookings: number
  totalBookings: number
  lastBookingDate: string | null
  totalPayments: number
  totalFines: number
  paidFines: number
  pendingFines: number
}

interface Booking {
  _id: string
  vehicle: {
    plateNumber: string
    brand: string
    model: string
  }
  startDateTime: string
  endDateTime: string
  status: string
  totalAmount: number
  paymentStatus: string
}

export default function ClientDetailPage() {
  const router = useRouter()
  const params = useParams()
  const customerId = params.id as string
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [stats, setStats] = useState<CustomerStats | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'profile' | 'bookings' | 'fines'>('profile')

  useEffect(() => {
    fetchCustomer()
    fetchUserRole()
  }, [customerId])

  const fetchCustomer = async () => {
    try {
      const response = await fetch(`/api/customers/${customerId}`)
      if (response.ok) {
        const data = await response.json()
        setCustomer(data.customer)
        setStats(data.stats)

        // Fetch bookings for this customer
        const bookingsResponse = await fetch(`/api/bookings?customer=${customerId}&limit=50`)
        if (bookingsResponse.ok) {
          const bookingsData = await bookingsResponse.json()
          setBookings(bookingsData.bookings || [])
        }
      } else {
        alert('Failed to load customer')
        router.push('/clients')
      }
    } catch (error) {
      console.error('Error fetching customer:', error)
      alert('Failed to load customer')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUserRole = async () => {
    try {
      const response = await fetch('/api/auth/session')
      if (response.ok) {
        const session = await response.json()
        setUserRole(session.user?.role || '')
      }
    } catch (error) {
      console.error('Error fetching user role:', error)
    }
  }

  const handleUpdate = async (data: UpdateCustomerInput) => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        fetchCustomer()
        alert('Customer updated successfully')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update customer')
      }
    } catch (error) {
      console.error('Error updating customer:', error)
      alert('Failed to update customer')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8 text-bodyText">Loading customer...</div>
    )
  }

  if (!customer) {
    return null
  }

  const canEdit = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES_AGENT'].includes(userRole)

  const initialFormData: Partial<CreateCustomerInput> = {
    name: customer.user.name,
    email: customer.user.email,
    phone: customer.phone,
    alternatePhone: customer.alternatePhone,
    nationalId: customer.nationalId,
    passportNumber: customer.passportNumber,
    drivingLicenseNumber: customer.drivingLicenseNumber,
    drivingLicenseCountry: customer.drivingLicenseCountry,
    drivingLicenseExpiry: new Date(customer.drivingLicenseExpiry).toISOString().split('T')[0],
    addressLine1: customer.addressLine1,
    city: customer.city,
    country: customer.country,
    emergencyContactName: customer.emergencyContactName,
    emergencyContactPhone: customer.emergencyContactPhone,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-headingText">{customer.user.name}</h1>
        <p className="text-bodyText mt-2">{customer.user.email}</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-borderSoft">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'profile'
                ? 'text-sidebarActiveBg border-b-2 border-sidebarActiveBg'
                : 'text-bodyText hover:text-headingText'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'bookings'
                ? 'text-sidebarActiveBg border-b-2 border-sidebarActiveBg'
                : 'text-bodyText hover:text-headingText'
            }`}
          >
            Bookings History ({stats?.totalBookings || 0})
          </button>
          <button
            onClick={() => setActiveTab('fines')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'fines'
                ? 'text-sidebarActiveBg border-b-2 border-sidebarActiveBg'
                : 'text-bodyText hover:text-headingText'
            }`}
          >
            Fines & Payments
          </button>
        </div>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <SectionCard title="Customer Profile">
          {canEdit ? (
            <CustomerForm
              initialData={initialFormData}
              onSubmit={handleUpdate as any}
              isLoading={isSaving}
              isEdit={true}
              onCancel={() => router.push('/clients')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-headingText mb-1">
                  Name
                </label>
                <p className="text-bodyText">{customer.user.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-headingText mb-1">
                  Email
                </label>
                <p className="text-bodyText">{customer.user.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-headingText mb-1">
                  Phone
                </label>
                <p className="text-bodyText">{customer.phone}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-headingText mb-1">
                  Driving License
                </label>
                <p className="text-bodyText">
                  {customer.drivingLicenseNumber} ({customer.drivingLicenseCountry})
                </p>
                <p className="text-xs text-sidebarMuted">
                  Expires: {format(new Date(customer.drivingLicenseExpiry), 'MMM dd, yyyy')}
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-headingText mb-1">
                  Address
                </label>
                <p className="text-bodyText">
                  {customer.addressLine1}, {customer.city}, {customer.country}
                </p>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* Bookings Tab */}
      {activeTab === 'bookings' && (
        <SectionCard title="Booking History">
          {bookings.length === 0 ? (
            <div className="text-center py-8 text-bodyText">No bookings found</div>
          ) : (
            <Table
              headers={[
                'Booking #',
                'Vehicle',
                'Start Date',
                'End Date',
                'Amount',
                'Status',
                'Payment',
              ]}
            >
              {bookings.map((booking) => (
                <TableRow key={booking._id}>
                  <TableCell className="font-medium text-headingText">
                    #{booking._id.slice(-6).toUpperCase()}
                  </TableCell>
                  <TableCell>
                    {booking.vehicle.plateNumber} - {booking.vehicle.brand}{' '}
                    {booking.vehicle.model}
                  </TableCell>
                  <TableCell>{format(new Date(booking.startDateTime), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{format(new Date(booking.endDateTime), 'MMM dd, yyyy')}</TableCell>
                  <TableCell className="font-medium">
                    AED {booking.totalAmount.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <StatusChip
                      status={booking.status.replace('_', ' ')}
                      variant={getStatusVariant(booking.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <StatusChip
                      status={booking.paymentStatus.replace('_', ' ')}
                      variant={getPaymentStatusVariant(booking.paymentStatus)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          )}
        </SectionCard>
      )}

      {/* Fines & Payments Tab */}
      {activeTab === 'fines' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SectionCard title="Payment Summary">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-bodyText">Total Payments:</span>
                <span className="text-lg font-semibold text-headingText">
                  AED {(stats?.totalPayments ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-bodyText">Total Bookings:</span>
                <span className="font-medium text-headingText">
                  {stats?.totalBookings || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-bodyText">Active Bookings:</span>
                <span className="font-medium text-headingText">
                  {stats?.activeBookings || 0}
                </span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Fines Summary">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-bodyText">Total Fines:</span>
                <span className="text-lg font-semibold text-headingText">
                  AED {(stats?.totalFines ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-bodyText">Paid:</span>
                <span className="font-medium text-success">
                  AED {(stats?.paidFines ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-bodyText">Pending:</span>
                <span className="font-medium text-warning">
                  AED {(stats?.pendingFines ?? 0).toFixed(2)}
                </span>
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  )
}

