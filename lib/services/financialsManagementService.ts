import connectDB from '@/lib/db'
import Invoice from '@/lib/models/Invoice'
import Expense from '@/lib/models/Expense'
import ExpenseCategory from '@/lib/models/ExpenseCategory'
import { startOfDay, endOfDay } from 'date-fns'

interface ProfitAndLossParams {
  dateFrom: Date
  dateTo: Date
  branchId?: string
}

interface ProfitAndLossResult {
  revenue: {
    total: number
    breakdown: Array<{
      period: string
      amount: number
    }>
  }
  cogs: {
    total: number
    byCategory: Array<{
      categoryId: string
      categoryName: string
      amount: number
    }>
  }
  opex: {
    total: number
    byCategory: Array<{
      categoryId: string
      categoryName: string
      amount: number
    }>
  }
  netProfit: number
  profitMargin: number
}

/**
 * Get Profit & Loss statement
 */
export async function getProfitAndLoss(
  params: ProfitAndLossParams
): Promise<ProfitAndLossResult> {
  await connectDB()

  const { dateFrom, dateTo, branchId } = params

  // Calculate Revenue from invoices
  const invoiceFilter: any = {
    issueDate: {
      $gte: startOfDay(dateFrom),
      $lte: endOfDay(dateTo),
    },
    status: { $in: ['ISSUED', 'PAID'] },
  }

  const invoices = await Invoice.find(invoiceFilter)
    .populate({
      path: 'booking',
      select: 'pickupBranch',
    })
    .lean()

  // Filter by branch if specified (after populate)
  const filteredInvoices = branchId
    ? invoices.filter((inv: any) => inv.booking?.pickupBranch === branchId)
    : invoices

  // Calculate total revenue
  const totalRevenue = filteredInvoices.reduce((sum, inv: any) => sum + (inv.total || 0), 0)

  // Group revenue by month for breakdown
  const revenueByMonth = new Map<string, number>()
  filteredInvoices.forEach((inv: any) => {
    const date = new Date(inv.issueDate)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    revenueByMonth.set(monthKey, (revenueByMonth.get(monthKey) || 0) + (inv.total || 0))
  })

  const revenueBreakdown = Array.from(revenueByMonth.entries())
    .map(([period, amount]) => ({ period, amount }))
    .sort((a, b) => a.period.localeCompare(b.period))

  // Calculate COGS (Cost of Goods Sold)
  const cogsFilter: any = {
    dateIncurred: {
      $gte: startOfDay(dateFrom),
      $lte: endOfDay(dateTo),
    },
    isDeleted: false,
  }

  if (branchId) {
    cogsFilter.branchId = branchId
  }

  const cogsExpenses = await Expense.find(cogsFilter)
    .populate('category')
    .lean()

  const cogsByCategory = new Map<string, { name: string; amount: number }>()
  let totalCOGS = 0

  cogsExpenses.forEach((exp: any) => {
    const category = exp.category
    if (category && category.type === 'COGS') {
      const categoryId = String(category._id)
      if (!cogsByCategory.has(categoryId)) {
        cogsByCategory.set(categoryId, { name: category.name, amount: 0 })
      }
      const cat = cogsByCategory.get(categoryId)!
      cat.amount += exp.amount || 0
      totalCOGS += exp.amount || 0
    }
  })

  // Calculate OPEX (Operating Expenses) - includes salary expenses automatically
  const opexExpenses = await Expense.find(cogsFilter).populate('category').lean()

  const opexByCategory = new Map<string, { name: string; amount: number }>()
  let totalOPEX = 0

  opexExpenses.forEach((exp: any) => {
    const category = exp.category
    if (category && category.type === 'OPEX') {
      const categoryId = String(category._id)
      if (!opexByCategory.has(categoryId)) {
        opexByCategory.set(categoryId, { name: category.name, amount: 0 })
      }
      const cat = opexByCategory.get(categoryId)!
      cat.amount += exp.amount || 0
      totalOPEX += exp.amount || 0
    }
  })

  // Calculate Net Profit
  const netProfit = totalRevenue - totalCOGS - totalOPEX
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  return {
    revenue: {
      total: totalRevenue,
      breakdown: revenueBreakdown,
    },
    cogs: {
      total: totalCOGS,
      byCategory: Array.from(cogsByCategory.entries()).map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        amount: data.amount,
      })),
    },
    opex: {
      total: totalOPEX,
      byCategory: Array.from(opexByCategory.entries()).map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name,
        amount: data.amount,
      })),
    },
    netProfit,
    profitMargin,
  }
}

