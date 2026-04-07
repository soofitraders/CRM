'use client'

import Table, { TableRow, TableCell } from '@/components/ui/Table'
import { formatLedgerAmount, formatLedgerDateOnly } from '@/lib/ledgerDisplayFormat'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'

export interface LedgerRow {
  _id: string
  date: string
  entryType: string
  direction: 'CREDIT' | 'DEBIT' | 'INTERNAL'
  description: string
  amount: number
  accountLabel?: string
  isReconciled?: boolean
  isVoided?: boolean
  runningBalance?: number
  referenceModel?: string
  referenceId?: string
  bookingId?: string
}

function typeBadgeClass(t: string) {
  const base = 'text-xs font-semibold px-2 py-0.5 rounded-full'
  switch (t) {
    case 'PAYMENT':
      return `${base} bg-emerald-100 text-emerald-800`
    case 'INVOICE':
      return `${base} bg-blue-100 text-blue-800`
    case 'EXPENSE':
    case 'RECURRING_EXPENSE':
      return `${base} bg-orange-100 text-orange-800`
    case 'SALARY':
      return `${base} bg-purple-100 text-purple-800`
    case 'INVESTOR_PAYOUT':
      return `${base} bg-indigo-100 text-indigo-800`
    case 'FINE':
      return `${base} bg-amber-100 text-amber-900`
    case 'DEPOSIT':
      return `${base} bg-teal-100 text-teal-800`
    case 'DEPOSIT_REFUND':
      return `${base} bg-rose-100 text-rose-800`
    default:
      return `${base} bg-gray-100 text-gray-800`
  }
}

interface Props {
  entries: LedgerRow[] | null | undefined
  page: number
  pageSize: number
  onRowClick: (entry: LedgerRow) => void
  onReconcile?: (entry: LedgerRow) => void
  onVoid?: (entry: LedgerRow) => void
  canVoid?: boolean
}

export default function LedgerTable({ entries, page, pageSize, onRowClick, onReconcile, onVoid, canVoid }: Props) {
  const list = entries ?? []
  return (
    <Table
      headers={[
        '#',
        'Date',
        'Type',
        'Direction',
        'Description',
        'Account',
        'Amount',
        'Running balance',
        'Reference',
        'Actions',
      ]}
    >
      {list.map((e, i) => {
        const idx = (page - 1) * pageSize + i + 1
        const isCredit = e.direction === 'CREDIT'
        const isInternal = e.direction === 'INTERNAL'
        const refSuffix = (e.referenceId ?? '').length >= 8 ? (e.referenceId ?? '').slice(-8) : e.referenceId ?? '—'
        const rowKey = typeof e._id === 'string' ? e._id : String(e._id)
        return (
          <TableRow key={rowKey} onClick={() => onRowClick(e)}>
            <TableCell className="text-sidebarMuted">{idx}</TableCell>
            <TableCell className="whitespace-nowrap">
              {formatLedgerDateOnly(typeof e.date === 'string' ? e.date : String(e.date))}
            </TableCell>
            <TableCell>
              <span className={typeBadgeClass(e.entryType)}>{e.entryType.replace(/_/g, ' ')}</span>
            </TableCell>
            <TableCell>
              <span
                className={`inline-flex items-center gap-1 font-medium ${
                  isInternal ? 'text-gray-600 italic' : isCredit ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {isInternal ? null : isCredit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                {e.direction}
              </span>
            </TableCell>
            <TableCell className="max-w-xs">
              <span className={`block truncate ${e.isVoided ? 'line-through text-sidebarMuted' : ''}`} title={e.description}>
                {e.description}
              </span>
            </TableCell>
            <TableCell>{e.accountLabel || '—'}</TableCell>
            <TableCell
              className={`font-semibold ${isInternal ? 'text-gray-600 italic' : isCredit ? 'text-emerald-600' : 'text-red-600'}`}
            >
              {isInternal ? '' : isCredit ? '+' : '−'} Rs {formatLedgerAmount(e.amount)}
            </TableCell>
            <TableCell className="text-right">
              {e.runningBalance !== undefined && e.runningBalance !== null ? `Rs ${formatLedgerAmount(e.runningBalance)}` : '—'}
            </TableCell>
            <TableCell className="text-xs text-sidebarMuted font-mono">
              {e.referenceModel ?? '—'}:{refSuffix}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation()
                    onReconcile?.(e)
                  }}
                  className={`text-xs px-2 py-1 rounded border ${e.isReconciled ? 'border-emerald-500 text-emerald-600' : 'border-borderSoft text-sidebarMuted'}`}
                >
                  {e.isReconciled ? 'Reconciled' : 'Mark'}
                </button>
                {canVoid && !e.isVoided && (
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onVoid?.(e)
                    }}
                    className="text-xs px-2 py-1 rounded border border-red-400 text-red-600"
                  >
                    Void
                  </button>
                )}
              </div>
            </TableCell>
          </TableRow>
        )
      })}
    </Table>
  )
}
