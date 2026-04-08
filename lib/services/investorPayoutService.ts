import connectDB from '@/lib/db'
import InvestorProfile from '@/lib/models/InvestorProfile'
import Vehicle from '@/lib/models/Vehicle'
import Booking from '@/lib/models/Booking'
import Invoice from '@/lib/models/Invoice'
import ExpenseCategory from '@/lib/models/ExpenseCategory'
import Expense from '@/lib/models/Expense'
import Payment from '@/lib/models/Payment'
import InvestorPayout from '@/lib/models/InvestorPayout'
import User from '@/lib/models/User'
import mongoose from 'mongoose'
import { startOfDay, endOfDay } from 'date-fns'
import { format } from 'date-fns'
import type { IUser } from '@/lib/models/User'
import { logger } from '@/lib/utils/performance'

const DEFAULT_COMMISSION_PERCENT = 20

export type InvestorPayoutPreview = {
  investorId: string
  investorName: string
  periodFrom: Date
  periodTo: Date
  branchId?: string
  totalRevenue: number
  commissionPercent: number
  commissionAmount: number
  netPayout: number
  breakdown: {
    vehicleId: string
    plateNumber: string
    brand: string
    model: string
    category: string
    bookingsCount: number
    revenue: number
  }[]
}

/**
 * Calculate investor payout preview without creating any records
 */
export async function calculateInvestorPayoutPreview(params: {
  investorId: string
  periodFrom: Date
  periodTo: Date
  branchId?: string
}): Promise<InvestorPayoutPreview> {
  await connectDB()

  const { investorId, periodFrom, periodTo, branchId } = params

  // Validate period
  if (periodFrom > periodTo) {
    throw new Error('Period from date must be before or equal to period to date')
  }

  // Load investor profile
  const investorProfile = await InvestorProfile.findById(investorId)
    .populate('user', 'name email')
    .lean()

  if (!investorProfile) {
    throw new Error('Investor profile not found')
  }

  const investorUser = investorProfile.user as any
  const investorName = investorUser?.name || 'Unknown Investor'

  // Find all vehicles owned by this investor
  const vehicleFilter: any = {
    ownershipType: 'INVESTOR',
    investor: investorId,
  }

  if (branchId) {
    vehicleFilter.currentBranch = branchId
  }

  const investorVehicles = await Vehicle.find(vehicleFilter)
    .select('_id plateNumber brand model category')
    .lean()

  logger.log(`[InvestorPayout] Found ${investorVehicles.length} vehicles for investor ${investorId}`)
  logger.log(`[InvestorPayout] Vehicle filter:`, vehicleFilter)

  if (investorVehicles.length === 0) {
    return {
      investorId,
      investorName,
      periodFrom,
      periodTo,
      branchId,
      totalRevenue: 0,
      commissionPercent: DEFAULT_COMMISSION_PERCENT,
      commissionAmount: 0,
      netPayout: 0,
      breakdown: [],
    }
  }

  const vehicleIds = investorVehicles.map((v) => v._id)

  // Get bookings for these vehicles in the period
  const bookings = await Booking.find({
    vehicle: { $in: vehicleIds },
    startDateTime: {
      $lte: endOfDay(periodTo),
    },
    endDateTime: {
      $gte: startOfDay(periodFrom),
    },
    status: { $in: ['CONFIRMED', 'CHECKED_OUT', 'CHECKED_IN'] },
  })
    .populate('vehicle', 'plateNumber brand model category')
    .lean()

  logger.log(`[InvestorPayout] Found ${bookings.length} bookings for period ${format(periodFrom, 'yyyy-MM-dd')} to ${format(periodTo, 'yyyy-MM-dd')}`)

  // Initialize map for all investor vehicles
  const vehicleRevenueMap = new Map<string, { bookingsCount: number; revenue: number }>()
  investorVehicles.forEach((vehicle: any) => {
    vehicleRevenueMap.set(String(vehicle._id), { bookingsCount: 0, revenue: 0 })
  })

  // Get invoices for these bookings (don't filter by issueDate, use booking dates instead)
  const bookingIds = bookings.map((b) => b._id)
  const invoices = await Invoice.find({
    booking: { $in: bookingIds },
    status: { $in: ['ISSUED', 'PAID'] },
  }).lean()

  logger.log(`[InvestorPayout] Found ${invoices.length} invoices for ${bookings.length} bookings`)

  // Create a map of booking ID to invoice total
  const invoiceMap = new Map<string, number>()
  invoices.forEach((invoice: any) => {
    const bookingId = String(invoice.booking)
    invoiceMap.set(bookingId, (invoiceMap.get(bookingId) || 0) + (invoice.total || 0))
  })

  // Calculate revenue per vehicle based on bookings
  bookings.forEach((booking: any) => {
    const vehicle = booking.vehicle as any
    const vehicleId = String(vehicle?._id || booking.vehicle)

    if (!vehicleRevenueMap.has(vehicleId)) {
      vehicleRevenueMap.set(vehicleId, { bookingsCount: 0, revenue: 0 })
    }

    const vehicleData = vehicleRevenueMap.get(vehicleId)!
    vehicleData.bookingsCount += 1

    // Use invoice total if available, otherwise use booking totalAmount
    const bookingId = String(booking._id)
    const revenue = invoiceMap.get(bookingId) || (booking.totalAmount || 0)
    vehicleData.revenue += revenue
  })

  // Build breakdown
  const breakdown = investorVehicles.map((vehicle: any) => {
    const vehicleData = vehicleRevenueMap.get(String(vehicle._id)) || {
      bookingsCount: 0,
      revenue: 0,
    }

    return {
      vehicleId: String(vehicle._id),
      plateNumber: vehicle.plateNumber,
      brand: vehicle.brand,
      model: vehicle.model,
      category: vehicle.category,
      bookingsCount: vehicleData.bookingsCount,
      revenue: vehicleData.revenue,
    }
  })

  // Calculate totals
  const totalRevenue = breakdown.reduce((sum, item) => sum + item.revenue, 0)
  // Note: InvestorProfile doesn't have commissionPercent field, using default
  const commissionPercent = DEFAULT_COMMISSION_PERCENT
  const commissionAmount = (totalRevenue * commissionPercent) / 100
  const netPayout = totalRevenue - commissionAmount

  logger.log(`[InvestorPayout] Calculated totals:`, {
    totalRevenue,
    commissionPercent,
    commissionAmount,
    netPayout,
    breakdownCount: breakdown.length,
  })

  return {
    investorId,
    investorName,
    periodFrom,
    periodTo,
    branchId,
    totalRevenue,
    commissionPercent,
    commissionAmount,
    netPayout,
    breakdown,
  }
}

/**
 * Create investor payout with automatically linked expense and optional payment
 */
export async function createInvestorPayoutWithExpenseAndPayment(
  input: {
    investorId: string
    periodFrom: Date
    periodTo: Date
    branchId?: string
    notes?: string
    createPayment?: boolean
    paymentMethod?: 'BANK_TRANSFER' | 'CASH' | 'OTHER'
  },
  currentUser: IUser
) {
  await connectDB()

  // Ensure default categories exist
  await ExpenseCategory.ensureDefaultCategories()

  // Find Investor Payouts category
  const payoutCategory = await ExpenseCategory.findOne({ code: 'INVESTOR_PAYOUTS' })
  if (!payoutCategory) {
    throw new Error('Investor Payouts category not found. Please ensure default categories are created.')
  }

  // Calculate preview
  const preview = await calculateInvestorPayoutPreview({
    investorId: input.investorId,
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
    branchId: input.branchId,
  })

  if (preview.netPayout <= 0) {
    throw new Error('Net payout must be greater than zero')
  }

  // Format period for description
  const formattedPeriod = `${format(input.periodFrom, 'MMM yyyy')} - ${format(input.periodTo, 'MMM yyyy')}`

  // Create Expense first
  const expense = await Expense.create({
    category: payoutCategory._id,
    description: `Investor Payout - ${preview.investorName} - ${formattedPeriod}`,
    amount: preview.netPayout,
    currency: 'AED',
    dateIncurred: input.periodTo, // End of period
    branchId: input.branchId,
    createdBy: currentUser._id,
    investorPayout: undefined, // Will be set after payout creation
    isDeleted: false,
  })

  // Create Payment if requested
  let paymentId: mongoose.Types.ObjectId | undefined
  if (input.createPayment) {
    const payment = await Payment.create({
      booking: undefined,
      amount: preview.netPayout,
      method: input.paymentMethod || 'BANK_TRANSFER',
      status: 'PENDING',
      transactionId: undefined,
      gatewayReference: undefined,
      paidAt: undefined,
    })
    paymentId = payment._id as mongoose.Types.ObjectId
  }

  // Create InvestorPayout
  const payout = await InvestorPayout.create({
    investor: input.investorId,
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
    branchId: input.branchId,
    totals: {
      totalRevenue: preview.totalRevenue,
      commissionPercent: preview.commissionPercent,
      commissionAmount: preview.commissionAmount,
      netPayout: preview.netPayout,
      breakdown: preview.breakdown.map((item) => ({
        vehicle: item.vehicleId,
        plateNumber: item.plateNumber,
        brand: item.brand,
        model: item.model,
        category: item.category,
        bookingsCount: item.bookingsCount,
        revenue: item.revenue,
      })),
    },
    status: input.createPayment ? 'PENDING' : 'DRAFT',
    payment: paymentId,
    expense: expense._id,
    notes: input.notes,
    createdBy: currentUser._id,
  })

  // Update expense with payout reference
  await Expense.findByIdAndUpdate(expense._id, {
    investorPayout: payout._id,
  })

  // Populate and return
  const populatedPayout = await InvestorPayout.findById(payout._id)
    .populate({
      path: 'investor',
      populate: {
        path: 'user',
        select: 'name email phone',
      },
    })
    .populate('expense', 'amount dateIncurred description')
    .populate('payment', 'amount method status transactionId paidAt')
    .populate('createdBy', 'name email')
    .lean()

  return populatedPayout
}

/**
 * Update investor payout status and linked payment/expense
 */
export async function updateInvestorPayoutStatus(
  id: string,
  updates: {
    status?: 'PENDING' | 'PAID' | 'CANCELLED'
    notes?: string
    paymentInfo?: {
      status?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED'
      transactionId?: string
      paidAt?: Date
      method?: string
    }
  },
  currentUser: IUser
) {
  await connectDB()

  const payout = await InvestorPayout.findById(id)
    .populate('investor')
    .populate('payment')
    .populate('expense')
    .lean()

  if (!payout) {
    throw new Error('Investor payout not found')
  }

  // Update payout status
  if (updates.status) {
    await InvestorPayout.findByIdAndUpdate(id, {
      status: updates.status,
    })
  }

  // Update notes
  if (updates.notes !== undefined) {
    await InvestorPayout.findByIdAndUpdate(id, {
      notes: updates.notes,
    })
  }

  // Update payment if provided
  if (updates.paymentInfo && (payout as any).payment) {
    const paymentId = (payout as any).payment._id || (payout as any).payment
    const paymentUpdates: any = {}

    if (updates.paymentInfo.status) {
      paymentUpdates.status = updates.paymentInfo.status
    }
    if (updates.paymentInfo.transactionId !== undefined) {
      paymentUpdates.transactionId = updates.paymentInfo.transactionId
    }
    if (updates.paymentInfo.paidAt !== undefined) {
      paymentUpdates.paidAt = updates.paymentInfo.paidAt
    }
    if (updates.paymentInfo.method) {
      paymentUpdates.method = updates.paymentInfo.method
    }

    if (Object.keys(paymentUpdates).length > 0) {
      await Payment.findByIdAndUpdate(paymentId, paymentUpdates)
    }
  }

  // Handle status changes
  if (updates.status === 'CANCELLED' && (payout as any).expense) {
    const expenseId = (payout as any).expense._id || (payout as any).expense
    await Expense.findByIdAndUpdate(expenseId, { isDeleted: true })
  }

  if (updates.status === 'PAID' && (payout as any).payment) {
    const paymentId = (payout as any).payment._id || (payout as any).payment
    const payment = await Payment.findById(paymentId)
    if (payment && payment.status !== 'SUCCESS') {
      await Payment.findByIdAndUpdate(paymentId, {
        status: 'SUCCESS',
        paidAt: updates.paymentInfo?.paidAt || new Date(),
      })
    }
  }

  // Return updated payout
  const updatedPayout = await InvestorPayout.findById(id)
    .populate({
      path: 'investor',
      populate: {
        path: 'user',
        select: 'name email phone',
      },
    })
    .populate('expense', 'amount dateIncurred description')
    .populate('payment', 'amount method status transactionId paidAt')
    .populate('createdBy', 'name email')
    .lean()

  return updatedPayout
}
