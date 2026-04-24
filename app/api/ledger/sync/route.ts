import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import connectDB from '@/lib/db';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import LedgerEntry from '@/lib/models/LedgerEntry';

// ─── SAFE HELPERS ─────────────────────────────────────────────────────────
const n = (v: any) => { const x = Number(v); return isNaN(x) ? 0 : x; };
const d = (v: any) => { if (!v) return new Date(); const x = new Date(v); return isNaN(x.getTime()) ? new Date() : x; };
const s = (v: any, fb = '') => {
  if (!v) return fb;
  if (typeof v === 'object' && !Array.isArray(v)) return String(v.name ?? v.title ?? v.label ?? fb);
  return String(v);
};
const f = (obj: any, ...keys: string[]) => {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  return null;
};

// ─── DROP BAD INDEXES ─────────────────────────────────────────────────────
async function fixIndexes() {
  try {
    const col = mongoose.connection.collection('ledgerentries');
    const indexes = await col.indexes();
    for (const idx of indexes) {
      if (idx.unique && (idx as any).key?.referenceModel && (idx as any).key?.referenceId && (idx as any).key?.entryType) {
        await col.dropIndex(idx.name as string).catch(() => {});
        console.log('[SYNC] Dropped bad unique index:', idx.name);
      }
    }
    await col.createIndex(
      { referenceModel: 1, referenceId: 1, entryType: 1 },
      { unique: false, background: true }
    ).catch(() => {});
  } catch (e) { console.log('[SYNC] Index fix warning:', e); }
}

// ─── REMOVE DUPLICATE ENTRIES ─────────────────────────────────────────────
async function removeDuplicates() {
  try {
    const col = mongoose.connection.collection('ledgerentries');
    const all = await col.find({}).sort({ createdAt: 1 }).toArray();
    const seen = new Map<string, any>();
    const toDelete: any[] = [];
    for (const doc of all) {
      const key = [
        doc.referenceModel, doc.referenceId?.toString(),
        doc.entryType, doc.amount,
        new Date(doc.date as any).toISOString().split('T')[0],
      ].join('|');
      if (seen.has(key)) toDelete.push(doc._id);
      else seen.set(key, doc._id);
    }
    if (toDelete.length > 0) {
      await col.deleteMany({ _id: { $in: toDelete } });
      console.log(`[SYNC] Removed ${toDelete.length} duplicates`);
    }
    return toDelete.length;
  } catch (e) { console.log('[SYNC] Duplicate removal warning:', e); return 0; }
}

// ─── UPSERT HELPER ────────────────────────────────────────────────────────
async function upsert(refModel: string, refId: any, type: string, data: Record<string, any>) {
  try {
    const dateObj = d(data.date);
    const dayStart = new Date(dateObj); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateObj); dayEnd.setHours(23, 59, 59, 999);
    const existing = await LedgerEntry.findOne({
      referenceModel: refModel,
      referenceId: refId,
      entryType: type,
      amount: data.amount,
      date: { $gte: dayStart, $lte: dayEnd },
    });
    if (existing) {
      await LedgerEntry.findByIdAndUpdate(existing._id, {
        $set: { ...data, referenceModel: refModel, referenceId: refId, entryType: type, currency: 'AED', isVoided: false },
      });
    } else {
      await LedgerEntry.create({
        ...data, referenceModel: refModel, referenceId: refId, entryType: type, currency: 'AED', isVoided: false,
      });
    }
    return true;
  } catch (e: any) {
    if (e?.code !== 11000) console.error(`[SYNC] Upsert error ${refModel}:`, e?.message);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    // Fix indexes and duplicates first
    await fixIndexes();
    const removedDups = await removeDuplicates();

    // ── FIX EXISTING WRONG DIRECTION ENTRIES ──────────────────────────────
    // DEBIT: ONLY fines and expenses
    await LedgerEntry.updateMany(
      { entryType: { $in: [
        'FINE_COLLECTED', 'FINE_PAID', 'FINE',
        'EXPENSE_PAID', 'RECURRING_EXPENSE', 'VEHICLE_MAINTENANCE',
        'FUEL_EXPENSE', 'INSURANCE_PREMIUM', 'REGISTRATION_FEE',
        'VENDOR_PAYMENT', 'MISCELLANEOUS_OUT', 'BANK_WITHDRAWAL',
        'LOAN_REPAYMENT',
      ]}},
      { $set: { direction: 'DEBIT' } }
    );

    // CREDIT: Everything else
    await LedgerEntry.updateMany(
      { entryType: { $in: [
        'BOOKING_PAYMENT', 'PARTIAL_PAYMENT', 'ADVANCE_PAYMENT',
        'SECURITY_DEPOSIT', 'SECURITY_DEPOSIT_REFUND', 'LATE_FEE',
        'DAMAGE_CHARGE', 'SALARY_PAID', 'INVESTOR_PAYOUT',
        'INVESTOR_CAPITAL_IN', 'BANK_DEPOSIT', 'BANK_TRANSFER_IN',
        'LOAN_RECEIVED', 'MISCELLANEOUS_IN', 'INSURANCE_CLAIM',
        'INVOICE_PAYMENT', 'INVOICE_PARTIAL', 'INVOICE_RECEIVABLE',
      ]}},
      { $set: { direction: 'CREDIT' } }
    );

    // Fix PKR → AED
    await LedgerEntry.updateMany({ currency: 'PKR' }, { $set: { currency: 'AED' } });
    console.log('[SYNC] Direction and currency corrections applied');

    let synced = 0, skipped = 0;
    const errors: string[] = [];

    const track = async (refModel: string, refId: any, type: string, data: Record<string, any>) => {
      const ok = await upsert(refModel, refId, type, data);
      if (ok) synced++; else skipped++;
    };

    // ══════════════════════════════════════════════════════════════════════
    // 1. EXPENSES → DEBIT
    // Rule: All expenses are DEBIT
    // ══════════════════════════════════════════════════════════════════════
    try {
      const Expense = (await import('@/lib/models/Expense')).default;
      const docs = await Expense.find({}).lean();
      console.log(`[SYNC] Expenses: ${docs.length}`);
      for (const doc of docs) {
        const amount = n(f(doc, 'amount', 'totalAmount', 'cost', 'price'));
        const date = d(f(doc, 'date', 'expenseDate', 'paidDate', 'createdAt'));
        const desc = s(f(doc, 'description', 'title', 'name'), 'Expense');
        const rawCat = f(doc, 'category', 'expenseCategory', 'categoryName', 'type');
        const cat = s(rawCat, 'General Expense');
        const vehicle = f(doc, 'vehicleId', 'vehicle', 'unitId');
        const method = s(f(doc, 'paymentMethod', 'paidVia', 'method'), 'Cash');
        await track('Expense', (doc as any)._id, 'EXPENSE_PAID', {
          date,
          direction: 'DEBIT', // ← ALWAYS DEBIT
          amount,
          description: desc,
          category: cat,
          accountLabel: method,
          accountType: method.toLowerCase().includes('bank') ? 'BANK' : 'CASH',
          vehicleId: vehicle ?? undefined,
          note: s(f(doc, 'notes', 'note', 'remarks')),
          isReconciled: false,
        });
      }
    } catch (e) { errors.push(`Expense: ${e}`); }

    // ══════════════════════════════════════════════════════════════════════
    // 2. FINES → DEBIT
    // Rule: ALL fines (whether paid by customer or business) are DEBIT
    // ══════════════════════════════════════════════════════════════════════
    try {
      let FineModel: any = null;
      for (const name of ['FineOrPenalty', 'Fine', 'Penalty', 'Fines']) {
        try { FineModel = (await import(`@/lib/models/${name}`)).default; break; } catch { continue; }
      }
      if (FineModel) {
        const docs = await FineModel.find({}).lean();
        console.log(`[SYNC] Fines: ${docs.length}`);
        for (const doc of docs) {
          const amount = n(f(doc, 'amount', 'fineAmount', 'penaltyAmount', 'cost'));
          if (amount <= 0) continue;
          const date = d(f(doc, 'date', 'issuedDate', 'fineDate', 'createdAt'));
          const desc = s(f(doc, 'description', 'reason', 'type', 'title'), 'Fine');
          const vehicle = f(doc, 'vehicleId', 'vehicle', 'unitId');
          const customer = f(doc, 'customerId', 'customer', 'clientId');
          await track('FineOrPenalty', (doc as any)._id, 'FINE_PAID', {
            date,
            direction: 'DEBIT', // ← ALL FINES ARE DEBIT
            amount,
            description: `Fine: ${desc}`,
            category: 'Fine',
            accountLabel: 'Cash',
            accountType: 'CASH',
            vehicleId: vehicle ?? undefined,
            customerId: customer ?? undefined,
            note: s(f(doc, 'notes', 'note')),
            isReconciled: false,
          });
        }
      }
    } catch (e) { errors.push(`Fines: ${e}`); }

    // ══════════════════════════════════════════════════════════════════════
    // 3. RECURRING EXPENSES → DEBIT
    // ══════════════════════════════════════════════════════════════════════
    try {
      let RecModel: any = null;
      for (const name of ['RecurringExpense', 'Recurring', 'RecurringCost']) {
        try { RecModel = (await import(`@/lib/models/${name}`)).default; break; } catch { continue; }
      }
      if (RecModel) {
        const docs = await RecModel.find({}).lean();
        console.log(`[SYNC] Recurring expenses: ${docs.length}`);
        for (const doc of docs) {
          const amount = n(f(doc, 'amount', 'cost', 'totalAmount'));
          if (amount <= 0) continue;
          const date = d(f(doc, 'lastProcessed', 'lastPaidDate', 'processedAt', 'createdAt'));
          const desc = s(f(doc, 'description', 'title', 'name'), 'Recurring Expense');
          const cat = s(f(doc, 'category', 'expenseCategory', 'type'), 'Recurring Expense');
          await track('RecurringExpense', (doc as any)._id, 'RECURRING_EXPENSE', {
            date,
            direction: 'DEBIT', // ← DEBIT
            amount,
            description: desc,
            category: cat,
            accountLabel: 'Cash',
            accountType: 'CASH',
            isReconciled: false,
          });
        }
      }
    } catch (e) { errors.push(`RecurringExpense: ${e}`); }

    // ══════════════════════════════════════════════════════════════════════
    // 4. MAINTENANCE → DEBIT
    // ══════════════════════════════════════════════════════════════════════
    try {
      let MaintModel: any = null;
      for (const name of ['MaintenanceRecord', 'Maintenance', 'VehicleMaintenance']) {
        try { MaintModel = (await import(`@/lib/models/${name}`)).default; break; } catch { continue; }
      }
      if (MaintModel) {
        const docs = await MaintModel.find({}).lean();
        console.log(`[SYNC] Maintenance: ${docs.length}`);
        for (const doc of docs) {
          const amount = n(f(doc, 'cost', 'amount', 'totalCost', 'price', 'laborCost'));
          if (amount <= 0) continue;
          const date = d(f(doc, 'date', 'completedDate', 'scheduledDate', 'serviceDate', 'createdAt'));
          const desc = s(f(doc, 'description', 'type', 'serviceType', 'maintenanceType', 'title'), 'Maintenance');
          const vehicle = f(doc, 'vehicleId', 'vehicle', 'unitId', 'carId');
          await track('MaintenanceRecord', (doc as any)._id, 'VEHICLE_MAINTENANCE', {
            date,
            direction: 'DEBIT', // ← DEBIT
            amount,
            description: `Maintenance: ${desc}`,
            category: 'Vehicle Maintenance',
            accountLabel: 'Cash',
            accountType: 'CASH',
            vehicleId: vehicle ?? undefined,
            isReconciled: false,
          });
        }
      }
    } catch (e) { errors.push(`Maintenance: ${e}`); }

    // ══════════════════════════════════════════════════════════════════════
    // 5. PAYMENTS → CREDIT
    // ══════════════════════════════════════════════════════════════════════
    try {
      const Payment = (await import('@/lib/models/Payment')).default;
      const docs = await Payment.find({}).lean();
      console.log(`[SYNC] Payments: ${docs.length}`);
      for (const doc of docs) {
        const amount = n(f(doc, 'amount', 'totalAmount', 'paidAmount'));
        const date = d(f(doc, 'date', 'paymentDate', 'paidAt', 'createdAt'));
        const method = s(f(doc, 'paymentMethod', 'method', 'type'), 'Cash');
        const bookingId = f(doc, 'bookingId', 'booking');
        const customerId = f(doc, 'customerId', 'customer', 'clientId');
        const typeStr = s(f(doc, 'type', 'paymentType')).toLowerCase();
        const isDeposit = typeStr.includes('deposit');
        const entryType = isDeposit ? 'SECURITY_DEPOSIT' : 'BOOKING_PAYMENT';
        await track('Payment', (doc as any)._id, entryType, {
          date,
          direction: 'CREDIT', // ← ALWAYS CREDIT
          amount,
          description: isDeposit ? 'Security deposit received' : 'Booking payment received',
          category: isDeposit ? 'Security Deposit' : 'Booking Payment',
          accountLabel: method,
          accountType: method.toLowerCase().includes('bank') ? 'BANK' : 'CASH',
          bookingId: bookingId ?? undefined,
          customerId: customerId ?? undefined,
          note: s(f(doc, 'notes', 'note', 'remarks')),
          isReconciled: false,
        });
      }
    } catch (e) { errors.push(`Payment: ${e}`); }

    // ══════════════════════════════════════════════════════════════════════
    // 6. INVOICES → CREDIT (including partial payments and receivables)
    // Rule: ALL invoice-related entries are CREDIT
    // ══════════════════════════════════════════════════════════════════════
    try {
      let InvoiceModel: any = null;
      for (const name of ['Invoice', 'Invoices', 'RentalInvoice']) {
        try { InvoiceModel = (await import(`@/lib/models/${name}`)).default; break; } catch { continue; }
      }
      if (InvoiceModel) {
        const docs = await InvoiceModel.find({}).lean();
        console.log(`[SYNC] Invoices: ${docs.length}`);
        for (const doc of docs) {
          const totalAmount = n(f(doc, 'totalAmount', 'amount', 'grandTotal', 'total',
                                     'invoiceAmount', 'netAmount', 'subtotal', 'rentAmount'));
          const paidAmount = n(f(doc, 'paidAmount', 'amountPaid', 'paid', 'paymentReceived', 'amountReceived'));
          const dueAmount = Math.max(0, totalAmount - paidAmount);
          const date = d(f(doc, 'date', 'invoiceDate', 'issueDate', 'createdAt'));
          const invoiceNum = s(f(doc, 'invoiceNumber', 'invoiceNo', 'number', 'reference'), 'Invoice');
          const customer = f(doc, 'customerId', 'customer', 'clientId');
          const booking = f(doc, 'bookingId', 'booking');
          const vehicle = f(doc, 'vehicleId', 'vehicle', 'unitId');
          const status = s(f(doc, 'status', 'paymentStatus', 'invoiceStatus'), 'pending');

          // ── Full invoice amount → CREDIT ─────────────────────────────
          if (totalAmount > 0) {
            await track('Invoice', (doc as any)._id, 'BOOKING_PAYMENT', {
              date,
              direction: 'CREDIT', // ← ALWAYS CREDIT
              amount: totalAmount,
              description: `Invoice #${invoiceNum} — Total`,
              category: 'Invoice',
              accountLabel: 'Cash',
              accountType: 'CASH',
              customerId: customer ?? undefined,
              bookingId: booking ?? undefined,
              vehicleId: vehicle ?? undefined,
              note: `Status: ${status}`,
              isReconciled: ['paid','completed','settled'].includes(status.toLowerCase()),
            });
          }

          // ── Partial payment (if paid < total) → CREDIT ────────────────
          if (paidAmount > 0 && paidAmount < totalAmount) {
            await track('Invoice', (doc as any)._id, 'PARTIAL_PAYMENT', {
              date,
              direction: 'CREDIT', // ← CREDIT
              amount: paidAmount,
              description: `Invoice #${invoiceNum} — Partial Payment`,
              category: 'Partial Payment',
              accountLabel: 'Cash',
              accountType: 'CASH',
              customerId: customer ?? undefined,
              bookingId: booking ?? undefined,
              vehicleId: vehicle ?? undefined,
              note: `Paid: AED ${paidAmount}, Due: AED ${dueAmount}`,
              isReconciled: false,
            });
          }

          // ── Receivable (unpaid amount) → CREDIT ───────────────────────
          if (dueAmount > 0) {
            await track('Invoice', (doc as any)._id, 'INVOICE_RECEIVABLE', {
              date,
              direction: 'CREDIT', // ← CREDIT (receivable = money owed TO business)
              amount: dueAmount,
              description: `Invoice #${invoiceNum} — Receivable`,
              category: 'Receivable',
              accountLabel: 'Receivable',
              accountType: 'OTHER',
              customerId: customer ?? undefined,
              bookingId: booking ?? undefined,
              vehicleId: vehicle ?? undefined,
              note: `Outstanding: AED ${dueAmount} of AED ${totalAmount}`,
              isReconciled: false,
            });
          }
        }
      }
    } catch (e) { errors.push(`Invoice: ${e}`); console.error('[SYNC] Invoice error:', e); }

    // ══════════════════════════════════════════════════════════════════════
    // 7. SALARIES → CREDIT
    // ══════════════════════════════════════════════════════════════════════
    try {
      let SalaryModel: any = null;
      for (const name of ['SalaryRecord', 'Salary', 'SalaryPayment']) {
        try { SalaryModel = (await import(`@/lib/models/${name}`)).default; break; } catch { continue; }
      }
      if (SalaryModel) {
        const docs = await SalaryModel.find({}).lean();
        console.log(`[SYNC] Salaries: ${docs.length}`);
        for (const doc of docs) {
          const amount = n(f(doc, 'amount', 'netSalary', 'salary', 'totalAmount', 'paidAmount'));
          const date = d(f(doc, 'date', 'paymentDate', 'paidDate', 'month', 'salaryMonth', 'createdAt'));
          const ename = s(f(doc, 'employeeName', 'staffName', 'name', 'userName'));
          const userId = f(doc, 'userId', 'employeeId', 'staffId', 'user');
          await track('SalaryRecord', (doc as any)._id, 'SALARY_PAID', {
            date,
            direction: 'CREDIT', // ← CREDIT
            amount,
            description: `Salary${ename ? ' — ' + ename : ''}`,
            category: 'Salary',
            accountLabel: 'Cash',
            accountType: 'CASH',
            userId: userId ?? undefined,
            isReconciled: false,
          });
        }
      }
    } catch (e) { errors.push(`Salary: ${e}`); }

    // ══════════════════════════════════════════════════════════════════════
    // 8. INVESTOR PAYOUTS → CREDIT
    // ══════════════════════════════════════════════════════════════════════
    try {
      let PayoutModel: any = null;
      for (const name of ['InvestorPayout', 'Payout', 'InvestorPayment']) {
        try { PayoutModel = (await import(`@/lib/models/${name}`)).default; break; } catch { continue; }
      }
      if (PayoutModel) {
        const docs = await PayoutModel.find({}).lean();
        console.log(`[SYNC] Investor payouts: ${docs.length}`);
        for (const doc of docs) {
          const amount = n(f(doc, 'amount', 'payoutAmount', 'totalAmount'));
          const date = d(f(doc, 'date', 'payoutDate', 'paidDate', 'createdAt'));
          const iname = s(f(doc, 'investorName', 'name'));
          await track('InvestorPayout', (doc as any)._id, 'INVESTOR_PAYOUT', {
            date,
            direction: 'CREDIT', // ← CREDIT
            amount,
            description: `Investor payout${iname ? ' — ' + iname : ''}`,
            category: 'Investor Payout',
            accountLabel: 'Cash',
            accountType: 'CASH',
            isReconciled: false,
          });
        }
      }
    } catch (e) { errors.push(`InvestorPayout: ${e}`); }

    // ══════════════════════════════════════════════════════════════════════
    // 9. BOOKING DEPOSITS → CREDIT
    // ══════════════════════════════════════════════════════════════════════
    try {
      const Booking = (await import('@/lib/models/Booking')).default;
      const docs = await Booking.find({
        $or: [{ depositAmount: { $gt: 0 } }, { securityDeposit: { $gt: 0 } }, { deposit: { $gt: 0 } }],
      }).lean();
      console.log(`[SYNC] Booking deposits: ${docs.length}`);
      for (const doc of docs) {
        const deposit = n(f(doc, 'depositAmount', 'securityDeposit', 'deposit'));
        if (deposit <= 0) continue;
        const date = d(f(doc, 'startDate', 'bookingDate', 'createdAt'));
        const bookingNum = s(f(doc, 'bookingNumber', 'bookingId', '_id'));
        const customer = f(doc, 'customerId', 'customer', 'clientId');
        const vehicle = f(doc, 'vehicleId', 'vehicle', 'unitId', 'carId');
        await track('Booking', (doc as any)._id, 'SECURITY_DEPOSIT', {
          date,
          direction: 'CREDIT', // ← CREDIT
          amount: deposit,
          description: `Security deposit — Booking #${bookingNum}`,
          category: 'Security Deposit',
          accountLabel: 'Cash',
          accountType: 'CASH',
          bookingId: (doc as any)._id,
          customerId: customer ?? undefined,
          vehicleId: vehicle ?? undefined,
          isReconciled: false,
        });
      }
    } catch (e) { errors.push(`Booking deposits: ${e}`); }

    // ══════════════════════════════════════════════════════════════════════
    // RECOMPUTE RUNNING BALANCE
    // ══════════════════════════════════════════════════════════════════════
    try {
      const all = await LedgerEntry.find({ isVoided: { $ne: true } })
        .sort({ date: 1, createdAt: 1 }).select('_id direction amount').lean();
      let balance = 0;
      const ops = all.map((e: any) => {
        balance += e.direction === 'CREDIT' ? n(e.amount) : -n(e.amount);
        return {
          updateOne: {
            filter: { _id: e._id },
            update: { $set: { runningBalance: Math.round(balance * 100) / 100 } },
          },
        };
      });
      if (ops.length > 0) await LedgerEntry.bulkWrite(ops, { ordered: false });
      console.log(`[SYNC] Running balance updated for ${ops.length} entries`);
    } catch (e) { errors.push(`Balance recompute: ${e}`); }

    const totalInDB = await LedgerEntry.countDocuments();

    return NextResponse.json({
      success: true,
      synced,
      skipped,
      totalInDB,
      removedDuplicates: removedDups,
      errors: errors.slice(0, 15),
    });

  } catch (error) {
    console.error('[SYNC] Fatal:', error);
    return NextResponse.json({ error: 'Sync failed', details: String(error) }, { status: 500 });
  }
}
