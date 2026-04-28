'use client';

import { useEffect, useState } from 'react';

interface Props {
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}

// ── DEBIT TYPES: ONLY expenses and fines ──────────────────────────────────
const DEBIT_TYPES = [
  { v: 'EXPENSE_PAID', l: 'General Expense' },
  { v: 'FUEL_EXPENSE', l: 'Fuel Expense' },
  { v: 'VEHICLE_MAINTENANCE', l: 'Vehicle Maintenance' },
  { v: 'INSURANCE_PREMIUM', l: 'Insurance Premium' },
  { v: 'REGISTRATION_FEE', l: 'Registration Fee' },
  { v: 'VENDOR_PAYMENT', l: 'Vendor Payment' },
  { v: 'FINE_PAID', l: 'Fine (Penalty)' },
  { v: 'RECURRING_EXPENSE', l: 'Recurring Expense' },
  { v: 'MISCELLANEOUS_OUT', l: 'Miscellaneous Expense' },
];

// ── CREDIT TYPES: Everything else ─────────────────────────────────────────
const CREDIT_TYPES = [
  { v: 'BOOKING_PAYMENT', l: 'Booking Payment' },
  { v: 'INVOICE_PAYMENT', l: 'Invoice Payment' },
  { v: 'PARTIAL_PAYMENT', l: 'Partial Payment' },
  { v: 'SECURITY_DEPOSIT', l: 'Security Deposit' },
  { v: 'ADVANCE_PAYMENT', l: 'Advance Payment' },
  { v: 'INVESTOR_CAPITAL_IN', l: 'Investor Capital In' },
  { v: 'LOAN_RECEIVED', l: 'Loan Received' },
  { v: 'BANK_DEPOSIT', l: 'Bank Deposit' },
  { v: 'MISCELLANEOUS_IN', l: 'Miscellaneous Income' },
];

const ACCOUNTS = ['Cash', 'Bank', 'Mobile Wallet', 'Petty Cash'];

export default function ManualEntryModal({ onClose, onSuccess }: Props) {
  const [tab, setTab] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [entryType, setEntryType] = useState('EXPENSE_PAID');
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    description: '',
    category: '',
    accountLabel: 'Cash',
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const isDebit = tab === 'DEBIT';

  useEffect(() => {
    const loadExpenseCategories = async () => {
      setLoadingCategories(true);
      try {
        const res = await fetch('/api/expense-categories');
        if (!res.ok) return;
        const data = await res.json();
        const names = Array.isArray(data?.categories)
          ? data.categories
              .map((c: any) => String(c?.name || '').trim())
              .filter((v: string) => Boolean(v))
          : [];
        setExpenseCategories(names);
      } catch {
        // Non-blocking: keep manual fallback input behavior.
      } finally {
        setLoadingCategories(false);
      }
    };
    loadExpenseCategories();
  }, []);

  const handleTab = (t: 'DEBIT' | 'CREDIT') => {
    setTab(t);
    setEntryType(t === 'DEBIT' ? 'EXPENSE_PAID' : 'BOOKING_PAYMENT');
    setError('');
    setSuccess('');
  };

  const submit = async () => {
    if (!form.amount || Number(form.amount) <= 0) { setError('Enter a valid amount'); return; }
    if (!form.description.trim()) { setError('Description is required'); return; }
    setError(''); setSaving(true);
    try {
      const res = await fetch('/api/ledger/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date, entryType, direction: tab,
          amount: Number(form.amount),
          description: form.description.trim(),
          category: form.category.trim() || entryType.replace(/_/g, ' '),
          accountLabel: form.accountLabel,
          note: form.note.trim(),
          currency: 'AED',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setSuccess(data.message || '✓ Entry saved');
      setTimeout(() => onSuccess(data.newBalance ?? 0), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const displayAmt = Number(form.amount || 0).toLocaleString('en-AE', { minimumFractionDigits: 2 });
  const types = isDebit ? DEBIT_TYPES : CREDIT_TYPES;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className={`p-5 ${isDebit ? 'bg-red-600' : 'bg-emerald-600'}`}>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-white font-bold text-xl">Manual Entry</h2>
              <p className="text-white/70 text-xs mt-0.5">Currency: AED</p>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white text-3xl leading-none">×</button>
          </div>
          {/* Tab Toggle */}
          <div className="flex gap-2">
            <button onClick={() => handleTab('DEBIT')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                isDebit ? 'bg-white text-red-700 shadow' : 'bg-white/20 text-white hover:bg-white/30'
              }`}>
              ↓ Expense / Fine (Debit)
            </button>
            <button onClick={() => handleTab('CREDIT')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                !isDebit ? 'bg-white text-emerald-700 shadow' : 'bg-white/20 text-white hover:bg-white/30'
              }`}>
              ↑ Income / Payment (Credit)
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Rule reminder */}
          <div className={`rounded-xl px-4 py-2.5 text-xs font-semibold border ${
            isDebit ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
          }`}>
            {isDebit
              ? '↓ DEBIT — Expenses and fines only. Deducted from balance.'
              : '↑ CREDIT — Payments, invoices, income. Added to balance.'}
          </div>

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex gap-2 items-center">
              <span className="text-emerald-500">✓</span>
              <p className="text-emerald-700 text-sm font-medium">{success}</p>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Fields */}
          {[
            {
              label: isDebit ? 'Category' : 'Income Type',
              content: (
                isDebit ? (
                  <select
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                    disabled={loadingCategories}
                  >
                    <option value="">
                      {loadingCategories ? 'Loading categories...' : 'Select expense category'}
                    </option>
                    {expenseCategories.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                ) : (
                  <select value={entryType} onChange={e => setEntryType(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500">
                    {types.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                )
              ),
            },
            {
              label: 'Date *',
              content: (
                <input type="date" value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500" />
              ),
            },
            {
              label: 'Amount (AED) *',
              content: (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">AED</span>
                  <input type="number" min="0.01" step="0.01" value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-xl pl-14 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              ),
            },
            {
              label: 'Description *',
              content: (
                <input type="text" value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder={isDebit ? 'What was this expense/fine for?' : 'What is this income from?'}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500" />
              ),
            },
            ...(!isDebit ? [{
              label: 'Category',
              content: (
                <input type="text" value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  placeholder="e.g. Booking, Deposit"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500" />
              ),
            }] : []),
            {
              label: 'Account',
              content: (
                <select value={form.accountLabel}
                  onChange={e => setForm(p => ({ ...p, accountLabel: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500">
                  {ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              ),
            },
            {
              label: 'Note (optional)',
              content: (
                <textarea value={form.note} rows={2}
                  onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                  placeholder="Additional details..."
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 resize-none" />
              ),
            },
          ].map(field => (
            <div key={field.label}>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{field.label}</label>
              {field.content}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={submit} disabled={saving || !!success}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 ${
              isDebit ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}>
            {saving ? 'Saving...' : success ? '✓ Saved!'
              : isDebit ? `↓ Record Debit  AED ${displayAmt}`
              : `↑ Record Credit  AED ${displayAmt}`}
          </button>
        </div>
      </div>
    </div>
  );
}
