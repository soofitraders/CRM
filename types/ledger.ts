export type LedgerDirection = 'CREDIT' | 'DEBIT'

export type LedgerEntryType =
  | 'BOOKING_PAYMENT'
  | 'ADVANCE_PAYMENT'
  | 'PARTIAL_PAYMENT'
  | 'SECURITY_DEPOSIT'
  | 'SECURITY_DEPOSIT_REFUND'
  | 'LATE_FEE'
  | 'DAMAGE_CHARGE'
  | 'EXPENSE_PAID'
  | 'RECURRING_EXPENSE'
  | 'SALARY_PAID'
  | 'INVESTOR_PAYOUT'
  | 'INVESTOR_CAPITAL_IN'
  | 'VEHICLE_MAINTENANCE'
  | 'FUEL_EXPENSE'
  | 'FINE_COLLECTED'
  | 'FINE_PAID'
  | 'INSURANCE_PREMIUM'
  | 'REGISTRATION_FEE'
  | 'BANK_DEPOSIT'
  | 'BANK_WITHDRAWAL'
  | 'BANK_TRANSFER'
  | 'LOAN_RECEIVED'
  | 'LOAN_REPAYMENT'
  | 'VENDOR_PAYMENT'
  | 'MISCELLANEOUS_IN'
  | 'MISCELLANEOUS_OUT'

export type AccountType = 'CASH' | 'BANK' | 'MOBILE_WALLET' | 'OTHER'

export interface ILedgerEntry {
  _id: string
  date: string
  valueDate?: string
  entryType: LedgerEntryType | string
  direction: LedgerDirection
  amount: number
  currency: string
  runningBalance: number
  description: string
  category: string
  subCategory?: string
  note?: string
  accountLabel: string
  accountType: AccountType
  referenceModel: string
  referenceId?: string
  bookingId?: string
  customerId?: string
  vehicleId?: string
  userId?: string
  isVoided: boolean
  isReconciled: boolean
  createdAt: string
  updatedAt: string
}

export interface ILedgerSummary {
  totalCredits: number
  totalDebits: number
  netBalance: number
  totalEntries: number
  unreconciledCount: number
}

export interface ILedgerFilters {
  startDate?: string
  endDate?: string
  direction?: string
  entryType?: string
  category?: string
  search?: string
  page?: number
  limit?: number
}

export interface ICategoryItem {
  value: string
  label: string
}
