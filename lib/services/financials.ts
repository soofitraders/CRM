import connectDB from '@/lib/db'
import Invoice from '@/lib/models/Invoice'
import Payment from '@/lib/models/Payment'
import { logger } from '@/lib/utils/performance'

/**
 * Calculate total sales for a given period
 * Sales are calculated from invoices (PAID or ISSUED status)
 * Excludes fines from revenue calculation
 * @param startDate - Start date of the period (optional, defaults to beginning of current month)
 * @param endDate - End date of the period (optional, defaults to now)
 * @returns Total sales amount
 */
export async function totalSalesForPeriod(
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  try {
    await connectDB()

    const filter: any = {
      status: { $in: ['PAID', 'ISSUED'] }, // Count both paid and issued invoices
    }

    if (startDate || endDate) {
      filter.issueDate = {}
      if (startDate) {
        filter.issueDate.$gte = startDate
      }
      if (endDate) {
        filter.issueDate.$lte = endDate
      }
    }

    // Get all invoices in the period
    const invoices = await Invoice.find(filter).lean()

    // Calculate total sales excluding fines
    let totalSales = 0
    
    for (const invoice of invoices) {
      // Calculate fines amount from invoice items
      const finesAmount = (invoice.items || [])
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
      
      // Add invoice total minus fines (fines are expenses, not revenue)
      totalSales += (invoice.total || 0) - finesAmount
    }

    return totalSales
  } catch (error) {
    logger.error('Error calculating total sales:', error)
    return 0
  }
}

/**
 * Calculate total amount of unpaid invoices
 * @returns Total amount of unpaid invoices
 */
export async function totalUnpaidInvoices(): Promise<number> {
  try {
    await connectDB()

    const result = await Invoice.aggregate([
      {
        $match: {
          status: { $in: ['DRAFT', 'ISSUED'] }, // Only count unpaid invoices
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$total' },
        },
      },
    ])

    return result.length > 0 ? result[0].total : 0
  } catch (error) {
    logger.error('Error calculating total unpaid invoices:', error)
    return 0
  }
}

/**
 * Get financial summary for dashboard
 */
export async function getFinancialSummary() {
  try {
    await connectDB()

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

    const [currentMonthSales, lastMonthSales, unpaidInvoices] = await Promise.all([
      totalSalesForPeriod(startOfMonth, now),
      totalSalesForPeriod(startOfLastMonth, endOfLastMonth),
      totalUnpaidInvoices(),
    ])

    const salesGrowth =
      lastMonthSales > 0
        ? ((currentMonthSales - lastMonthSales) / lastMonthSales) * 100
        : 0

    return {
      totalSales: currentMonthSales,
      salesGrowth,
      unpaidInvoices,
    }
  } catch (error) {
    logger.error('Error getting financial summary:', error)
    return {
      totalSales: 0,
      salesGrowth: 0,
      unpaidInvoices: 0,
    }
  }
}

