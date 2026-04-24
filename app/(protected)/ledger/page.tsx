'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import type { ILedgerEntry, ILedgerSummary, ILedgerFilters } from '@/types/ledger'
import { fmtAED } from './formatters'
import LedgerTable from './components/LedgerTable'
import LedgerEntryDetail from './components/LedgerEntryDetail'
import ManualEntryModal from './components/ManualEntryModal'

export default function LedgerPage() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role
  const canAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN'

  const [entries, setEntries] = useState<ILedgerEntry[]>([])
  const [summary, setSummary] = useState<ILedgerSummary | null>(null)
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, pages: 0 })
  const [filters, setFilters] = useState<ILedgerFilters>({ page: 1, limit: 50 })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<ILedgerEntry | null>(null)
  const [showManual, setShowManual] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [entryTypes, setEntryTypes] = useState<string[]>([])

  const fetchData = useCallback(async (f: ILedgerFilters = {}) => {
    try {
      setLoading(true)
      setError(null)
      const p = new URLSearchParams()
      p.set('page', String(f.page ?? 1))
      p.set('limit', String(f.limit ?? 50))
      Object.entries(f).forEach(([k, v]) => {
        if (k === 'page' || k === 'limit') return
        if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
      })
      const res = await fetch(`/api/ledger?${p}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error || `HTTP ${res.status}`)
      }
      const data = await res.json()
      const raw = (data.entries ?? []) as Record<string, unknown>[]
      setEntries(
        raw.map((row) => ({
          ...(row as unknown as ILedgerEntry),
          runningBalance: Number(row.runningBalance ?? 0),
          amount: Number(row.amount ?? 0),
        }))
      )
      setSummary(data.summary ?? null)
      setPagination(data.pagination ?? { total: 0, page: 1, limit: 50, pages: 0 })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/ledger/categories')
      if (res.ok) {
        const d = await res.json()
        setCategories(d.categories ?? [])
        setEntryTypes(d.entryTypes ?? [])
      }
    } catch {
      /* non-critical */
    }
  }, [])

  useEffect(() => {
    void fetchData(filters)
  }, [fetchData, filters])

  useEffect(() => {
    void fetchCategories()
  }, [fetchCategories])

  const handleSync = async () => {
    try {
      setSyncing(true)
      const res = await fetch('/api/ledger/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      const dup =
        typeof data.removedDuplicates === 'number' && data.removedDuplicates > 0
          ? `\n${data.removedDuplicates} duplicate row(s) removed before sync`
          : ''
      alert(
        `✓ Sync complete!\n${data.synced} operations completed\n${data.totalInDB ?? 0} total rows in ledger${dup}${
          data.errors?.length ? '\n\nWarnings:\n' + data.errors.join('\n') : ''
        }`
      )
      setFilters((prev) => ({ ...prev }))
      void fetchCategories()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleClearCache = async () => {
    try {
      const res = await fetch('/api/cache/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: 'ledger:' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Clear failed')
      alert(`✓ Cache cleared: ${(data as { cleared?: number }).cleared ?? 0} entries removed`)
      void fetchData(filters)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Cache clear failed')
    }
  }

  const applyFilter = (key: string, value: string) => {
    const updated: ILedgerFilters = { ...filters, [key]: value || undefined, page: 1 }
    setFilters(updated)
  }

  const goPage = (page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }

  const clearFilters = () => {
    setFilters({ page: 1, limit: 50 })
  }

  const cr = Number(summary?.totalCredits ?? 0)
  const dr = Number(summary?.totalDebits ?? 0)
  const net = cr - dr

  return (
    <div className="p-6 space-y-5 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">General Ledger</h1>
          <p className="text-sm text-gray-500 mt-1">Full accounting view — all financial transactions in AED</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAdmin && (
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="px-4 py-2 text-sm font-medium border border-gray-300 bg-white rounded-lg hover:bg-gray-50 shadow-sm"
            >
              + Manual Entry
            </button>
          )}
          {canAdmin && (
            <button
              type="button"
              onClick={() => void handleSync()}
              disabled={syncing}
              className="px-4 py-2 text-sm font-medium border border-gray-300 bg-white rounded-lg hover:bg-gray-50 shadow-sm disabled:opacity-50"
            >
              {syncing ? '⏳ Syncing...' : '⟳ Sync All Data'}
            </button>
          )}
          {canAdmin && (
            <button
              type="button"
              onClick={() => void handleClearCache()}
              className="px-4 py-2 text-sm font-medium border border-gray-300 bg-white rounded-lg hover:bg-gray-50 shadow-sm"
            >
              Clear Cache
            </button>
          )}
          <a
            href="/api/ledger/export"
            className="inline-flex items-center px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm"
          >
            ↓ Export Excel
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: 'Total Income',
            value: fmtAED(cr),
            sub: '↑ All credits',
            color: 'text-emerald-600',
            border: 'border-emerald-100',
            bg: 'bg-emerald-50/50',
          },
          {
            label: 'Total Expenses',
            value: fmtAED(dr),
            sub: '↓ All debits',
            color: 'text-red-600',
            border: 'border-red-100',
            bg: 'bg-red-50/50',
          },
          {
            label: 'Net Balance',
            value: fmtAED(net),
            sub: net >= 0 ? '▲ Surplus' : '▼ Deficit',
            color: net >= 0 ? 'text-emerald-700' : 'text-red-700',
            border: net >= 0 ? 'border-emerald-200' : 'border-red-200',
            bg: 'bg-white',
          },
          {
            label: 'Transactions',
            value: (summary?.totalEntries ?? 0).toLocaleString(),
            sub: 'All entries',
            color: 'text-blue-600',
            border: 'border-blue-100',
            bg: 'bg-blue-50/50',
          },
          {
            label: 'Unreconciled',
            value: (summary?.unreconciledCount ?? 0).toLocaleString(),
            sub: 'Need review',
            color: (summary?.unreconciledCount ?? 0) > 0 ? 'text-orange-600' : 'text-gray-500',
            border: (summary?.unreconciledCount ?? 0) > 0 ? 'border-orange-200' : 'border-gray-200',
            bg: 'bg-white',
          },
        ].map((card) => (
          <div key={card.label} className={`${card.bg} border ${card.border} rounded-xl p-4 shadow-sm`}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider leading-none">{card.label}</p>
            <p className={`text-lg font-bold mt-2 break-all ${card.color}`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">From</label>
            <input
              type="date"
              onChange={(e) => applyFilter('startDate', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">To</label>
            <input
              type="date"
              onChange={(e) => applyFilter('endDate', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Direction</label>
            <select
              onChange={(e) => applyFilter('direction', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              defaultValue=""
            >
              <option value="">All</option>
              <option value="CREDIT">↑ Credit (Cash In)</option>
              <option value="DEBIT">↓ Debit (Cash Out)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Type</label>
            <select
              onChange={(e) => applyFilter('entryType', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              defaultValue=""
            >
              <option value="">All Types</option>
              {entryTypes.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Category</label>
            <select
              onChange={(e) => applyFilter('category', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              defaultValue=""
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Search</label>
            <input
              type="text"
              placeholder="Search..."
              onChange={(e) => applyFilter('search', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex justify-between items-center pt-1">
          <p className="text-xs text-gray-400">
            Showing {entries.length} of {pagination.total.toLocaleString()} entries (this page)
          </p>
          <button type="button" onClick={clearFilters} className="text-xs text-blue-600 hover:underline">
            Clear Filters
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-semibold text-lg">Failed to load</p>
          <p className="text-red-500 text-sm mt-1">{error}</p>
          <button
            type="button"
            onClick={() => void fetchData(filters)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-14 text-center">
          <div className="text-5xl mb-4">📒</div>
          <p className="text-gray-700 text-xl font-semibold">Ledger is empty</p>
          <p className="text-gray-400 text-sm mt-2 max-w-md mx-auto">
            Click &quot;Sync All Data&quot; to import financial records from expenses, payments, salaries, payouts,
            maintenance, fines, recurring expenses, and booking deposits.
          </p>
          {canAdmin && (
            <button
              type="button"
              onClick={() => void handleSync()}
              disabled={syncing}
              className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-md"
            >
              {syncing ? '⏳ Syncing...' : '⟳ Sync All Data Now'}
            </button>
          )}
        </div>
      ) : (
        <LedgerTable entries={entries} onRowClick={setSelected} />
      )}

      {pagination.pages > 1 && (
        <div className="flex justify-center items-center gap-2 flex-wrap pt-2">
          <button
            type="button"
            onClick={() => goPage(Math.max(1, pagination.page - 1))}
            disabled={pagination.page <= 1}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-xs text-gray-500 px-2">
            Page {pagination.page} of {pagination.pages}
          </span>
          <button
            type="button"
            onClick={() => goPage(Math.min(pagination.pages, pagination.page + 1))}
            disabled={pagination.page >= pagination.pages}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}

      {selected ? <LedgerEntryDetail entry={selected} onClose={() => setSelected(null)} /> : null}
      {showManual ? (
        <ManualEntryModal
          onClose={() => setShowManual(false)}
          onSuccess={(newBalance: number) => {
            setShowManual(false)
            void fetchData(filters)
            void fetchCategories()
            console.log(`[Ledger] New balance after entry: AED ${newBalance}`)
          }}
        />
      ) : null}
    </div>
  )
}
