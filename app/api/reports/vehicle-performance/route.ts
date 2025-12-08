export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import Booking from '@/lib/models/Booking'
import Invoice from '@/lib/models/Invoice'
import Vehicle from '@/lib/models/Vehicle'
import Expense from '@/lib/models/Expense'
import ExpenseCategory from '@/lib/models/ExpenseCategory'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format, differenceInDays } from 'date-fns'
import { logger } from '@/lib/utils/performance'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'MANAGER'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const vehicleId = searchParams.get('vehicleId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const period = searchParams.get('period') || 'MONTH' // WEEK, MONTH, YEAR

    if (!vehicleId) {
      return NextResponse.json({ error: 'Vehicle ID is required' }, { status: 400 })
    }

    // Get vehicle
    const vehicle = await Vehicle.findById(vehicleId).lean()
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    // Get vehicle purchase cost from expenses
    // Look for purchase-related categories (by code or name)
    const purchaseCategories = await ExpenseCategory.find({
      $or: [
        { code: 'VEHICLE_PURCHASE' },
        { code: 'PURCHASE_PRICE_FROM_AUCTION' },
        { code: { $regex: /purchase/i } },
        { name: { $regex: /purchase|auction.*price|price.*auction/i } },
      ],
      isActive: true,
    }).lean()
    
    let vehiclePurchaseCost = 0
    
    if (purchaseCategories.length > 0) {
      const purchaseCategoryIds = purchaseCategories.map((cat: any) => cat._id)
      
      // First: Get purchase expenses directly linked to this vehicle
      const purchaseExpenses = await Expense.find({
        vehicle: vehicleId,
        category: { $in: purchaseCategoryIds },
        isDeleted: false,
      }).lean()
      
      vehiclePurchaseCost = purchaseExpenses.reduce((sum, exp: any) => sum + (exp.amount || 0), 0)
      
      // Second: If no direct link, check ALL purchase expenses by description matching
      // This handles cases where expense was created before vehicle field was added
      if (vehiclePurchaseCost === 0) {
        const vehiclePlate = ((vehicle as any).plateNumber || '').trim()
        const vehicleVin = ((vehicle as any).vin || '').trim()
        const vehicleBrand = ((vehicle as any).brand || '').trim()
        const vehicleModel = ((vehicle as any).model || '').trim()
        
        // Get ALL purchase expenses (including those without vehicle field or with different vehicle)
        const allPurchaseExpenses = await Expense.find({
          category: { $in: purchaseCategoryIds },
          isDeleted: false,
        }).limit(100).lean()
        
        // Match expenses by plate number, VIN, brand/model in description
        vehiclePurchaseCost = allPurchaseExpenses.reduce((sum, exp: any) => {
          // Skip if expense is already linked to a different vehicle
          if (exp.vehicle && String(exp.vehicle) !== String(vehicleId)) {
            return sum
          }
          
          const desc = (exp.description || '').toLowerCase()
          const descUpper = (exp.description || '').toUpperCase()
          
          // Check multiple matching strategies
          let matches = false
          
          // Match by plate number (handle formats like "0-28651" or "028651")
          if (vehiclePlate) {
            const plateNormalized = vehiclePlate.replace(/[-\s_]/g, '').toLowerCase()
            const plateWithDash = vehiclePlate.toLowerCase()
            const plateVariations = [
              plateNormalized,
              plateWithDash,
              vehiclePlate.toLowerCase(),
            ]
            
            matches = plateVariations.some(plate => {
              const plateInDesc = desc.replace(/[-\s_]/g, '').includes(plate.replace(/[-\s_]/g, ''))
              return plateInDesc || desc.includes(plate) || descUpper.includes(plate.toUpperCase())
            })
          }
          
          // Match by VIN
          if (!matches && vehicleVin) {
            matches = desc.includes(vehicleVin.toLowerCase()) || 
                     descUpper.includes(vehicleVin.toUpperCase())
          }
          
          // Match by brand and model (e.g., "KIA TELLURIDE")
          if (!matches && vehicleBrand && vehicleModel) {
            const brandLower = vehicleBrand.toLowerCase()
            const modelLower = vehicleModel.toLowerCase()
            matches = desc.includes(brandLower) && desc.includes(modelLower)
          }
          
          // Match by model only if it's distinctive
          if (!matches && vehicleModel && vehicleModel.length > 3) {
            matches = desc.includes(vehicleModel.toLowerCase())
          }
          
          if (matches) {
            return sum + (exp.amount || 0)
          }
          return sum
        }, 0)
      }
    }

    // Calculate date range based on period
    let actualDateFrom: Date
    let actualDateTo: Date

    if (dateFrom && dateTo) {
      actualDateFrom = startOfDay(new Date(dateFrom))
      actualDateTo = endOfDay(new Date(dateTo))
    } else {
      const today = new Date()
      switch (period) {
        case 'WEEK':
          actualDateFrom = startOfWeek(today, { weekStartsOn: 0 })
          actualDateTo = endOfWeek(today, { weekStartsOn: 0 })
          break
        case 'YEAR':
          actualDateFrom = startOfYear(today)
          actualDateTo = endOfYear(today)
          break
        case 'MONTH':
        default:
          actualDateFrom = startOfMonth(today)
          actualDateTo = endOfMonth(today)
          break
      }
    }

    // Get bookings for this vehicle in the period
    const bookings = await Booking.find({
      vehicle: vehicleId,
      startDateTime: {
        $lte: actualDateTo,
      },
      $or: [
        { endDateTime: { $gte: actualDateFrom } },
        { endDateTime: { $exists: false } },
      ],
      status: { $in: ['CONFIRMED', 'CHECKED_OUT', 'CHECKED_IN'] },
    })
      .sort({ startDateTime: 1 })
      .lean()

    // Get invoices for these bookings
    const bookingIds = bookings.map((b) => b._id)
    const invoices = await Invoice.find({
      booking: { $in: bookingIds },
      status: { $in: ['ISSUED', 'PAID'] },
    }).lean()

    // Create invoice map
    const invoiceMap = new Map<string, any>()
    invoices.forEach((inv: any) => {
      const bookingId = String(inv.booking)
      invoiceMap.set(bookingId, inv)
    })

    // Helper function to exclude fines from invoice total
    const getRevenueWithoutFines = (invoice: any): number => {
      if (!invoice || !invoice.items) return 0
      const finesAmount = invoice.items
        .filter((item: any) => {
          const label = (item.label || '').toLowerCase()
          return item.amount > 0 && (
            label.includes('fine') || 
            label.includes('penalty') || 
            label.includes('government') ||
            label.includes('traffic')
          )
        })
        .reduce((sum: number, item: any) => sum + item.amount, 0)
      return (invoice.total || 0) - finesAmount
    }

    // Calculate metrics
    let totalRevenue = 0
    let totalBookings = 0
    const bookingDetails: any[] = []

    bookings.forEach((booking: any) => {
      const invoice = invoiceMap.get(String(booking._id))
      // Exclude fines from revenue (fines are expenses, not revenue)
      const revenue = invoice ? getRevenueWithoutFines(invoice) : (booking.totalAmount || 0)
      
      totalRevenue += revenue
      totalBookings += 1

      // Calculate days for this booking
      let bookingDays = 1
      if (booking.endDateTime) {
        const start = new Date(Math.max(new Date(booking.startDateTime).getTime(), actualDateFrom.getTime()))
        const end = new Date(Math.min(new Date(booking.endDateTime).getTime(), actualDateTo.getTime()))
        bookingDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
      }

      bookingDetails.push({
        bookingId: String(booking._id),
        startDate: booking.startDateTime,
        endDate: booking.endDateTime || null,
        days: bookingDays,
        revenue,
        status: booking.status,
      })
    })

    // Calculate period days
    const periodDays = Math.max(1, differenceInDays(actualDateTo, actualDateFrom) + 1)
    
    // Calculate utilization (days rented / days available)
    const rentedDays = new Set<string>()
    bookings.forEach((booking: any) => {
      const start = new Date(Math.max(new Date(booking.startDateTime).getTime(), actualDateFrom.getTime()))
      const end = booking.endDateTime 
        ? new Date(Math.min(new Date(booking.endDateTime).getTime(), actualDateTo.getTime()))
        : actualDateTo

      let current = new Date(start)
      while (current <= end) {
        rentedDays.add(current.toISOString().split('T')[0])
        current.setDate(current.getDate() + 1)
      }
    })

    const daysRented = rentedDays.size
    const utilizationRate = periodDays > 0 ? (daysRented / periodDays) * 100 : 0
    const averageDailyRevenue = daysRented > 0 ? totalRevenue / daysRented : 0

    // Helper function to calculate breakdown by period type
    const calculatePeriodBreakdown = (periodType: 'WEEK' | 'MONTH' | 'YEAR') => {
      const breakdown = new Map<string, { revenue: number; bookings: number; days: number }>()
      
      bookings.forEach((booking: any) => {
        const invoice = invoiceMap.get(String(booking._id))
        // Exclude fines from revenue (fines are expenses, not revenue)
        const revenue = invoice ? getRevenueWithoutFines(invoice) : (booking.totalAmount || 0)
        
        const bookingDate = new Date(booking.startDateTime)
        let periodKey: string
        
        switch (periodType) {
          case 'WEEK':
            const weekStart = startOfWeek(bookingDate, { weekStartsOn: 0 })
            periodKey = format(weekStart, 'yyyy-MM-dd')
            break
          case 'YEAR':
            periodKey = format(bookingDate, 'yyyy')
            break
          case 'MONTH':
          default:
            periodKey = format(bookingDate, 'yyyy-MM')
            break
        }
        
        if (!breakdown.has(periodKey)) {
          breakdown.set(periodKey, { revenue: 0, bookings: 0, days: 0 })
        }
        
        const periodData = breakdown.get(periodKey)!
        periodData.revenue += revenue
        periodData.bookings += 1
        
        // Calculate days for this booking in this period
        let bookingDays = 1
        if (booking.endDateTime) {
          const start = new Date(Math.max(new Date(booking.startDateTime).getTime(), actualDateFrom.getTime()))
          const end = new Date(Math.min(new Date(booking.endDateTime).getTime(), actualDateTo.getTime()))
          bookingDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
        }
        periodData.days += bookingDays
      })
      
      return Array.from(breakdown.entries())
        .map(([period, data]) => ({
          period,
          revenue: Math.round(data.revenue * 100) / 100,
          bookings: data.bookings,
          days: data.days,
        }))
        .sort((a, b) => a.period.localeCompare(b.period))
    }

    // Calculate breakdowns for all period types
    const weeklyBreakdown = calculatePeriodBreakdown('WEEK')
    const monthlyBreakdown = calculatePeriodBreakdown('MONTH')
    const yearlyBreakdown = calculatePeriodBreakdown('YEAR')

    // Calculate break-even metrics
    const netProfit = totalRevenue - vehiclePurchaseCost
    const breakEvenStatus = vehiclePurchaseCost > 0 
      ? (netProfit >= 0 ? 'BREAK_EVEN' : 'NOT_BREAK_EVEN')
      : 'NO_PURCHASE_COST'
    const remainingToBreakEven = vehiclePurchaseCost > 0 && netProfit < 0 
      ? Math.abs(netProfit)
      : 0
    const profitAfterBreakEven = netProfit > 0 ? netProfit : 0
    const breakEvenPercentage = vehiclePurchaseCost > 0 
      ? Math.min(100, Math.max(0, (totalRevenue / vehiclePurchaseCost) * 100))
      : 0

    return NextResponse.json({
      vehicle: {
        _id: vehicle._id,
        plateNumber: vehicle.plateNumber,
        brand: vehicle.brand,
        model: vehicle.model,
        category: vehicle.category,
        color: (vehicle as any).color,
      },
      period: {
        from: actualDateFrom,
        to: actualDateTo,
        type: period,
        days: periodDays,
      },
      purchaseCost: {
        amount: vehiclePurchaseCost,
        hasPurchaseCost: vehiclePurchaseCost > 0,
      },
      metrics: {
        totalRevenue,
        totalBookings,
        daysRented,
        daysAvailable: periodDays - daysRented,
        utilizationRate: Math.round(utilizationRate * 100) / 100,
        averageDailyRevenue: Math.round(averageDailyRevenue * 100) / 100,
        averageRevenuePerBooking: totalBookings > 0 ? Math.round((totalRevenue / totalBookings) * 100) / 100 : 0,
        // Break-even metrics
        netProfit: Math.round(netProfit * 100) / 100,
        breakEvenStatus,
        remainingToBreakEven: Math.round(remainingToBreakEven * 100) / 100,
        profitAfterBreakEven: Math.round(profitAfterBreakEven * 100) / 100,
        breakEvenPercentage: Math.round(breakEvenPercentage * 100) / 100,
      },
      weeklyBreakdown,
      monthlyBreakdown,
      yearlyBreakdown,
      bookings: bookingDetails,
    })
  } catch (error: any) {
    logger.error('Error fetching vehicle performance:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch vehicle performance' },
      { status: 500 }
    )
  }
}

