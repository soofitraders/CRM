import mongoose from 'mongoose'
import connectDB from '@/lib/db'
import LedgerEntry, { ILedgerEntry } from '@/lib/models/LedgerEntry'
import Payment from '@/lib/models/Payment'
import Invoice from '@/lib/models/Invoice'
import Expense from '@/lib/models/Expense'
import SalaryRecord from '@/lib/models/SalaryRecord'
import InvestorPayout from '@/lib/models/InvestorPayout'
import FineOrPenalty from '@/lib/models/FineOrPenalty'
import Booking from '@/lib/models/Booking'
import MaintenanceRecord from '@/lib/models/MaintenanceRecord'
import { logger } from '@/lib/utils/performance'
import { AccountType, LedgerDirection, LedgerEntryType } from '@/types/ledger'

export const LEDGER_DEFAULT_CURRENCY = 'PKR'

/** Treat false / null / missing as active; only `true` is voided */
export const LEDGER_ACTIVE_VOID_FILTER = { isVoided: { $ne: true } } as const

export type LedgerSeedInput = Omit<Partial<ILedgerEntry>, 'referenceId'> & {
  referenceId?: mongoose.Types.ObjectId
}

function oid(id?: string) {
  return id ? new mongoose.Types.ObjectId(id) : undefined
}

function systemUpsertFilter(doc: LedgerSeedInput) {
  if (doc.referenceModel && doc.referenceId) {
    // $ne: true matches false, missing, or null — legacy rows without isVoided still upsert correctly
    return { referenceModel: doc.referenceModel, referenceId: doc.referenceId, isVoided: { $ne: true } }
  }
  return null
}

export async function upsertSystemLedgerEntry(doc: LedgerSeedInput): Promise<void> {
  await connectDB()
  const payload: Partial<ILedgerEntry> = {
    currency: LEDGER_DEFAULT_CURRENCY,
    accountType: 'CASH',
    isVoided: false,
    isReconciled: false,
    ...doc,
  }

  const filter = systemUpsertFilter(doc)
  if (filter) {
    await LedgerEntry.updateOne(filter, { $set: payload }, { upsert: true })
  } else {
    await LedgerEntry.create(payload)
  }
}

export async function recomputeAllRunningBalances(): Promise<void> {
  await connectDB()
  const entries = await LedgerEntry.find({ isVoided: { $ne: true } })
    .sort({ date: 1, createdAt: 1, _id: 1 })
    .select('_id direction amount')
    .lean()

  let balance = 0
  const ops: { updateOne: { filter: { _id: unknown }; update: { $set: { runningBalance: number } } } }[] =
    []
  for (const e of entries) {
    if (e.direction === 'CREDIT') balance += e.amount ?? 0
    else if (e.direction === 'DEBIT') balance -= e.amount ?? 0
    ops.push({
      updateOne: {
        filter: { _id: e._id },
        update: { $set: { runningBalance: balance } },
      },
    })
  }

  const chunkSize = 1000
  for (let i = 0; i < ops.length; i += chunkSize) {
    const chunk = ops.slice(i, i + chunkSize)
    if (chunk.length > 0) {
      await LedgerEntry.bulkWrite(chunk, { ordered: true })
    }
  }

  await LedgerEntry.updateMany({ isVoided: true }, { $set: { runningBalance: null } })
}

export async function ledgerFromPayment(paymentId: string): Promise<void> {
  await connectDB()
  const p = await Payment.findById(paymentId).lean()
  if (!p || p.status !== 'SUCCESS') return

  const payout = await InvestorPayout.findOne({ payment: p._id }).lean()
  if (payout) return

  let customerId: mongoose.Types.ObjectId | undefined
  let vehicleId: mongoose.Types.ObjectId | undefined
  if (p.booking) {
    const b = await Booking.findById(p.booking).select('customer vehicle').lean()
    customerId = b?.customer as mongoose.Types.ObjectId | undefined
    vehicleId = b?.vehicle as mongoose.Types.ObjectId | undefined
  }

  await upsertSystemLedgerEntry({
    date: p.paidAt || p.updatedAt || p.createdAt,
    valueDate: p.paidAt,
    entryType: 'BOOKING_PAYMENT',
    direction: 'CREDIT',
    amount: p.amount,
    description: `Booking payment received${p.transactionId ? ` (${p.transactionId})` : ''}`,
    referenceModel: 'Payment',
    referenceId: p._id as mongoose.Types.ObjectId,
    bookingId: p.booking as mongoose.Types.ObjectId | undefined,
    customerId,
    vehicleId,
    category: 'PAYMENT',
    accountType: 'CASH',
  })
}

export async function ledgerFromBookingDeposit(bookingId: string): Promise<void> {
  await connectDB()
  const b = await Booking.findById(bookingId).lean()
  if (!b || b.depositAmount <= 0) return

  await LedgerEntry.updateMany(
    {
      referenceModel: 'Booking',
      referenceId: b._id,
      entryType: { $in: ['SECURITY_DEPOSIT', 'SECURITY_DEPOSIT_REFUND'] },
      isVoided: { $ne: true },
    },
    { $set: { isVoided: true, voidReason: 'Superseded by latest booking deposit state', voidedAt: new Date() } }
  )

  await LedgerEntry.create({
    date: b.createdAt,
    valueDate: b.createdAt,
    entryType: 'SECURITY_DEPOSIT',
    direction: 'CREDIT',
    amount: b.depositAmount,
    currency: LEDGER_DEFAULT_CURRENCY,
    description: 'Security deposit collected',
    referenceModel: 'Booking',
    referenceId: b._id,
    bookingId: b._id,
    customerId: b.customer,
    vehicleId: b.vehicle,
    accountType: 'CASH',
    category: 'DEPOSIT',
    isVoided: false,
    isReconciled: false,
  })

  if (b.depositStatus === 'RELEASED') {
    await LedgerEntry.create({
      date: b.updatedAt,
      valueDate: b.updatedAt,
      entryType: 'SECURITY_DEPOSIT_REFUND',
      direction: 'DEBIT',
      amount: b.depositAmount,
      currency: LEDGER_DEFAULT_CURRENCY,
      description: 'Security deposit refunded',
      referenceModel: 'Booking',
      referenceId: b._id,
      bookingId: b._id,
      customerId: b.customer,
      vehicleId: b.vehicle,
      accountType: 'CASH',
      category: 'DEPOSIT',
      isVoided: false,
      isReconciled: false,
    })
  }
}

export async function ledgerFromExpense(expenseId: string, entryTypeOverride?: LedgerEntryType): Promise<void> {
  await connectDB()
  const exp = await Expense.findById(expenseId).populate('category', 'name code').lean()
  if (!exp || exp.isDeleted) return
  if (exp.salaryRecord || exp.investorPayout) return

  const category = exp.category as { name?: string; code?: string } | undefined
  const mappedType: LedgerEntryType =
    entryTypeOverride ||
    (exp.maintenanceRecord ? 'VEHICLE_MAINTENANCE' : category?.code === 'FUEL' ? 'FUEL_EXPENSE' : 'EXPENSE_PAID')

  const currency = (exp as { currency?: string }).currency?.trim() || LEDGER_DEFAULT_CURRENCY

  await upsertSystemLedgerEntry({
    date: exp.dateIncurred,
    valueDate: exp.dateIncurred,
    entryType: mappedType,
    direction: 'DEBIT',
    amount: exp.amount,
    currency: currency.toUpperCase(),
    description: exp.description,
    referenceModel: 'Expense',
    referenceId: exp._id as mongoose.Types.ObjectId,
    vehicleId: exp.vehicle as mongoose.Types.ObjectId | undefined,
    createdBy: exp.createdBy as mongoose.Types.ObjectId,
    category: category?.name || mappedType,
    accountType: 'CASH',
  })
}

export async function ledgerFromSalaryRecord(salaryId: string): Promise<void> {
  await connectDB()
  const s = await SalaryRecord.findById(salaryId).lean()
  if (!s || s.isDeleted || s.status !== 'PAID') return
  await upsertSystemLedgerEntry({
    date: s.paidAt || s.updatedAt || s.createdAt,
    valueDate: s.paidAt,
    entryType: 'SALARY_PAID',
    direction: 'DEBIT',
    amount: s.netSalary,
    currency: LEDGER_DEFAULT_CURRENCY,
    description: `Salary paid for ${s.month}/${s.year}`,
    referenceModel: 'SalaryRecord',
    referenceId: s._id as mongoose.Types.ObjectId,
    createdBy: s.createdBy as mongoose.Types.ObjectId,
    note: s.notes,
    accountType: 'CASH',
  })
}

export async function ledgerFromInvestorPayout(payoutId: string): Promise<void> {
  await connectDB()
  const p = await InvestorPayout.findById(payoutId).lean()
  if (!p || p.status !== 'PAID') return
  const amount = p.totals?.netPayout || 0
  if (!amount) return
  await upsertSystemLedgerEntry({
    date: p.updatedAt || p.createdAt,
    valueDate: p.updatedAt || p.createdAt,
    entryType: 'INVESTOR_PAYOUT',
    direction: 'DEBIT',
    amount,
    currency: LEDGER_DEFAULT_CURRENCY,
    description: 'Investor payout paid',
    referenceModel: 'InvestorPayout',
    referenceId: p._id as mongoose.Types.ObjectId,
    createdBy: p.createdBy as mongoose.Types.ObjectId,
    note: p.notes,
    accountType: 'BANK',
  })
}

export async function ledgerFromInvoice(invoiceId: string): Promise<void> {
  await connectDB()
  const inv = await Invoice.findById(invoiceId).lean()
  if (!inv) return
  const rawBooking = inv.booking as mongoose.Types.ObjectId | { _id: mongoose.Types.ObjectId } | string | undefined | null
  const bookingIdStr =
    rawBooking == null
      ? undefined
      : typeof rawBooking === 'object' && '_id' in rawBooking
        ? String(rawBooking._id)
        : String(rawBooking)
  await upsertSystemLedgerEntry({
    date: inv.issueDate,
    valueDate: inv.dueDate,
    entryType: 'PARTIAL_PAYMENT',
    direction: 'INTERNAL',
    amount: inv.total,
    currency: LEDGER_DEFAULT_CURRENCY,
    description: `Invoice ${inv.invoiceNumber} issued`,
    referenceModel: 'Invoice',
    referenceId: inv._id as mongoose.Types.ObjectId,
    bookingId: oid(bookingIdStr),
    category: 'RECEIVABLE',
    accountType: 'OTHER',
  })
}

export async function ledgerFromFineOrPenalty(fineId: string): Promise<void> {
  await connectDB()
  const f = await FineOrPenalty.findById(fineId).lean()
  if (!f) return
  const direction: LedgerDirection = f.status === 'PAID' ? 'DEBIT' : 'CREDIT'
  await upsertSystemLedgerEntry({
    date: f.issueDate,
    valueDate: f.dueDate,
    entryType: direction === 'CREDIT' ? 'FINE_COLLECTED' : 'FINE_PAID',
    direction,
    amount: f.amount,
    currency: LEDGER_DEFAULT_CURRENCY,
    description: `Fine ${f.referenceNumber} - ${f.authorityName}`,
    referenceModel: 'FineOrPenalty',
    referenceId: f._id as mongoose.Types.ObjectId,
    bookingId: f.booking as mongoose.Types.ObjectId | undefined,
    customerId: f.customer as mongoose.Types.ObjectId | undefined,
    vehicleId: f.vehicle as mongoose.Types.ObjectId,
    category: 'FINE',
    accountType: 'CASH',
  })
}

export async function ledgerFromMaintenanceRecord(recordId: string): Promise<void> {
  await connectDB()
  const m = await MaintenanceRecord.findById(recordId).lean()
  if (!m || !m.cost || m.cost <= 0) return
  await upsertSystemLedgerEntry({
    date: m.scheduledDate || m.createdAt,
    valueDate: m.completedDate || m.scheduledDate || m.createdAt,
    entryType: 'VEHICLE_MAINTENANCE',
    direction: 'DEBIT',
    amount: m.cost,
    currency: LEDGER_DEFAULT_CURRENCY,
    description: `Maintenance: ${m.description}`,
    referenceModel: 'MaintenanceRecord',
    referenceId: m._id as mongoose.Types.ObjectId,
    vehicleId: m.vehicle as mongoose.Types.ObjectId,
    createdBy: m.createdBy as mongoose.Types.ObjectId,
    category: m.type,
    accountType: 'CASH',
  })
}

export async function safeLedger(fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
    await recomputeAllRunningBalances()
  } catch (error) {
    logger.error('Ledger sync error (non-fatal):', error)
  }
}

export function buildLedgerMatch(params: {
  startDate?: Date
  endDate?: Date
  direction?: 'CREDIT' | 'DEBIT' | 'INTERNAL'
  entryTypes?: string[]
  accountType?: string
  accountLabel?: string
  bookingId?: string
  customerId?: string
  vehicleId?: string
  isReconciled?: boolean
  isVoided?: boolean
  minAmount?: number
  maxAmount?: number
  search?: string
}): Record<string, unknown> {
  const match: Record<string, unknown> = {}
  if (params.startDate || params.endDate) {
    match.date = {}
    if (params.startDate) (match.date as any).$gte = params.startDate
    if (params.endDate) (match.date as any).$lte = params.endDate
  }
  if (params.direction) match.direction = params.direction
  if (params.entryTypes?.length) match.entryType = { $in: params.entryTypes }
  if (params.accountType) match.accountType = params.accountType
  if (params.accountLabel) match.accountLabel = params.accountLabel
  if (params.bookingId) match.bookingId = oid(params.bookingId)
  if (params.customerId) match.customerId = oid(params.customerId)
  if (params.vehicleId) match.vehicleId = oid(params.vehicleId)
  if (typeof params.isReconciled === 'boolean') match.isReconciled = params.isReconciled
  if (typeof params.isVoided === 'boolean') {
    if (params.isVoided) {
      match.isVoided = true
    } else {
      match['isVoided'] = { $ne: true }
    }
  }
  if (params.minAmount !== undefined || params.maxAmount !== undefined) {
    match.amount = {}
    if (params.minAmount !== undefined) (match.amount as any).$gte = params.minAmount
    if (params.maxAmount !== undefined) (match.amount as any).$lte = params.maxAmount
  }
  if (params.search?.trim()) {
    const q = params.search.trim()
    match.$or = [
      { description: { $regex: q, $options: 'i' } },
      { note: { $regex: q, $options: 'i' } },
      { accountLabel: { $regex: q, $options: 'i' } },
      { category: { $regex: q, $options: 'i' } },
    ]
  }
  return match
}

export async function computeBalance(match: Record<string, unknown>) {
  const [agg] = await LedgerEntry.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        credits: { $sum: { $cond: [{ $eq: ['$direction', 'CREDIT'] }, '$amount', 0] } },
        debits: { $sum: { $cond: [{ $eq: ['$direction', 'DEBIT'] }, '$amount', 0] } },
      },
    },
  ])
  return {
    credits: agg?.credits || 0,
    debits: agg?.debits || 0,
    net: (agg?.credits || 0) - (agg?.debits || 0),
  }
}

export async function syncLedgerFull() {
  await connectDB()
  let synced = 0
  let skipped = 0
  const errors: string[] = []

  const safe = async (fn: () => Promise<void>) => {
    try {
      await fn()
      synced++
    } catch (e: unknown) {
      skipped++
      const msg = e instanceof Error ? e.message : 'sync error'
      errors.push(msg)
    }
  }

  const runSource = async (label: string, work: () => Promise<void>) => {
    try {
      await work()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${label}: ${msg}`)
    }
  }

  await runSource('Payment', async () => {
    const payments = await Payment.find({ status: 'SUCCESS' }).select('_id').lean()
    for (const p of payments) await safe(() => ledgerFromPayment(String(p._id)))
  })

  await runSource('Invoice', async () => {
    const invoices = await Invoice.find({}).select('_id').lean()
    for (const i of invoices) await safe(() => ledgerFromInvoice(String(i._id)))
  })

  await runSource('Expense', async () => {
    const expenses = await Expense.find({ isDeleted: false }).select('_id').lean()
    for (const e of expenses) await safe(() => ledgerFromExpense(String(e._id)))
  })

  await runSource('SalaryRecord', async () => {
    const salaries = await SalaryRecord.find({ isDeleted: false, status: 'PAID' }).select('_id').lean()
    for (const s of salaries) await safe(() => ledgerFromSalaryRecord(String(s._id)))
  })

  await runSource('InvestorPayout', async () => {
    const payouts = await InvestorPayout.find({ status: 'PAID' }).select('_id').lean()
    for (const p of payouts) await safe(() => ledgerFromInvestorPayout(String(p._id)))
  })

  await runSource('FineOrPenalty', async () => {
    const fines = await FineOrPenalty.find({}).select('_id').lean()
    for (const f of fines) await safe(() => ledgerFromFineOrPenalty(String(f._id)))
  })

  await runSource('Booking', async () => {
    const bookings = await Booking.find({}).select('_id').lean()
    for (const b of bookings) await safe(() => ledgerFromBookingDeposit(String(b._id)))
  })

  await runSource('MaintenanceRecord', async () => {
    const maint = await MaintenanceRecord.find({ cost: { $gt: 0 } }).select('_id').lean()
    for (const m of maint) await safe(() => ledgerFromMaintenanceRecord(String(m._id)))
  })

  try {
    await recomputeAllRunningBalances()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    errors.push(`recomputeAllRunningBalances: ${msg}`)
  }

  return { synced, skipped, errors }
}
