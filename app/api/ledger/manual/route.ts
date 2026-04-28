import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import connectDB from '@/lib/db';
import { NextResponse } from 'next/server';
import LedgerEntry from '@/lib/models/LedgerEntry';

async function recomputeBalance() {
  const all = await LedgerEntry.find({ isVoided: { $ne: true } })
    .sort({ date: 1, createdAt: 1 })
    .select('_id direction amount')
    .lean();
  let balance = 0;
  const ops = all.map((e: any) => {
    balance += e.direction === 'CREDIT' ? Number(e.amount ?? 0) : -Number(e.amount ?? 0);
    return {
      updateOne: {
        filter: { _id: e._id },
        update: { $set: { runningBalance: Math.round(balance * 100) / 100 } },
      },
    };
  });
  if (ops.length > 0) await LedgerEntry.bulkWrite(ops, { ordered: false });
  return Math.round(balance * 100) / 100;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const body = await request.json();
    const { date, entryType, direction, amount, description, category, accountLabel, note, vehicleId } = body;

    if (!date) return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    if (!entryType) return NextResponse.json({ error: 'Entry type is required' }, { status: 400 });
    if (!direction) return NextResponse.json({ error: 'Direction is required' }, { status: 400 });
    if (!amount || Number(amount) <= 0)
      return NextResponse.json({ error: 'Valid amount required' }, { status: 400 });
    if (!description?.trim())
      return NextResponse.json({ error: 'Description required' }, { status: 400 });

    // ── ENFORCE DIRECTION RULES ────────────────────────────────────────────
    // Fines and expenses MUST be DEBIT regardless of what was sent
    const debitTypes = [
      'EXPENSE_PAID', 'RECURRING_EXPENSE', 'VEHICLE_MAINTENANCE',
      'FUEL_EXPENSE', 'INSURANCE_PREMIUM', 'REGISTRATION_FEE',
      'VENDOR_PAYMENT', 'MISCELLANEOUS_OUT', 'BANK_WITHDRAWAL',
      'LOAN_REPAYMENT', 'FINE_PAID', 'FINE_COLLECTED', 'FINE',
    ];
    const enforcedDirection = debitTypes.includes(entryType) ? 'DEBIT' : direction;

    const numAmount = Math.round(Number(amount) * 100) / 100;
    const entryDate = new Date(date);

    // ── IF DEBIT EXPENSE → ALSO SAVE TO EXPENSE COLLECTION ────────────────
    let expenseId: any = null;
    if (enforcedDirection === 'DEBIT') {
      try {
        const Expense = (await import('@/lib/models/Expense')).default;
        const exp = await Expense.create({
          amount: numAmount,
          totalAmount: numAmount,
          description: description.trim(),
          title: description.trim(),
          date: entryDate,
          expenseDate: entryDate,
          category: category || entryType.replace(/_/g, ' '),
          expenseCategory: category || entryType.replace(/_/g, ' '),
          paymentMethod: accountLabel || 'Cash',
          note: note || '',
          source: 'manual_ledger',
          ...(vehicleId ? { vehicleId, vehicle: vehicleId } : {}),
        });
        expenseId = exp._id;
        console.log('[MANUAL] Expense saved:', expenseId);
      } catch (e) {
        console.warn('[MANUAL] Could not save to Expense collection:', e);
      }
    }

    // ── CREATE LEDGER ENTRY ────────────────────────────────────────────────
    const entry = await LedgerEntry.create({
      date: entryDate,
      entryType,
      direction: enforcedDirection, // use enforced direction
      amount: numAmount,
      currency: 'AED',
      description: description.trim(),
      category: category || entryType.replace(/_/g, ' '),
      accountLabel: accountLabel || 'Cash',
      accountType: String(accountLabel || '').toLowerCase().includes('bank') ? 'BANK' : 'CASH',
      note: note || '',
      // Always tag manual rows as manual so we can keep them even if we purge/sync system-generated rows.
      referenceModel: enforcedDirection === 'DEBIT' ? 'ManualExpense' : 'ManualIncome',
      referenceId: expenseId ?? undefined,
      isVoided: false,
      isReconciled: false,
      ...(vehicleId ? { vehicleId } : {}),
    });

    const newBalance = await recomputeBalance();

    return NextResponse.json({
      success: true,
      ledgerEntry: entry,
      expenseId,
      newBalance,
      direction: enforcedDirection,
      message: enforcedDirection === 'DEBIT'
        ? `Expense of AED ${numAmount} recorded as Debit`
        : `Income of AED ${numAmount} recorded as Credit`,
    });

  } catch (error) {
    console.error('[POST /api/ledger/manual]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
