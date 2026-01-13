'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import SectionCard from '@/components/ui/SectionCard'
import StatusChip from '@/components/ui/StatusChip'
import { ArrowLeft, CheckCircle, XCircle, Plus, Trash2, Download } from 'lucide-react'
import Link from 'next/link'

interface InvoiceItem {
  label: string
  amount: number
}

interface Invoice {
  _id: string
  invoiceNumber: string
  booking: {
    _id: string
    vehicle: {
      plateNumber: string
      brand: string
      model: string
      year: number
    }
    customer: {
      user: {
        name: string
        email: string
        phone?: string
      }
    }
  }
  issueDate: string
  dueDate: string
  items: InvoiceItem[]
  subtotal: number
  taxAmount: number
  total: number
  status: string
  createdAt: string
  updatedAt: string
}

export default function InvoiceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const invoiceId = params.id as string
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [userRole, setUserRole] = useState<string>('')
  const [isEditingItems, setIsEditingItems] = useState(false)
  const [editedItems, setEditedItems] = useState<InvoiceItem[]>([])
  const [editedTaxAmount, setEditedTaxAmount] = useState<number>(0)
  const [newFine, setNewFine] = useState({ label: '', amount: '' })
  const [isExportingPDF, setIsExportingPDF] = useState(false)

  useEffect(() => {
    fetchInvoice()
    fetchUserRole()
  }, [invoiceId])

  const fetchInvoice = async () => {
    try {
      console.log('[Invoice Detail] Fetching invoice:', invoiceId)
      const response = await fetch(`/api/invoices/${invoiceId}`)
      
      console.log('[Invoice Detail] Response status:', response.status)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('[Invoice Detail] Error response:', errorData)
        alert(`Failed to load invoice: ${errorData.error || 'Unknown error'}`)
        router.push('/financials')
        return
      }
      
      const data = await response.json()
      console.log('[Invoice Detail] Invoice loaded:', data.invoice?._id)
      setInvoice(data.invoice)
      setEditedItems([...(data.invoice?.items || [])])
      setEditedTaxAmount(data.invoice?.taxAmount || 0)
    } catch (error: any) {
      console.error('[Invoice Detail] Error fetching invoice:', error)
      console.error('[Invoice Detail] Error details:', {
        message: error.message,
        stack: error.stack,
      })
      alert(`Failed to load invoice: ${error.message || 'Network error'}`)
      router.push('/financials')
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

  const handleStatusUpdate = async (status: 'PAID' | 'VOID') => {
    if (!confirm(`Are you sure you want to mark this invoice as ${status}?`)) {
      return
    }

    setIsUpdating(true)
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      })

      if (response.ok) {
        const data = await response.json()
        setInvoice(data.invoice)
        router.refresh()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update invoice')
      }
    } catch (error) {
      console.error('Error updating invoice:', error)
      alert('Failed to update invoice')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAddFine = () => {
    if (!newFine.label.trim() || !newFine.amount) {
      alert('Please enter fine description and amount')
      return
    }

    const amount = parseFloat(newFine.amount)
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount')
      return
    }

    setEditedItems([
      ...editedItems,
      {
        label: newFine.label.trim(),
        amount: amount,
      },
    ])
    setNewFine({ label: '', amount: '' })
  }

  const handleRemoveItem = (index: number) => {
    setEditedItems(editedItems.filter((_, i) => i !== index))
  }

  const handleSaveItems = async () => {
    if (editedItems.length === 0) {
      alert('Invoice must have at least one item')
      return
    }

    setIsUpdating(true)
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          items: editedItems,
          taxAmount: editedTaxAmount 
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setInvoice(data.invoice)
        setEditedItems([...data.invoice.items])
        setEditedTaxAmount(data.invoice.taxAmount || 0)
        setIsEditingItems(false)
        router.refresh()
        alert('Invoice items updated successfully')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update invoice items')
      }
    } catch (error) {
      console.error('Error updating invoice items:', error)
      alert('Failed to update invoice items')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleExportPDF = async () => {
    if (isExportingPDF) return // Prevent multiple clicks
    
    setIsExportingPDF(true)
    try {
      console.log('Starting PDF export for invoice:', invoiceId)
      const response = await fetch(`/api/invoices/${invoiceId}/pdf`)
      
      console.log('PDF response status:', response.status)
      console.log('PDF response headers:', Object.fromEntries(response.headers.entries()))
      
      if (!response.ok) {
        let errorMessage = 'Failed to generate PDF'
        let errorDetails = ''
        try {
          const error = await response.json()
          errorMessage = error.error || errorMessage
          errorDetails = error.details || ''
          console.error('PDF generation error:', error)
        } catch {
          errorMessage = `Server error: ${response.status} ${response.statusText}`
          console.error('Failed to parse error response')
        }
        alert(`${errorMessage}${errorDetails ? '\n\nDetails: ' + errorDetails : ''}`)
        setIsExportingPDF(false)
        return
      }

      // Check if response is actually a PDF
      const contentType = response.headers.get('content-type')
      console.log('Response content type:', contentType)
      
      if (!contentType || !contentType.includes('application/pdf')) {
        const text = await response.text()
        console.error('Invalid PDF response:', text.substring(0, 500))
        alert('Invalid response from server. Expected PDF but got: ' + contentType)
        setIsExportingPDF(false)
        return
      }

      // Get the PDF blob
      const blob = await response.blob()
      console.log('PDF blob size:', blob.size, 'bytes')
      
      if (blob.size === 0) {
        alert('PDF file is empty. Please try again.')
        setIsExportingPDF(false)
        return
      }
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${invoice?.invoiceNumber || invoiceId}.pdf`
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      
      console.log('PDF download initiated')
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        setIsExportingPDF(false)
      }, 100)
    } catch (error: any) {
      console.error('Error exporting PDF:', error)
      console.error('Error stack:', error.stack)
      alert(`Failed to export PDF: ${error.message || 'Unknown error'}. Please check the console for details.`)
      setIsExportingPDF(false)
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8 text-bodyText">Loading invoice...</div>
    )
  }

  if (!invoice) {
    return null
  }

  const canUpdateStatus = ['FINANCE', 'SUPER_ADMIN', 'ADMIN'].includes(userRole)
  const canEditItems = canUpdateStatus && invoice.status !== 'PAID' && invoice.status !== 'VOID'
  const canMarkPaid = canUpdateStatus && invoice.status !== 'PAID' && invoice.status !== 'VOID'
  const canVoid = canUpdateStatus && invoice.status !== 'PAID' && invoice.status !== 'VOID'

  const getStatusVariant = (status: string): 'yellow' | 'green' | 'red' => {
    if (status === 'PAID') return 'green'
    if (status === 'VOID') return 'red'
    if (status === 'ISSUED') return 'yellow'
    return 'yellow'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number) => {
    return `AED ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  const isOverdue = invoice.status !== 'PAID' && invoice.status !== 'VOID' && new Date(invoice.dueDate) < new Date()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          <Link
            href="/financials"
            className="p-2 hover:bg-borderSoft rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-bodyText" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-headingText">Invoice Details</h1>
            <p className="text-bodyText mt-2">Invoice {invoice.invoiceNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            type="button"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap shrink-0 shadow-md"
            title="Export as PDF"
            aria-label="Export invoice as PDF"
          >
            <Download className="w-4 h-4 flex-shrink-0" />
            <span className="font-semibold">{isExportingPDF ? 'Generating...' : 'Export PDF'}</span>
          </button>
          <StatusChip
            status={invoice.status}
            variant={getStatusVariant(invoice.status)}
          />
          {isOverdue && (
            <span className="px-3 py-1 bg-red-500/10 text-red-500 rounded-lg text-sm font-medium whitespace-nowrap">
              Overdue
            </span>
          )}
        </div>
      </div>

      {/* Invoice Header Card */}
      <SectionCard>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-headingText mb-1">
              Invoice Number
            </label>
            <p className="text-bodyText font-semibold">{invoice.invoiceNumber}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-headingText mb-1">
              Issue Date
            </label>
            <p className="text-bodyText">{formatDate(invoice.issueDate)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-headingText mb-1">
              Due Date
            </label>
            <p className={`text-bodyText ${isOverdue ? 'text-red-500 font-semibold' : ''}`}>
              {formatDate(invoice.dueDate)}
            </p>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-borderSoft">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <label className="block text-sm font-medium text-headingText mb-1">
                Total Amount
              </label>
              <p className="text-3xl font-bold text-headingText">
                {formatCurrency(invoice.total)}
              </p>
            </div>
            <button
              onClick={handleExportPDF}
              disabled={isExportingPDF}
              type="button"
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap shadow-lg"
              title="Export as PDF"
              aria-label="Export invoice as PDF"
            >
              <Download className="w-5 h-5" />
              <span>{isExportingPDF ? 'Generating PDF...' : 'Export as PDF'}</span>
            </button>
            {canUpdateStatus && (
              <div className="flex gap-3">
                {canMarkPaid && (
                  <button
                    onClick={() => handleStatusUpdate('PAID')}
                    disabled={isUpdating}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark as Paid
                  </button>
                )}
                {canVoid && (
                  <button
                    onClick={() => handleStatusUpdate('VOID')}
                    disabled={isUpdating}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Void Invoice
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Line Items */}
      <SectionCard
        title="Line Items"
        actions={
          canEditItems && (
            <div className="flex items-center gap-2">
              {isEditingItems ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditingItems(false)
                      setEditedItems([...invoice.items])
                      setEditedTaxAmount(invoice.taxAmount || 0)
                      setNewFine({ label: '', amount: '' })
                    }}
                    className="px-3 py-1.5 text-sm bg-pageBg border border-borderSoft rounded-lg text-bodyText hover:bg-borderSoft transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveItems}
                    disabled={isUpdating}
                    className="px-3 py-1.5 text-sm bg-sidebarActiveBg text-white rounded-lg hover:bg-sidebarActiveBg/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setIsEditingItems(true)
                    setEditedTaxAmount(invoice.taxAmount || 0)
                  }}
                  className="px-3 py-1.5 text-sm bg-sidebarActiveBg text-white rounded-lg hover:bg-sidebarActiveBg/90 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Fines
                </button>
              )}
            </div>
          )
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-borderSoft">
                <th className="text-left py-3 px-4 text-sm font-medium text-headingText">
                  Description
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-headingText">
                  Amount
                </th>
                {isEditingItems && (
                  <th className="text-right py-3 px-4 text-sm font-medium text-headingText w-20">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {(isEditingItems ? editedItems : invoice.items).map((item, index) => {
                const isNegative = item.amount < 0
                const isDeposit = item.label.toLowerCase().includes('deposit')
                return (
                  <tr 
                    key={index} 
                    className={`border-b border-borderSoft ${isDeposit ? 'bg-green-500/5' : ''}`}
                  >
                    <td className="py-3 px-4 text-bodyText">
                      {item.label}
                      {isDeposit && (
                        <span className="ml-2 text-xs text-green-600 font-medium">(Payment Received)</span>
                      )}
                    </td>
                    <td className={`py-3 px-4 text-right font-medium ${
                      isNegative ? 'text-green-600' : 'text-bodyText'
                    }`}>
                      {isNegative ? `(${formatCurrency(Math.abs(item.amount))})` : formatCurrency(item.amount)}
                    </td>
                    {isEditingItems && (
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
              {isEditingItems && (
                <tr className="border-b border-borderSoft bg-sidebarActiveBg/5">
                  <td className="py-3 px-4">
                    <input
                      type="text"
                      placeholder="Fine description (e.g., Traffic Fine - Speeding)"
                      value={newFine.label}
                      onChange={(e) => setNewFine({ ...newFine, label: e.target.value })}
                      className="w-full px-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Amount"
                        value={newFine.amount}
                        onChange={(e) => setNewFine({ ...newFine, amount: e.target.value })}
                        step="0.01"
                        min="0"
                        className="flex-1 px-3 py-2 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText placeholder-sidebarMuted focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50"
                      />
                      <button
                        onClick={handleAddFine}
                        className="p-2 bg-sidebarActiveBg text-white rounded-lg hover:bg-sidebarActiveBg/90 transition-colors"
                        title="Add fine"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  {isEditingItems && <td></td>}
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-borderSoft">
                <td className="py-3 px-4 text-sm font-medium text-headingText">Subtotal</td>
                <td className="py-3 px-4 text-bodyText text-right">
                  {formatCurrency(
                    (isEditingItems ? editedItems : invoice.items).reduce(
                      (sum, item) => sum + item.amount,
                      0
                    )
                  )}
                </td>
                {isEditingItems && <td></td>}
              </tr>
              <tr>
                <td className="py-3 px-4 text-sm font-medium text-headingText">Tax</td>
                <td className="py-3 px-4 text-bodyText text-right">
                  {isEditingItems ? (
                    <div className="flex items-center justify-end gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editedTaxAmount}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0
                          setEditedTaxAmount(Math.max(0, value))
                        }}
                        className="w-32 px-3 py-1.5 bg-pageBg border border-borderSoft rounded-lg text-sm text-bodyText focus:outline-none focus:ring-2 focus:ring-sidebarActiveBg/20 focus:border-sidebarActiveBg/50 text-right"
                      />
                    </div>
                  ) : (
                    formatCurrency(invoice.taxAmount)
                  )}
                </td>
                {isEditingItems && <td></td>}
              </tr>
              <tr className="bg-sidebarActiveBg/5">
                <td className="py-3 px-4 text-sm font-bold text-headingText">Total</td>
                <td className="py-3 px-4 text-headingText text-right font-bold">
                  {formatCurrency(
                    (isEditingItems ? editedItems : invoice.items).reduce(
                      (sum, item) => sum + item.amount,
                      0
                    ) + (isEditingItems ? editedTaxAmount : invoice.taxAmount)
                  )}
                </td>
                {isEditingItems && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      </SectionCard>

      {/* Booking Information */}
      <SectionCard title="Linked Booking">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-headingText mb-1">
              Booking Number
            </label>
            <Link
              href={`/bookings/${invoice.booking?._id || ''}`}
              className="text-sidebarActiveBg hover:text-sidebarActiveBg/80 font-medium"
            >
              {invoice.booking?._id 
                ? `#${invoice.booking._id.toString().slice(-6).toUpperCase()}`
                : 'N/A'
              }
            </Link>
          </div>
          <div>
            <label className="block text-sm font-medium text-headingText mb-1">
              Vehicle
            </label>
            <p className="text-bodyText">
              {invoice.booking?.vehicle ? (
                <>
                  {invoice.booking.vehicle.plateNumber || 'N/A'} - {invoice.booking.vehicle.brand || ''}{' '}
                  {invoice.booking.vehicle.model || ''} {invoice.booking.vehicle.year ? `(${invoice.booking.vehicle.year})` : ''}
                </>
              ) : (
                <span className="text-sidebarMuted">N/A</span>
              )}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-headingText mb-1">
              Customer Name
            </label>
            <p className="text-bodyText">
              {invoice.booking?.customer?.user?.name || <span className="text-sidebarMuted">N/A</span>}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-headingText mb-1">
              Customer Email
            </label>
            <p className="text-bodyText">
              {invoice.booking?.customer?.user?.email || <span className="text-sidebarMuted">N/A</span>}
            </p>
          </div>
          {invoice.booking?.customer?.user?.phone && (
            <div>
              <label className="block text-sm font-medium text-headingText mb-1">
                Customer Phone
              </label>
              <p className="text-bodyText">{invoice.booking?.customer?.user?.phone}</p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Invoice Metadata */}
      <SectionCard title="Invoice Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-headingText mb-1">
              Created At
            </label>
            <p className="text-bodyText">
              {new Date(invoice.createdAt).toLocaleString()}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-headingText mb-1">
              Last Updated
            </label>
            <p className="text-bodyText">
              {new Date(invoice.updatedAt).toLocaleString()}
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

