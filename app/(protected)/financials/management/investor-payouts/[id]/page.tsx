'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { format } from 'date-fns'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import StatusChip from '@/components/ui/StatusChip'
import { ArrowLeft, Download, Check, X, Edit, Loader2 } from 'lucide-react'

interface InvestorPayout {
  _id: string
  investor: {
    _id: string
    user: {
      name: string
      email: string
      phone?: string
    }
    companyName?: string
    bankName?: string
    bankAccountName?: string
    iban?: string
    swift?: string
  }
  periodFrom: string
  periodTo: string
  branchId?: string
  totals: {
    totalRevenue: number
    commissionPercent: number
    commissionAmount: number
    netPayout: number
    breakdown: {
      vehicle: string
      plateNumber: string
      brand: string
      model: string
      category: string
      bookingsCount: number
      revenue: number
    }[]
  }
  status: 'DRAFT' | 'PENDING' | 'PAID' | 'CANCELLED'
  payment?: {
    _id: string
    amount: number
    method: string
    status: string
    transactionId?: string
    paidAt?: string
  }
  expense?: {
    _id: string
    amount: number
    dateIncurred: string
    description: string
  }
  notes?: string
  createdBy: {
    name: string
    email: string
  }
  createdAt: string
}

export default function InvestorPayoutDetailPage() {
  const router = useRouter()
  const params = useParams()
  const payoutId = params.id as string

  const [payout, setPayout] = useState<InvestorPayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState('')

  useEffect(() => {
    fetchPayout()
  }, [payoutId])

  const fetchPayout = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/investor-payouts/${payoutId}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch payout')
      }

      const data = await response.json()
      console.log('Fetched payout data:', data.payout)
      console.log('Totals:', data.payout?.totals)
      setPayout(data.payout)
      setNotesValue(data.payout.notes || '')
    } catch (err: any) {
      setError(err.message || 'Failed to load payout')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkAsPaid = async () => {
    if (!confirm('Mark this payout as paid?')) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/investor-payouts/${payoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PAID',
          paymentInfo: {
            status: 'SUCCESS',
            paidAt: new Date().toISOString(),
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to mark as paid')
      }

      fetchPayout()
    } catch (err: any) {
      alert(err.message || 'Failed to mark as paid')
    } finally {
      setUpdating(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this payout?')) return

    setUpdating(true)
    try {
      const response = await fetch(`/api/investor-payouts/${payoutId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to cancel payout')
      }

      router.push('/financials/management/investor-payouts')
    } catch (err: any) {
      alert(err.message || 'Failed to cancel payout')
      setUpdating(false)
    }
  }

  const handleSaveNotes = async () => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/investor-payouts/${payoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesValue }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update notes')
      }

      setEditingNotes(false)
      fetchPayout()
    } catch (err: any) {
      alert(err.message || 'Failed to update notes')
    } finally {
      setUpdating(false)
    }
  }

  const handleDownloadPDF = () => {
    window.open(`/api/investor-payouts/${payoutId}/pdf`, '_blank')
  }

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null || isNaN(amount)) {
      return 'AED 0.00'
    }
    return `AED ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-sidebarActiveBg" />
          <p className="text-bodyText">Loading payout details...</p>
        </div>
      </div>
    )
  }

  if (error || !payout) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-sidebarMuted/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-bodyText" />
          </button>
          <div>
            <h1 className="text-4xl font-bold text-headingText mb-2">Investor Payout</h1>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error || 'Payout not found'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-sidebarMuted/10 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-bodyText" />
          </button>
          <div>
            <h1 className="text-4xl font-bold text-headingText mb-2">Investor Payout</h1>
            <p className="text-bodyText text-base">Payout details and statement</p>
          </div>
        </div>
        <div className="flex gap-2">
          {payout.status === 'PENDING' && (
            <button
              onClick={handleMarkAsPaid}
              disabled={updating}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Mark as Paid
            </button>
          )}
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            Download Statement
          </button>
          {(payout.status === 'DRAFT' || payout.status === 'PENDING') && (
            <button
              onClick={handleCancel}
              disabled={updating}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              Cancel Payout
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <SectionCard>
          <div>
            <p className="text-sm text-bodyText mb-1">Investor</p>
            <p className="text-lg font-semibold text-headingText">{payout.investor.user.name}</p>
            <p className="text-xs text-sidebarMuted mt-1">INVESTOR</p>
            {payout.investor.companyName && (
              <p className="text-xs text-sidebarMuted">{payout.investor.companyName}</p>
            )}
          </div>
        </SectionCard>
        <SectionCard>
          <div>
            <p className="text-sm text-bodyText mb-1">Period</p>
            <p className="text-lg font-semibold text-headingText">
              {format(new Date(payout.periodFrom), 'MMM dd, yyyy')} -{' '}
              {format(new Date(payout.periodTo), 'MMM dd, yyyy')}
            </p>
          </div>
        </SectionCard>
        <SectionCard>
          <div>
            <p className="text-sm text-bodyText mb-1">Net Payout</p>
            <p className="text-lg font-semibold text-sidebarActiveBg">
              {formatCurrency(payout.totals?.netPayout)}
            </p>
          </div>
        </SectionCard>
        <SectionCard>
          <div>
            <p className="text-sm text-bodyText mb-1">Status</p>
            <div className="mt-1">
              <StatusChip
                status={payout.status}
                variant={
                  payout.status === 'PAID'
                    ? 'green'
                    : payout.status === 'CANCELLED'
                    ? 'red'
                    : payout.status === 'PENDING'
                    ? 'yellow'
                    : 'default'
                }
              />
            </div>
            {payout.payment && (
              <div className="mt-2">
                <p className="text-xs text-bodyText">Payment:</p>
                <StatusChip
                  status={payout.payment.status}
                  variant={
                    payout.payment.status === 'SUCCESS'
                      ? 'green'
                      : payout.payment.status === 'FAILED'
                      ? 'red'
                      : 'yellow'
                  }
                />
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Summary Section */}
      <SectionCard title="Payout Summary">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-bodyText mb-1">Total Revenue</p>
              <p className="text-xl font-semibold text-headingText">
                {formatCurrency(payout.totals?.totalRevenue)}
              </p>
            </div>
            <div>
              <p className="text-sm text-bodyText mb-1">Commission ({payout.totals?.commissionPercent || 0}%)</p>
              <p className="text-xl font-semibold text-headingText">
                {formatCurrency(payout.totals?.commissionAmount)}
              </p>
            </div>
          </div>
          <div className="border-t border-borderSoft pt-4">
            <div className="flex justify-between items-center">
              <p className="text-lg font-semibold text-headingText">Net Payout</p>
              <p className="text-2xl font-bold text-sidebarActiveBg">
                {formatCurrency(payout.totals?.netPayout)}
              </p>
            </div>
          </div>
          {payout.branchId && (
            <div>
              <p className="text-sm text-bodyText mb-1">Branch</p>
              <p className="text-base text-headingText">{payout.branchId}</p>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-bodyText">Notes</p>
              {!editingNotes && (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="p-1 text-sidebarActiveBg hover:bg-sidebarMuted/10 rounded"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
            </div>
            {editingNotes ? (
              <div className="space-y-2">
                <textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveNotes}
                    disabled={updating}
                    className="px-3 py-1 bg-sidebarActiveBg text-white rounded text-sm hover:opacity-90 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditingNotes(false)
                      setNotesValue(payout.notes || '')
                    }}
                    className="px-3 py-1 bg-cardBg border border-borderSoft rounded text-sm text-bodyText hover:bg-sidebarMuted/10"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-base text-bodyText">{payout.notes || 'No notes'}</p>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Breakdown Table */}
      {payout.totals.breakdown && payout.totals.breakdown.length > 0 && (
        <SectionCard title="Vehicle Breakdown">
          <Table headers={['Plate No', 'Vehicle', 'Category', 'Bookings', 'Revenue (AED)']}>
            {payout.totals.breakdown.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell>{item.plateNumber}</TableCell>
                <TableCell>
                  {item.brand} {item.model}
                </TableCell>
                <TableCell>{item.category}</TableCell>
                <TableCell>{item.bookingsCount}</TableCell>
                <TableCell>{formatCurrency(item.revenue)}</TableCell>
              </TableRow>
            ))}
          </Table>
        </SectionCard>
      )}

      {/* Investor & Payment Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionCard title="Investor Details">
          <div className="space-y-3">
            <div>
              <p className="text-sm text-bodyText mb-1">Name</p>
              <p className="text-base font-medium text-headingText">{payout.investor.user.name}</p>
            </div>
            {payout.investor.companyName && (
              <div>
                <p className="text-sm text-bodyText mb-1">Company</p>
                <p className="text-base font-medium text-headingText">{payout.investor.companyName}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-bodyText mb-1">Email</p>
              <p className="text-base text-headingText">{payout.investor.user.email}</p>
            </div>
            {payout.investor.user.phone && (
              <div>
                <p className="text-sm text-bodyText mb-1">Phone</p>
                <p className="text-base text-headingText">{payout.investor.user.phone}</p>
              </div>
            )}
            {payout.investor.bankName && (
              <>
                <div className="border-t border-borderSoft pt-3 mt-3">
                  <p className="text-sm font-medium text-bodyText mb-2">Bank Details</p>
                </div>
                <div>
                  <p className="text-sm text-bodyText mb-1">Bank Name</p>
                  <p className="text-base text-headingText">{payout.investor.bankName}</p>
                </div>
                {payout.investor.bankAccountName && (
                  <div>
                    <p className="text-sm text-bodyText mb-1">Account Name</p>
                    <p className="text-base text-headingText">{payout.investor.bankAccountName}</p>
                  </div>
                )}
                {payout.investor.iban && (
                  <div>
                    <p className="text-sm text-bodyText mb-1">IBAN</p>
                    <p className="text-base text-headingText font-mono">{payout.investor.iban}</p>
                  </div>
                )}
                {payout.investor.swift && (
                  <div>
                    <p className="text-sm text-bodyText mb-1">SWIFT</p>
                    <p className="text-base text-headingText font-mono">{payout.investor.swift}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </SectionCard>

        {payout.payment && (
          <SectionCard title="Payment Details">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-bodyText mb-1">Amount</p>
                <p className="text-base font-semibold text-headingText">
                  {formatCurrency(payout.payment.amount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-bodyText mb-1">Method</p>
                <p className="text-base text-headingText">{payout.payment.method}</p>
              </div>
              <div>
                <p className="text-sm text-bodyText mb-1">Status</p>
                <StatusChip
                  status={payout.payment.status}
                  variant={
                    payout.payment.status === 'SUCCESS'
                      ? 'green'
                      : payout.payment.status === 'FAILED'
                      ? 'red'
                      : 'yellow'
                  }
                />
              </div>
              {payout.payment.transactionId && (
                <div>
                  <p className="text-sm text-bodyText mb-1">Transaction ID</p>
                  <p className="text-base text-headingText font-mono">{payout.payment.transactionId}</p>
                </div>
              )}
              {payout.payment.paidAt && (
                <div>
                  <p className="text-sm text-bodyText mb-1">Paid At</p>
                  <p className="text-base text-headingText">
                    {format(new Date(payout.payment.paidAt), 'MMM dd, yyyy HH:mm')}
                  </p>
                </div>
              )}
            </div>
          </SectionCard>
        )}
      </div>

      {/* Expense Link */}
      {payout.expense && (
        <SectionCard title="Linked Expense">
          <div className="space-y-2">
            <p className="text-sm text-bodyText">
              This payout is automatically linked to an expense entry (COGS) for accounting purposes.
            </p>
            <div>
              <p className="text-sm text-bodyText mb-1">Expense Amount</p>
              <p className="text-base font-semibold text-headingText">
                {formatCurrency(payout.expense.amount)}
              </p>
            </div>
            <div>
              <p className="text-sm text-bodyText mb-1">Date Incurred</p>
              <p className="text-base text-headingText">
                {format(new Date(payout.expense.dateIncurred), 'MMM dd, yyyy')}
              </p>
            </div>
            <div>
              <p className="text-sm text-bodyText mb-1">Description</p>
              <p className="text-base text-headingText">{payout.expense.description}</p>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Created By */}
      <SectionCard>
        <div className="text-sm text-bodyText">
          Created by {payout.createdBy.name} on {format(new Date(payout.createdAt), 'MMM dd, yyyy HH:mm')}
        </div>
      </SectionCard>
    </div>
  )
}
