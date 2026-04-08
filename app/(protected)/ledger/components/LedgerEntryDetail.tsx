'use client'

import { useEffect } from 'react'
import type { ILedgerEntry } from '@/types/ledger'
import { fmtAED, fmtDate } from '../formatters'

export default function LedgerEntryDetail({
  entry,
  onClose,
}: {
  entry: ILedgerEntry
  onClose: () => void
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const isCredit = entry.direction === 'CREDIT'
  const rows: [string, string][] = [
    ['Date', fmtDate(entry.date)],
    ['Entry Type', String(entry.entryType ?? '—').replace(/_/g, ' ')],
    ['Direction', isCredit ? '↑ Credit — Cash In' : '↓ Debit — Cash Out'],
    ['Amount', fmtAED(entry.amount)],
    ['Running Balance', fmtAED(entry.runningBalance ?? 0)],
    ['Description', entry.description || '—'],
    ['Category', entry.category || '—'],
    ['Account', entry.accountLabel || 'Cash'],
    ['Reference', entry.referenceModel || '—'],
    ['Reconciled', entry.isReconciled ? '✓ Yes' : '✗ No'],
    ['Note', entry.note || '—'],
  ]

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className={`p-5 flex items-start justify-between ${isCredit ? 'bg-emerald-600' : 'bg-red-600'}`}>
          <div>
            <p className="text-white/70 text-sm">{isCredit ? '↑ Cash In' : '↓ Cash Out'}</p>
            <p className="text-white font-bold text-2xl mt-0.5">{fmtAED(entry.amount)}</p>
            <p className="text-white/70 text-xs mt-1">{fmtDate(entry.date)}</p>
          </div>
          <button type="button" onClick={onClose} className="text-white/70 hover:text-white text-3xl leading-none mt-1">
            ×
          </button>
        </div>
        <div className="p-5 space-y-0 divide-y divide-gray-100">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between py-2.5 gap-4">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0">{label}</span>
              <span className="text-sm text-gray-700 text-right max-w-[58%] break-words">{value}</span>
            </div>
          ))}
        </div>
        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
