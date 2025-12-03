import connectDB from '@/lib/db'
import InvestorProfile from '@/lib/models/InvestorProfile'
import InvestorPayout from '@/lib/models/InvestorPayout'
import Vehicle from '@/lib/models/Vehicle'
import Booking from '@/lib/models/Booking'
import Invoice from '@/lib/models/Invoice'
import { startOfDay, endOfDay } from 'date-fns'

const DEFAULT_COMMISSION_PERCENT = 20

export interface InvestorReportParams {
  dateFrom?: Date
  dateTo?: Date
  investorId?: string
  branchId?: string
}

export interface VehiclePerformance {
  vehicleId: string
  plateNumber: string
  brand: string
  model: string
  category: string
  revenue: number
  bookingsCount: number
  commission: number
  netPayout: number
  revenuePerVehicle: number
  commissionPerVehicle: number
}

export interface InvestorPerformance {
  investorId: string
  investorName: string
  companyName?: string
  totalVehicles: number
  totalRevenue: number
  totalCommission: number
  totalNetPayout: number
  averageCommissionPercent: number
  totalBookings: number
  revenuePerVehicle: number
  commissionPerVehicle: number
  vehicles: VehiclePerformance[]
}

export interface PayoutDetail {
  payoutId: string
  periodFrom: Date
  periodTo: Date
  totalRevenue: number
  commissionPercent: number
  commissionAmount: number
  netPayout: number
  status: string
  paymentStatus?: string
  paidAt?: Date
  createdAt: Date
}

export interface CommissionAnalysis {
  investorId: string
  investorName: string
  commissionPercent: number
  totalRevenue: number
  commissionAmount: number
  netPayout: number
  commissionImpact: number // How much commission affects revenue
  effectiveRate: number // Effective commission rate
}

export interface InvestorReportResult {
  summary: {
    totalInvestors: number
    totalRevenue: number
    totalCommission: number
    totalNetPayout: number
    averageCommissionPercent: number
  }
  investors: InvestorPerformance[]
  payouts: PayoutDetail[]
  commissionAnalysis: CommissionAnalysis[]
}

/**
 * Get comprehensive investor performance report
 */
export async function getInvestorPerformanceReport(
  params: InvestorReportParams
): Promise<InvestorReportResult> {
  await connectDB()

  const { dateFrom, dateTo, investorId, branchId } = params

  // Build date filter
  const dateFilter: any = {}
  if (dateFrom && dateTo) {
    dateFilter.issueDate = {
      $gte: startOfDay(dateFrom),
      $lte: endOfDay(dateTo),
    }
  }

  // Get investor profiles
  const investorFilter: any = {}
  if (investorId) {
    investorFilter._id = investorId
  }

  const investorProfiles = await InvestorProfile.find(investorFilter)
    .populate('user', 'name email phone')
    .lean()

  // Create a map of investor ID to commission percent
  const investorCommissionMap = new Map<string, number>()
  investorProfiles.forEach((profile: any) => {
    const id = String(profile._id)
    investorCommissionMap.set(id, profile.commissionPercent || 20) // Default 20%
  })

  // Get all investor-owned vehicles
  const vehicleFilter: any = {
    ownershipType: 'INVESTOR',
    investor: { $exists: true },
  }

  if (investorId) {
    vehicleFilter.investor = investorId
  }

  if (branchId) {
    vehicleFilter.currentBranch = branchId
  }

  const vehicles = await Vehicle.find(vehicleFilter)
    .populate('investor')
    .lean()

  // Get bookings for these vehicles
  const vehicleIds = vehicles.map((v: any) => v._id)
  const bookingFilter: any = {
    vehicle: { $in: vehicleIds },
    status: { $in: ['CONFIRMED', 'CHECKED_OUT', 'CHECKED_IN'] },
  }

  if (dateFrom && dateTo) {
    bookingFilter.startDateTime = {
      $lte: endOfDay(dateTo),
    }
    bookingFilter.endDateTime = {
      $gte: startOfDay(dateFrom),
    }
  }

  const bookings = await Booking.find(bookingFilter)
    .populate('vehicle', 'plateNumber brand model category investor')
    .lean()

  // Get invoices for these bookings
  const bookingIds = bookings.map((b: any) => b._id)
  const invoiceFilter: any = {
    booking: { $in: bookingIds },
    status: { $in: ['ISSUED', 'PAID'] },
  }

  if (dateFrom && dateTo) {
    invoiceFilter.issueDate = {
      $gte: startOfDay(dateFrom),
      $lte: endOfDay(dateTo),
    }
  }

  const invoices = await Invoice.find(invoiceFilter).lean()

  // Get payouts
  const payoutFilter: any = {}
  if (investorId) {
    payoutFilter.investor = investorId
  }
  if (dateFrom && dateTo) {
    payoutFilter.periodFrom = { $lte: endOfDay(dateTo) }
    payoutFilter.periodTo = { $gte: startOfDay(dateFrom) }
  }

  const payouts = await InvestorPayout.find(payoutFilter)
    .populate({
      path: 'investor',
      populate: {
        path: 'user',
        select: 'name email',
      },
    })
    .populate('payment')
    .sort({ periodFrom: -1 })
    .lean()

  // Group data by investor
  const investorMap = new Map<string, InvestorPerformance>()
  const vehiclePerformanceMap = new Map<string, VehiclePerformance>()

  // Initialize investor data
  investorProfiles.forEach((profile: any) => {
    const id = String(profile._id)
    const commissionPercent = investorCommissionMap.get(id) || 20
    investorMap.set(id, {
      investorId: id,
      investorName: profile.user?.name || 'Unknown',
      companyName: profile.companyName,
      totalVehicles: 0,
      totalRevenue: 0,
      totalCommission: 0,
      totalNetPayout: 0,
      averageCommissionPercent: commissionPercent,
      totalBookings: 0,
      revenuePerVehicle: 0,
      commissionPerVehicle: 0,
      vehicles: [],
    })
  })

  // Process invoices and calculate revenue per vehicle
  invoices.forEach((invoice: any) => {
    const booking = bookings.find((b: any) => String(b._id) === String(invoice.booking))
    if (!booking) return

    const vehicle = booking.vehicle as any
    const investorIdFromVehicle = String(vehicle?.investor || '')
    if (!investorIdFromVehicle) return

    const investor = investorMap.get(investorIdFromVehicle)
    if (!investor) {
      // If investor not in map, try to find it
      const profile = investorProfiles.find((p: any) => String(p._id) === investorIdFromVehicle)
      if (profile) {
        const commissionPercent = investorCommissionMap.get(investorIdFromVehicle) || 20
        investorMap.set(investorIdFromVehicle, {
          investorId: investorIdFromVehicle,
          investorName: (profile.user as any)?.name || 'Unknown',
          companyName: profile.companyName,
          totalVehicles: 0,
          totalRevenue: 0,
          totalCommission: 0,
          totalNetPayout: 0,
          averageCommissionPercent: commissionPercent,
          totalBookings: 0,
          revenuePerVehicle: 0,
          commissionPerVehicle: 0,
          vehicles: [],
        })
      } else {
        return // Skip if investor profile not found
      }
    }

    const vehicleId = String(vehicle._id)
    const revenue = invoice.total || 0

    // Update vehicle performance
    if (!vehiclePerformanceMap.has(vehicleId)) {
      vehiclePerformanceMap.set(vehicleId, {
        vehicleId,
        plateNumber: vehicle.plateNumber || 'N/A',
        brand: vehicle.brand || 'N/A',
        model: vehicle.model || 'N/A',
        category: vehicle.category || 'N/A',
        revenue: 0,
        bookingsCount: 0,
        commission: 0,
        netPayout: 0,
        revenuePerVehicle: 0,
        commissionPerVehicle: 0,
      })
    }

    const vehiclePerf = vehiclePerformanceMap.get(vehicleId)!
    vehiclePerf.revenue += revenue
    vehiclePerf.bookingsCount += 1

    // Update investor totals
    const currentInvestor = investorMap.get(investorIdFromVehicle)
    if (currentInvestor) {
      currentInvestor.totalRevenue += revenue
      currentInvestor.totalBookings += 1
    }
  })

  // Calculate commission and net payout for each vehicle
  vehiclePerformanceMap.forEach((vehiclePerf) => {
    const booking = bookings.find((b: any) => String(b.vehicle?._id || b.vehicle) === vehiclePerf.vehicleId)
    if (!booking) return

    const vehicle = booking.vehicle as any
    const investorIdFromVehicle = String(vehicle?.investor || '')
    const investor = investorMap.get(investorIdFromVehicle)
    if (!investor) return

    const commissionPercent = investorCommissionMap.get(investorIdFromVehicle) || investor.averageCommissionPercent
    vehiclePerf.commission = (vehiclePerf.revenue * commissionPercent) / 100
    vehiclePerf.netPayout = vehiclePerf.revenue - vehiclePerf.commission
    vehiclePerf.revenuePerVehicle = vehiclePerf.revenue
    vehiclePerf.commissionPerVehicle = vehiclePerf.commission

    // Add to investor's vehicles list
    investor.vehicles.push(vehiclePerf)
  })

  // Calculate investor totals
  investorMap.forEach((investor) => {
    investor.totalCommission = investor.vehicles.reduce((sum, v) => sum + v.commission, 0)
    investor.totalNetPayout = investor.vehicles.reduce((sum, v) => sum + v.netPayout, 0)
    investor.totalVehicles = investor.vehicles.length
    investor.revenuePerVehicle =
      investor.totalVehicles > 0 ? investor.totalRevenue / investor.totalVehicles : 0
    investor.commissionPerVehicle =
      investor.totalVehicles > 0 ? investor.totalCommission / investor.totalVehicles : 0
  })

  // Format payout details
  const payoutDetails: PayoutDetail[] = payouts.map((payout: any) => ({
    payoutId: String(payout._id),
    periodFrom: payout.periodFrom,
    periodTo: payout.periodTo,
    totalRevenue: payout.totals?.totalRevenue || 0,
    commissionPercent: payout.totals?.commissionPercent || 0,
    commissionAmount: payout.totals?.commissionAmount || 0,
    netPayout: payout.totals?.netPayout || 0,
    status: payout.status,
    paymentStatus: payout.payment?.status,
    paidAt: payout.payment?.paidAt,
    createdAt: payout.createdAt,
  }))

  // Commission analysis
  const commissionAnalysis: CommissionAnalysis[] = Array.from(investorMap.values()).map((investor) => {
    const commissionImpact = investor.totalRevenue - investor.totalNetPayout
    const effectiveRate =
      investor.totalRevenue > 0 ? (commissionImpact / investor.totalRevenue) * 100 : 0

    return {
      investorId: investor.investorId,
      investorName: investor.investorName,
      commissionPercent: investor.averageCommissionPercent,
      totalRevenue: investor.totalRevenue,
      commissionAmount: investor.totalCommission,
      netPayout: investor.totalNetPayout,
      commissionImpact,
      effectiveRate,
    }
  })

  // Calculate summary
  const investorsArray = Array.from(investorMap.values())
  const summary = {
    totalInvestors: investorsArray.length,
    totalRevenue: investorsArray.reduce((sum, inv) => sum + inv.totalRevenue, 0),
    totalCommission: investorsArray.reduce((sum, inv) => sum + inv.totalCommission, 0),
    totalNetPayout: investorsArray.reduce((sum, inv) => sum + inv.totalNetPayout, 0),
    averageCommissionPercent:
      investorsArray.length > 0
        ? investorsArray.reduce((sum, inv) => sum + inv.averageCommissionPercent, 0) /
          investorsArray.length
        : 0,
  }

  return {
    summary,
    investors: investorsArray.sort((a, b) => b.totalRevenue - a.totalRevenue),
    payouts: payoutDetails,
    commissionAnalysis: commissionAnalysis.sort((a, b) => b.totalRevenue - a.totalRevenue),
  }
}

