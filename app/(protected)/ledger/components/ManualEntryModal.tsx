'use client'

import { useState } from 'react'

const TYPES = [
  { v: 'BANK_DEPOSIT', l: 'Bank Deposit', dir: 'CREDIT' as const },
  { v: 'BANK_WITHDRAWAL', l: 'Bank Withdrawal', dir: 'DEBIT' as const },
  { v: 'BANK_TRANSFER', l: 'Bank Transfer', dir: 'DEBIT' as const },
  { v: 'INVESTOR_CAPITAL_IN', l: 'Investor Capital In', dir: 'CREDIT' as const },
  { v: 'LOAN_RECEIVED', l: 'Loan Received', dir: 'CREDIT' as const },
  { v: 'LOAN_REPAYMENT', l: 'Loan Repayment', dir: 'DEBIT' as const },
  { v: 'FUEL_EXPENSE', l: 'Fuel Expense', dir: 'DEBIT' as const },
  { v: 'INSURANCE_PREMIUM', l: 'Insurance Premium', dir: 'DEBIT' as const },
  { v: 'REGISTRATION_FEE', l: 'Registration Fee', dir: 'DEBIT' as const },
  { v: 'VENDOR_PAYMENT', l: 'Vendor Payment', dir: 'DEBIT' as const },
  { v: 'MISCELLANEOUS_IN', l: 'Misc. Income', dir: 'CREDIT' as const },
  { v: 'MISCELLANEOUS_OUT', l: 'Misc. Expense', dir: 'DEBIT' as const },
]

export default function ManualEntryModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    entryType: 'BANK_DEPOSIT',
    amount: '',
    description: '',
    accountLabel: 'Cash',
    note: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const sel = TYPES.find((t) => t.v === form.entryType)!

  const submit = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      setErr('Enter a valid amount')
      return
    }
    if (!form.description.trim()) {
      setErr('Description is required')
      return
    }
    try {
      setSaving(true)
      setErr('')
      const res = await fetch('/api/ledger/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          direction: sel.dir,
          currency: 'AED',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed')
      onSuccess()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-gray-900">New Manual Entry</h2>
            <p className="text-xs text-gray-400 mt-0.5">Currency: AED</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
            ×
          </button>
        </div>

        {err ? <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{err}</p> : null}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Entry Type</label>
            <select
              value={form.entryType}
              onChange={(e) => setForm((p) => ({ ...p, entryType: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              {TYPES.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l} ({t.dir})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Amount (AED)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.amount}
              placeholder="0.00"
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description *</label>
            <input
              type="text"
              value={form.description}
              placeholder="What is this for?"
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Account</label>
            <select
              value={form.accountLabel}
              onChange={(e) => setForm((p) => ({ ...p, accountLabel: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option>Cash</option>
              <option>Bank</option>
              <option>Mobile Wallet</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Note (optional)</label>
            <input
              type="text"
              value={form.note}
              placeholder="Additional note..."
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${
            sel.dir === 'CREDIT' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {sel.dir === 'CREDIT' ? '↑' : '↓'} This will be recorded as a <strong>{sel.dir}</strong> entry
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 ${
              sel.dir === 'CREDIT' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {saving ? 'Saving...' : `Save ${sel.dir === 'CREDIT' ? 'Credit ↑' : 'Debit ↓'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
