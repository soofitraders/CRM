import mongoose, { Schema, Document, Model } from 'mongoose'

export interface ILedgerEntry extends Document {
  date: Date
  valueDate?: Date
  entryType: string
  direction: 'CREDIT' | 'DEBIT'
  amount: number
  currency: string
  runningBalance: number
  description: string
  category: string
  subCategory?: string
  note?: string
  accountLabel: string
  accountType: 'CASH' | 'BANK' | 'MOBILE_WALLET' | 'OTHER'
  referenceModel: string
  referenceId?: mongoose.Types.ObjectId
  bookingId?: mongoose.Types.ObjectId
  customerId?: mongoose.Types.ObjectId
  vehicleId?: mongoose.Types.ObjectId
  userId?: mongoose.Types.ObjectId
  isVoided: boolean
  isReconciled: boolean
  reconciledAt?: Date
  createdAt: Date
  updatedAt: Date
}

const LedgerEntrySchema = new Schema<ILedgerEntry>(
  {
    date: { type: Date, required: true },
    valueDate: { type: Date },
    entryType: { type: String, required: true },
    direction: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
    amount: { type: Number, required: true, default: 0, min: 0 },
    currency: { type: String, default: 'AED' },
    runningBalance: { type: Number, default: 0 },
    description: { type: String, default: '' },
    category: { type: String, default: 'General' },
    subCategory: { type: String },
    note: { type: String, default: '' },
    accountLabel: { type: String, default: 'Cash' },
    accountType: {
      type: String,
      enum: ['CASH', 'BANK', 'MOBILE_WALLET', 'OTHER'],
      default: 'CASH',
    },
    referenceModel: { type: String, default: '' },
    referenceId: { type: Schema.Types.ObjectId },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    customerId: { type: Schema.Types.ObjectId, ref: 'CustomerProfile' },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    isVoided: { type: Boolean, default: false },
    isReconciled: { type: Boolean, default: false },
    reconciledAt: { type: Date },
  },
  { timestamps: true }
)

LedgerEntrySchema.index({ date: -1 })
LedgerEntrySchema.index({ direction: 1 })
LedgerEntrySchema.index({ entryType: 1 })
LedgerEntrySchema.index({ category: 1 })
LedgerEntrySchema.index({ bookingId: 1 })
LedgerEntrySchema.index({ customerId: 1 })
LedgerEntrySchema.index({ vehicleId: 1 })
LedgerEntrySchema.index({ isVoided: 1 })
LedgerEntrySchema.index({ isReconciled: 1 })
/** Non-unique: one source can produce multiple ledger lines (e.g. partial payments). */
LedgerEntrySchema.index({ referenceModel: 1, referenceId: 1, entryType: 1 })

const LedgerEntry: Model<ILedgerEntry> =
  mongoose.models.LedgerEntry || mongoose.model<ILedgerEntry>('LedgerEntry', LedgerEntrySchema)

export default LedgerEntry
