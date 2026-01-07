'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import StatusChip from '@/components/ui/StatusChip'
import { Search, Filter, Eye, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import ExportButtonGroup from '@/components/export/ExportButtonGroup'

interface Invoice {
  _id: string
  invoiceNumber: string
  booking: {
    _id: string
  }
  customer?: {
    name: string
    email: string
  }
  issueDate: string
  dueDate: string
  total: number
  status: string
}

interface Payment {
  _id: string
  booking: {
    _id: string
  }
  amount: number
  method: string
  status: string
  transactionId?: string
  createdAt: string
}

interface InvoicesResponse {
  invoices: Invoice[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

interface PaymentsResponse {
  payments: Payment[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

function FinancialsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments'>(
    (searchParams.get('tab') as 'invoices' | 'payments') || 'invoices'
  )
  const [invoices, setInvoices] = useState<Invoice[]>([])
  
  // Debug: Log invoices state changes
  useEffect(() => {
    console.log('[Financials] Invoices state updated:', invoices?.length || 0, 'invoices')
    if (invoices && invoices.length > 0) {
      console.log('[Financials] First invoice structure:', JSON.stringify(invoices[0], null, 2))
    }
  }, [invoices])
  const [payments, setPayments] = useState<Payment[]>([])
  const [invoicesPagination, setInvoicesPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  })
  const [paymentsPagination, setPaymentsPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  })
  const [invoiceFilters, setInvoiceFilters] = useState({
    status: searchParams.get('status') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    search: searchParams.get('search') || '',
  })
  const [paymentFilters, setPaymentFilters] = useState({
    status: searchParams.get('status') || '',
    method: searchParams.get('method') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    search: searchParams.get('search') || '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [bookings, setBookings] = useState<Array<{ _id: string; vehicle: { plateNumber: string; brand: string; model: string }; customer: { user: { name: string } } }>>([])
  const [selectedBooking, setSelectedBooking] = useState<string>('')
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false)
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set())
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null)

  useEffect(() => {
    if (activeTab === 'invoices') {
      fetchInvoices()
    } else {
      fetchPayments()
    }
    fetchUserRole()
  }, [activeTab, invoiceFilters, paymentFilters, invoicesPagination.page, paymentsPagination.page])

  useEffect(() => {
    if (showCreateModal) {
      fetchBookings()
    }
  }, [showCreateModal])

  const fetchInvoices = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (invoiceFilters.status) params.append('status', invoiceFilters.status)
      if (invoiceFilters.dateFrom) params.append('dateFrom', invoiceFilters.dateFrom)
      if (invoiceFilters.dateTo) params.append('dateTo', invoiceFilters.dateTo)
      if (invoiceFilters.search) params.append('search', invoiceFilters.search)
      params.append('page', invoicesPagination.page.toString())
      params.append('limit', invoicesPagination.limit.toString())

      console.log('[Financials] Fetching invoices with params:', params.toString())
      const response = await fetch(`/api/invoices?${params.toString()}`)
      
      console.log('[Financials] Invoice response status:', response.status, response.statusText)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('[Financials] Invoice fetch error:', errorData)
        alert(`Failed to load invoices: ${errorData.error || 'Unknown error'}`)
        setInvoices([])
        return
      }
      
      const data: InvoicesResponse = await response.json()
      console.log('[Financials] Invoices loaded:', data.invoices?.length || 0, 'invoices')
      console.log('[Financials] Invoice data structure:', JSON.stringify(data.invoices?.[0] || {}, null, 2))
      
      // Ensure invoices is always an array and clean up any invalid entries
      let invoicesArray: Invoice[] = []
      if (Array.isArray(data.invoices)) {
        invoicesArray = data.invoices.filter((inv: any) => {
          // Filter out null, undefined, or invalid invoices
          if (!inv || typeof inv !== 'object') return false
          // Ensure each invoice has required properties
          return inv._id != null
        })
      }
      console.log('[Financials] Cleaned invoices array:', invoicesArray.length, 'valid invoices')
      setInvoices(invoicesArray)
      // Clear selections when data changes
      setSelectedInvoices(new Set())
      setInvoicesPagination(data.pagination || {
        page: 1,
        limit: 10,
        total: 0,
        pages: 0,
      })
    } catch (error: any) {
      console.error('[Financials] Error fetching invoices:', error)
      console.error('[Financials] Error details:', {
        message: error.message,
        stack: error.stack,
      })
      alert(`Failed to load invoices: ${error.message || 'Network error'}`)
      setInvoices([])
    } finally {
      setIsLoading(false)
    }
  }

  const fetchPayments = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (paymentFilters.status) params.append('status', paymentFilters.status)
      if (paymentFilters.method) params.append('method', paymentFilters.method)
      if (paymentFilters.dateFrom) params.append('dateFrom', paymentFilters.dateFrom)
      if (paymentFilters.dateTo) params.append('dateTo', paymentFilters.dateTo)
      if (paymentFilters.search) params.append('search', paymentFilters.search)
      params.append('page', paymentsPagination.page.toString())
      params.append('limit', paymentsPagination.limit.toString())

      const response = await fetch(`/api/payments?${params.toString()}`)
      if (response.ok) {
        const data: PaymentsResponse = await response.json()
        setPayments(data.payments)
        setPaymentsPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error fetching payments:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInvoiceFilterChange = (key: string, value: string) => {
    setInvoiceFilters((prev) => ({ ...prev, [key]: value }))
    setInvoicesPagination((prev) => ({ ...prev, page: 1 }))
  }

  const handlePaymentFilterChange = (key: string, value: string) => {
    setPaymentFilters((prev) => ({ ...prev, [key]: value }))
    setPaymentsPagination((prev) => ({ ...prev, page: 1 }))
  }

  const getInvoiceStatusVariant = (status: string): 'yellow' | 'green' | 'red' => {
    if (status === 'PAID') return 'green'
    if (status === 'VOID') return 'red'
    if (status === 'ISSUED') return 'yellow'
    return 'yellow'
  }

  const getPaymentStatusVariant = (status: string): 'yellow' | 'green' | 'red' => {
    if (status === 'SUCCESS') return 'green'
    if (status === 'FAILED') return 'red'
    return 'yellow'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number) => {
    return `AED ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

  const fetchBookings = async () => {
    try {
      // Fetch all bookings (not just CONFIRMED) to give more options
      // We'll filter out ones that already have invoices
      const response = await fetch('/api/bookings?limit=100')
      if (response.ok) {
        const data = await response.json()
        const bookingsList = data.bookings || []
        
        console.log('Fetched bookings:', bookingsList.length)
        
        // Filter out bookings that already have invoices
        const bookingsWithoutInvoices = await Promise.all(
          bookingsList.map(async (booking: any) => {
            try {
              const invoiceCheck = await fetch(`/api/invoices?booking=${booking._id}`)
              if (invoiceCheck.ok) {
                const invoiceData = await invoiceCheck.json()
                if (invoiceData.invoices && invoiceData.invoices.length > 0) {
                  return null // Booking already has an invoice
                }
              }
              return booking
            } catch (error) {
              console.error('Error checking invoice for booking:', error)
              return booking // Include it if we can't check
            }
          })
        )
        
        // Filter out null values and only show CONFIRMED, CHECKED_OUT, or CHECKED_IN bookings
        const availableBookings = bookingsWithoutInvoices
          .filter((b: any) => b !== null)
          .filter((b: any) => ['CONFIRMED', 'CHECKED_OUT', 'CHECKED_IN'].includes(b.status))
        
        console.log('Available bookings for invoice:', availableBookings.length)
        setBookings(availableBookings)
      } else {
        console.error('Failed to fetch bookings:', response.statusText)
        setBookings([])
      }
    } catch (error) {
      console.error('Error fetching bookings:', error)
      setBookings([])
    }
  }

  const handleCreateInvoice = async () => {
    if (!selectedBooking) {
      alert('Please select a booking')
      return
    }

    setIsCreatingInvoice(true)
    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ booking: selectedBooking }),
      })

      if (response.ok) {
        const data = await response.json()
        setShowCreateModal(false)
        setSelectedBooking('')
        alert('Invoice created successfully!')
        router.push(`/financials/invoices/${data.invoice._id}`)
        fetchInvoices()
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

  const handleSelectInvoice = (invoiceId: string) => {
    setSelectedInvoices((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(invoiceId)) {
        newSet.delete(invoiceId)
      } else {
        newSet.add(invoiceId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedInvoices.size === invoices.length) {
      setSelectedInvoices(new Set())
    } else {
      setSelectedInvoices(new Set(invoices.map((inv) => inv._id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedInvoices.size === 0) return

    setIsDeleting(true)
    try {
      const response = await fetch('/api/invoices', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoiceIds: Array.from(selectedInvoices) }),
      })

      if (response.ok) {
        const data = await response.json()
        setShowBulkDeleteModal(false)
        setSelectedInvoices(new Set())
        alert(`Successfully deleted ${data.deletedCount} invoice(s)`)
        fetchInvoices()
      } else {
        const error = await response.json()
        let errorMessage = error.error || 'Failed to delete invoices'
        if (error.protectedInvoices && error.protectedInvoices.length > 0) {
          const protectedNumbers = error.protectedInvoices
            .map((inv: any) => inv.invoiceNumber)
            .join(', ')
          errorMessage += `\n\nCannot delete: ${protectedNumbers} (PAID or VOID status - protected for audit purposes)`
        }
        alert(errorMessage)
      }
    } catch (error: any) {
      console.error('Error deleting invoices:', error)
      alert('Failed to delete invoices: ' + (error.message || 'Network error'))
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDeleteInvoice = async (invoiceId: string) => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setInvoiceToDelete(null)
        alert('Invoice deleted successfully')
        fetchInvoices()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete invoice')
      }
    } catch (error: any) {
      console.error('Error deleting invoice:', error)
      alert('Failed to delete invoice: ' + (error.message || 'Network error'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-headingText">Financials</h1>
        <p className="text-bodyText mt-2">Manage invoices and payments</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-borderSoft">
        <button
          onClick={() => {
            setActiveTab('invoices')
            router.push('/financials?tab=invoices')
          }}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'invoices'
              ? 'text-sidebarActiveBg border-b-2 border-sidebarActiveBg'
              : 'text-bodyText hover:text-headingText'
          }`}
        >
          Invoices
        </button>
        <button
          onClick={() => {
            setActiveTab('payments')
            router.push('/financials?tab=payments')
          }}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'payments'
              ? 'text-sidebarActiveBg border-b-2 border-sidebarActiveBg'
              : 'text-bodyText hover:text-headingText'
          }`}
        >
          Payments
        </button>
      </div>

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <>
          <SectionCard
            title="Invoices"
            actions={
              <div className="flex items-center gap-2">
                {selectedInvoices.size > 0 && ['ADMIN', 'SUPER_ADMIN'].includes(userRole) && (
                  <button
                    onClick={() => setShowBulkDeleteModal(true)}
                    className="px-4 py-2 bg-danger text-white rounded-lg font-medium hover:bg-danger/90 transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-5 h-5" />
                    Delete Selected ({selectedInvoices.size})
                  </button>
                )}
                {['FINANCE', 'ADMIN', 'SUPER_ADMIN'].includes(userRole) && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg font-medium hover:bg-sidebarActiveBg/90 transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Create Invoice
                  </button>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-bodyText" />
                  <input
                    type="text"
                    placeholder="Search invoice #..."
                    value={invoiceFilters.search}
                    onChange={(e) => handleInvoiceFilterChange('search', e.target.value)}
                    className="pl-9 pr-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 w-48"
                  />
                </div>
                <select
                  value={invoiceFilters.status}
                  onChange={(e) => handleInvoiceFilterChange('status', e.target.value)}
                  className="px-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                >
                  <option value="">All Status</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ISSUED">Issued</option>
                  <option value="PAID">Paid</option>
                  <option value="VOID">Void</option>
                </select>
                <input
                  type="date"
                  value={invoiceFilters.dateFrom}
                  onChange={(e) => handleInvoiceFilterChange('dateFrom', e.target.value)}
                  placeholder="From"
                  className="px-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                />
                <input
                  type="date"
                  value={invoiceFilters.dateTo}
                  onChange={(e) => handleInvoiceFilterChange('dateTo', e.target.value)}
                  placeholder="To"
                  className="px-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                />
                <ExportButtonGroup module="INVOICES" filters={invoiceFilters} />
              </div>
            }
          >
          {isLoading ? (
            <div className="text-center py-8 text-bodyText">Loading...</div>
          ) : !Array.isArray(invoices) || invoices.length === 0 ? (
            <div className="text-center py-8 text-bodyText">No invoices found</div>
          ) : (() => {
            try {
              return (
                <>
                  <Table
                    headers={[
                      ['ADMIN', 'SUPER_ADMIN'].includes(userRole) ? (
                        <div key="select-all" className="flex justify-center">
                          <input
                            type="checkbox"
                            checked={invoices.length > 0 && selectedInvoices.size === invoices.length}
                            onChange={handleSelectAll}
                            className="w-4 h-4 text-sidebarActiveBg border-borderSoft rounded focus:ring-sidebarActiveBg cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                            title="Select all invoices"
                          />
                        </div>
                      ) : null,
                      'Invoice #',
                      'Booking #',
                      'Customer',
                      'Issue Date',
                      'Due Date',
                      'Total',
                      'Status',
                      'Actions',
                    ].filter(Boolean)}
                  >
                    {(() => {
                  // Double-check invoices is an array and filter out any undefined/null items
                  if (!Array.isArray(invoices)) {
                    console.warn('[Financials] Invoices is not an array:', typeof invoices, invoices)
                    return null
                  }
                  
                  const safeInvoices = invoices.filter((inv: any) => {
                    if (inv == null) return false
                    if (typeof inv !== 'object') return false
                    if (!inv._id) return false
                    return true
                  })
                  
                  if (safeInvoices.length === 0) {
                    return null
                  }
                  
                  // Filter out any remaining invalid invoices before mapping
                  const validInvoices = safeInvoices.filter((inv: any) => {
                    if (!inv || !inv._id) {
                      console.warn(`[Financials] Filtering out invalid invoice:`, inv)
                      return false
                    }
                    return true
                  })
                  
                  return validInvoices.map((invoice: any, index: number) => {
                    
                    // Safety check for booking._id before using slice
                    let bookingIdDisplay = 'N/A'
                    try {
                      // Check if booking exists
                      const booking = invoice?.booking
                      if (!booking) {
                        bookingIdDisplay = 'N/A'
                      } else {
                        // Safely access _id property
                        let bookingIdValue: any
                        try {
                          bookingIdValue = booking._id
                        } catch (e) {
                          console.error(`[Financials] Error accessing booking._id:`, e)
                          bookingIdValue = null
                        }
                        
                        // Only proceed if we have a valid value
                        if (bookingIdValue !== undefined && bookingIdValue !== null) {
                          // Convert to string safely
                          let bookingId: string = ''
                          try {
                            if (typeof bookingIdValue === 'string') {
                              bookingId = bookingIdValue
                            } else if (typeof bookingIdValue === 'object' && bookingIdValue.toString) {
                              bookingId = bookingIdValue.toString()
                            } else {
                              bookingId = String(bookingIdValue)
                            }
                          } catch (e) {
                            console.error(`[Financials] Error converting booking._id to string:`, e)
                            bookingId = ''
                          }
                          
                          // Only use slice if we have a valid non-empty string
                          if (bookingId && typeof bookingId === 'string' && bookingId.length > 0 && bookingId !== 'undefined' && bookingId !== 'null') {
                            try {
                              if (bookingId.length >= 6) {
                                bookingIdDisplay = `#${bookingId.slice(-6).toUpperCase()}`
                              } else {
                                bookingIdDisplay = `#${bookingId.toUpperCase()}`
                              }
                            } catch (sliceError) {
                              console.error(`[Financials] Error using slice on bookingId "${bookingId}":`, sliceError)
                              bookingIdDisplay = `#${bookingId.toUpperCase()}`
                            }
                          }
                        }
                      }
                    } catch (error) {
                      console.error(`[Financials] Error processing booking ID for invoice ${invoice?._id}:`, error)
                      bookingIdDisplay = 'N/A'
                    }
                  
                  const canDelete = invoice.status !== 'PAID' && invoice.status !== 'VOID'
                  
                  return (
                    <TableRow key={invoice._id || `invoice-${index}`}>
                      {['ADMIN', 'SUPER_ADMIN'].includes(userRole) && (
                        <TableCell className="w-12 text-center">
                          <input
                            type="checkbox"
                            checked={selectedInvoices.has(invoice._id)}
                            onChange={() => handleSelectInvoice(invoice._id)}
                            disabled={!canDelete}
                            className="w-4 h-4 text-sidebarActiveBg border-borderSoft rounded focus:ring-sidebarActiveBg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                            title={!canDelete ? 'PAID and VOID invoices cannot be deleted' : 'Select invoice'}
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium text-headingText">
                        {invoice.invoiceNumber || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <span className="text-sidebarMuted">{bookingIdDisplay}</span>
                      </TableCell>
                      <TableCell>
                        {invoice.customer ? (
                          <div>
                            <div className="font-medium text-headingText">
                              {invoice.customer.name || 'N/A'}
                            </div>
                            <div className="text-xs text-sidebarMuted">
                              {invoice.customer.email || ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sidebarMuted">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>{invoice.issueDate ? formatDate(invoice.issueDate) : 'N/A'}</TableCell>
                      <TableCell>{invoice.dueDate ? formatDate(invoice.dueDate) : 'N/A'}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(invoice.total || 0)}
                      </TableCell>
                      <TableCell>
                        <StatusChip
                          status={invoice.status || 'DRAFT'}
                          variant={getInvoiceStatusVariant(invoice.status || 'DRAFT')}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/financials/invoices/${invoice._id}`}
                            className="text-sidebarActiveBg hover:text-sidebarActiveBg/80 font-medium text-sm flex items-center gap-1 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </Link>
                          {['ADMIN', 'SUPER_ADMIN'].includes(userRole) && canDelete && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setInvoiceToDelete(invoice._id)
                              }}
                              className="text-danger hover:text-danger/80 font-medium text-sm flex items-center gap-1 transition-colors"
                              title="Delete invoice"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Delete</span>
                            </button>
                          )}
                          {['ADMIN', 'SUPER_ADMIN'].includes(userRole) && !canDelete && (
                            <span className="text-xs text-sidebarMuted italic" title="PAID and VOID invoices are protected for audit purposes">
                              Protected
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
                })()}
              </Table>

              {/* Pagination */}
              {invoicesPagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-borderSoft">
                  <div className="text-sm text-bodyText">
                    Showing {(invoicesPagination.page - 1) * invoicesPagination.limit + 1} to{' '}
                    {Math.min(
                      invoicesPagination.page * invoicesPagination.limit,
                      invoicesPagination.total
                    )}{' '}
                    of {invoicesPagination.total} invoices
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setInvoicesPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                      }
                      disabled={invoicesPagination.page === 1}
                      className="p-2 bg-pageBg border border-borderSoft rounded-lg hover:bg-borderSoft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-bodyText px-2">
                      Page {invoicesPagination.page} of {invoicesPagination.pages}
                    </span>
                    <button
                      onClick={() =>
                        setInvoicesPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                      }
                      disabled={invoicesPagination.page === invoicesPagination.pages}
                      className="p-2 bg-pageBg border border-borderSoft rounded-lg hover:bg-borderSoft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
                </>
              )
            } catch (renderError: any) {
              console.error('[Financials] Error rendering invoices table:', renderError)
              console.error('[Financials] Error details:', {
                message: renderError.message,
                stack: renderError.stack,
                invoices: invoices,
              })
              return (
                <div className="text-center py-8 text-bodyText">
                  <p className="text-red-500 mb-2">Error loading invoices</p>
                  <p className="text-sm text-sidebarMuted">{renderError.message}</p>
                </div>
              )
            }
          })()}
        </SectionCard>

        {/* Bulk Delete Confirmation Modal */}
        {showBulkDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-pageBg rounded-lg p-6 w-full max-w-md border border-borderSoft">
              <h2 className="text-2xl font-bold text-headingText mb-4">Delete Invoices</h2>
              <p className="text-bodyText mb-4">
                Are you sure you want to delete {selectedInvoices.size} invoice(s)? This action cannot be undone.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800 font-medium mb-2">⚠️ Important:</p>
                <ul className="text-xs text-yellow-700 list-disc list-inside space-y-1">
                  <li>PAID and VOID invoices are protected and cannot be deleted</li>
                  <li>Only DRAFT and ISSUED invoices can be deleted</li>
                  <li>This action is logged for audit purposes</li>
                </ul>
              </div>
              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => setShowBulkDeleteModal(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText hover:bg-borderSoft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-danger text-white rounded-lg font-medium hover:bg-danger/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Individual Delete Confirmation Modal */}
        {invoiceToDelete && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-pageBg rounded-lg p-6 w-full max-w-md border border-borderSoft">
              <h2 className="text-2xl font-bold text-headingText mb-4">Delete Invoice</h2>
              <p className="text-bodyText mb-4">
                Are you sure you want to delete this invoice? This action cannot be undone.
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800 font-medium mb-2">⚠️ Note:</p>
                <p className="text-xs text-yellow-700">
                  PAID and VOID invoices are protected for audit and compliance purposes and cannot be deleted.
                </p>
              </div>
              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => setInvoiceToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText hover:bg-borderSoft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteInvoice(invoiceToDelete)}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-danger text-white rounded-lg font-medium hover:bg-danger/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Invoice Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-pageBg rounded-lg p-6 w-full max-w-md border border-borderSoft">
              <h2 className="text-2xl font-bold text-headingText mb-4">Create Invoice</h2>
              <p className="text-bodyText mb-4">Select a confirmed booking to create an invoice</p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-headingText mb-2">
                  Select Booking
                </label>
                <select
                  value={selectedBooking}
                  onChange={(e) => setSelectedBooking(e.target.value)}
                  className="w-full px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                >
                  <option value="">-- Select a booking --</option>
                  {bookings.map((booking: any) => {
                    const vehicle = booking.vehicle || {}
                    const customer = booking.customer || {}
                    const userName = customer.user?.name || customer.name || 'Unknown'
                    const plateNumber = vehicle.plateNumber || 'N/A'
                    const brand = vehicle.brand || ''
                    const model = vehicle.model || ''
                    
                    // Safety check for booking ID
                    let bookingIdStr = 'N/A'
                    try {
                      if (booking._id) {
                        const idStr = String(booking._id)
                        bookingIdStr = idStr.length >= 6 ? idStr.slice(-6).toUpperCase() : idStr.toUpperCase()
                      }
                    } catch (error) {
                      console.error('[Financials] Error processing booking ID:', error)
                    }
                    
                    return (
                      <option key={booking._id} value={booking._id}>
                        #{bookingIdStr} - {plateNumber} - {brand} {model} ({userName})
                      </option>
                    )
                  })}
                </select>
              </div>

              {bookings.length === 0 && (
                <p className="text-sm text-sidebarMuted mb-4">
                  No confirmed bookings found. Please confirm a booking first.
                </p>
              )}

              <div className="flex items-center gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setSelectedBooking('')
                  }}
                  className="px-4 py-2 bg-pageBg border border-borderSoft rounded-lg text-bodyText hover:bg-borderSoft transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateInvoice}
                  disabled={!selectedBooking || isCreatingInvoice}
                  className="px-4 py-2 bg-sidebarActiveBg text-white rounded-lg font-medium hover:bg-sidebarActiveBg/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingInvoice ? 'Creating...' : 'Create Invoice'}
                </button>
              </div>
            </div>
          </div>
        )}
        </>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <SectionCard
          title="Payments"
          actions={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-bodyText" />
                <input
                  type="text"
                  placeholder="Search transaction ID..."
                  value={paymentFilters.search}
                  onChange={(e) => handlePaymentFilterChange('search', e.target.value)}
                  className="pl-9 pr-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 w-48"
                />
              </div>
              <select
                value={paymentFilters.status}
                onChange={(e) => handlePaymentFilterChange('status', e.target.value)}
                className="px-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
                <option value="REFUNDED">Refunded</option>
              </select>
              <select
                value={paymentFilters.method}
                onChange={(e) => handlePaymentFilterChange('method', e.target.value)}
                className="px-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
              >
                <option value="">All Methods</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Card</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="ONLINE">Online</option>
              </select>
              <input
                type="date"
                value={paymentFilters.dateFrom}
                onChange={(e) => handlePaymentFilterChange('dateFrom', e.target.value)}
                placeholder="From"
                className="px-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
              />
              <input
                type="date"
                value={paymentFilters.dateTo}
                onChange={(e) => handlePaymentFilterChange('dateTo', e.target.value)}
                placeholder="To"
                className="px-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
              />
            </div>
          }
        >
          {isLoading ? (
            <div className="text-center py-8 text-bodyText">Loading...</div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-bodyText">No payments found</div>
          ) : (
            <>
              <Table
                headers={['Date', 'Booking #', 'Method', 'Amount', 'Status', 'Transaction ID']}
              >
                {payments.map((payment) => (
                  <TableRow key={payment._id}>
                    <TableCell>{formatDate(payment.createdAt)}</TableCell>
                    <TableCell>
                      {(() => {
                        try {
                          if (payment.booking?._id) {
                            const bookingId = String(payment.booking._id)
                            const displayId = bookingId.length >= 6 
                              ? bookingId.slice(-6).toUpperCase() 
                              : bookingId.toUpperCase()
                            return `#${displayId}`
                          }
                          return <span className="text-sidebarMuted">N/A</span>
                        } catch (error) {
                          console.error('[Financials] Error processing payment booking ID:', error)
                          return <span className="text-sidebarMuted">N/A</span>
                        }
                      })()}
                    </TableCell>
                    <TableCell>{payment.method.replace('_', ' ')}</TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                    <TableCell>
                      <StatusChip
                        status={payment.status}
                        variant={getPaymentStatusVariant(payment.status)}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-sidebarMuted">
                      {payment.transactionId || 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </Table>

              {/* Pagination */}
              {paymentsPagination.pages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-borderSoft">
                  <div className="text-sm text-bodyText">
                    Showing {(paymentsPagination.page - 1) * paymentsPagination.limit + 1} to{' '}
                    {Math.min(
                      paymentsPagination.page * paymentsPagination.limit,
                      paymentsPagination.total
                    )}{' '}
                    of {paymentsPagination.total} payments
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setPaymentsPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                      }
                      disabled={paymentsPagination.page === 1}
                      className="p-2 bg-pageBg border border-borderSoft rounded-lg hover:bg-borderSoft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-bodyText px-2">
                      Page {paymentsPagination.page} of {paymentsPagination.pages}
                    </span>
                    <button
                      onClick={() =>
                        setPaymentsPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                      }
                      disabled={paymentsPagination.page === paymentsPagination.pages}
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
      )}
    </div>
  )
}

export default function FinancialsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="text-bodyText">Loading...</div></div>}>
      <FinancialsContent />
    </Suspense>
  )
}

