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

    // ── PURGE SYSTEM-GENERATED EXPENSE/INVOICE ROWS ────────────────────────
    // Per business rule:
    // - Debits (expenses) should ONLY appear if added via Manual Entry form.
    // - Credits should ONLY appear for payments that are actually paid/success.
    //
    // So we remove:
    // - any DEBIT rows that are not manual
    // - invoice receivables / partials / invoice totals (unpaid/pending should not show)
    // - any non-payment credits (salary, investor payouts, deposits, etc.)
    await LedgerEntry.deleteMany({
      isVoided: { $ne: true },
      $or: [
        // Keep only manual debits
        { direction: 'DEBIT', referenceModel: { $nin: ['ManualExpense'] } },

        // Remove invoice-related rows
        { entryType: { $in: ['INVOICE_RECEIVABLE', 'INVOICE_PARTIAL', 'INVOICE_PAYMENT', 'PARTIAL_PAYMENT'] } },
        { referenceModel: 'Invoice' },

        // Remove other system credits so ledger credits only represent paid payments (but keep manual income)
        {
          direction: 'CREDIT',
          referenceModel: { $nin: ['ManualIncome'] },
          entryType: { $nin: ['BOOKING_PAYMENT', 'SECURITY_DEPOSIT'] },
        },
      ],
    });

    let synced = 0, skipped = 0;
    const errors: string[] = [];

    const track = async (refModel: string, refId: any, type: string, data: Record<string, any>) => {
      const ok = await upsert(refModel, refId, type, data);
      if (ok) synced++; else skipped++;
    };

    // ══════════════════════════════════════════════════════════════════════
    // 5. PAYMENTS → CREDIT
    // Rule: ONLY include payments that are actually PAID/SUCCESS in system.
    // ══════════════════════════════════════════════════════════════════════
    try {
      const Payment = (await import('@/lib/models/Payment')).default;
      const docs = await Payment.find({ status: 'SUCCESS' }).lean();
      console.log(`[SYNC] Payments (SUCCESS only): ${docs.length}`);
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
          isReconciled: true,
        });
      }
    } catch (e) { errors.push(`Payment: ${e}`); }
    
    // ══════════════════════════════════════════════════════════════════════
    // 6. PAID INVOICES → CREDIT
    // Rule: show ONLY invoices that are PAID (no receivables, no partials).
    // ══════════════════════════════════════════════════════════════════════
    try {
      const Invoice = (await import('@/lib/models/Invoice')).default;
      const docs = await Invoice.find({ status: 'PAID' }).lean();
      console.log(`[SYNC] Invoices (PAID only): ${docs.length}`);
      for (const doc of docs) {
        const amount = n(f(doc, 'total', 'totalAmount', 'grandTotal', 'invoiceAmount', 'netAmount'));
        if (amount <= 0) continue;
        const date = d(f(doc, 'updatedAt', 'paidAt', 'issueDate', 'createdAt'));
        const invoiceNum = s(f(doc, 'invoiceNumber', 'invoiceNo', 'number', 'reference'), 'Invoice');
        const bookingId = f(doc, 'booking');
        const method = String(f(doc, 'transactionMethod') || 'CASH').toUpperCase();
        const accountLabel = method === 'BANK_TRANSFER' ? 'Bank Transfer' : 'Cash';
        const accountType = method === 'BANK_TRANSFER' ? 'BANK' : 'CASH';
        await track('Invoice', (doc as any)._id, 'INVOICE_PAYMENT', {
          date,
          direction: 'CREDIT',
          amount,
          description: `Invoice ${invoiceNum} — Paid`,
          category: 'Invoice Payment',
          accountLabel,
          accountType,
          bookingId: bookingId ?? undefined,
          isReconciled: true,
        });
      }
    } catch (e) { errors.push(`Invoice(PAID): ${e}`); }
    
    // NOTE: We intentionally do NOT sync expenses/fines/maintenance/salaries/receivables here
    // because the ledger view should only show:
    // - manual debits (from Manual Entry form)
    // - successful paid payments (credits)
    // - paid invoices (credits)

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
