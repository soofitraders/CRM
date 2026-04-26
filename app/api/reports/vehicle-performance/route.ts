export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import connectDB from '@/lib/db';
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

const safeNum = (v: any) => { const n = Number(v); return isNaN(n) ? 0 : n; };
const safeDate = (v: any): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const safeStr = (v: any, fb = '') => {
  if (!v) return fb;
  if (typeof v === 'object' && !Array.isArray(v)) return String(v.name ?? v.title ?? fb);
  return String(v);
};
const f = (obj: any, ...keys: string[]) => {
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  return null;
};
const calcDays = (start: any, end: any) => {
  const s = safeDate(start); const e = safeDate(end);
  if (!s || !e) return 0;
  return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / 86400000));
};
const isDateInRange = (value: any, rangeStart: Date, rangeEnd: Date) => {
  const date = safeDate(value);
  return !!date && date >= rangeStart && date <= rangeEnd;
};
const rangesOverlap = (startA: Date, endA: Date, startB: Date, endB: Date) =>
  startA <= endB && endA >= startB;

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get('id') || searchParams.get('vehicleId') || searchParams.get('unitId');
    const period = searchParams.get('period') || 'all';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Load models
    let Vehicle: any = null;
    for (const name of ['Vehicle', 'Unit', 'Car']) {
      try { Vehicle = (await import(`@/lib/models/${name}`)).default; break; } catch { continue; }
    }
    if (!Vehicle) return NextResponse.json({ error: 'Vehicle model not found' }, { status: 500 });

    const Booking = (await import('@/lib/models/Booking')).default;

    let Invoice: any = null;
    for (const name of ['Invoice', 'Invoices', 'RentalInvoice']) {
      try { Invoice = (await import(`@/lib/models/${name}`)).default; break; } catch { continue; }
    }

    let Payment: any = null;
    try { Payment = (await import('@/lib/models/Payment')).default; } catch { /* ok */ }

    let Expense: any = null;
    try { Expense = (await import('@/lib/models/Expense')).default; } catch { /* ok */ }

    let Maintenance: any = null;
    for (const name of ['MaintenanceRecord', 'Maintenance', 'VehicleMaintenance']) {
      try { Maintenance = (await import(`@/lib/models/${name}`)).default; break; } catch { continue; }
    }

    // Date range
    const now = new Date();
    const rangeEnd = endDate ? new Date(endDate) : now;
    rangeEnd.setHours(23, 59, 59, 999);
    let rangeStart: Date;
    if (startDate) {
      rangeStart = new Date(startDate);
    } else if (period === 'all') {
      rangeStart = new Date('2000-01-01');
    } else {
      rangeStart = new Date(now.getTime() - Number(period) * 86400000);
    }

    // Get vehicles
    const vQuery = vehicleId ? { _id: new mongoose.Types.ObjectId(vehicleId) } : {};
    const vehicles = await Vehicle.find(vQuery).lean();

    const results = await Promise.all(vehicles.map(async (vehicle: any) => {
      const vId = vehicle._id;

      const vehicleName = [
        vehicle.make ?? vehicle.brand ?? '',
        vehicle.model ?? '',
        vehicle.year ?? vehicle.modelYear ?? '',
      ].filter(Boolean).join(' ') || vehicle.name || vehicle.plateNumber || 'Unknown';

      const vLink = {
        $or: [
          { vehicleId: vId }, { vehicle: vId },
          { unitId: vId }, { carId: vId },
        ],
      };

      // ── ALL TIME BOOKINGS ─────────────────────────────────────────────
      const allBookings = await Booking.find(vLink).lean();
      const allBookingIds = allBookings.map((b: any) => b._id);

      // ── PERIOD BOOKINGS ───────────────────────────────────────────────
      // Filter in memory so we can apply inclusive overlap logic across varied schemas.
      const periodBookings = allBookings.filter((booking: any) => {
        const startField = f(booking, 'startDateTime', 'startDate', 'from', 'pickupDate', 'checkIn', 'rentalStartDate');
        const endField = f(booking, 'endDateTime', 'endDate', 'to', 'returnDate', 'checkOut', 'rentalEndDate');
        const createdAt = f(booking, 'createdAt');

        const start = safeDate(startField);
        const end = safeDate(endField);
        if (start && end) {
          return rangesOverlap(start, end, rangeStart, rangeEnd);
        }

        // If one side is missing, treat booking as a point-in-time event.
        if (start) return isDateInRange(start, rangeStart, rangeEnd);
        if (end) return isDateInRange(end, rangeStart, rangeEnd);
        return isDateInRange(createdAt, rangeStart, rangeEnd);
      });

      // ── PROCESS BOOKINGS ──────────────────────────────────────────────
      const processBooking = (b: any) => {
        const startField = f(b, 'startDateTime','startDate','from','pickupDate','checkIn','rentalStartDate');
        const endField = f(b, 'endDateTime','endDate','to','returnDate','checkOut','rentalEndDate');
        const storedDays = safeNum(f(b, 'days','rentalDays','duration','numberOfDays','noOfDays'));
        const rentalDays = storedDays > 0 ? storedDays : calcDays(startField, endField);
        const dailyAmount = safeNum(f(b, 'totalAmount','amount','rentAmount','price','totalRent','totalCost'));
        const amount = dailyAmount * rentalDays;
        const paidDaily = safeNum(f(b, 'paidAmount','amountPaid','paid','paymentReceived'));
        const paidAmt = paidDaily > 0 ? paidDaily * rentalDays : 0;
        const dueAmt = Math.max(0, amount - paidAmt);
        const status = safeStr(f(b, 'status','bookingStatus','state'), 'unknown');
        const payStatus = safeStr(f(b, 'paymentStatus','invoiceStatus'), '');
        const isPaid = ['paid','completed','settled','done'].includes(payStatus.toLowerCase()) ||
                           ['paid','completed','settled','done'].includes(status.toLowerCase());
        const isPending = ['pending','partial','unpaid'].includes(payStatus.toLowerCase());
        return {
          bookingId: b._id.toString(),
          bookingNumber: safeStr(f(b, 'bookingNumber','bookingId','reference')),
          customerName: safeStr(f(b, 'customerName','clientName','guestName')),
          customerId: (f(b, 'customerId','customer','clientId') ?? '').toString(),
          startDate: startField ? new Date(startField).toISOString() : null,
          endDate: endField ? new Date(endField).toISOString() : null,
          rentalDays,
          dailyAmount,
          totalAmount: amount,
          paidAmount: isPaid ? amount : paidAmt,
          dueAmount: isPaid ? 0 : dueAmt,
          status,
          paymentStatus: payStatus,
          isPaid,
          isPending,
          isUnpaid: !isPaid && !isPending && dueAmt > 0,
        };
      };

      const allBookingDetails = allBookings.map(processBooking);
      const periodBookingDetails = periodBookings.map(processBooking);
      const useAllData = period === 'all' && !startDate && !endDate;
      const selectedBookingDetails = useAllData ? allBookingDetails : periodBookingDetails;
      const selectedBookingIdSet = new Set(selectedBookingDetails.map((b: any) => String(b.bookingId)));
      const bookingById = new Map(allBookingDetails.map((b: any) => [String(b.bookingId), b]));

      // ── BOOKING FINANCIALS ────────────────────────────────────────────
      const totalBookings = selectedBookingDetails.length;
      const totalRentalDays = selectedBookingDetails.reduce((s, b) => s + b.rentalDays, 0);
      const totalEarnings = selectedBookingDetails.reduce((s, b) => s + b.totalAmount, 0);
      const totalPaidBookings = selectedBookingDetails.reduce((s, b) => s + b.paidAmount, 0);
      const totalDueBookings = selectedBookingDetails.reduce((s, b) => s + b.dueAmount, 0);
      const paidBookings = selectedBookingDetails.filter(b => b.isPaid).length;
      const pendingBookings = selectedBookingDetails.filter(b => b.isPending || b.isUnpaid).length;
      const avgRentalDays = totalBookings > 0 ? Math.round((totalRentalDays / totalBookings) * 10) / 10 : 0;

      // ── INVOICES ──────────────────────────────────────────────────────
      let allInvoices: any[] = [];
      if (Invoice && allBookingIds.length > 0) {
        allInvoices = await Invoice.find({
          $or: [
            { vehicleId: vId }, { vehicle: vId },
            { bookingId: { $in: allBookingIds } },
            { booking: { $in: allBookingIds } },
          ],
        }).lean();
      } else if (Invoice) {
        allInvoices = await Invoice.find(vLink).lean();
      }

      const processInvoice = (inv: any) => {
        const total = safeNum(f(inv, 'totalAmount','amount','grandTotal','total','invoiceAmount','netAmount','rentAmount'));
        const paid = safeNum(f(inv, 'paidAmount','amountPaid','paid','paymentReceived','amountReceived'));
        const due = safeNum(f(inv, 'dueAmount','amountDue','outstanding','balance','pendingAmount')) || Math.max(0, total - paid);
        const status = safeStr(f(inv, 'status','paymentStatus','invoiceStatus'), 'pending').toLowerCase();
        const isPaid = ['paid','completed','settled','closed','done','received'].includes(status);
        const isOverdue = ['overdue','late','past_due','pastdue','expired'].includes(status);
        const isPending = ['pending','unpaid','open','outstanding'].includes(status) || (!isPaid && !isOverdue);
        const startF = f(inv, 'startDate','from','rentalStart','checkIn','pickupDate');
        const endF = f(inv, 'endDate','to','rentalEnd','checkOut','returnDate');
        const days = safeNum(f(inv, 'days','rentalDays','duration','numberOfDays')) || calcDays(startF, endF);
        return {
          invoiceId: inv._id.toString(),
          invoiceNumber: safeStr(f(inv, 'invoiceNumber','invoiceNo','number','reference','code')),
          bookingId: (f(inv, 'bookingId','booking') ?? '').toString(),
          customerName: safeStr(f(inv, 'customerName','clientName','guestName')),
          status,
          isPaid, isOverdue, isPending,
          totalAmount: total,
          paidAmount: isPaid ? total : paid,
          dueAmount: isPaid ? 0 : due,
          rentalDays: days,
          startDate: startF ? new Date(startF).toISOString() : null,
          endDate: endF ? new Date(endF).toISOString() : null,
          issueDate: safeDate(f(inv, 'date','issueDate','invoiceDate','createdAt'))?.toISOString(),
          dueDate: safeDate(f(inv, 'dueDate','paymentDue','expiryDate'))?.toISOString(),
        };
      };

      const processedInvoices = allInvoices.map(processInvoice);
      const selectedInvoices = useAllData
        ? processedInvoices
        : processedInvoices.filter((invoice) =>
            selectedBookingIdSet.has(String(invoice.bookingId)) ||
            isDateInRange(invoice.issueDate, rangeStart, rangeEnd) ||
            isDateInRange(invoice.startDate, rangeStart, rangeEnd) ||
            isDateInRange(invoice.endDate, rangeStart, rangeEnd)
          );

      // Invoice aggregates
      const totalInvoiced = selectedInvoices.reduce((s, i) => s + i.totalAmount, 0);
      const totalInvPaid = selectedInvoices.reduce((s, i) => s + i.paidAmount, 0);
      const totalInvDue = selectedInvoices.reduce((s, i) => s + i.dueAmount, 0);
      const paidInvCount = selectedInvoices.filter(i => i.isPaid).length;
      const pendingInvCount = selectedInvoices.filter(i => i.isPending).length;
      const overdueInvCount = selectedInvoices.filter(i => i.isOverdue).length;

      // ── PAYMENTS ──────────────────────────────────────────────────────
      let allPayments: any[] = [];
      if (Payment) {
        allPayments = await Payment.find({
          $or: [
            { vehicleId: vId }, { vehicle: vId },
            ...(allBookingIds.length > 0 ? [
              { bookingId: { $in: allBookingIds } },
              { booking: { $in: allBookingIds } },
            ] : []),
          ],
        }).lean();
      }

      const processPayment = (p: any) => {
        const bookingId = (f(p, 'bookingId','booking') ?? '').toString();
        const booking = bookingById.get(bookingId);
        return {
        paymentId: p._id.toString(),
        amount: safeNum(f(p, 'amount','totalAmount','paidAmount','receivedAmount')),
        date: safeDate(f(p, 'date','paymentDate','paidAt','createdAt'))?.toISOString(),
        method: safeStr(f(p, 'paymentMethod','method','type','mode'), 'Cash'),
        bookingId,
        startDate: booking?.startDate ?? null,
        endDate: booking?.endDate ?? null,
        rentalDays: booking?.rentalDays ?? 0,
        status: safeStr(f(p, 'status','paymentStatus'), 'completed'),
        type: safeStr(f(p, 'type','paymentType'), 'payment'),
        };
      };

      const processedPayments = allPayments.map(processPayment);
      const selectedPayments = useAllData
        ? processedPayments
        : processedPayments.filter((payment) =>
            selectedBookingIdSet.has(String(payment.bookingId)) ||
            isDateInRange(payment.date, rangeStart, rangeEnd) ||
            isDateInRange(payment.startDate, rangeStart, rangeEnd) ||
            isDateInRange(payment.endDate, rangeStart, rangeEnd)
          );
      const totalPayments = selectedPayments.reduce((s, p) => s + p.amount, 0);

      // Classify payments
      const paidPayments = selectedPayments.filter(p => ['paid','completed','received','settled'].includes(p.status.toLowerCase()));
      const pendingPayments = selectedPayments.filter(p => ['pending','unpaid','partial'].includes(p.status.toLowerCase()));
      const paidPayAmt = paidPayments.reduce((s, p) => s + p.amount, 0);
      const pendingPayAmt = pendingPayments.reduce((s, p) => s + p.amount, 0);

      // ── EXPENSES ──────────────────────────────────────────────────────
      let allExpenses: any[] = [];
      if (Expense) {
        allExpenses = await Expense.find(vLink).lean();
      }
      const selectedExpenses = useAllData
        ? allExpenses
        : allExpenses.filter((expense: any) =>
            isDateInRange(
              f(expense, 'date', 'expenseDate', 'transactionDate', 'createdAt', 'invoiceDate'),
              rangeStart,
              rangeEnd
            )
          );
      const totalExpenses = selectedExpenses.reduce(
        (s, e: any) => s + safeNum(f(e, 'amount','totalAmount','cost','price')), 0
      );

      // ── MAINTENANCE ───────────────────────────────────────────────────
      let allMaintenance: any[] = [];
      if (Maintenance) {
        allMaintenance = await Maintenance.find(vLink).lean();
      }
      const selectedMaintenance = useAllData
        ? allMaintenance
        : allMaintenance.filter((maintenance: any) =>
            isDateInRange(
              f(maintenance, 'date', 'serviceDate', 'completedAt', 'createdAt', 'maintenanceDate'),
              rangeStart,
              rangeEnd
            )
          );
      const totalMaintenance = selectedMaintenance.reduce(
        (s, m: any) => s + safeNum(f(m, 'cost','amount','totalCost','price','laborCost')), 0
      );

      // ── FINAL CALCULATIONS ────────────────────────────────────────────
      // Revenue = prefer invoice total, fallback to payments, fallback to booking amounts
      const totalRevenue = totalInvoiced > 0 ? totalInvoiced
                         : totalPayments > 0 ? totalPayments
                         : totalEarnings;

      const totalReceived = totalInvPaid > 0 ? totalInvPaid : paidPayAmt;
      const totalOutstanding = totalInvDue > 0 ? totalInvDue : pendingPayAmt;
      const totalCosts = totalExpenses + totalMaintenance;
      const netProfit = totalRevenue - totalCosts;
      const revenuePerDay = totalRentalDays > 0 ? Math.round((totalRevenue / totalRentalDays) * 100) / 100 : 0;

      const periodDays = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / 86400000));
      const periodRentalDays = periodBookingDetails.reduce((s, b) => s + b.rentalDays, 0);
      const utilizationPct = Math.min(100, Math.round((periodRentalDays / periodDays) * 100));

      return {
        // ── Vehicle Info ──────────────────────────────────────────────
        vehicleId: vId.toString(),
        vehicleName,
        plateNumber: vehicle.plateNumber ?? vehicle.plate ?? vehicle.registrationNumber ?? '',
        make: vehicle.make ?? vehicle.brand ?? '',
        model: vehicle.model ?? '',
        year: vehicle.year ?? vehicle.modelYear ?? '',
        color: vehicle.color ?? vehicle.colour ?? '',
        status: vehicle.status ?? vehicle.vehicleStatus ?? 'unknown',
        image: vehicle.image ?? vehicle.imageUrl ?? vehicle.photo ?? '',

        // ── Booking Summary ───────────────────────────────────────────
        bookings: {
          total: totalBookings,
          paid: paidBookings,
          pending: pendingBookings,
          totalRentalDays,
          avgRentalDays,
          totalEarnings: Math.round(totalEarnings * 100) / 100,
          totalPaid: Math.round(totalPaidBookings * 100) / 100,
          totalDue: Math.round(totalDueBookings * 100) / 100,
          list: selectedBookingDetails,
        },

        // ── Invoice Summary ───────────────────────────────────────────
        invoices: {
          total: selectedInvoices.length,
          paidCount: paidInvCount,
          pendingCount: pendingInvCount,
          overdueCount: overdueInvCount,
          totalInvoiced: Math.round(totalInvoiced * 100) / 100,
          totalPaid: Math.round(totalInvPaid * 100) / 100,
          totalDue: Math.round(totalInvDue * 100) / 100,
          list: selectedInvoices,
        },

        // ── Payment Summary ───────────────────────────────────────────
        payments: {
          total: selectedPayments.length,
          paid: paidPayments.length,
          pending: pendingPayments.length,
          totalAmount: Math.round(totalPayments * 100) / 100,
          paidAmount: Math.round(paidPayAmt * 100) / 100,
          pendingAmount: Math.round(pendingPayAmt * 100) / 100,
          list: selectedPayments,
        },

        // ── Financial Summary ─────────────────────────────────────────
        financial: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalReceived: Math.round(totalReceived * 100) / 100,
          totalOutstanding: Math.round(totalOutstanding * 100) / 100,
          totalExpenses: Math.round(totalExpenses * 100) / 100,
          totalMaintenance: Math.round(totalMaintenance * 100) / 100,
          totalCosts: Math.round(totalCosts * 100) / 100,
          netProfit: Math.round(netProfit * 100) / 100,
          revenuePerDay: Math.round(revenuePerDay * 100) / 100,
        },

        // ── Period Stats ──────────────────────────────────────────────
        period: {
          start: rangeStart.toISOString(),
          end: rangeEnd.toISOString(),
          days: periodDays,
          totalBookings: periodBookings.length,
          totalRentalDays: periodRentalDays,
          utilizationPercent: utilizationPct,
          totalRevenue: Math.round(periodBookingDetails.reduce((s,b)=>s+b.totalAmount,0)*100)/100,
          totalPaid: Math.round(periodBookingDetails.reduce((s,b)=>s+b.paidAmount, 0)*100)/100,
          totalDue: Math.round(periodBookingDetails.reduce((s,b)=>s+b.dueAmount, 0)*100)/100,
        },

        currency: 'AED',
      };
    }));

    return NextResponse.json(
      vehicleId && results.length === 1
        ? { vehicle: results[0] }
        : { vehicles: results }
    );

  } catch (error) {
    console.error('[Vehicle Performance API]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

