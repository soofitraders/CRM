export type LedgerDirection = 'CREDIT' | 'DEBIT' | 'INTERNAL'

export type LedgerEntryType =
  | 'BOOKING_PAYMENT'
  | 'SECURITY_DEPOSIT'
  | 'FINE_COLLECTED'
  | 'ADVANCE_PAYMENT'
  | 'PARTIAL_PAYMENT'
  | 'OVERPAYMENT_RECEIVED'
  | 'LATE_FEE_COLLECTED'
  | 'DAMAGE_RECOVERY'
  | 'INSURANCE_CLAIM'
  | 'BANK_DEPOSIT'
  | 'BANK_TRANSFER_IN'
  | 'INVESTOR_CAPITAL_IN'
  | 'LOAN_RECEIVED'
  | 'MISCELLANEOUS_INCOME'
  | 'EXPENSE_PAID'
  | 'RECURRING_EXPENSE'
  | 'SALARY_PAID'
  | 'INVESTOR_PAYOUT'
  | 'SECURITY_DEPOSIT_REFUND'
  | 'VEHICLE_MAINTENANCE'
  | 'FUEL_EXPENSE'
  | 'FINE_PAID'
  | 'INSURANCE_PREMIUM'
  | 'REGISTRATION_FEE'
  | 'LOAN_REPAYMENT'
  | 'BANK_WITHDRAWAL'
  | 'BANK_TRANSFER_OUT'
  | 'VENDOR_PAYMENT'
  | 'ADVANCE_REFUND'
  | 'OVERPAYMENT_REFUND'
  | 'MISCELLANEOUS_EXPENSE'
  | 'BANK_TRANSFER_INTERNAL'
  | 'OPENING_BALANCE'
  | 'BALANCE_ADJUSTMENT'

export type AccountType = 'CASH' | 'BANK' | 'MOBILE_WALLET' | 'OTHER'

export interface ILedgerEntry {
  _id: string
  date: string
  valueDate?: string
  entryType: LedgerEntryType
  direction: LedgerDirection
  amount: number
  currency: string
  description: string
  referenceModel?: string
  referenceId?: string
  bookingId?: string
  customerId?: string
  vehicleId?: string
  userId?: string
  accountType: AccountType
  accountLabel?: string
  bankName?: string
  transferToAccount?: string
  transferFromAccount?: string
  pairedEntryId?: string
  category?: string
  subCategory?: string
  tags?: string[]
  runningBalance?: number
  isReconciled: boolean
  isVoided: boolean
  voidReason?: string
  note?: string
  attachmentUrl?: string
  createdBy?: string
  createdAt: string
}

export interface IAccountBalance {
  accountLabel: string
  accountType: AccountType
  bankName?: string
  balance: number
  lastActivity: string
}

export interface ILedgerSummary {
  totalCredits: number
  totalDebits: number
  netBalance: number
  openingBalance: number
  closingBalance: number
  byEntryType: { type: string; total: number; count: number }[]
  byAccount: IAccountBalance[]
  monthlyTrend: {
    month: string
    credits: number
    debits: number
    net: number
    cumulative: number
  }[]
  topExpenseCategories: { category: string; total: number }[]
  unreconciledCount: number
  pendingDeposits: number
}
