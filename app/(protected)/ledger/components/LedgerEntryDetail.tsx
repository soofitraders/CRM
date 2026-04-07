'use client'

import Link from 'next/link'
import { formatLedgerAmount, formatLedgerDateTimeUtc } from '@/lib/ledgerDisplayFormat'
import { X } from 'lucide-react'
import type { LedgerRow } from './LedgerTable'

function sourceLink(entry: LedgerRow): { href: string; label: string } | null {
  const id = entry.referenceId
  if (!id) return null
  switch (entry.referenceModel) {
    case 'Booking':
      return { href: `/bookings/${id}`, label: 'Open booking' }
    case 'Invoice':
      return { href: `/financials/invoices/${id}`, label: 'Open invoice' }
    case 'Expense':
      return { href: `/financials/management/expenses`, label: 'View expenses module' }
    case 'SalaryRecord':
      return { href: `/financials/management/salaries`, label: 'View salaries' }
    case 'InvestorPayout':
      return { href: `/financials/management/investor-payouts/${id}`, label: 'Open investor payout' }
    case 'Payment':
      if (entry.bookingId) {
        return { href: `/bookings/${entry.bookingId}`, label: 'Open related booking' }
      }
      return null
    default:
      return null
  }
}

interface Props {
  entry: LedgerRow | null
  fullEntry: Record<string, unknown> | null
  onClose: () => void
}

export default function LedgerEntryDetail({ entry, fullEntry, onClose }: Props) {
  if (!entry) return null

  const link = sourceLink(entry)
  const category = fullEntry?.category as string | undefined
  const note = (fullEntry?.note as string | undefined) ?? '—'
  const valueDate = fullEntry?.valueDate as string | undefined

  const amountVal = entry.amount ?? 0
  const runningVal = entry.runningBalance

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} aria-hidden />
      <aside className="fixed top-0 right-0 h-full w-full max-w-md bg-cardBg border-l border-borderSoft shadow-xl z-50 flex flex-col transition-transform">
        <div className="flex items-center justify-between p-4 border-b border-borderSoft">
          <h2 className="text-lg font-semibold text-headingText">Ledger entry</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-pageBg text-bodyText"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
          <div>
            <p className="text-sidebarMuted text-xs">Date</p>
            <p className="text-headingText font-medium">{formatLedgerDateTimeUtc(String(entry.date))}</p>
          </div>
          {valueDate && (
            <div>
              <p className="text-sidebarMuted text-xs">Value date</p>
              <p className="text-headingText">{formatLedgerDateTimeUtc(String(valueDate))}</p>
            </div>
          )}
          <div>
            <p className="text-sidebarMuted text-xs">Type / direction</p>
            <p className="text-headingText">
              {entry.entryType} · {entry.direction}
            </p>
          </div>
          <div>
            <p className="text-sidebarMuted text-xs">Amount</p>
            <p
              className={`text-xl font-bold ${
                entry.direction === 'INTERNAL' ? 'text-gray-600' : entry.direction === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              Rs {formatLedgerAmount(amountVal)}
            </p>
          </div>
          {runningVal !== undefined && runningVal !== null && (
            <div>
              <p className="text-sidebarMuted text-xs">Running balance (after this row)</p>
              <p className="text-headingText font-medium">Rs {formatLedgerAmount(runningVal)}</p>
            </div>
          )}
          <div>
            <p className="text-sidebarMuted text-xs">Description</p>
            <p className="text-bodyText">{entry.description ?? '—'}</p>
          </div>
          {category ? (
            <div>
              <p className="text-sidebarMuted text-xs">Category</p>
              <p className="text-bodyText">{category}</p>
            </div>
          ) : null}
          <div>
            <p className="text-sidebarMuted text-xs">Note</p>
            <p className="text-bodyText">{note}</p>
          </div>
          <div>
            <p className="text-sidebarMuted text-xs">Reference</p>
            <p className="text-bodyText font-mono text-xs break-all">
              {entry.referenceModel ?? '—'} / {entry.referenceId ?? '—'}
            </p>
          </div>
          {entry.bookingId && (
            <div>
              <p className="text-sidebarMuted text-xs">Booking</p>
              <Link href={`/bookings/${entry.bookingId}`} className="text-sidebarActiveBg hover:underline">
                {entry.bookingId}
              </Link>
            </div>
          )}
          {link && (
            <Link
              href={link.href}
              className="inline-flex items-center justify-center w-full py-2.5 rounded-lg bg-sidebarActiveBg text-white font-medium hover:opacity-90"
            >
              {link.label}
            </Link>
          )}
        </div>
      </aside>
    </>
  )
}
