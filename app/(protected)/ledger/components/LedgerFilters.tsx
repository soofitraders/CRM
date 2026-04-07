'use client'

import Toolbar, { ToolbarGroup } from '@/components/ui/Toolbar'
import { Search, Download, RefreshCw } from 'lucide-react'

export const LEDGER_ENTRY_TYPES = [
  { value: 'BOOKING_PAYMENT', label: 'Booking payment' },
  { value: 'SECURITY_DEPOSIT', label: 'Security deposit' },
  { value: 'SECURITY_DEPOSIT_REFUND', label: 'Deposit refund' },
  { value: 'EXPENSE_PAID', label: 'Expense paid' },
  { value: 'RECURRING_EXPENSE', label: 'Recurring expense' },
  { value: 'SALARY_PAID', label: 'Salary paid' },
  { value: 'INVESTOR_PAYOUT', label: 'Investor payout' },
  { value: 'FINE_COLLECTED', label: 'Fine collected' },
  { value: 'FINE_PAID', label: 'Fine paid' },
] as const

interface Props {
  startDate: string
  endDate: string
  onStartDate: (v: string) => void
  onEndDate: (v: string) => void
  direction: 'ALL' | 'CREDIT' | 'DEBIT' | 'INTERNAL'
  onDirection: (v: 'ALL' | 'CREDIT' | 'DEBIT' | 'INTERNAL') => void
  selectedTypes: string[]
  onTypesChange: (types: string[]) => void
  accountLabel: string
  onAccountLabel: (v: string) => void
  minAmount: string
  maxAmount: string
  onMinAmount: (v: string) => void
  onMaxAmount: (v: string) => void
  isReconciled: 'ALL' | 'true' | 'false'
  onIsReconciled: (v: 'ALL' | 'true' | 'false') => void
  search: string
  onSearch: (v: string) => void
  onClear: () => void
  onExport: () => void
  onSync?: () => void
  syncing?: boolean
  canSync?: boolean
  onOpenManual?: () => void
}

export default function LedgerFilters({
  startDate,
  endDate,
  onStartDate,
  onEndDate,
  direction,
  onDirection,
  selectedTypes,
  onTypesChange,
  accountLabel,
  onAccountLabel,
  minAmount,
  maxAmount,
  onMinAmount,
  onMaxAmount,
  isReconciled,
  onIsReconciled,
  search,
  onSearch,
  onClear,
  onExport,
  onSync,
  syncing,
  canSync,
  onOpenManual,
}: Props) {
  const toggleType = (value: string) => {
    if (selectedTypes.includes(value)) {
      onTypesChange(selectedTypes.filter((t) => t !== value))
    } else {
      onTypesChange([...selectedTypes, value])
    }
  }

  return (
    <Toolbar>
      <ToolbarGroup>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-sidebarMuted mb-1">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-borderSoft bg-pageBg text-bodyText text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-sidebarMuted mb-1">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-borderSoft bg-pageBg text-bodyText text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-sidebarMuted mb-1">Cash flow</label>
            <select
              value={direction}
              onChange={(e) => onDirection(e.target.value as 'ALL' | 'CREDIT' | 'DEBIT' | 'INTERNAL')}
              className="px-3 py-2 rounded-lg border border-borderSoft bg-pageBg text-bodyText text-sm min-w-[140px]"
            >
              <option value="ALL">All</option>
              <option value="CREDIT">Cash in</option>
              <option value="DEBIT">Cash out</option>
              <option value="INTERNAL">Internal</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-sidebarMuted mb-1">Entry types</label>
            <div className="flex flex-wrap gap-1">
              {LEDGER_ENTRY_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => toggleType(t.value)}
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    selectedTypes.includes(t.value)
                      ? 'bg-sidebarActiveBg text-white border-sidebarActiveBg'
                      : 'border-borderSoft text-bodyText hover:bg-pageBg'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-sidebarMuted mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sidebarMuted" />
              <input
                type="text"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Description, note, category…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-borderSoft bg-pageBg text-bodyText text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-sidebarMuted mb-1">Account</label>
            <input
              value={accountLabel}
              onChange={(e) => onAccountLabel(e.target.value)}
              className="px-3 py-2 rounded-lg border border-borderSoft bg-pageBg text-bodyText text-sm"
              placeholder="e.g. MCB Business"
            />
          </div>
          <div>
            <label className="block text-xs text-sidebarMuted mb-1">Min / Max</label>
            <div className="flex gap-2">
              <input value={minAmount} onChange={(e) => onMinAmount(e.target.value)} placeholder="Min" className="w-24 px-3 py-2 rounded-lg border border-borderSoft bg-pageBg text-bodyText text-sm" />
              <input value={maxAmount} onChange={(e) => onMaxAmount(e.target.value)} placeholder="Max" className="w-24 px-3 py-2 rounded-lg border border-borderSoft bg-pageBg text-bodyText text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-sidebarMuted mb-1">Reconciled</label>
            <select value={isReconciled} onChange={(e) => onIsReconciled(e.target.value as 'ALL' | 'true' | 'false')} className="px-3 py-2 rounded-lg border border-borderSoft bg-pageBg text-bodyText text-sm">
              <option value="ALL">All</option>
              <option value="true">Reconciled</option>
              <option value="false">Unreconciled</option>
            </select>
          </div>
        </div>
      </ToolbarGroup>
      <ToolbarGroup className="flex gap-2">
        {canSync && onOpenManual && (
          <button type="button" onClick={onOpenManual} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-borderSoft bg-cardBg text-bodyText text-sm font-medium hover:bg-pageBg">
            Manual Entry
          </button>
        )}
        {canSync && onSync && (
          <button
            type="button"
            onClick={onSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-borderSoft bg-cardBg text-bodyText text-sm font-medium hover:bg-pageBg disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sync ledger
          </button>
        )}
        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sidebarActiveBg text-white text-sm font-medium hover:opacity-90"
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>
        <button type="button" onClick={onClear} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-borderSoft bg-cardBg text-bodyText text-sm font-medium hover:bg-pageBg">
          Clear Filters
        </button>
      </ToolbarGroup>
    </Toolbar>
  )
}
