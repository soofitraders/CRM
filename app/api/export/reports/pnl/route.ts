import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/services/exportService'
import ExportLog from '@/lib/models/ExportLog'
import { getEnhancedProfitAndLoss } from '@/lib/services/pnlService'
import { format as formatDate } from 'date-fns'
import { logger } from '@/lib/utils/performance'

export async function GET(request: NextRequest) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    const session = await getServerSession(authOptions)
    if (!session?.user) {
      clearTimeout(timeoutId)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      clearTimeout(timeoutId)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      clearTimeout(timeoutId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const branchId = searchParams.get('branchId') || undefined
    const periodType = (searchParams.get('periodType') || 'MONTH') as any
    const compareWith = searchParams.get('compareWith') as any

    if (!dateFrom || !dateTo) {
      clearTimeout(timeoutId)
      return NextResponse.json({ error: 'dateFrom and dateTo are required' }, { status: 400 })
    }

    logger.log(`P&L export - Format: ${format}, User: ${user.email}`)

    const pnlData = await getEnhancedProfitAndLoss({
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      branchId,
      periodType,
      compareWith: compareWith || undefined,
    })

    // Prepare export data
    const exportData = [
      // Summary
      { metric: 'Total Revenue', value: pnlData.revenue.total },
      { metric: 'Total COGS', value: pnlData.cogs.total },
      { metric: 'Total Operating Expenses', value: pnlData.opex.total },
      { metric: 'Gross Profit', value: pnlData.profit.grossProfit },
      { metric: 'Net Profit', value: pnlData.profit.netProfit },
      { metric: 'Gross Profit Margin %', value: pnlData.profit.grossMargin },
      { metric: 'Net Profit Margin %', value: pnlData.profit.netMargin },
      // COGS breakdown
      ...pnlData.cogs.byCategory.map((cat) => ({
        category: cat.categoryName,
        type: 'COGS',
        amount: cat.amount,
        percentage: cat.percentage,
      })),
      // Maintenance costs
      ...(pnlData.cogs.maintenance.total > 0
        ? [
            {
              category: 'Maintenance Costs',
              type: 'COGS',
              amount: pnlData.cogs.maintenance.total,
              percentage: pnlData.cogs.total > 0 ? (pnlData.cogs.maintenance.total / pnlData.cogs.total) * 100 : 0,
            },
            ...pnlData.cogs.maintenance.byType.map((maint) => ({
              category: `  - ${maint.type}`,
              type: 'COGS',
              amount: maint.amount,
              percentage: 0,
            })),
          ]
        : []),
      // OPEX breakdown
      ...pnlData.opex.byCategory.map((cat) => ({
        category: cat.categoryName,
        type: 'OPEX',
        amount: cat.amount,
        percentage: cat.percentage,
      })),
      // Fixed costs
      { category: 'Salaries', type: 'Fixed Cost', amount: pnlData.opex.fixedCosts.salaries, percentage: 0 },
      { category: 'Rent', type: 'Fixed Cost', amount: pnlData.opex.fixedCosts.rent, percentage: 0 },
      { category: 'Utilities', type: 'Fixed Cost', amount: pnlData.opex.fixedCosts.utilities, percentage: 0 },
      { category: 'Other Fixed Costs', type: 'Fixed Cost', amount: pnlData.opex.fixedCosts.other, percentage: 0 },
      // Comparison data if available
      ...(pnlData.comparison
        ? [
            { metric: 'Previous Revenue', value: pnlData.comparison.previous.revenue },
            { metric: 'Previous COGS', value: pnlData.comparison.previous.cogs },
            { metric: 'Previous OPEX', value: pnlData.comparison.previous.opex },
            { metric: 'Previous Net Profit', value: pnlData.comparison.previous.netProfit },
            { metric: 'Revenue Change', value: pnlData.comparison.change.revenue },
            { metric: 'Revenue Change %', value: pnlData.comparison.change.revenuePercent },
            { metric: 'Net Profit Change', value: pnlData.comparison.change.netProfit },
            { metric: 'Net Profit Change %', value: pnlData.comparison.change.netProfitPercent },
          ]
        : []),
    ]

    const columns = [
      { key: 'metric' as const, label: 'Metric' },
      { key: 'category' as const, label: 'Category' },
      { key: 'type' as const, label: 'Type' },
      { key: 'amount' as const, label: 'Amount' },
      { key: 'value' as const, label: 'Value' },
      { key: 'percentage' as const, label: 'Percentage %' },
    ]

    let fileBuffer: Buffer
    let contentType: string
    let fileExtension: string

    try {
      if (format === 'csv') {
        const csvContent = exportToCSV(exportData as any, columns as any)
        fileBuffer = Buffer.from(csvContent, 'utf-8')
        contentType = 'text/csv; charset=utf-8'
        fileExtension = 'csv'
      } else if (format === 'excel') {
        fileBuffer = await exportToExcel(exportData as any, columns as any)
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        fileExtension = 'xlsx'
      } else if (format === 'pdf') {
        fileBuffer = await exportToPDF('Profit & Loss Report', exportData as any, columns as any)
        contentType = 'application/pdf'
        fileExtension = 'pdf'
      } else {
        clearTimeout(timeoutId)
        return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
      }
    } catch (exportError: any) {
      logger.error(`${format.toUpperCase()} generation error:`, exportError)
      clearTimeout(timeoutId)
      return NextResponse.json(
        { error: `Failed to generate ${format} file: ${exportError.message}` },
        { status: 500 }
      )
    }

    try {
      await ExportLog.create({
        user: user._id,
        module: 'FINANCIALS',
        format: format.toUpperCase() as 'CSV' | 'EXCEL' | 'PDF',
        filters: { dateFrom, dateTo, branchId, periodType, compareWith },
        rowCount: exportData.length,
      })
    } catch (logError) {
      logger.error('Export logging failed:', logError)
    }

    clearTimeout(timeoutId)
    const timestamp = formatDate(new Date(), 'yyyyMMdd-HHmmss')
    const filename = `pnl-report-${timestamp}.${fileExtension}`

    return new NextResponse(fileBuffer as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error: any) {
    logger.error('P&L export error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export P&L report' },
      { status: 500 }
    )
  }
}

