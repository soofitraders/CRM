'use client'

import type { ILedgerEntry } from '@/types/ledger'
import { fmtAED, fmtDate } from '../formatters'

interface Props {
  entries: ILedgerEntry[]
  onRowClick: (e: ILedgerEntry) => void
}

const TYPE_LABEL: Record<string, string> = {
  BOOKING_PAYMENT: 'Booking Payment',
  ADVANCE_PAYMENT: 'Advance Payment',
  PARTIAL_PAYMENT: 'Partial Payment',
  SECURITY_DEPOSIT: 'Security Deposit',
  SECURITY_DEPOSIT_REFUND: 'Deposit Refund',
  LATE_FEE: 'Late Fee',
  DAMAGE_CHARGE: 'Damage Charge',
  EXPENSE_PAID: 'Expense',
  RECURRING_EXPENSE: 'Recurring Exp.',
  SALARY_PAID: 'Salary',
  INVESTOR_PAYOUT: 'Investor Payout',
  INVESTOR_CAPITAL_IN: 'Investor Capital',
  VEHICLE_MAINTENANCE: 'Maintenance',
  FUEL_EXPENSE: 'Fuel',
  FINE_COLLECTED: 'Fine Collected',
  FINE_PAID: 'Fine Paid',
  INSURANCE_PREMIUM: 'Insurance',
  REGISTRATION_FEE: 'Registration',
  BANK_DEPOSIT: 'Bank Deposit',
  BANK_WITHDRAWAL: 'Bank Withdrawal',
  BANK_TRANSFER: 'Bank Transfer',
  LOAN_RECEIVED: 'Loan Received',
  LOAN_REPAYMENT: 'Loan Repayment',
  VENDOR_PAYMENT: 'Vendor Payment',
  MISCELLANEOUS_IN: 'Misc. Income',
  MISCELLANEOUS_OUT: 'Misc. Expense',
}

const TYPE_COLOR: Record<string, string> = {
  BOOKING_PAYMENT: 'bg-emerald-100 text-emerald-700',
  ADVANCE_PAYMENT: 'bg-emerald-100 text-emerald-700',
  PARTIAL_PAYMENT: 'bg-teal-100 text-teal-700',
  SECURITY_DEPOSIT: 'bg-blue-100 text-blue-700',
  SECURITY_DEPOSIT_REFUND: 'bg-orange-100 text-orange-700',
  EXPENSE_PAID: 'bg-red-100 text-red-700',
  RECURRING_EXPENSE: 'bg-rose-100 text-rose-700',
  SALARY_PAID: 'bg-purple-100 text-purple-700',
  INVESTOR_PAYOUT: 'bg-pink-100 text-pink-700',
  INVESTOR_CAPITAL_IN: 'bg-violet-100 text-violet-700',
  VEHICLE_MAINTENANCE: 'bg-yellow-100 text-yellow-700',
  FUEL_EXPENSE: 'bg-amber-100 text-amber-700',
  FINE_COLLECTED: 'bg-green-100 text-green-700',
  FINE_PAID: 'bg-red-100 text-red-700',
  BANK_DEPOSIT: 'bg-cyan-100 text-cyan-700',
  BANK_WITHDRAWAL: 'bg-slate-100 text-slate-700',
  LOAN_RECEIVED: 'bg-indigo-100 text-indigo-700',
  LOAN_REPAYMENT: 'bg-slate-100 text-slate-700',
  VENDOR_PAYMENT: 'bg-red-100 text-red-700',
}

export default function LedgerTable({ entries, onRowClick }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-10">#</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Description</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Category</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Account</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-red-300">
                Debit (AED)
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-emerald-300">
                Credit (AED)
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Balance (AED)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map((entry, idx) => {
              const isCredit = entry.direction === 'CREDIT'
              const bal = Number(entry.runningBalance ?? 0)
              const et = String(entry.entryType ?? '')
              return (
                <tr
                  key={entry._id}
                  onClick={() => onRowClick(entry)}
                  className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                    isCredit ? 'border-l-[3px] border-l-emerald-400' : 'border-l-[3px] border-l-red-400'
                  }`}
                >
                  <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{fmtDate(entry.date)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                        TYPE_COLOR[et] ?? 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {TYPE_LABEL[et] ?? et.replace(/_/g, ' ') ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate" title={entry.description}>
                    {entry.description || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{entry.category || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {entry.accountLabel || 'Cash'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600 whitespace-nowrap">
                    {!isCredit ? fmtAED(entry.amount) : ''}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600 whitespace-nowrap">
                    {isCredit ? fmtAED(entry.amount) : ''}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-bold whitespace-nowrap ${
                      bal >= 0 ? 'text-gray-800' : 'text-red-700'
                    }`}
                  >
                    {fmtAED(bal)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
