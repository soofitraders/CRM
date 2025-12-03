'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import SectionCard from '@/components/ui/SectionCard'
import Table, { TableRow, TableCell } from '@/components/ui/Table'
import StatusChip from '@/components/ui/StatusChip'
import { Plus, Eye, Download, X, Check, FileText } from 'lucide-react'

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
  }
  periodFrom: string
  periodTo: string
  branchId?: string
  totals: {
    totalRevenue: number
    commissionPercent: number
    commissionAmount: number
    netPayout: number
  }
  status: 'DRAFT' | 'PENDING' | 'PAID' | 'CANCELLED'
  payment?: {
    status: string
    method: string
    transactionId?: string
    paidAt?: string
  }
  createdAt: string
}

interface InvestorProfile {
  _id: string
  user: {
    name: string
    email: string
  }
  companyName?: string
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export default function InvestorPayoutsPage() {
  const router = useRouter()
  const [payouts, setPayouts] = useState<InvestorPayout[]>([])
  const [investors, setInvestors] = useState<InvestorProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState<number | ''>('')
  const [investorId, setInvestorId] = useState<string>('')
  const [status, setStatus] = useState<string>('')

  useEffect(() => {
    fetchPayouts()
    fetchInvestors()
  }, [year, month, investorId, status])

  const fetchPayouts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('year', year.toString())
      if (month) params.append('month', month.toString())
      if (investorId) params.append('investorId', investorId)
      if (status) params.append('status', status)

      const response = await fetch(`/api/investor-payouts?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch payouts')

      const data = await response.json()
      setPayouts(data.payouts || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load payouts')
    } finally {
      setLoading(false)
    }
  }

  const fetchInvestors = async () => {
    try {
      const response = await fetch('/api/investors')
      if (!response.ok) return

      const data = await response.json()
      setInvestors(data.investors || [])
    } catch (err) {
      console.error('Failed to load investors:', err)
    }
  }

  const handleMarkAsPaid = async (id: string) => {
    try {
      const response = await fetch(`/api/investor-payouts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAID' }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to mark as paid')
      }

      fetchPayouts()
    } catch (err: any) {
      alert(err.message || 'Failed to mark as paid')
    }
  }

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this payout?')) return

    try {
      const response = await fetch(`/api/investor-payouts/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to cancel payout')
      }

      fetchPayouts()
    } catch (err: any) {
      alert(err.message || 'Failed to cancel payout')
    }
  }

  const handleDownloadPDF = (id: string) => {
    window.open(`/api/investor-payouts/${id}/pdf`, '_blank')
  }

  const formatPeriod = (from: string, to: string) => {
    const fromDate = new Date(from)
    const toDate = new Date(to)
    if (format(fromDate, 'MMM yyyy') === format(toDate, 'MMM yyyy')) {
      return format(fromDate, 'MMM yyyy')
    }
    return `${format(fromDate, 'MMM dd, yyyy')} – ${format(toDate, 'MMM dd, yyyy')}`
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-headingText mb-2">Investor Payouts</h1>
          <p className="text-bodyText text-base">Manage investor payout statements and settlements</p>
        </div>
        <button
          onClick={() => router.push('/financials/management/investor-payouts/new')}
          className="flex items-center gap-2 px-4 py-2 bg-sidebarActiveBg text-white rounded-lg hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          Generate Payout
        </button>
      </div>

      {/* Filters */}
      <SectionCard>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-bodyText mb-1">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-bodyText mb-1">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value ? parseInt(e.target.value) : '')}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            >
              <option value="">All Months</option>
              {MONTHS.map((m, idx) => (
                <option key={idx} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-bodyText mb-1">Investor</label>
            <select
              value={investorId}
              onChange={(e) => setInvestorId(e.target.value)}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            >
              <option value="">All Investors</option>
              {investors.map((investor) => (
                <option key={investor._id} value={investor._id}>
                  {investor.user.name} {investor.companyName ? `(${investor.companyName})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-bodyText mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 bg-cardBg border border-borderSoft rounded text-bodyText"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </SectionCard>

      {/* Payouts Table */}
      <SectionCard>
        {loading ? (
          <div className="py-12 text-center text-bodyText">Loading...</div>
        ) : error ? (
          <div className="py-12 text-center text-red-600">{error}</div>
        ) : (
          <Table
            headers={[
              'Investor',
              'Period',
              'Total Revenue',
              'Commission %',
              'Commission Amount',
              'Net Payout',
              'Status',
              'Payment Status',
              'Created At',
              'Actions',
            ]}
          >
            {payouts.map((payout) => (
              <TableRow key={payout._id}>
                <TableCell>
                  {payout.investor.user.name}
                  <div className="text-xs text-sidebarMuted">INVESTOR</div>
                  {payout.investor.companyName && (
                    <div className="text-xs text-sidebarMuted">{payout.investor.companyName}</div>
                  )}
                </TableCell>
                <TableCell>{formatPeriod(payout.periodFrom, payout.periodTo)}</TableCell>
                <TableCell>
                  AED {payout.totals.totalRevenue.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell>{payout.totals.commissionPercent}%</TableCell>
                <TableCell>
                  AED {payout.totals.commissionAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell>
                  <span className="font-semibold">
                    AED {payout.totals.netPayout.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell>
                  {payout.payment ? (
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
                  ) : (
                    <span className="text-sidebarMuted">—</span>
                  )}
                </TableCell>
                <TableCell>{format(new Date(payout.createdAt), 'MMM dd, yyyy')}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/financials/management/investor-payouts/${payout._id}`)}
                      className="p-1 text-sidebarActiveBg hover:bg-sidebarMuted/10 rounded"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDownloadPDF(payout._id)}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      title="Download PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {payout.status === 'PENDING' && (
                      <button
                        onClick={() => handleMarkAsPaid(payout._id)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                        title="Mark as Paid"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                    {(payout.status === 'DRAFT' || payout.status === 'PENDING') && (
                      <button
                        onClick={() => handleCancel(payout._id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </Table>
        )}
      </SectionCard>
    </div>
  )
}
