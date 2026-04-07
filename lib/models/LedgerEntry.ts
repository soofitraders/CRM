import mongoose, { Schema, Document, Model } from 'mongoose'
import { AccountType, LedgerDirection, LedgerEntryType } from '@/types/ledger'

export interface ILedgerEntry extends Document {
  date: Date
  valueDate?: Date
  entryType: LedgerEntryType
  direction: LedgerDirection
  amount: number
  currency: string
  description: string
  referenceModel?: string
  referenceId?: mongoose.Types.ObjectId
  bookingId?: mongoose.Types.ObjectId
  customerId?: mongoose.Types.ObjectId
  vehicleId?: mongoose.Types.ObjectId
  userId?: mongoose.Types.ObjectId
  accountType: AccountType
  accountLabel?: string
  bankName?: string
  transferToAccount?: string
  transferFromAccount?: string
  pairedEntryId?: mongoose.Types.ObjectId
  loanId?: mongoose.Types.ObjectId
  category?: string
  subCategory?: string
  tags?: string[]
  runningBalance?: number
  isReconciled: boolean
  reconciledAt?: Date
  reconciledBy?: mongoose.Types.ObjectId
  createdBy?: mongoose.Types.ObjectId
  note?: string
  attachmentUrl?: string
  isVoided: boolean
  voidedAt?: Date
  voidedBy?: mongoose.Types.ObjectId
  voidReason?: string
  createdAt: Date
  updatedAt: Date
}

const ENTRY_TYPES: LedgerEntryType[] = [
  'BOOKING_PAYMENT',
  'SECURITY_DEPOSIT',
  'FINE_COLLECTED',
  'ADVANCE_PAYMENT',
  'PARTIAL_PAYMENT',
  'OVERPAYMENT_RECEIVED',
  'LATE_FEE_COLLECTED',
  'DAMAGE_RECOVERY',
  'INSURANCE_CLAIM',
  'BANK_DEPOSIT',
  'BANK_TRANSFER_IN',
  'INVESTOR_CAPITAL_IN',
  'LOAN_RECEIVED',
  'MISCELLANEOUS_INCOME',
  'EXPENSE_PAID',
  'RECURRING_EXPENSE',
  'SALARY_PAID',
  'INVESTOR_PAYOUT',
  'SECURITY_DEPOSIT_REFUND',
  'VEHICLE_MAINTENANCE',
  'FUEL_EXPENSE',
  'FINE_PAID',
  'INSURANCE_PREMIUM',
  'REGISTRATION_FEE',
  'LOAN_REPAYMENT',
  'BANK_WITHDRAWAL',
  'BANK_TRANSFER_OUT',
  'VENDOR_PAYMENT',
  'ADVANCE_REFUND',
  'OVERPAYMENT_REFUND',
  'MISCELLANEOUS_EXPENSE',
  'BANK_TRANSFER_INTERNAL',
  'OPENING_BALANCE',
  'BALANCE_ADJUSTMENT',
]

const LedgerEntrySchema = new Schema<ILedgerEntry>(
  {
    date: { type: Date, required: true, index: true },
    valueDate: { type: Date },
    entryType: { type: String, enum: ENTRY_TYPES, required: true, index: true },
    direction: { type: String, enum: ['CREDIT', 'DEBIT', 'INTERNAL'], required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'PKR', trim: true, uppercase: true },
    description: { type: String, required: true, trim: true },
    referenceModel: { type: String, trim: true },
    referenceId: { type: Schema.Types.ObjectId },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'CustomerProfile', index: true },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    accountType: { type: String, enum: ['CASH', 'BANK', 'MOBILE_WALLET', 'OTHER'], default: 'CASH', index: true },
    accountLabel: { type: String, trim: true, index: true },
    bankName: { type: String, trim: true },
    transferToAccount: { type: String, trim: true },
    transferFromAccount: { type: String, trim: true },
    pairedEntryId: { type: Schema.Types.ObjectId, ref: 'LedgerEntry' },
    loanId: { type: Schema.Types.ObjectId },
    category: { type: String, trim: true },
    subCategory: { type: String, trim: true },
    tags: [{ type: String, trim: true }],
    runningBalance: { type: Number },
    isReconciled: { type: Boolean, default: false, index: true },
    reconciledAt: { type: Date },
    reconciledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, trim: true },
    attachmentUrl: { type: String, trim: true },
    isVoided: { type: Boolean, default: false, index: true },
    voidedAt: { type: Date },
    voidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    voidReason: { type: String, trim: true },
  },
  { timestamps: true }
)

LedgerEntrySchema.index({ date: 1, createdAt: 1 })
LedgerEntrySchema.index(
  { referenceModel: 1, referenceId: 1 },
  { unique: true, sparse: true, partialFilterExpression: { referenceModel: { $exists: true }, referenceId: { $exists: true } } }
)

const LedgerEntry: Model<ILedgerEntry> =
  mongoose.models.LedgerEntry || mongoose.model<ILedgerEntry>('LedgerEntry', LedgerEntrySchema)

export default LedgerEntry
