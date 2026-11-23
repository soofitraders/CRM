import connectDB from '@/lib/db'
import Invoice from '@/lib/models/Invoice'
import Payment from '@/lib/models/Payment'
import { logger } from '@/lib/utils/performance'

/**
 * Money actually RECEIVED in a period = customer payments that were recorded as
 * successful (a payment is recorded when an invoice is marked Paid).
 * Unpaid invoices are NOT included. Investor payouts (money going OUT) are not
 * included either (they have no booking).
 * The date used is the day the payment was received (paidAt).
 */
export async function totalReceivedForPeriod(startDate?: Date, endDate?: Date): Promise<number> {
  try {
    await connectDB()
    const pipeline: any[] = [
      { $match: { status: 'SUCCESS', booking: { $exists: true, $ne: null } } },
      { $addFields: { receivedOn: { $ifNull: ['$paidAt', '$createdAt'] } } },
    ]
    const range: any = {}
    if (startDate) range.$gte = startDate
    if (endDate) range.$lte = endDate
    if (startDate || endDate) pipeline.push({ $match: { receivedOn: range } })
    pipeline.push({ $group: { _id: null, total: { $sum: '$amount' } } })
    const result = await Payment.aggregate(pipeline)
    return result.length > 0 ? result[0].total : 0
  } catch (error) {
    logger.error('Error calculating money received:', error)
    return 0
  }
}

/**
 * Calculate total INVOICED for a given period (billed, whether or not it was paid)
 * Invoiced amounts are calculated from invoices (PAID or ISSUED status)
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
            label.includes('traffic') ||
            label.includes('salik') ||
            label.includes('toll')
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

    // "Total Sales" on the dashboard = money actually received this month.
    // (Billed-but-unpaid invoices are shown separately as "unpaid", never added to sales.)
    const [receivedThisMonth, receivedLastMonth, invoicedThisMonth, unpaidInvoices] = await Promise.all([
      totalReceivedForPeriod(startOfMonth, now),
      totalReceivedForPeriod(startOfLastMonth, endOfLastMonth),
      totalSalesForPeriod(startOfMonth, now),
      totalUnpaidInvoices(),
    ])

    const salesGrowth =
      receivedLastMonth > 0
        ? ((receivedThisMonth - receivedLastMonth) / receivedLastMonth) * 100
        : 0

    return {
      totalSales: receivedThisMonth,
      salesGrowth,
      invoicedThisMonth,
      unpaidInvoices,
    }
  } catch (error) {
    logger.error('Error getting financial summary:', error)
    return {
      totalSales: 0,
      salesGrowth: 0,
      invoicedThisMonth: 0,
      unpaidInvoices: 0,
    }
  }
}

