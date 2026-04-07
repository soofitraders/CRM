'use client'

import SectionCard from '@/components/ui/SectionCard'
import { formatLedgerAmount } from '@/lib/ledgerDisplayFormat'
import { Wallet, Building2, Smartphone, CircleHelp } from 'lucide-react'
import { IAccountBalance } from '@/types/ledger'

const iconByType = {
  CASH: Wallet,
  BANK: Building2,
  MOBILE_WALLET: Smartphone,
  OTHER: CircleHelp,
}

function balanceClass(balance: number) {
  if (!Number.isFinite(balance)) return 'text-gray-500'
  if (balance > 0) return 'text-emerald-600'
  if (balance < 0) return 'text-red-600'
  return 'text-gray-500'
}

export default function AccountBalancesStrip({ accounts }: { accounts: IAccountBalance[] | null | undefined }) {
  const list = accounts ?? []
  if (list.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-borderSoft px-4 py-6 text-center text-sm text-sidebarMuted">
        No accounts with activity yet. Sync the ledger or add manual entries to see balances here.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 min-w-max pb-1">
        {list.map((a) => {
          const Icon = iconByType[a.accountType] || CircleHelp
          const bal = Number.isFinite(a.balance) ? a.balance : 0
          return (
            <SectionCard key={`${a.accountLabel}-${a.accountType}-${a.bankName ?? ''}`} className="min-w-[260px]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-sidebarMuted">{a.accountType}</p>
                  <p className="font-semibold text-headingText">{a.accountLabel}</p>
                  {a.bankName && <p className="text-xs text-sidebarMuted">{a.bankName}</p>}
                  <p className={`mt-2 text-lg font-bold ${balanceClass(bal)}`}>Rs {formatLedgerAmount(bal)}</p>
                </div>
                <Icon className="w-6 h-6 text-sidebarMuted" />
              </div>
            </SectionCard>
          )
        })}
      </div>
    </div>
  )
}
