'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { format, subMonths } from 'date-fns'
import PageHeader from '@/components/ui/PageHeader'
import SectionCard from '@/components/ui/SectionCard'
import LedgerSummaryCards from './components/LedgerSummaryCards'
import LedgerFilters from './components/LedgerFilters'
import LedgerTable, { LedgerRow } from './components/LedgerTable'
import LedgerEntryDetail from './components/LedgerEntryDetail'
import AccountBalancesStrip from './components/AccountBalancesStrip'
import ManualEntryModal from './components/ManualEntryModal'

/** Default range: last 12 months (invoices / activity often span outside “this month”). */
function defaultLedgerStartDate() {
  return format(subMonths(new Date(), 12), 'yyyy-MM-dd')
}

const LedgerCharts = dynamic(() => import('./components/LedgerCharts'), {
  ssr: false,
  loading: () => <div className="h-64 bg-gray-100 animate-pulse rounded-lg" />,
})

interface LedgerApiEntry extends LedgerRow {
  valueDate?: string
  currency?: string
  category?: string
  note?: string
  customerId?: string
  vehicleId?: string
}

export default function LedgerPage() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role
  const canSync = role === 'SUPER_ADMIN' || role === 'ADMIN'

  const [startDate, setStartDate] = useState(() => defaultLedgerStartDate())
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [direction, setDirection] = useState<'ALL' | 'CREDIT' | 'DEBIT' | 'INTERNAL'>('ALL')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [entries, setEntries] = useState<LedgerApiEntry[]>([])
  const [pagination, setPagination] = useState({ total: 0, pages: 0, limit: 50 })
  const [summary, setSummary] = useState({
    totalCredits: 0,
    totalDebits: 0,
    netBalance: 0,
    openingBalance: 0,
    closingBalance: 0,
  })
  const [accounts, setAccounts] = useState<any[]>([])
  const [summaryFull, setSummaryFull] = useState<any>(null)
  const [view, setView] = useState<'table' | 'charts'>('table')
  const [showManual, setShowManual] = useState(false)
  const [accountLabel, setAccountLabel] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [isReconciled, setIsReconciled] = useState<'ALL' | 'true' | 'false'>('ALL')
  const [monthNet, setMonthNet] = useState(0)
  const [unreconciledCount, setUnreconciledCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [selected, setSelected] = useState<LedgerApiEntry | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('limit', '50')
    p.set('sortBy', 'date')
    p.set('sortOrder', 'desc')
    if (startDate) p.set('startDate', new Date(startDate + 'T00:00:00').toISOString())
    if (endDate) p.set('endDate', new Date(endDate + 'T23:59:59').toISOString())
    p.set('direction', direction)
    if (selectedTypes.length) p.set('entryType', selectedTypes.join(','))
    if (accountLabel.trim()) p.set('accountLabel', accountLabel.trim())
    if (minAmount.trim()) p.set('minAmount', minAmount.trim())
    if (maxAmount.trim()) p.set('maxAmount', maxAmount.trim())
    if (isReconciled !== 'ALL') p.set('isReconciled', isReconciled)
    if (debouncedSearch.trim()) p.set('search', debouncedSearch.trim())
    return p.toString()
  }, [page, startDate, endDate, direction, selectedTypes, accountLabel, minAmount, maxAmount, isReconciled, debouncedSearch])

  const fetchLedger = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ledger?${queryString}`)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Failed to load ledger')
      }
      const data = await res.json()
      setEntries(data.entries || [])
      setPagination(data.pagination || { total: 0, pages: 0, limit: 50 })
      setSummary(
        data.summary || {
          totalCredits: 0,
          totalDebits: 0,
          netBalance: 0,
          openingBalance: 0,
          closingBalance: 0,
        }
      )
    } catch (e: any) {
      setError(e.message || 'Failed to load ledger')
    } finally {
      setLoading(false)
    }
  }, [queryString])

  const fetchSummaryMeta = useCallback(async () => {
    try {
      const p = new URLSearchParams()
      if (startDate) p.set('startDate', new Date(startDate + 'T00:00:00').toISOString())
      if (endDate) p.set('endDate', new Date(endDate + 'T23:59:59').toISOString())
      const res = await fetch(`/api/ledger/summary?${p}`)
      if (!res.ok) return
      const data = await res.json()
      setSummaryFull(data)
      setUnreconciledCount(data.unreconciledCount || 0)
      const ym = format(new Date(), 'yyyy-MM')
      const row = (data.monthlyTrend || []).find((m: { month: string }) => m.month === ym)
      setMonthNet(row?.net ?? 0)
    } catch {
      /* ignore */
    }
  }, [startDate, endDate])

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/ledger/accounts')
      if (!res.ok) return
      const data = await res.json()
      setAccounts(data.accounts || [])
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void fetchLedger()
  }, [fetchLedger])

  useEffect(() => {
    void fetchSummaryMeta()
  }, [fetchSummaryMeta])

  useEffect(() => {
    void fetchAccounts()
  }, [fetchAccounts])

  const handleExport = () => {
    const p = new URLSearchParams()
    if (startDate) p.set('startDate', new Date(startDate + 'T00:00:00').toISOString())
    if (endDate) p.set('endDate', new Date(endDate + 'T23:59:59').toISOString())
    p.set('direction', direction)
    if (selectedTypes.length) p.set('entryType', selectedTypes.join(','))
    if (accountLabel.trim()) p.set('accountLabel', accountLabel.trim())
    if (debouncedSearch.trim()) p.set('search', debouncedSearch.trim())
    window.open(`/api/ledger/export?${p.toString()}`, '_blank')
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/ledger/sync', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || data.details || 'Sync failed')
      }
      await fetchLedger()
      await fetchSummaryMeta()
      await fetchAccounts()
      const synced = typeof data.synced === 'number' ? data.synced : 0
      const skipped = typeof data.skipped === 'number' ? data.skipped : 0
      const errList = Array.isArray(data.errors) ? data.errors : []
      const msg = `Sync finished: ${synced} operations completed, ${skipped} skipped.${errList.length ? ` First issues: ${errList.slice(0, 3).join(' | ')}` : ''}`
      alert(msg)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const handleVoid = async (entry: LedgerRow) => {
    const reason = window.prompt('Void reason is required:')
    if (!reason) return
    const res = await fetch(`/api/ledger/${entry._id}/void`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voidReason: reason }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      alert(j.error || 'Failed to void entry')
      return
    }
    await fetchLedger()
    await fetchSummaryMeta()
    await fetchAccounts()
  }

  const handleReconcile = async (entry: LedgerRow) => {
    const res = await fetch(`/api/ledger/${entry._id}/reconcile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isReconciled: !entry.isReconciled }),
    })
    if (!res.ok) return
    await fetchLedger()
    await fetchSummaryMeta()
  }

  const clearFilters = () => {
    setStartDate(defaultLedgerStartDate())
    setEndDate(format(new Date(), 'yyyy-MM-dd'))
    setDirection('ALL')
    setSelectedTypes([])
    setAccountLabel('')
    setMinAmount('')
    setMaxAmount('')
    setIsReconciled('ALL')
    setSearch('')
    setPage(1)
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      <PageHeader
        title="General ledger"
        subtitle="Complete financial record of all cash movements"
        actions={
          <div className="flex gap-2">
            <button onClick={() => setView(view === 'table' ? 'charts' : 'table')} className="px-4 py-2 rounded-lg border border-borderSoft bg-cardBg text-bodyText">
              {view === 'table' ? 'Charts View' : 'Table View'}
            </button>
            {canSync && (
              <button onClick={() => setShowManual(true)} className="px-4 py-2 rounded-lg border border-borderSoft bg-cardBg text-bodyText">
                Manual Entry
              </button>
            )}
          </div>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-pageBg border border-borderSoft animate-pulse" />
            ))}
          </div>
          <div className="h-24 rounded-xl bg-pageBg border border-borderSoft animate-pulse" />
        </div>
      ) : (
        <>
          <LedgerSummaryCards
            totalCredits={summary.totalCredits}
            totalDebits={summary.totalDebits}
            netBalance={summary.netBalance}
            monthNet={monthNet}
            unreconciledCount={unreconciledCount}
          />
          <AccountBalancesStrip accounts={accounts} />
        </>
      )}

      <SectionCard>
        <LedgerFilters
          startDate={startDate}
          endDate={endDate}
          onStartDate={(v) => {
            setStartDate(v)
            setPage(1)
          }}
          onEndDate={(v) => {
            setEndDate(v)
            setPage(1)
          }}
          direction={direction}
          onDirection={(v) => {
            setDirection(v)
            setPage(1)
          }}
          selectedTypes={selectedTypes}
          onTypesChange={(t) => {
            setSelectedTypes(t)
            setPage(1)
          }}
          accountLabel={accountLabel}
          onAccountLabel={(v) => {
            setAccountLabel(v)
            setPage(1)
          }}
          minAmount={minAmount}
          maxAmount={maxAmount}
          onMinAmount={(v) => {
            setMinAmount(v)
            setPage(1)
          }}
          onMaxAmount={(v) => {
            setMaxAmount(v)
            setPage(1)
          }}
          isReconciled={isReconciled}
          onIsReconciled={(v) => {
            setIsReconciled(v)
            setPage(1)
          }}
          search={search}
          onSearch={(v) => {
            setSearch(v)
            setPage(1)
          }}
          onClear={clearFilters}
          onExport={handleExport}
          onSync={canSync ? handleSync : undefined}
          syncing={syncing}
          canSync={canSync}
          onOpenManual={canSync ? () => setShowManual(true) : undefined}
        />
      </SectionCard>

      <SectionCard>
        {view === 'charts' ? (
          <LedgerCharts summary={summaryFull} />
        ) : loading ? (
          <div className="p-6 space-y-3">
            <div className="h-8 bg-pageBg border border-borderSoft rounded animate-pulse w-48" />
            <div className="h-96 bg-pageBg border border-borderSoft rounded animate-pulse" />
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-700 dark:text-red-400 font-medium">Failed to load ledger</p>
              <p className="text-red-600/90 dark:text-red-300/90 text-sm mt-1">{error}</p>
              <button
                type="button"
                onClick={() => void fetchLedger()}
                className="mt-3 text-sm text-red-700 dark:text-red-400 underline"
              >
                Try again
              </button>
            </div>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-16 text-center space-y-4">
            <p className="text-bodyText">No ledger entries match your filters.</p>
            <p className="text-sm text-sidebarMuted max-w-lg mx-auto">
              Tip: widen the date range (defaults to the last 12 months). If payments and expenses exist but the ledger is still empty, use <strong>Sync ledger</strong> once to import historical records.
            </p>
            {pagination.total === 0 && canSync && (
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="px-6 py-2 rounded-lg bg-sidebarActiveBg text-white font-medium hover:opacity-90 disabled:opacity-50"
              >
                {syncing ? 'Syncing…' : 'Sync ledger from data'}
              </button>
            )}
          </div>
        ) : (
          <>
            <LedgerTable
              entries={entries}
              page={page}
              pageSize={pagination.limit}
              onReconcile={handleReconcile}
              onVoid={handleVoid}
              canVoid={role === 'SUPER_ADMIN'}
              onRowClick={(row) =>
                setSelected(entries.find((e) => e._id === row._id) || (row as LedgerApiEntry))
              }
            />
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-borderSoft">
                <p className="text-sm text-sidebarMuted">
                  Page {page} of {pagination.pages} ({pagination.total} rows)
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-borderSoft text-sm disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= pagination.pages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 rounded-lg border border-borderSoft text-sm disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </SectionCard>

      <LedgerEntryDetail
        entry={selected}
        fullEntry={selected as unknown as Record<string, unknown>}
        onClose={() => setSelected(null)}
      />
      <ManualEntryModal
        open={showManual}
        onClose={() => setShowManual(false)}
        onCreated={async () => {
          await fetchLedger()
          await fetchSummaryMeta()
          await fetchAccounts()
        }}
      />
    </div>
  )
}
