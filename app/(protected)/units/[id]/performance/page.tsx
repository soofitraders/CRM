'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

// ─── FORMATTERS ───────────────────────────────────────────────────────────
const fmtAED = (v: any) => {
  const n = Number(v ?? 0);
  return `AED ${isNaN(n) ? '0.00' : n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const fmtDate = (v: any) => {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString('en-AE', { day:'2-digit', month:'short', year:'numeric' }); }
  catch { return '—'; }
};
const Badge = ({ s }: { s: string }) => {
  const sl = (s ?? '').toLowerCase();
  const cls =
    ['paid','completed','settled','done','received','active'].includes(sl) ? 'bg-green-100 text-green-700' :
    ['overdue','late','past_due','expired'].includes(sl) ? 'bg-red-100 text-red-700' :
    ['pending','unpaid','open','partial'].includes(sl) ? 'bg-orange-100 text-orange-700' :
    ['draft','new','created'].includes(sl) ? 'bg-gray-100 text-gray-600' :
    'bg-gray-100 text-gray-500';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${cls}`}>{s || 'unknown'}</span>;
};

export default function VehiclePerformanceTab() {
  const params = useParams();
  const vehicleId = params.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('all');
  const [tab, setTab] = useState<'overview'|'bookings'|'invoices'|'payments'>('overview');

  const load = async (p = period) => {
    if (!vehicleId) return;
    setLoading(true); setError('');
    try {
      // Adjust URL to match your actual API path found in Step 0:
      const res = await fetch(`/api/reports/vehicle-performance?id=${vehicleId}&period=${p}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json.vehicle ?? json.vehicles?.[0] ?? null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [vehicleId]);

  if (loading) return (
    <div className="space-y-3 p-4">
      {[...Array(5)].map((_,i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  );
  if (error) return (
    <div className="p-6 text-center">
      <p className="text-red-500">{error}</p>
      <button onClick={() => load()} className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm">Retry</button>
    </div>
  );
  if (!data) return <div className="p-6 text-center text-gray-400">No data found</div>;

  const bk = data.bookings ?? {};
  const inv = data.invoices ?? {};
  const pay = data.payments ?? {};
  const fin = data.financial ?? {};
  const pr = data.period ?? {};

  const bkList: any[] = bk.list ?? [];
  const invList: any[] = inv.list ?? [];
  const payList: any[] = pay.list ?? [];

  return (
    <div className="space-y-4">

      {/* ── PERIOD FILTER ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Period:</span>
        {[
          { v: 'all', l: 'All Time' },
          { v: '30', l: '30 Days' },
          { v: '90', l: '3 Months' },
          { v: '365', l: 'This Year'},
        ].map(p => (
          <button key={p.v} onClick={() => { setPeriod(p.v); load(p.v); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              period === p.v ? 'bg-blue-600 text-white' : 'border border-gray-300 hover:bg-gray-50'
            }`}>
            {p.l}
          </button>
        ))}
      </div>

      {/* ── TOP SUMMARY CARDS ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Revenue', value: fmtAED(fin.totalRevenue), sub: `${bk.total ?? 0} bookings`, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'Amount Received', value: fmtAED(fin.totalReceived), sub: `${bk.paid ?? 0} paid`, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Outstanding', value: fmtAED(fin.totalOutstanding), sub: `${(inv.pendingCount ?? 0) + (inv.overdueCount ?? 0)} unpaid`, color: (fin.totalOutstanding ?? 0) > 0 ? 'text-orange-700' : 'text-gray-500', bg: (fin.totalOutstanding ?? 0) > 0 ? 'bg-orange-50' : 'bg-gray-50', border: (fin.totalOutstanding ?? 0) > 0 ? 'border-orange-100' : 'border-gray-100' },
          { label: 'Net Profit', value: fmtAED(fin.netProfit), sub: `After AED ${Number(fin.totalCosts ?? 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })} costs`, color: (fin.netProfit ?? 0) >= 0 ? 'text-green-700' : 'text-red-700', bg: (fin.netProfit ?? 0) >= 0 ? 'bg-green-50' : 'bg-red-50', border: (fin.netProfit ?? 0) >= 0 ? 'border-green-100' : 'border-red-100' },
        ].map(card => (
          <div key={card.label} className={`${card.bg} border ${card.border} rounded-xl p-4`}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{card.label}</p>
            <p className={`text-base font-bold mt-1 break-all ${card.color}`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── STATS ROW ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { l: 'Total Bookings', v: bk.total ?? 0, s: '' },
          { l: 'Paid Bookings', v: bk.paid ?? 0, s: '' },
          { l: 'Pending', v: bk.pending ?? 0, s: '' },
          { l: 'Days Rented', v: bk.totalRentalDays?? 0, s: 'd' },
          { l: 'Rev / Day', v: `AED ${Number(fin.revenuePerDay ?? 0).toLocaleString('en-AE', { maximumFractionDigits: 0 })}`, s: '' },
          { l: 'Utilization', v: pr.utilizationPercent ?? 0, s: '%' },
        ].map(stat => (
          <div key={stat.l} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400">{stat.l}</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">{stat.v}{stat.s}</p>
          </div>
        ))}
      </div>

      {/* ── SECTION TABS ───────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[
          { k: 'overview', l: 'Overview' },
          { k: 'bookings', l: `Bookings (${bkList.length})` },
          { k: 'invoices', l: `Invoices (${invList.length})` },
          { k: 'payments', l: `Payments (${payList.length})` },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t.k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* ════════════════════ OVERVIEW TAB ════════════════════════════ */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Booking Overview</h3>
            <div className="space-y-2">
              {[
                { l: 'Total Bookings', v: bk.total ?? 0, fmt: 'num' },
                { l: 'Total Earnings', v: bk.totalEarnings ?? 0,fmt: 'aed' },
                { l: 'Amount Paid', v: bk.totalPaid ?? 0, fmt: 'aed', color: 'text-emerald-600' },
                { l: 'Amount Pending', v: bk.totalDue ?? 0, fmt: 'aed', color: 'text-orange-600' },
                { l: 'Total Rental Days', v: bk.totalRentalDays ?? 0, fmt: 'day' },
                { l: 'Avg Rental', v: bk.avgRentalDays ?? 0,fmt: 'day' },
              ].map(row => (
                <div key={row.l} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">{row.l}</span>
                  <span className={`text-sm font-bold ${(row as any).color ?? 'text-gray-800'}`}>
                    {row.fmt === 'aed' ? fmtAED(row.v) :
                     row.fmt === 'day' ? `${row.v}d` : row.v}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Invoice Overview</h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { l: 'Paid', v: inv.paidCount ?? 0, color: 'text-green-600', dot: 'bg-green-500' },
                { l: 'Pending', v: inv.pendingCount ?? 0, color: 'text-orange-600', dot: 'bg-orange-500' },
                { l: 'Overdue', v: inv.overdueCount ?? 0, color: 'text-red-600', dot: 'bg-red-500' },
              ].map(s => (
                <div key={s.l} className="bg-gray-50 rounded-lg p-2 text-center">
                  <span className={`inline-block w-2 h-2 rounded-full mb-1 ${s.dot}`} />
                  <p className="text-xs text-gray-500">{s.l}</p>
                  <p className={`text-lg font-bold ${s.color}`}>{s.v}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {[
                { l: 'Total Invoiced', v: inv.totalInvoiced ?? 0, c: 'text-blue-700' },
                { l: 'Received', v: inv.totalPaid ?? 0, c: 'text-emerald-700' },
                { l: 'Outstanding', v: inv.totalDue ?? 0, c: 'text-orange-700' },
              ].map(row => (
                <div key={row.l} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">{row.l}</span>
                  <span className={`text-sm font-bold ${row.c}`}>{fmtAED(row.v)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 lg:col-span-2">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Profit & Loss</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { l: 'Revenue', v: fin.totalRevenue, c: 'text-blue-700', bg: 'bg-blue-50' },
                { l: 'Expenses', v: fin.totalExpenses, c: 'text-red-600', bg: 'bg-red-50' },
                { l: 'Maintenance', v: fin.totalMaintenance, c: 'text-orange-600', bg: 'bg-orange-50' },
                { l: 'Net Profit', v: fin.netProfit, c: (fin.netProfit??0)>=0?'text-green-700':'text-red-700', bg: (fin.netProfit??0)>=0?'bg-green-50':'bg-red-50' },
              ].map(card => (
                <div key={card.l} className={`${card.bg} rounded-xl p-3`}>
                  <p className="text-xs text-gray-500">{card.l}</p>
                  <p className={`text-sm font-bold mt-1 ${card.c}`}>{fmtAED(card.v ?? 0)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ BOOKINGS TAB ════════════════════════════ */}
      {tab === 'bookings' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-3 border-b border-gray-200">
            {[
              { l: 'Total Earned', v: fmtAED(bk.totalEarnings), c: 'text-blue-700' },
              { l: 'Paid', v: fmtAED(bk.totalPaid), c: 'text-emerald-700' },
              { l: 'Pending', v: fmtAED(bk.totalDue), c: 'text-orange-700' },
            ].map((s, i) => (
              <div key={i} className={`p-3 text-center ${i < 2 ? 'border-r border-gray-200' : ''}`}>
                <p className="text-xs text-gray-400">{s.l}</p>
                <p className={`text-sm font-bold ${s.c}`}>{s.v}</p>
              </div>
            ))}
          </div>
          {bkList.length === 0
            ? <div className="p-8 text-center text-gray-400">No bookings found</div>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Booking #','Customer','Start','End','Days','Total (AED)','Paid (AED)','Due (AED)','Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-gray-500 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bkList.map((b: any) => (
                      <tr key={b.bookingId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-800">#{b.bookingNumber || b.bookingId.slice(-6)}</td>
                        <td className="px-4 py-3 text-gray-600">{b.customerName || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(b.startDate)}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(b.endDate)}</td>
                        <td className="px-4 py-3 text-center font-bold text-blue-700">{b.rentalDays > 0 ? `${b.rentalDays}d` : '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800">{fmtAED(b.totalAmount)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmtAED(b.paidAmount)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-orange-600">{b.dueAmount > 0 ? fmtAED(b.dueAmount) : '—'}</td>
                        <td className="px-4 py-3"><Badge s={b.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold text-xs">
                      <td colSpan={4} className="px-4 py-3 text-gray-700">TOTAL ({bkList.length})</td>
                      <td className="px-4 py-3 text-center text-blue-700">{bkList.reduce((s:number,b:any)=>s+b.rentalDays,0)}d</td>
                      <td className="px-4 py-3 text-right text-gray-800">{fmtAED(bkList.reduce((s:number,b:any)=>s+b.totalAmount,0))}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{fmtAED(bkList.reduce((s:number,b:any)=>s+b.paidAmount,0))}</td>
                      <td className="px-4 py-3 text-right text-orange-700">{fmtAED(bkList.reduce((s:number,b:any)=>s+b.dueAmount,0))}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          }
        </div>
      )}

      {/* ════════════════════ INVOICES TAB ════════════════════════════ */}
      {tab === 'invoices' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-3 border-b border-gray-200">
            {[
              { l: 'Total Invoiced', v: fmtAED(inv.totalInvoiced), c: 'text-blue-700' },
              { l: 'Received', v: fmtAED(inv.totalPaid), c: 'text-emerald-700' },
              { l: 'Outstanding', v: fmtAED(inv.totalDue), c: 'text-orange-700' },
            ].map((s, i) => (
              <div key={i} className={`p-3 text-center ${i < 2 ? 'border-r border-gray-200' : ''}`}>
                <p className="text-xs text-gray-400">{s.l}</p>
                <p className={`text-sm font-bold ${s.c}`}>{s.v}</p>
              </div>
            ))}
          </div>
          {invList.length === 0
            ? <div className="p-8 text-center text-gray-400">No invoices found</div>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Invoice #','Issue Date','Rental Period','Days','Total (AED)','Paid (AED)','Due (AED)','Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-gray-500 font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invList.map((inv: any) => (
                      <tr key={inv.invoiceId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-800">#{inv.invoiceNumber || inv.invoiceId.slice(-6)}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(inv.issueDate)}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(inv.startDate)} → {fmtDate(inv.endDate)}</td>
                        <td className="px-4 py-3 text-center font-bold text-blue-700">{inv.rentalDays > 0 ? `${inv.rentalDays}d` : '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800">{fmtAED(inv.totalAmount)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmtAED(inv.paidAmount)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-orange-600">{inv.dueAmount > 0 ? fmtAED(inv.dueAmount) : '—'}</td>
                        <td className="px-4 py-3"><Badge s={inv.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold text-xs">
                      <td colSpan={4} className="px-4 py-3 text-gray-700">TOTAL ({invList.length})</td>
                      <td className="px-4 py-3 text-right text-gray-800">{fmtAED(invList.reduce((s:number,i:any)=>s+i.totalAmount,0))}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{fmtAED(invList.reduce((s:number,i:any)=>s+i.paidAmount,0))}</td>
                      <td className="px-4 py-3 text-right text-orange-700">{fmtAED(invList.reduce((s:number,i:any)=>s+i.dueAmount,0))}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          }
        </div>
      )}

      {/* ════════════════════ PAYMENTS TAB ════════════════════════════ */}
      {tab === 'payments' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-3 border-b border-gray-200">
            {[
              { l: 'Total Received', v: fmtAED(pay.paidAmount), c: 'text-emerald-700' },
              { l: 'Pending', v: fmtAED(pay.pendingAmount), c: 'text-orange-700' },
              { l: 'Total', v: fmtAED(pay.totalAmount), c: 'text-blue-700' },
            ].map((s, i) => (
              <div key={i} className={`p-3 text-center ${i < 2 ? 'border-r border-gray-200' : ''}`}>
                <p className="text-xs text-gray-400">{s.l}</p>
                <p className={`text-sm font-bold ${s.c}`}>{s.v}</p>
              </div>
            ))}
          </div>
          {payList.length === 0
            ? <div className="p-8 text-center text-gray-400">No payments found</div>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {['Date','Type','Method','Start','End','Days','Amount (AED)','Status'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-gray-500 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payList.map((p: any) => (
                      <tr key={p.paymentId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(p.date)}</td>
                        <td className="px-4 py-3 text-gray-600 capitalize">{p.type}</td>
                        <td className="px-4 py-3 text-gray-500">{p.method}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(p.startDate)}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(p.endDate)}</td>
                        <td className="px-4 py-3 text-center font-bold text-blue-700">{p.rentalDays > 0 ? `${p.rentalDays}d` : '—'}</td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">{fmtAED(p.amount)}</td>
                        <td className="px-4 py-3"><Badge s={p.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-300 font-bold text-xs">
                      <td colSpan={5} className="px-4 py-3 text-gray-700">TOTAL ({payList.length})</td>
                      <td className="px-4 py-3 text-center text-blue-700">{payList.reduce((s:number,p:any)=>s+Number(p.rentalDays ?? 0),0)}d</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{fmtAED(payList.reduce((s:number,p:any)=>s+p.amount,0))}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          }
        </div>
      )}
    </div>
  );
}

