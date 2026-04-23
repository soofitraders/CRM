'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const fmtAED = (val: number | undefined | null) => {
  const n = Number(val ?? 0)
  if (Number.isNaN(n)) return 'AED 0.00'
  return `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const fmtDate = (val: string | null | undefined) => {
  if (!val) return '—'
  const d = new Date(val)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-AE', { day: '2-digit', month: 'short', year: 'numeric' })
}

const StatusBadge = ({ status }: { status: string }) => {
  const s = (status ?? '').toLowerCase()
  const cls =
    ['paid', 'completed', 'settled', 'done', 'received', 'success'].includes(s) ? 'bg-green-100 text-green-700' :
    ['overdue', 'late', 'past_due', 'expired'].includes(s) ? 'bg-red-100 text-red-700' :
    ['pending', 'unpaid', 'open', 'outstanding', 'issued'].includes(s) ? 'bg-orange-100 text-orange-700' :
    ['draft', 'new', 'created'].includes(s) ? 'bg-gray-100 text-gray-600' :
    ['active', 'ongoing', 'rented', 'confirmed', 'checked_out'].includes(s) ? 'bg-blue-100 text-blue-700' :
    'bg-gray-100 text-gray-500'
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${cls}`}>{status || 'unknown'}</span>
}

export default function VehiclePerformancePage() {
  const params = useParams()
  const vehicleId = params.id as string

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('30')
  const [activeSection, setActiveSection] = useState<'overview' | 'invoices' | 'bookings' | 'expenses'>('overview')

  const fetchData = async (p = period) => {
    if (!vehicleId) return
    try {
      setLoading(true)
      setError('')
      const res = await fetch(`/api/reports/vehicle-performance?vehicleId=${vehicleId}&period=${p}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setData(json.vehicle ?? json.vehicles?.[0] ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId])

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500 font-medium">{error}</p>
        <button onClick={() => fetchData()} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm">
          Retry
        </button>
      </div>
    )
  }

  if (!data) return <div className="p-6 text-center text-gray-400">No performance data available</div>

  const at = data.allTime ?? {}
  const pr = data.period ?? {}
  const inv = at.invoices ?? {}
  const invList: any[] = inv.list ?? []
  const bkList: any[] = at.bookingDetails ?? []
  const expList: any[] = at.expenses?.list ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-gray-400 uppercase">Period:</span>
        {[
          { v: '7', l: '7 Days' },
          { v: '30', l: '30 Days' },
          { v: '90', l: '3 Months' },
          { v: '180', l: '6 Months' },
          { v: '365', l: 'This Year' },
        ].map((p) => (
          <button
            key={p.v}
            onClick={() => {
              setPeriod(p.v)
              fetchData(p.v)
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              period === p.v ? 'bg-blue-600 text-white shadow-sm' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p.l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Invoiced', value: fmtAED(inv.totalInvoiced), sub: `${inv.count ?? 0} invoices`, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'Amount Received', value: fmtAED(inv.totalPaid), sub: `${inv.paidCount ?? 0} paid`, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Outstanding Due', value: fmtAED(inv.totalDue), sub: `${(inv.pendingCount ?? 0) + (inv.overdueCount ?? 0)} unpaid`, color: (inv.totalDue ?? 0) > 0 ? 'text-orange-700' : 'text-gray-500', bg: (inv.totalDue ?? 0) > 0 ? 'bg-orange-50' : 'bg-gray-50', border: (inv.totalDue ?? 0) > 0 ? 'border-orange-100' : 'border-gray-100' },
          { label: 'Net Profit', value: fmtAED(at.netProfit), sub: `After AED ${Number(at.totalCosts ?? 0).toLocaleString('en-AE')} costs`, color: (at.netProfit ?? 0) >= 0 ? 'text-green-700' : 'text-red-700', bg: (at.netProfit ?? 0) >= 0 ? 'bg-green-50' : 'bg-red-50', border: (at.netProfit ?? 0) >= 0 ? 'border-green-100' : 'border-red-100' },
        ].map((card) => (
          <div key={card.label} className={`${card.bg} border ${card.border} rounded-xl p-4`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{card.label}</p>
            <p className={`text-lg font-bold mt-1 break-all ${card.color}`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { label: 'Total Bookings', value: at.totalBookings ?? 0, suffix: '' },
          { label: 'Days Rented', value: at.totalRentalDays ?? 0, suffix: 'd' },
          { label: 'Avg Rental', value: at.avgBookingDays ?? 0, suffix: 'd' },
          { label: 'Rev / Day', value: `AED ${(at.revenuePerDay ?? 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`, suffix: '' },
          { label: 'Utilization', value: pr.utilizationPercent ?? 0, suffix: '%' },
          { label: 'Fines', value: fmtAED(at.fines?.total ?? 0), suffix: '' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400 font-medium">{stat.label}</p>
            <p className="text-base font-bold text-gray-800 mt-0.5">{stat.value}{stat.suffix}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[
          { k: 'overview', l: 'Overview' },
          { k: 'invoices', l: `Invoices (${invList.length})` },
          { k: 'bookings', l: `Bookings (${bkList.length})` },
          { k: 'expenses', l: `Expenses (${expList.length})` },
        ].map((tab) => (
          <button
            key={tab.k}
            onClick={() => setActiveSection(tab.k as any)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeSection === tab.k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.l}
          </button>
        ))}
      </div>

      {activeSection === 'overview' && (
        <div className="space-y-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Invoice Status Breakdown</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Paid', count: inv.paidCount ?? 0, amount: invList.filter((i) => i.isPaid).reduce((s: number, i: any) => s + i.totalAmount, 0), color: 'text-green-600', dot: 'bg-green-500' },
                { label: 'Pending', count: inv.pendingCount ?? 0, amount: invList.filter((i) => i.isPending).reduce((s: number, i: any) => s + i.totalAmount, 0), color: 'text-orange-600', dot: 'bg-orange-500' },
                { label: 'Overdue', count: inv.overdueCount ?? 0, amount: invList.filter((i) => i.isOverdue).reduce((s: number, i: any) => s + i.totalAmount, 0), color: 'text-red-600', dot: 'bg-red-500' },
                { label: 'Draft', count: inv.draftCount ?? 0, amount: invList.filter((i) => i.isDraft).reduce((s: number, i: any) => s + i.totalAmount, 0), color: 'text-gray-500', dot: 'bg-gray-400' },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                  <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${item.dot}`} />
                  <div>
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className={`text-sm font-bold ${item.color}`}>{item.count} invoices</p>
                    <p className="text-xs text-gray-400">{fmtAED(item.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Revenue vs Costs (All Time)</h3>
            <div className="space-y-2">
              {[
                { label: 'Total Revenue', value: at.totalRevenue, color: 'text-emerald-700' },
                { label: 'Amount Received', value: at.totalReceived, color: 'text-blue-600' },
                { label: 'Outstanding', value: at.totalOutstanding, color: 'text-orange-600' },
                { label: 'Total Expenses', value: at.expenses?.total, color: 'text-red-600' },
                { label: 'Maintenance', value: at.maintenance?.total, color: 'text-yellow-600' },
                { label: 'Fines', value: at.fines?.total, color: 'text-red-500' },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">{row.label}</span>
                  <span className={`text-sm font-bold ${row.color}`}>{fmtAED(row.value ?? 0)}</span>
                </div>
              ))}
              <div className="flex justify-between items-center py-2 mt-1 bg-gray-50 rounded-lg px-3">
                <span className="text-sm font-bold text-gray-700">Net Profit</span>
                <span className={`text-sm font-bold ${(at.netProfit ?? 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmtAED(at.netProfit ?? 0)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === 'invoices' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {invList.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <p className="text-lg">No invoices found for this vehicle</p>
              <p className="text-sm mt-1">Invoices will appear here once created</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-0 border-b border-gray-200">
                {[
                  { label: 'Total Invoiced', value: fmtAED(inv.totalInvoiced), color: 'text-blue-700' },
                  { label: 'Received', value: fmtAED(inv.totalPaid), color: 'text-green-700' },
                  { label: 'Outstanding', value: fmtAED(inv.totalDue), color: 'text-orange-700' },
                ].map((s, i) => (
                  <div key={i} className={`p-3 text-center ${i < 2 ? 'border-r border-gray-200' : ''}`}>
                    <p className="text-xs text-gray-400">{s.label}</p>
                    <p className={`text-sm font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-gray-500 font-semibold">Invoice #</th>
                      <th className="px-4 py-3 text-left text-gray-500 font-semibold">Issue Date</th>
                      <th className="px-4 py-3 text-left text-gray-500 font-semibold">Rental Period</th>
                      <th className="px-4 py-3 text-center text-gray-500 font-semibold">Days</th>
                      <th className="px-4 py-3 text-right text-gray-500 font-semibold">Total (AED)</th>
                      <th className="px-4 py-3 text-right text-gray-500 font-semibold">Paid (AED)</th>
                      <th className="px-4 py-3 text-right text-gray-500 font-semibold">Due (AED)</th>
                      <th className="px-4 py-3 text-center text-gray-500 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invList.map((invoice: any) => (
                      <tr key={invoice.invoiceId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-gray-800">#{invoice.invoiceNumber || invoice.invoiceId.slice(-6)}</td>
                        <td className="px-4 py-3 text-gray-500">{fmtDate(invoice.issueDate)}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(invoice.startDate)} → {fmtDate(invoice.endDate)}</td>
                        <td className="px-4 py-3 text-center font-bold text-blue-700">{invoice.rentalDays > 0 ? `${invoice.rentalDays}d` : '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800">{fmtAED(invoice.totalAmount)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmtAED(invoice.paidAmount)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-orange-600">{invoice.dueAmount > 0 ? fmtAED(invoice.dueAmount) : '—'}</td>
                        <td className="px-4 py-3 text-center"><StatusBadge status={invoice.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold">
                      <td colSpan={4} className="px-4 py-3 text-gray-700">TOTAL ({invList.length} invoices)</td>
                      <td className="px-4 py-3 text-right text-blue-700">{fmtAED(invList.reduce((s: number, i: any) => s + i.totalAmount, 0))}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{fmtAED(invList.reduce((s: number, i: any) => s + i.paidAmount, 0))}</td>
                      <td className="px-4 py-3 text-right text-orange-700">{fmtAED(invList.reduce((s: number, i: any) => s + i.dueAmount, 0))}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {activeSection === 'bookings' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {bkList.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No bookings found for this vehicle</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-gray-500 font-semibold">Booking #</th>
                    <th className="px-4 py-3 text-left text-gray-500 font-semibold">Customer</th>
                    <th className="px-4 py-3 text-left text-gray-500 font-semibold">Start</th>
                    <th className="px-4 py-3 text-left text-gray-500 font-semibold">End</th>
                    <th className="px-4 py-3 text-center text-gray-500 font-semibold">Days</th>
                    <th className="px-4 py-3 text-right text-gray-500 font-semibold">Amount (AED)</th>
                    <th className="px-4 py-3 text-center text-gray-500 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bkList.map((bk: any) => (
                    <tr key={bk.bookingId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-800">#{bk.bookingNumber || bk.bookingId.slice(-6)}</td>
                      <td className="px-4 py-3 text-gray-600">{bk.customerName || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{fmtDate(bk.startDate)}</td>
                      <td className="px-4 py-3 text-gray-500">{fmtDate(bk.endDate)}</td>
                      <td className="px-4 py-3 text-center font-bold text-blue-700">{bk.rentalDays > 0 ? `${bk.rentalDays}d` : '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600">{bk.amount > 0 ? fmtAED(bk.amount) : '—'}</td>
                      <td className="px-4 py-3 text-center"><StatusBadge status={bk.status} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold">
                    <td colSpan={4} className="px-4 py-3 text-gray-700">TOTAL ({bkList.length} bookings)</td>
                    <td className="px-4 py-3 text-center text-blue-700">{bkList.reduce((s: number, b: any) => s + b.rentalDays, 0)}d</td>
                    <td className="px-4 py-3 text-right text-emerald-700">{fmtAED(bkList.reduce((s: number, b: any) => s + b.amount, 0))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {activeSection === 'expenses' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {expList.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No expenses found for this vehicle</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-gray-500 font-semibold">Date</th>
                    <th className="px-4 py-3 text-left text-gray-500 font-semibold">Description</th>
                    <th className="px-4 py-3 text-left text-gray-500 font-semibold">Category</th>
                    <th className="px-4 py-3 text-right text-gray-500 font-semibold">Amount (AED)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {expList.map((exp: any) => (
                    <tr key={exp.expenseId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500">{fmtDate(exp.date)}</td>
                      <td className="px-4 py-3 text-gray-700">{exp.description}</td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs">{exp.category}</span></td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">{fmtAED(exp.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold">
                    <td colSpan={3} className="px-4 py-3 text-gray-700">TOTAL ({expList.length} expenses)</td>
                    <td className="px-4 py-3 text-right text-red-700">{fmtAED(expList.reduce((s: number, e: any) => s + e.amount, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

