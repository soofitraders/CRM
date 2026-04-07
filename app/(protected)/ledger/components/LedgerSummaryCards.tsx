'use client'

import SectionCard from '@/components/ui/SectionCard'
import { formatLedgerAmount } from '@/lib/ledgerDisplayFormat'
import { TrendingUp, TrendingDown, Scale, Calendar, AlertTriangle } from 'lucide-react'

interface Props {
  totalCredits: number
  totalDebits: number
  netBalance: number
  monthNet: number
  unreconciledCount: number
}

export default function LedgerSummaryCards({
  totalCredits,
  totalDebits,
  netBalance,
  monthNet,
  unreconciledCount,
}: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      <SectionCard className="border-l-4 border-l-emerald-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-sidebarMuted font-medium">Total credits (period)</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">Rs {formatLedgerAmount(totalCredits)}</p>
          </div>
          <TrendingUp className="w-10 h-10 text-emerald-500/80" />
        </div>
      </SectionCard>
      <SectionCard className="border-l-4 border-l-red-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-sidebarMuted font-medium">Total debits (period)</p>
            <p className="text-2xl font-bold text-red-600 mt-1">Rs {formatLedgerAmount(totalDebits)}</p>
          </div>
          <TrendingDown className="w-10 h-10 text-red-500/80" />
        </div>
      </SectionCard>
      <SectionCard className="border-l-4 border-l-blue-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-sidebarMuted font-medium">Net balance (period)</p>
            <p className={`text-2xl font-bold mt-1 ${netBalance >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
              Rs {formatLedgerAmount(netBalance)}
            </p>
          </div>
          <Scale className="w-10 h-10 text-blue-500/80" />
        </div>
      </SectionCard>
      <SectionCard className="border-l-4 border-l-violet-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-sidebarMuted font-medium">This month net</p>
            <p className={`text-2xl font-bold mt-1 ${monthNet >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              Rs {formatLedgerAmount(monthNet)}
            </p>
          </div>
          <Calendar className="w-10 h-10 text-violet-500/80" />
        </div>
      </SectionCard>
      <SectionCard className="border-l-4 border-l-amber-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-sidebarMuted font-medium">Unreconciled entries</p>
            <p className={`text-2xl font-bold mt-1 ${unreconciledCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {unreconciledCount}
            </p>
          </div>
          <AlertTriangle className={`w-10 h-10 ${unreconciledCount > 0 ? 'text-amber-500/80' : 'text-emerald-500/80'}`} />
        </div>
      </SectionCard>
    </div>
  )
}
