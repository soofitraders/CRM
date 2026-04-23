export const dynamic = 'force-dynamic'

import mongoose from 'mongoose'
import { getServerSession } from 'next-auth'
import { NextRequest, NextResponse } from 'next/server'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import Booking from '@/lib/models/Booking'
import Expense from '@/lib/models/Expense'
import FineOrPenalty from '@/lib/models/FineOrPenalty'
import Invoice from '@/lib/models/Invoice'
import MaintenanceRecord from '@/lib/models/MaintenanceRecord'
import Payment from '@/lib/models/Payment'
import Vehicle from '@/lib/models/Vehicle'

const safeNum = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const safeDate = (v: unknown): Date | null => {
  if (!v) return null
  const d = new Date(v as any)
  return Number.isNaN(d.getTime()) ? null : d
}

const safeStr = (v: unknown, fb = ''): string => {
  if (v == null) return fb
  return String(v)
}

const calcDays = (start: unknown, end: unknown): number => {
  const s = safeDate(start)
  const e = safeDate(end)
  if (!s || !e) return 0
  return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / 86400000))
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'MANAGER'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const { searchParams } = new URL(request.url)
    const vehicleId = searchParams.get('id') || searchParams.get('vehicleId') || searchParams.get('unitId')
    const startDate = searchParams.get('startDate') || searchParams.get('dateFrom')
    const endDate = searchParams.get('endDate') || searchParams.get('dateTo')
    const period = searchParams.get('period') || '30'
    const isDetail = Boolean(vehicleId)

    const now = new Date()
    const rangeEnd = endDate ? new Date(endDate) : now
    const rangeStart = startDate
      ? new Date(startDate)
      : new Date(now.getTime() - safeNum(period) * 86400000)
    rangeEnd.setHours(23, 59, 59, 999)
    rangeStart.setHours(0, 0, 0, 0)

    const periodDays = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1)
    const vehicleQuery = vehicleId ? { _id: new mongoose.Types.ObjectId(vehicleId) } : {}
    const vehicles = await Vehicle.find(vehicleQuery).lean()

    if (!vehicles.length) {
      return NextResponse.json(isDetail ? { vehicle: null, message: 'Vehicle not found' } : { vehicles: [], periodDays })
    }

    const results = await Promise.all(
      vehicles.map(async (vehicle: any) => {
        const vId = vehicle._id

        const allTimeBookings = await Booking.find({ vehicle: vId }).sort({ startDateTime: -1 }).lean()
        const periodBookings = allTimeBookings.filter((b: any) => {
          const start = safeDate(b.startDateTime)
          if (!start) return false
          return start >= rangeStart && start <= rangeEnd
        })

        const allTimeBookingIds = allTimeBookings.map((b: any) => b._id)
        const periodBookingIdSet = new Set(periodBookings.map((b: any) => String(b._id)))

        const allInvoices = allTimeBookingIds.length
          ? await Invoice.find({ booking: { $in: allTimeBookingIds } }).sort({ issueDate: -1 }).lean()
          : []
        const periodInvoices = allInvoices.filter((inv: any) => periodBookingIdSet.has(String(inv.booking)))

        const processInvoice = (inv: any) => {
          const total = safeNum(inv.total)
          const statusRaw = safeStr(inv.status, 'DRAFT')
          const status = statusRaw.toLowerCase()
          const isPaid = statusRaw === 'PAID'
          const isDraft = statusRaw === 'DRAFT'
          const dueDate = safeDate(inv.dueDate)
          const isOverdue = statusRaw === 'ISSUED' && !!dueDate && dueDate.getTime() < Date.now()
          const isPending = statusRaw === 'ISSUED'
          const startDateTime = safeDate(inv.rentalStartDate) ?? null
          const endDateTime = safeDate(inv.rentalEndDate) ?? null

          return {
            invoiceId: String(inv._id),
            invoiceNumber: safeStr(inv.invoiceNumber, String(inv._id).slice(-6).toUpperCase()),
            bookingId: inv.booking ? String(inv.booking) : '',
            status,
            isPaid,
            isOverdue,
            isDraft,
            isPending,
            totalAmount: total,
            paidAmount: isPaid ? total : 0,
            dueAmount: isPaid ? 0 : total,
            rentalDays: calcDays(startDateTime, endDateTime),
            startDate: startDateTime?.toISOString() ?? null,
            endDate: endDateTime?.toISOString() ?? null,
            issueDate: safeDate(inv.issueDate)?.toISOString() ?? null,
            dueDate: dueDate?.toISOString() ?? null,
          }
        }

        const processedAllInvoices = allInvoices.map(processInvoice)
        const processedPeriodInvoices = periodInvoices.map(processInvoice)

        const summarizeInvoices = (items: ReturnType<typeof processInvoice>[]) => ({
          count: items.length,
          totalInvoiced: items.reduce((sum, item) => sum + item.totalAmount, 0),
          totalPaid: items.reduce((sum, item) => sum + item.paidAmount, 0),
          totalDue: items.reduce((sum, item) => sum + item.dueAmount, 0),
          paidCount: items.filter((item) => item.isPaid).length,
          pendingCount: items.filter((item) => item.isPending).length,
          overdueCount: items.filter((item) => item.isOverdue).length,
          draftCount: items.filter((item) => item.isDraft).length,
          totalRentalDays: items.reduce((sum, item) => sum + item.rentalDays, 0),
        })

        const allInvoiceSummary = summarizeInvoices(processedAllInvoices)
        const periodInvoiceSummary = summarizeInvoices(processedPeriodInvoices)

        const allPayments = allTimeBookingIds.length
          ? await Payment.find({ booking: { $in: allTimeBookingIds } }).sort({ paidAt: -1 }).lean()
          : []
        const periodPayments = allPayments.filter((pay: any) => periodBookingIdSet.has(String(pay.booking)))

        const processPayment = (pay: any) => ({
          paymentId: String(pay._id),
          amount: safeNum(pay.amount),
          date: safeDate(pay.paidAt ?? pay.createdAt)?.toISOString() ?? null,
          method: safeStr(pay.method, 'CASH'),
          bookingId: pay.booking ? String(pay.booking) : '',
          status: safeStr(pay.status, 'SUCCESS').toLowerCase(),
        })

        const processedAllPayments = allPayments.map(processPayment)
        const processedPeriodPayments = periodPayments.map(processPayment)

        const allExpenses = await Expense.find({ vehicle: vId, isDeleted: false }).sort({ dateIncurred: -1 }).lean()
        const periodExpenses = allExpenses.filter((exp: any) => {
          const d = safeDate(exp.dateIncurred)
          return !!d && d >= rangeStart && d <= rangeEnd
        })

        const processExpense = (exp: any) => ({
          expenseId: String(exp._id),
          amount: safeNum(exp.amount),
          description: safeStr(exp.description, 'Expense'),
          category: safeStr(exp.category, 'General'),
          date: safeDate(exp.dateIncurred)?.toISOString() ?? null,
        })

        const processedAllExpenses = allExpenses.map(processExpense)
        const processedPeriodExpenses = periodExpenses.map(processExpense)

        const allMaintenance = await MaintenanceRecord.find({ vehicle: vId }).lean()
        const maintenanceTotal = allMaintenance.reduce((sum: number, item: any) => sum + safeNum(item.cost), 0)

        const allFines = await FineOrPenalty.find({ vehicle: vId }).lean()
        const finesTotal = allFines.reduce((sum: number, item: any) => sum + safeNum(item.amount), 0)

        const processBooking = (booking: any) => {
          const start = safeDate(booking.startDateTime)
          const end = safeDate(booking.endDateTime)
          return {
            bookingId: String(booking._id),
            bookingNumber: safeStr(booking.bookingNumber ?? booking.reference, String(booking._id).slice(-6).toUpperCase()),
            customerName: safeStr((booking.customer as any)?.name ?? ''),
            customerId: booking.customer ? String(booking.customer) : '',
            startDate: start?.toISOString() ?? null,
            endDate: end?.toISOString() ?? null,
            rentalDays: calcDays(start, end),
            amount: safeNum(booking.totalAmount),
            status: safeStr(booking.status, 'PENDING').toLowerCase(),
            paymentStatus: safeStr(booking.paymentStatus, 'UNPAID').toLowerCase(),
          }
        }

        const allBookingDetails = allTimeBookings.map(processBooking)
        const periodBookingDetails = periodBookings.map(processBooking)
        const allTimeRentalDays = allBookingDetails.reduce((sum, booking) => sum + booking.rentalDays, 0)
        const periodRentalDays = periodBookingDetails.reduce((sum, booking) => sum + booking.rentalDays, 0)

        const allPaymentRevenue = processedAllPayments
          .filter((payment) => payment.status === 'success')
          .reduce((sum, payment) => sum + payment.amount, 0)
        const periodPaymentRevenue = processedPeriodPayments
          .filter((payment) => payment.status === 'success')
          .reduce((sum, payment) => sum + payment.amount, 0)

        const revenueAllTime = allInvoiceSummary.totalInvoiced > 0
          ? allInvoiceSummary.totalInvoiced
          : allPaymentRevenue > 0
            ? allPaymentRevenue
            : allBookingDetails.reduce((sum, booking) => sum + booking.amount, 0)
        const revenuePeriod = periodInvoiceSummary.totalInvoiced > 0
          ? periodInvoiceSummary.totalInvoiced
          : periodPaymentRevenue > 0
            ? periodPaymentRevenue
            : periodBookingDetails.reduce((sum, booking) => sum + booking.amount, 0)

        const expensesAllTime = processedAllExpenses.reduce((sum, expense) => sum + expense.amount, 0)
        const expensesPeriod = processedPeriodExpenses.reduce((sum, expense) => sum + expense.amount, 0)
        const totalCostsAllTime = expensesAllTime + maintenanceTotal + finesTotal
        const netProfitAllTime = revenueAllTime - totalCostsAllTime
        const utilizationPercent = Math.min(100, Math.round((periodRentalDays / periodDays) * 100))
        const revenuePerDay = allTimeRentalDays > 0 ? revenueAllTime / allTimeRentalDays : 0
        const avgBookingDays = allTimeBookings.length > 0 ? allTimeRentalDays / allTimeBookings.length : 0

        return {
          vehicleId: String(vId),
          vehicleName: `${safeStr(vehicle.brand)} ${safeStr(vehicle.model)} ${safeStr(vehicle.year)}`.trim(),
          plateNumber: safeStr(vehicle.plateNumber),
          make: safeStr(vehicle.brand),
          model: safeStr(vehicle.model),
          year: safeStr(vehicle.year),
          color: safeStr(vehicle.color),
          status: safeStr(vehicle.status, 'UNKNOWN').toLowerCase(),
          type: safeStr(vehicle.category),
          fuelType: safeStr(vehicle.fuelType),
          transmission: safeStr(vehicle.transmission),
          image: '',
          allTime: {
            totalBookings: allTimeBookings.length,
            totalRentalDays: allTimeRentalDays,
            avgBookingDays: Math.round(avgBookingDays * 10) / 10,
            bookingDetails: allBookingDetails,
            invoices: { ...allInvoiceSummary, list: processedAllInvoices },
            payments: {
              count: processedAllPayments.length,
              total: Math.round(allPaymentRevenue * 100) / 100,
              list: processedAllPayments,
            },
            expenses: {
              count: processedAllExpenses.length,
              total: Math.round(expensesAllTime * 100) / 100,
              list: processedAllExpenses,
            },
            maintenance: {
              count: allMaintenance.length,
              total: Math.round(maintenanceTotal * 100) / 100,
            },
            fines: {
              count: allFines.length,
              total: Math.round(finesTotal * 100) / 100,
            },
            totalRevenue: Math.round(revenueAllTime * 100) / 100,
            totalReceived: Math.round(allInvoiceSummary.totalPaid * 100) / 100,
            totalOutstanding: Math.round(allInvoiceSummary.totalDue * 100) / 100,
            totalCosts: Math.round(totalCostsAllTime * 100) / 100,
            netProfit: Math.round(netProfitAllTime * 100) / 100,
            revenuePerDay: Math.round(revenuePerDay * 100) / 100,
          },
          period: {
            start: rangeStart.toISOString(),
            end: rangeEnd.toISOString(),
            days: periodDays,
            totalBookings: periodBookings.length,
            totalRentalDays: periodRentalDays,
            utilizationPercent,
            bookingDetails: periodBookingDetails,
            invoices: { ...periodInvoiceSummary, list: processedPeriodInvoices },
            totalRevenue: Math.round(revenuePeriod * 100) / 100,
            totalExpenses: Math.round(expensesPeriod * 100) / 100,
            netProfit: Math.round((revenuePeriod - expensesPeriod) * 100) / 100,
          },
          currency: 'AED',
        }
      })
    )

    return NextResponse.json(isDetail && results.length === 1 ? { vehicle: results[0] } : { vehicles: results, periodDays })
  } catch (error) {
    console.error('[Vehicle Performance API]', error)
    return NextResponse.json(
      { error: 'Failed to load performance data', details: String(error) },
      { status: 500 }
    )
  }
}

