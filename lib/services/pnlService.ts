import connectDB from '@/lib/db'
import Invoice from '@/lib/models/Invoice'
import Expense from '@/lib/models/Expense'
import ExpenseCategory from '@/lib/models/ExpenseCategory'
import MaintenanceRecord from '@/lib/models/MaintenanceRecord'
import SalaryRecord from '@/lib/models/SalaryRecord'
import { 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth,
  startOfQuarter,
  endOfQuarter, 
  startOfYear,
  endOfYear,
  subMonths,
  subQuarters,
  subWeeks,
  subYears,
  differenceInDays,
  format
} from 'date-fns'

export type PeriodType = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR'
export type ComparisonType = 'PREVIOUS_PERIOD' | 'YEAR_OVER_YEAR'

interface PnLParams {
  dateFrom: Date
  dateTo: Date
  branchId?: string
  periodType?: PeriodType
  compareWith?: ComparisonType
}

interface CostBreakdown {
  categoryId: string
  categoryName: string
  categoryCode: string
  amount: number
  percentage: number
}

interface FixedCosts {
  salaries: number
  rent: number
  utilities: number
  other: number
  total: number
}

interface MaintenanceCosts {
  total: number
  byType: Array<{
    type: string
    amount: number
  }>
}

interface PeriodComparison {
  current: {
    revenue: number
    cogs: number
    opex: number
    grossProfit: number
    netProfit: number
    grossMargin: number
    netMargin: number
  }
  previous: {
    revenue: number
    cogs: number
    opex: number
    grossProfit: number
    netProfit: number
    grossMargin: number
    netMargin: number
  }
  change: {
    revenue: number
    revenuePercent: number
    cogs: number
    cogsPercent: number
    opex: number
    opexPercent: number
    grossProfit: number
    grossProfitPercent: number
    netProfit: number
    netProfitPercent: number
    grossMargin: number
    netMargin: number
  }
}

interface PnLResult {
  period: {
    from: Date
    to: Date
    type: PeriodType
    label: string
  }
  revenue: {
    total: number
    breakdown: Array<{
      period: string
      amount: number
    }>
  }
  cogs: {
    total: number
    byCategory: CostBreakdown[]
    maintenance: MaintenanceCosts
  }
  opex: {
    total: number
    byCategory: CostBreakdown[]
    fixedCosts: FixedCosts
  }
  profit: {
    grossProfit: number
    netProfit: number
    grossMargin: number
    netMargin: number
  }
  comparison?: PeriodComparison
}

function getPeriodDates(date: Date, periodType: PeriodType): { start: Date; end: Date } {
  switch (periodType) {
    case 'WEEK':
      return {
        start: startOfWeek(date, { weekStartsOn: 0 }),
        end: endOfWeek(date, { weekStartsOn: 0 }),
      }
    case 'MONTH':
      return {
        start: startOfMonth(date),
        end: endOfMonth(date),
      }
    case 'QUARTER':
      return {
        start: startOfQuarter(date),
        end: endOfQuarter(date),
      }
    case 'YEAR':
      return {
        start: startOfYear(date),
        end: endOfYear(date),
      }
  }
}

function getPreviousPeriodDates(
  dateFrom: Date,
  dateTo: Date,
  comparisonType: ComparisonType
): { start: Date; end: Date } {
  const periodDays = differenceInDays(dateTo, dateFrom)
  
  if (comparisonType === 'YEAR_OVER_YEAR') {
    return {
      start: subYears(dateFrom, 1),
      end: subYears(dateTo, 1),
    }
  } else {
    // Previous period (same length)
    return {
      start: new Date(dateFrom.getTime() - (dateTo.getTime() - dateFrom.getTime()) - 86400000),
      end: new Date(dateFrom.getTime() - 86400000),
    }
  }
}

function formatPeriodLabel(date: Date, periodType: PeriodType): string {
  switch (periodType) {
    case 'WEEK':
      return format(date, 'MMM dd, yyyy')
    case 'MONTH':
      return format(date, 'MMMM yyyy')
    case 'QUARTER':
      const quarter = Math.floor(date.getMonth() / 3) + 1
      return `Q${quarter} ${date.getFullYear()}`
    case 'YEAR':
      return format(date, 'yyyy')
  }
}

export async function getEnhancedProfitAndLoss(
  params: PnLParams
): Promise<PnLResult> {
  await connectDB()

  const { dateFrom, dateTo, branchId, periodType = 'MONTH', compareWith } = params

  // Determine period dates
  const periodDates = getPeriodDates(dateTo, periodType)
  const actualDateFrom = dateFrom || periodDates.start
  const actualDateTo = dateTo || periodDates.end

  // Calculate Revenue
  const invoiceFilter: any = {
    issueDate: {
      $gte: startOfDay(actualDateFrom),
      $lte: endOfDay(actualDateTo),
    },
    status: { $in: ['ISSUED', 'PAID'] },
  }

  const invoices = await Invoice.find(invoiceFilter)
    .populate({
      path: 'booking',
      select: 'pickupBranch',
    })
    .lean()

  const filteredInvoices = branchId
    ? invoices.filter((inv: any) => inv.booking?.pickupBranch === branchId)
    : invoices

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

  // Calculate revenue excluding fines (fines are expenses, not revenue)
  const totalRevenue = filteredInvoices.reduce((sum, inv: any) => {
    const finesAmount = getFinesAmount(inv.items || [])
    return sum + (inv.total || 0) - finesAmount
  }, 0)

  // Group revenue by period for breakdown (excluding fines)
  const revenueBreakdown = new Map<string, number>()
  filteredInvoices.forEach((inv: any) => {
    const date = new Date(inv.issueDate)
    let periodKey: string

    switch (periodType) {
      case 'WEEK':
        const weekStart = startOfWeek(date, { weekStartsOn: 0 })
        periodKey = format(weekStart, 'yyyy-MM-dd')
        break
      case 'MONTH':
        periodKey = format(date, 'yyyy-MM')
        break
      case 'QUARTER':
        const quarter = Math.floor(date.getMonth() / 3)
        periodKey = `${date.getFullYear()}-Q${quarter + 1}`
        break
      case 'YEAR':
        periodKey = format(date, 'yyyy')
        break
    }

    const finesAmount = getFinesAmount(inv.items || [])
    const revenueWithoutFines = (inv.total || 0) - finesAmount
    revenueBreakdown.set(periodKey, (revenueBreakdown.get(periodKey) || 0) + revenueWithoutFines)
  })

  // Calculate COGS
  const cogsFilter: any = {
    dateIncurred: {
      $gte: startOfDay(actualDateFrom),
      $lte: endOfDay(actualDateTo),
    },
    isDeleted: false,
  }

  if (branchId) {
    cogsFilter.branchId = branchId
  }

  const allExpenses = await Expense.find(cogsFilter)
    .populate('category')
    .lean()

  const cogsByCategory = new Map<string, { name: string; code: string; amount: number }>()
  let totalCOGS = 0

  allExpenses.forEach((exp: any) => {
    const category = exp.category
    const amount = exp.amount || 0
    
    // Helper function to check if expense should be COGS
    const isCOGS = () => {
      // If no category, include as COGS
      if (!category) return true
      
      // If category type is explicitly COGS, include it
      if (category.type === 'COGS') return true
      
      // If category type is missing, include it
      if (!category.type) return true
      
      // If category name contains "(COGS)" or similar indicators, include it even if type is wrong
      const categoryName = (category.name || '').toUpperCase()
      if (categoryName.includes('(COGS)') || categoryName.includes('COGS') || 
          categoryName.includes('COST OF GOODS') || categoryName.includes('PURCHASE PRICE')) {
        return true
      }
      
      // Otherwise exclude (it's OPEX)
      return false
    }
    
    // Include expenses that should be COGS
    if (isCOGS()) {
      const categoryId = category ? String(category._id) : 'UNCATEGORIZED'
      const categoryName = category?.name || 'Uncategorized'
      const categoryCode = category?.code || 'OTHER'
      
      if (!cogsByCategory.has(categoryId)) {
        cogsByCategory.set(categoryId, { name: categoryName, code: categoryCode, amount: 0 })
      }
      const cat = cogsByCategory.get(categoryId)!
      cat.amount += amount
      totalCOGS += amount
    }
  })

  // Calculate Maintenance Costs separately
  const maintenanceFilter: any = {
    date: {
      $gte: startOfDay(actualDateFrom),
      $lte: endOfDay(actualDateTo),
    },
    status: { $in: ['COMPLETED', 'IN_PROGRESS'] },
  }

  if (branchId) {
    maintenanceFilter.branchId = branchId
  }

  const maintenanceRecords = await MaintenanceRecord.find(maintenanceFilter).lean()
  
  const maintenanceByType = new Map<string, number>()
  let totalMaintenance = 0

  maintenanceRecords.forEach((record: any) => {
    const type = record.type || 'OTHER'
    const cost = record.cost || 0
    maintenanceByType.set(type, (maintenanceByType.get(type) || 0) + cost)
    totalMaintenance += cost
  })

  // Calculate OPEX - use the same allExpenses array but filter for OPEX type
  const opexExpenses = allExpenses.filter((exp: any) => {
    const category = exp.category
    return category && category.type === 'OPEX'
  })

  const opexByCategory = new Map<string, { name: string; code: string; amount: number }>()
  let totalOPEX = 0

  opexExpenses.forEach((exp: any) => {
    const category = exp.category
    const amount = exp.amount || 0
    
    const categoryId = String(category._id)
    if (!opexByCategory.has(categoryId)) {
      opexByCategory.set(categoryId, { name: category.name, code: category.code, amount: 0 })
    }
    const cat = opexByCategory.get(categoryId)!
    cat.amount += amount
    totalOPEX += amount
  })

  // Calculate Fixed Costs (Salaries, Rent, Utilities)
  const fixedCosts: FixedCosts = {
    salaries: 0,
    rent: 0,
    utilities: 0,
    other: 0,
    total: 0,
  }

  // Get salary expenses
  const salaryExpenses = opexExpenses.filter((exp: any) => {
    return exp.category?.code === 'SALARIES' || exp.salaryRecord
  })
  fixedCosts.salaries = salaryExpenses.reduce((sum, exp: any) => sum + (exp.amount || 0), 0)

  // Get rent expenses
  const rentExpenses = opexExpenses.filter((exp: any) => {
    return exp.category?.code === 'RENT'
  })
  fixedCosts.rent = rentExpenses.reduce((sum, exp: any) => sum + (exp.amount || 0), 0)

  // Get utilities (if there's a category for it)
  const utilitiesExpenses = opexExpenses.filter((exp: any) => {
    return exp.category?.code === 'UTILITIES' || exp.category?.name?.toLowerCase().includes('utility')
  })
  fixedCosts.utilities = utilitiesExpenses.reduce((sum, exp: any) => sum + (exp.amount || 0), 0)

  // Other fixed costs
  fixedCosts.other = totalOPEX - fixedCosts.salaries - fixedCosts.rent - fixedCosts.utilities
  fixedCosts.total = totalOPEX

  // Calculate Profit Margins
  const grossProfit = totalRevenue - totalCOGS
  const netProfit = totalRevenue - totalCOGS - totalOPEX
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  // Calculate comparison if requested
  let comparison: PeriodComparison | undefined

  if (compareWith) {
    const previousDates = getPreviousPeriodDates(actualDateFrom, actualDateTo, compareWith)
    
    // Get previous period data
    const previousInvoiceFilter: any = {
      issueDate: {
        $gte: startOfDay(previousDates.start),
        $lte: endOfDay(previousDates.end),
      },
      status: { $in: ['ISSUED', 'PAID'] },
    }

    const previousInvoices = await Invoice.find(previousInvoiceFilter)
      .populate({
        path: 'booking',
        select: 'pickupBranch',
      })
      .lean()

    const previousFilteredInvoices = branchId
      ? previousInvoices.filter((inv: any) => inv.booking?.pickupBranch === branchId)
      : previousInvoices

    const previousRevenue = previousFilteredInvoices.reduce((sum, inv: any) => sum + (inv.total || 0), 0)

    const previousExpenseFilter: any = {
      dateIncurred: {
        $gte: startOfDay(previousDates.start),
        $lte: endOfDay(previousDates.end),
      },
      isDeleted: false,
    }

    if (branchId) {
      previousExpenseFilter.branchId = branchId
    }

    const previousExpenses = await Expense.find(previousExpenseFilter)
      .populate('category')
      .lean()

    const previousCOGS = previousExpenses
      .filter((exp: any) => !exp.category || exp.category?.type === 'COGS' || !exp.category?.type)
      .reduce((sum, exp: any) => sum + (exp.amount || 0), 0)

    const previousOPEX = previousExpenses
      .filter((exp: any) => exp.category?.type === 'OPEX')
      .reduce((sum, exp: any) => sum + (exp.amount || 0), 0)

    const previousGrossProfit = previousRevenue - previousCOGS
    const previousNetProfit = previousRevenue - previousCOGS - previousOPEX
    const previousGrossMargin = previousRevenue > 0 ? (previousGrossProfit / previousRevenue) * 100 : 0
    const previousNetMargin = previousRevenue > 0 ? (previousNetProfit / previousRevenue) * 100 : 0

    const revenueChange = totalRevenue - previousRevenue
    const revenueChangePercent = previousRevenue > 0 ? (revenueChange / previousRevenue) * 100 : 0

    const cogsChange = totalCOGS - previousCOGS
    const cogsChangePercent = previousCOGS > 0 ? (cogsChange / previousCOGS) * 100 : 0

    const opexChange = totalOPEX - previousOPEX
    const opexChangePercent = previousOPEX > 0 ? (opexChange / previousOPEX) * 100 : 0

    const grossProfitChange = grossProfit - previousGrossProfit
    const grossProfitChangePercent = previousGrossProfit > 0 ? (grossProfitChange / previousGrossProfit) * 100 : 0

    const netProfitChange = netProfit - previousNetProfit
    const netProfitChangePercent = previousNetProfit > 0 ? (netProfitChange / previousNetProfit) * 100 : 0

    comparison = {
      current: {
        revenue: totalRevenue,
        cogs: totalCOGS,
        opex: totalOPEX,
        grossProfit,
        netProfit,
        grossMargin,
        netMargin,
      },
      previous: {
        revenue: previousRevenue,
        cogs: previousCOGS,
        opex: previousOPEX,
        grossProfit: previousGrossProfit,
        netProfit: previousNetProfit,
        grossMargin: previousGrossMargin,
        netMargin: previousNetMargin,
      },
      change: {
        revenue: revenueChange,
        revenuePercent: revenueChangePercent,
        cogs: cogsChange,
        cogsPercent: cogsChangePercent,
        opex: opexChange,
        opexPercent: opexChangePercent,
        grossProfit: grossProfitChange,
        grossProfitPercent: grossProfitChangePercent,
        netProfit: netProfitChange,
        netProfitPercent: netProfitChangePercent,
        grossMargin: grossMargin - previousGrossMargin,
        netMargin: netMargin - previousNetMargin,
      },
    }
  }

  // Format cost breakdowns with percentages
  const cogsBreakdown: CostBreakdown[] = Array.from(cogsByCategory.entries()).map(([categoryId, data]) => ({
    categoryId,
    categoryName: data.name,
    categoryCode: data.code,
    amount: data.amount,
    percentage: totalCOGS > 0 ? (data.amount / totalCOGS) * 100 : 0,
  }))

  const opexBreakdown: CostBreakdown[] = Array.from(opexByCategory.entries()).map(([categoryId, data]) => ({
    categoryId,
    categoryName: data.name,
    categoryCode: data.code,
    amount: data.amount,
    percentage: totalOPEX > 0 ? (data.amount / totalOPEX) * 100 : 0,
  }))

  return {
    period: {
      from: actualDateFrom,
      to: actualDateTo,
      type: periodType,
      label: formatPeriodLabel(actualDateTo, periodType),
    },
    revenue: {
      total: totalRevenue,
      breakdown: Array.from(revenueBreakdown.entries())
        .map(([period, amount]) => ({ period, amount }))
        .sort((a, b) => a.period.localeCompare(b.period)),
    },
    cogs: {
      total: totalCOGS,
      byCategory: cogsBreakdown.sort((a, b) => b.amount - a.amount),
      maintenance: {
        total: totalMaintenance,
        byType: Array.from(maintenanceByType.entries()).map(([type, amount]) => ({
          type,
          amount,
        })),
      },
    },
    opex: {
      total: totalOPEX,
      byCategory: opexBreakdown.sort((a, b) => b.amount - a.amount),
      fixedCosts,
    },
    profit: {
      grossProfit,
      netProfit,
      grossMargin,
      netMargin,
    },
    comparison,
  }
}

