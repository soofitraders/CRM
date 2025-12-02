'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import { ArrowLeft, Loader2 } from 'lucide-react'

interface InvestorProfile {
  _id: string
  user: {
    name: string
    email: string
  }
  companyName?: string
}

interface PayoutPreview {
  investorId: string
  investorName: string
  periodFrom: Date
  periodTo: Date
  branchId?: string
  totalRevenue: number
  commissionPercent: number
  commissionAmount: number
  netPayout: number
  breakdown: {
    vehicleId: string
    plateNumber: string
    brand: string
    model: string
    category: string
    bookingsCount: number
    revenue: number
  }[]
}

export default function NewInvestorPayoutPage() {
  const router = useRouter()
  const [investors, setInvestors] = useState<InvestorProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [preview, setPreview] = useState<PayoutPreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    investorId: '',
    periodFrom: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    periodTo: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    branchId: '',
    notes: '',
    createPayment: false,
    paymentMethod: 'BANK_TRANSFER' as 'BANK_TRANSFER' | 'CASH' | 'OTHER',
  })

  useEffect(() => {
    fetchInvestors()
  }, [])

  useEffect(() => {
    if (formData.investorId && formData.periodFrom && formData.periodTo) {
      fetchPreview()
    } else {
      setPreview(null)
    }
  }, [formData.investorId, formData.periodFrom, formData.periodTo, formData.branchId])

  const fetchInvestors = async () => {
    try {
      const response = await fetch('/api/investors')
      if (!response.ok) throw new Error('Failed to fetch investors')
      const data = await response.json()
      setInvestors(data.investors || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load investors')
    }
  }

  const fetchPreview = async () => {
    if (!formData.investorId || !formData.periodFrom || !formData.periodTo) return

    setPreviewLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('investorId', formData.investorId)
      params.append('periodFrom', formData.periodFrom)
      params.append('periodTo', formData.periodTo)
      if (formData.branchId) params.append('branchId', formData.branchId)

      const response = await fetch(`/api/investor-payouts/preview?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch preview')
      }

      const data = await response.json()
      setPreview(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load preview')
      setPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!preview || preview.netPayout <= 0) {
      alert('Invalid payout preview. Please check the period and investor selection.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/investor-payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investorId: formData.investorId,
          periodFrom: formData.periodFrom,
          periodTo: formData.periodTo,
          branchId: formData.branchId || undefined,
          notes: formData.notes || undefined,
          createPayment: formData.createPayment,
          paymentMethod: formData.createPayment ? formData.paymentMethod : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.message || errorData.error || 'Failed to create payout'
        const details = errorData.details ? `\nDetails: ${JSON.stringify(errorData.details, null, 2)}` : ''
        throw new Error(errorMessage + details)
      }

      const data = await response.json()
      router.push(`/financials/management/investor-payouts/${data.payout._id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create payout')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return `AED ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-sidebarMuted/10 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-bodyText" />
        </button>
        <div>
          <h1 className="text-4xl font-bold text-headingText mb-2">Generate Investor Payout</h1>
          <p className="text-bodyText text-base">Create a new payout statement for an investor</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Form Fields */}
        <SectionCard title="Payout Details">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">
                  Investor *
                </label>
                <select
                  value={formData.investorId}
                  onChange={(e) => setFormData({ ...formData, investorId: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                >
                  <option value="">Select Investor</option>
                  {investors.map((investor) => (
                    <option key={investor._id} value={investor._id}>
                      {investor.user.name} {investor.companyName ? `(${investor.companyName})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">Branch</label>
                <input
                  type="text"
                  value={formData.branchId}
                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  placeholder="Optional"
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">
                  Period From *
                </label>
                <input
                  type="date"
                  value={formData.periodFrom}
                  onChange={(e) => setFormData({ ...formData, periodFrom: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">Period To *</label>
                <input
                  type="date"
                  value={formData.periodTo}
                  onChange={(e) => setFormData({ ...formData, periodTo: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-bodyText mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Optional notes for this payout"
                className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="createPayment"
                checked={formData.createPayment}
                onChange={(e) => setFormData({ ...formData, createPayment: e.target.checked })}
                className="w-4 h-4 text-sidebarActiveBg border-borderSoft rounded focus:ring-sidebarActiveBg"
              />
              <label htmlFor="createPayment" className="text-sm font-medium text-bodyText">
                Create Payment Record Now
              </label>
            </div>

            {formData.createPayment && (
              <div>
                <label className="block text-sm font-medium text-bodyText mb-1">Payment Method</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      paymentMethod: e.target.value as 'BANK_TRANSFER' | 'CASH' | 'OTHER',
                    })
                  }
                  className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Preview Card */}
        {previewLoading && (
          <SectionCard>
            <div className="py-12 text-center text-bodyText">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p>Calculating payout preview...</p>
            </div>
          </SectionCard>
        )}

        {preview && !previewLoading && (
          <SectionCard title="Payout Preview">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-bodyText mb-1">Investor</p>
                  <p className="text-base font-semibold text-headingText">{preview.investorName}</p>
                </div>
                <div>
                  <p className="text-sm text-bodyText mb-1">Period</p>
                  <p className="text-base font-semibold text-headingText">
                    {format(new Date(preview.periodFrom), 'MMM dd, yyyy')} -{' '}
                    {format(new Date(preview.periodTo), 'MMM dd, yyyy')}
                  </p>
                </div>
              </div>

              <div className="border-t border-borderSoft pt-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-bodyText">Total Revenue:</span>
                  <span className="font-semibold text-headingText">{formatCurrency(preview.totalRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-bodyText">Commission ({preview.commissionPercent}%):</span>
                  <span className="font-semibold text-headingText">
                    {formatCurrency(preview.commissionAmount)}
                  </span>
                </div>
                <div className="flex justify-between pt-3 border-t border-borderSoft">
                  <span className="text-lg font-semibold text-headingText">Net Payout:</span>
                  <span className="text-lg font-bold text-sidebarActiveBg">
                    {formatCurrency(preview.netPayout)}
                  </span>
                </div>
              </div>

              {preview.breakdown.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-bodyText mb-3">Vehicle Breakdown</p>
                  <Table
                    headers={['Plate No', 'Vehicle', 'Category', 'Bookings', 'Revenue (AED)']}
                  >
                    {preview.breakdown.map((item) => (
                      <TableRow key={item.vehicleId}>
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
                </div>
              )}

              {preview.breakdown.length === 0 && (
                <div className="py-8 text-center text-sidebarMuted">
                  <p>No bookings found for this period</p>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 bg-cardBg border border-borderSoft rounded-lg text-bodyText hover:bg-sidebarMuted/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !preview || preview.netPayout <= 0}
            className="px-6 py-2 bg-sidebarActiveBg text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Generate Payout
          </button>
        </div>
      </form>
    </div>
  )
}
