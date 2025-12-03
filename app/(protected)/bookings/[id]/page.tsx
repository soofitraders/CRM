'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import BookingForm from '@/components/bookings/BookingForm'
import SectionCard from '@/components/ui/SectionCard'
import StatusChip from '@/components/ui/StatusChip'
import { CreateBookingInput, UpdateBookingInput } from '@/lib/validation/booking'
import { FileText, Plus } from 'lucide-react'
import Link from 'next/link'

interface Booking {
  _id: string
  vehicle: {
    _id: string
    plateNumber: string
    brand: string
    model: string
  }
  customer: {
    _id: string
    user: {
      name: string
      email: string
    }
  }
  startDateTime: string
  endDateTime: string
  rentalType: string
  pickupBranch: string
  dropoffBranch: string
  baseRate: number
  discounts: number
  taxes: number
  totalAmount: number
  depositAmount: number
  depositStatus: string
  paymentStatus: string
  status: string
  notes?: string
}

export default function EditBookingPage() {
  const router = useRouter()
  const params = useParams()
  const bookingId = params.id as string
  const [booking, setBooking] = useState<Booking | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [existingInvoice, setExistingInvoice] = useState<{ _id: string; invoiceNumber: string } | null>(null)
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false)

  useEffect(() => {
    fetchBooking()
    fetchUserRole()
    checkInvoice()
  }, [bookingId])

  const fetchBooking = async () => {
    try {
      console.log('[Booking Detail] Fetching booking:', bookingId)
      const response = await fetch(`/api/bookings/${bookingId}`)
      
      console.log('[Booking Detail] Response status:', response.status)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('[Booking Detail] Error response:', errorData)
        alert(`Failed to load booking: ${errorData.error || 'Unknown error'}`)
        router.push('/bookings')
        return
      }
      
      const data = await response.json()
      console.log('[Booking Detail] Booking loaded:', data.booking?._id)
      setBooking(data.booking)
    } catch (error: any) {
      console.error('[Booking Detail] Error fetching booking:', error)
      console.error('[Booking Detail] Error details:', {
        message: error.message,
        stack: error.stack,
      })
      alert(`Failed to load booking: ${error.message || 'Network error'}`)
      router.push('/bookings')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUserRole = async () => {
    // This would typically come from session, but for client component we'll fetch it
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

  const checkInvoice = async () => {
    try {
      const response = await fetch(`/api/invoices?booking=${bookingId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.invoices && data.invoices.length > 0) {
          setExistingInvoice({
            _id: data.invoices[0]._id,
            invoiceNumber: data.invoices[0].invoiceNumber,
          })
        }
      }
    } catch (error) {
      console.error('Error checking invoice:', error)
    }
  }

  const handleCreateInvoice = async () => {
    if (!confirm('Create invoice for this booking?')) {
      return
    }

    setIsCreatingInvoice(true)
    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ booking: bookingId }),
      })

      if (response.ok) {
        const data = await response.json()
        setExistingInvoice({
          _id: data.invoice._id,
          invoiceNumber: data.invoice.invoiceNumber,
        })
        alert('Invoice created successfully!')
        router.push(`/financials/invoices/${data.invoice._id}`)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create invoice')
      }
    } catch (error) {
      console.error('Error creating invoice:', error)
      alert('Failed to create invoice')
    } finally {
      setIsCreatingInvoice(false)
    }
  }

  const handleUpdate = async (data: UpdateBookingInput) => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.ok) {
        router.push('/bookings')
        router.refresh()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update booking')
      }
    } catch (error) {
      console.error('Error updating booking:', error)
      alert('Failed to update booking')
    } finally {
      setIsSaving(false)
    }
  }

  const handleStatusChange = async (status: string) => {
    await handleUpdate({ status: status as "PENDING" | "CONFIRMED" | "CHECKED_OUT" | "CHECKED_IN" | "CANCELLED" })
  }

  const handlePaymentStatusChange = async (paymentStatus: string) => {
    await handleUpdate({ paymentStatus: paymentStatus as "UNPAID" | "PARTIALLY_PAID" | "PAID" })
  }

  if (isLoading) {
    return (
      <div className="text-center py-8 text-bodyText">Loading booking...</div>
    )
  }

  if (!booking) {
    return null
  }

  const canEdit = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES_AGENT'].includes(userRole)
  const canChangePayment = ['SUPER_ADMIN', 'ADMIN', 'FINANCE'].includes(userRole)

  // Calculate tax percent from existing data
  const subtotal = booking.baseRate - booking.discounts
  const taxPercent = subtotal > 0 ? (booking.taxes / subtotal) * 100 : 0

  const initialFormData: Partial<CreateBookingInput> = {
    vehicle: booking.vehicle?._id || '',
    customer: booking.customer?._id || '',
    rentalType: booking.rentalType as any,
    startDateTime: booking.startDateTime ? new Date(booking.startDateTime).toISOString().slice(0, 16) : '',
    endDateTime: booking.endDateTime ? new Date(booking.endDateTime).toISOString().slice(0, 16) : '',
    pickupBranch: booking.pickupBranch || '',
    dropoffBranch: booking.dropoffBranch || '',
    baseRate: booking.baseRate || 0,
    discounts: booking.discounts || 0,
    taxPercent,
    depositAmount: booking.depositAmount || 0,
    notes: booking.notes || '',
  }

  const canCreateInvoice = ['FINANCE', 'ADMIN', 'SUPER_ADMIN'].includes(userRole)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-headingText">Edit Booking</h1>
          <p className="text-bodyText mt-2">
            Booking #{bookingId && bookingId.length >= 6 
              ? bookingId.slice(-6).toUpperCase() 
              : bookingId?.toUpperCase() || 'N/A'}
          </p>
        </div>
        {canCreateInvoice && (
          <div className="flex items-center gap-3">
            {existingInvoice ? (
              <Link
                href={`/financials/invoices/${existingInvoice._id}`}
                className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg font-medium hover:bg-sidebarActiveBg/90 transition-colors flex items-center gap-2"
              >
                <FileText className="w-5 h-5" />
                View Invoice ({existingInvoice.invoiceNumber})
              </Link>
            ) : (
              <button
                onClick={handleCreateInvoice}
                disabled={isCreatingInvoice}
                className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg font-medium hover:bg-sidebarActiveBg/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                {isCreatingInvoice ? 'Creating...' : 'Create Invoice'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Status and Payment Status Controls */}
      <SectionCard title="Booking Status">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              Status
            </label>
            {canEdit ? (
              <select
                value={booking.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
              >
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="CHECKED_OUT">Checked Out</option>
                <option value="CHECKED_IN">Checked In</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            ) : (
              <StatusChip status={booking.status} />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-headingText mb-2">
              Payment Status
            </label>
            {canChangePayment ? (
              <select
                value={booking.paymentStatus}
                onChange={(e) => handlePaymentStatusChange(e.target.value)}
                className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
              >
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Paid</option>
              </select>
            ) : (
              <StatusChip status={booking.paymentStatus.replace('_', ' ')} />
            )}
          </div>
        </div>
      </SectionCard>

      {/* Booking Details Form */}
      {canEdit && (
        <SectionCard title="Booking Details">
          <BookingForm
            initialData={initialFormData}
            onSubmit={handleUpdate as any}
            isLoading={isSaving}
            onCancel={() => router.push('/bookings')}
          />
        </SectionCard>
      )}

      {/* Read-only view for users who can't edit */}
      {!canEdit && (
        <SectionCard title="Booking Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-headingText mb-1">
                Vehicle
              </label>
              <p className="text-bodyText">
                {booking.vehicle ? (
                  <>
                    {booking.vehicle.plateNumber || 'N/A'} - {booking.vehicle.brand || ''}{' '}
                    {booking.vehicle.model || ''}
                  </>
                ) : (
                  <span className="text-sidebarMuted">N/A</span>
                )}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-headingText mb-1">
                Customer
              </label>
              <p className="text-bodyText">
                {booking.customer?.user ? (
                  <>
                    {booking.customer.user.name || 'N/A'} ({booking.customer.user.email || 'N/A'})
                  </>
                ) : (
                  <span className="text-sidebarMuted">N/A</span>
                )}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-headingText mb-1">
                Start Date
              </label>
              <p className="text-bodyText">
                {booking.startDateTime ? new Date(booking.startDateTime).toLocaleString() : 'N/A'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-headingText mb-1">
                End Date
              </label>
              <p className="text-bodyText">
                {booking.endDateTime ? new Date(booking.endDateTime).toLocaleString() : 'N/A'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-headingText mb-1">
                Total Amount
              </label>
              <p className="text-bodyText font-semibold">
                AED {(booking.totalAmount || 0).toFixed(2)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-headingText mb-1">
                Deposit Amount
              </label>
              <p className="text-bodyText">AED {(booking.depositAmount || 0).toFixed(2)}</p>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}

