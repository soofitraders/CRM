import connectDB from '@/lib/db'
import Booking from '@/lib/models/Booking'
import Invoice from '@/lib/models/Invoice'
import Payment from '@/lib/models/Payment'
import Vehicle from '@/lib/models/Vehicle'
import InvestorProfile from '@/lib/models/InvestorProfile'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays } from 'date-fns'

interface RevenueOverviewParams {
  dateFrom: Date
  dateTo: Date
  branchId?: string
  vehicleCategory?: string
  customerType?: 'INDIVIDUAL' | 'CORPORATE'
  groupBy?: 'day' | 'week' | 'month'
}

interface RevenueOverviewResult {
  summary: {
    grossRentalRevenue: number
    discounts: number
    taxCollected: number
    netRentalRevenue: number
    totalBookings: number
    averageBookingValue: number
  }
  byPeriod: Array<{
    period: string
    grossRevenue: number
    discounts: number
    tax: number
    netRevenue: number
    bookings: number
  }>
  byBranch: Array<{
    branch: string
    revenue: number
    bookings: number
  }>
  byOwnership: Array<{
    ownershipType: 'COMPANY' | 'INVESTOR'
    revenue: number
    bookings: number
  }>
}

interface AccountsReceivableParams {
  dateAsOf: Date
  branchId?: string
}

interface AccountsReceivableResult {
  total: number
  buckets: {
    '0-30': number
    '31-60': number
    '61-90': number
    '90+': number
  }
  invoices: Array<{
    invoiceNumber: string
    customerName: string
    issueDate: Date
    dueDate: Date
    total: number
    paidAmount: number
    balance: number
    daysOverdue: number
    bucket: string
  }>
}

interface InvestorPayoutParams {
  dateFrom: Date
  dateTo: Date
  commissionPercent?: number
  investorId?: string
}

interface InvestorPayoutResult {
  investors: Array<{
    investorId: string
    investorName: string
    revenue: number
    commissionPercent: number
    commission: number
    netAmount: number
    bookings: number
  }>
  summary: {
    totalRevenue: number
    totalCommission: number
    totalPayout: number
    investorCount: number
  }
}

interface UtilizationParams {
  dateFrom: Date
  dateTo: Date
  branchId?: string
  vehicleCategory?: string
}

interface UtilizationResult {
  vehicles: Array<{
    vehicleId: string
    plateNumber: string
    brand: string
    model: string
    category: string
    ownershipType: string
    daysAvailable: number
    daysRented: number
    utilizationPercent: number
    revenue: number
    revenuePerDay: number
  }>
  byCategory: Array<{
    category: string
    totalVehicles: number
    avgUtilization: number
    totalRevenue: number
  }>
}

/**
 * Get revenue overview report
 */
export async function getRevenueOverview(
  params: RevenueOverviewParams
): Promise<RevenueOverviewResult> {
  await connectDB()

  const { dateFrom, dateTo, branchId, vehicleCategory, customerType, groupBy = 'day' } = params

  // Build filter for bookings
  const bookingFilter: any = {
    startDateTime: {
      $gte: startOfDay(dateFrom),
      $lte: endOfDay(dateTo),
    },
    status: { $in: ['CONFIRMED', 'CHECKED_OUT', 'CHECKED_IN'] },
  }

  if (branchId) {
    bookingFilter.pickupBranch = branchId
  }

  // Aggregate revenue from invoices (more accurate than bookings)
  const invoiceFilter: any = {
    issueDate: {
      $gte: startOfDay(dateFrom),
      $lte: endOfDay(dateTo),
    },
    status: { $in: ['ISSUED', 'PAID'] },
  }

  // Get invoices with booking, vehicle, and customer data
  const invoices = await Invoice.find(invoiceFilter)
    .populate({
      path: 'booking',
      select: 'pickupBranch vehicle customer',
      populate: [
        {
          path: 'vehicle',
          select: 'ownershipType currentBranch category',
        },
        {
          path: 'customer',
          select: 'user',
          populate: {
            path: 'user',
            select: 'name role',
          },
        },
      ],
    })
    .lean()

  // Apply additional filters after populate
  let filteredInvoices = invoices

  if (vehicleCategory) {
    filteredInvoices = filteredInvoices.filter(
      (inv: any) => inv.booking?.vehicle?.category === vehicleCategory
    )
  }

  if (customerType) {
    // For now, we'll use role as customer type indicator
    // Individual = CUSTOMER role, Corporate = other roles or specific flag
    filteredInvoices = filteredInvoices.filter((inv: any) => {
      const userRole = inv.booking?.customer?.user?.role
      if (customerType === 'INDIVIDUAL') {
        return userRole === 'CUSTOMER'
      } else if (customerType === 'CORPORATE') {
        return userRole !== 'CUSTOMER'
      }
      return true
    })
  }

  // Helper function to identify fines in invoice items
  const getFinesAmount = (items: any[]): number => {
    if (!items || !Array.isArray(items)) return 0
    return items
      .filter(item => {
        const label = (item.label || '').toLowerCase()
        return item.amount > 0 && (
          label.includes('fine') || 
          label.includes('penalty') || 
          label.includes('government') ||
          label.includes('traffic')
        )
      })
      .reduce((sum, item) => sum + item.amount, 0)
  }

  // Calculate summary metrics
  let grossRentalRevenue = 0
  let discounts = 0
  let taxCollected = 0
  let netRentalRevenue = 0
  let totalFines = 0

  filteredInvoices.forEach((invoice: any) => {
    const items = invoice.items || []
    const finesAmount = getFinesAmount(items)
    totalFines += finesAmount
    
    items.forEach((item: { label: string; amount: number }) => {
      if (item.amount < 0) {
        discounts += Math.abs(item.amount)
      } else {
        // Exclude fines from gross rental revenue (they're expenses)
        const label = (item.label || '').toLowerCase()
        const isFine = item.amount > 0 && (
          label.includes('fine') || 
          label.includes('penalty') || 
          label.includes('government') ||
          label.includes('traffic')
        )
        if (!isFine) {
          grossRentalRevenue += item.amount
        }
      }
    })
    taxCollected += invoice.taxAmount || 0
    // Net revenue excludes fines (they're pass-through costs)
    netRentalRevenue += (invoice.total || 0) - finesAmount
  })

  // Group by period
  const byPeriodMap = new Map<string, any>()

  filteredInvoices.forEach((invoice: any) => {
    const date = new Date(invoice.issueDate)
    let periodKey: string

    if (groupBy === 'day') {
      periodKey = date.toISOString().split('T')[0]
    } else if (groupBy === 'week') {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 })
      periodKey = weekStart.toISOString().split('T')[0]
    } else {
      const monthStart = startOfMonth(date)
      periodKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`
    }

    if (!byPeriodMap.has(periodKey)) {
      byPeriodMap.set(periodKey, {
        period: periodKey,
        grossRevenue: 0,
        discounts: 0,
        tax: 0,
        netRevenue: 0,
        bookings: 0,
      })
    }

    const period = byPeriodMap.get(periodKey)!
    const items = invoice.items || []
    items.forEach((item: { amount: number }) => {
      if (item.amount < 0) {
        period.discounts += Math.abs(item.amount)
      } else {
        period.grossRevenue += item.amount
      }
    })
    period.tax += invoice.taxAmount || 0
    period.netRevenue += invoice.total || 0
    period.bookings += 1
  })

  const byPeriod = Array.from(byPeriodMap.values()).sort((a, b) =>
    a.period.localeCompare(b.period)
  )

  // Group by branch
  const byBranchMap = new Map<string, any>()

  filteredInvoices.forEach((invoice: any) => {
    const branch = invoice.booking?.pickupBranch || 'Unknown'
    if (!byBranchMap.has(branch)) {
      byBranchMap.set(branch, { branch, revenue: 0, bookings: 0 })
    }
    const branchData = byBranchMap.get(branch)!
    branchData.revenue += invoice.total || 0
    branchData.bookings += 1
  })

  const byBranch = Array.from(byBranchMap.values()).sort((a, b) => b.revenue - a.revenue)

  // Group by ownership type
  const byOwnershipMap = new Map<string, any>()

  filteredInvoices.forEach((invoice: any) => {
    const ownershipType = invoice.booking?.vehicle?.ownershipType || 'COMPANY'
    if (!byOwnershipMap.has(ownershipType)) {
      byOwnershipMap.set(ownershipType, { ownershipType, revenue: 0, bookings: 0 })
    }
    const ownershipData = byOwnershipMap.get(ownershipType)!
    ownershipData.revenue += invoice.total || 0
    ownershipData.bookings += 1
  })

  const byOwnership = Array.from(byOwnershipMap.values())

  const totalBookings = filteredInvoices.length
  const averageBookingValue = totalBookings > 0 ? netRentalRevenue / totalBookings : 0

  return {
    summary: {
      grossRentalRevenue,
      discounts,
      taxCollected,
      netRentalRevenue,
      totalBookings,
      averageBookingValue,
    },
    byPeriod,
    byBranch,
    byOwnership,
  }
}

/**
 * Get accounts receivable report
 */
export async function getAccountsReceivable(
  params: AccountsReceivableParams
): Promise<AccountsReceivableResult> {
  await connectDB()

  const { dateAsOf, branchId } = params

  // Build invoice filter
  const invoiceFilter: any = {
    status: { $in: ['ISSUED', 'DRAFT'] },
    dueDate: { $lte: dateAsOf },
  }

  // Find all unpaid or partially paid invoices
  const invoices = await Invoice.find(invoiceFilter)
    .populate({
      path: 'booking',
      select: 'customer pickupBranch',
      populate: {
        path: 'customer',
        select: 'user',
        populate: {
          path: 'user',
          select: 'name',
        },
      },
    })
    .lean()

  // Filter by branch if provided (after populate)
  const filteredInvoices = branchId
    ? invoices.filter((inv: any) => inv.booking?.pickupBranch === branchId)
    : invoices

  // Get payments for these invoices
  const invoiceIds = filteredInvoices.map((inv: any) => inv._id)
  const bookings = filteredInvoices.map((inv: any) => inv.booking?._id).filter(Boolean)
  const payments = await Payment.find({
    booking: { $in: bookings },
    status: 'SUCCESS',
  }).lean()

  // Calculate paid amounts per booking
  const paidByBooking = new Map<string, number>()
  payments.forEach((payment: any) => {
    const bookingId = String(payment.booking)
    paidByBooking.set(bookingId, (paidByBooking.get(bookingId) || 0) + (payment.amount || 0))
  })

  const buckets = {
    '0-30': 0,
    '31-60': 0,
    '61-90': 0,
    '90+': 0,
  }

  let total = 0
  const invoiceList: AccountsReceivableResult['invoices'] = []

  filteredInvoices.forEach((invoice: any) => {
    const bookingId = String(invoice.booking?._id)
    const paidAmount = paidByBooking.get(bookingId) || 0
    const balance = (invoice.total || 0) - paidAmount

    if (balance <= 0) return // Skip fully paid

    const daysOverdue = differenceInDays(dateAsOf, new Date(invoice.dueDate))
    let bucket: string

    if (daysOverdue <= 30) {
      bucket = '0-30'
      buckets['0-30'] += balance
    } else if (daysOverdue <= 60) {
      bucket = '31-60'
      buckets['31-60'] += balance
    } else if (daysOverdue <= 90) {
      bucket = '61-90'
      buckets['61-90'] += balance
    } else {
      bucket = '90+'
      buckets['90+'] += balance
    }

    total += balance

    invoiceList.push({
      invoiceNumber: invoice.invoiceNumber || 'N/A',
      customerName: invoice.booking?.customer?.user?.name || 'N/A',
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      total: invoice.total || 0,
      paidAmount,
      balance,
      daysOverdue,
      bucket,
    })
  })

  return {
    total,
    buckets,
    invoices: invoiceList.sort((a, b) => b.daysOverdue - a.daysOverdue),
  }
}

/**
 * Get investor payout summary
 */
export async function getInvestorPayoutSummary(
  params: InvestorPayoutParams
): Promise<InvestorPayoutResult> {
  await connectDB()

  const { dateFrom, dateTo, commissionPercent = 20, investorId } = params

  // Build vehicle filter
  const vehicleFilter: any = {
    ownershipType: 'INVESTOR',
    investor: { $exists: true },
  }

  if (investorId) {
    vehicleFilter.investor = investorId
  }

  // Get all investor-owned vehicles
  const investorVehicles = await Vehicle.find(vehicleFilter)
    .populate({
      path: 'investor',
      select: 'user',
      populate: {
        path: 'user',
        select: 'name',
      },
    })
    .lean()

  // Get bookings for these vehicles in the date range
  const vehicleIds = investorVehicles.map((v: any) => v._id)
  const bookings = await Booking.find({
    vehicle: { $in: vehicleIds },
    startDateTime: {
      $gte: startOfDay(dateFrom),
      $lte: endOfDay(dateTo),
    },
    status: { $in: ['CONFIRMED', 'CHECKED_OUT', 'CHECKED_IN'] },
  })
    .populate('vehicle', 'investor')
    .lean()

  // Get invoices for these bookings
  const bookingIds = bookings.map((b: any) => b._id)
  const invoices = await Invoice.find({
    booking: { $in: bookingIds },
    status: { $in: ['ISSUED', 'PAID'] },
  }).lean()

  // Group revenue by investor
  const investorMap = new Map<string, any>()

  invoices.forEach((invoice: any) => {
    const booking = bookings.find((b: any) => String(b._id) === String(invoice.booking))
    if (!booking) return

    const vehicle = booking.vehicle as any
    const investorId = String(vehicle?.investor || '')
    if (!investorId) return

    if (!investorMap.has(investorId)) {
      const investorProfile = investorVehicles.find(
        (v: any) => String(v.investor?._id) === investorId
      )
      investorMap.set(investorId, {
        investorId,
        investorName:
          (investorProfile?.investor as any)?.user?.name || 'Unknown',
        revenue: 0,
        commissionPercent,
        commission: 0,
        netAmount: 0,
        bookings: 0,
      })
    }

    const investor = investorMap.get(investorId)!
    investor.revenue += invoice.total || 0
    investor.bookings += 1
  })

  // Calculate commission and net amount
  const investors = Array.from(investorMap.values()).map((inv) => {
    inv.commission = (inv.revenue * inv.commissionPercent) / 100
    inv.netAmount = inv.revenue - inv.commission
    return inv
  })

  const summary = {
    totalRevenue: investors.reduce((sum, inv) => sum + inv.revenue, 0),
    totalCommission: investors.reduce((sum, inv) => sum + inv.commission, 0),
    totalPayout: investors.reduce((sum, inv) => sum + inv.netAmount, 0),
    investorCount: investors.length,
  }

  return {
    investors: investors.sort((a, b) => b.revenue - a.revenue),
    summary,
  }
}

/**
 * Get utilization and yield report
 */
export async function getUtilizationReport(
  params: UtilizationParams
): Promise<UtilizationResult> {
  await connectDB()

  const { dateFrom, dateTo, branchId, vehicleCategory } = params

  const periodDays = differenceInDays(dateTo, dateFrom) + 1

  // Build vehicle filter
  const vehicleFilter: any = {}
  if (branchId) {
    vehicleFilter.currentBranch = branchId
  }
  if (vehicleCategory) {
    vehicleFilter.category = vehicleCategory
  }

  const vehicles = await Vehicle.find(vehicleFilter).lean()

  // Get bookings for these vehicles
  const vehicleIds = vehicles.map((v: any) => v._id)
  const bookings = await Booking.find({
    vehicle: { $in: vehicleIds },
    startDateTime: { $lte: endOfDay(dateTo) },
    endDateTime: { $gte: startOfDay(dateFrom) },
    status: { $in: ['CONFIRMED', 'CHECKED_OUT', 'CHECKED_IN'] },
  })
    .populate('vehicle', 'plateNumber brand model category ownershipType')
    .lean()

  // Get invoices for revenue calculation
  const bookingIds = bookings.map((b: any) => b._id)
  const invoices = await Invoice.find({
    booking: { $in: bookingIds },
    status: { $in: ['ISSUED', 'PAID'] },
  }).lean()

  // Calculate utilization per vehicle
  const vehicleUtilization: UtilizationResult['vehicles'] = []

  vehicles.forEach((vehicle: any) => {
    const vehicleBookings = bookings.filter(
      (b: any) => String(b.vehicle?._id || b.vehicle) === String(vehicle._id)
    )

    // Calculate days rented (overlapping bookings count as one day)
    const rentedDays = new Set<string>()
    vehicleBookings.forEach((booking: any) => {
      const start = new Date(Math.max(new Date(booking.startDateTime).getTime(), dateFrom.getTime()))
      const end = new Date(
        Math.min(new Date(booking.endDateTime).getTime(), dateTo.getTime())
      )

      let current = new Date(start)
      while (current <= end) {
        rentedDays.add(current.toISOString().split('T')[0])
        current.setDate(current.getDate() + 1)
      }
    })

    const daysRented = rentedDays.size
    const daysAvailable = periodDays - daysRented
    const utilizationPercent = periodDays > 0 ? (daysRented / periodDays) * 100 : 0

    // Calculate revenue for this vehicle
    const vehicleInvoices = invoices.filter((inv: any) => {
      const booking = vehicleBookings.find((b: any) => String(b._id) === String(inv.booking))
      return !!booking
    })

    const revenue = vehicleInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0)
    const revenuePerDay = daysRented > 0 ? revenue / daysRented : 0

    vehicleUtilization.push({
      vehicleId: String(vehicle._id),
      plateNumber: vehicle.plateNumber,
      brand: vehicle.brand,
      model: vehicle.model,
      category: vehicle.category,
      ownershipType: vehicle.ownershipType,
      daysAvailable,
      daysRented,
      utilizationPercent: Math.round(utilizationPercent * 100) / 100,
      revenue,
      revenuePerDay: Math.round(revenuePerDay * 100) / 100,
    })
  })

  // Group by category
  const categoryMap = new Map<string, any>()

  vehicleUtilization.forEach((v) => {
    if (!categoryMap.has(v.category)) {
      categoryMap.set(v.category, {
        category: v.category,
        totalVehicles: 0,
        totalUtilization: 0,
        totalRevenue: 0,
      })
    }

    const cat = categoryMap.get(v.category)!
    cat.totalVehicles += 1
    cat.totalUtilization += v.utilizationPercent
    cat.totalRevenue += v.revenue
  })

  const byCategory = Array.from(categoryMap.values()).map((cat) => ({
    category: cat.category,
    totalVehicles: cat.totalVehicles,
    avgUtilization: Math.round((cat.totalUtilization / cat.totalVehicles) * 100) / 100,
    totalRevenue: cat.totalRevenue,
  }))

  return {
    vehicles: vehicleUtilization.sort((a, b) => b.utilizationPercent - a.utilizationPercent),
    byCategory: byCategory.sort((a, b) => b.avgUtilization - a.avgUtilization),
  }
}

