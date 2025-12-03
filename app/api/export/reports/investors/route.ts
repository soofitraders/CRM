export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/services/exportService'
import ExportLog from '@/lib/models/ExportLog'
import { getInvestorPerformanceReport } from '@/lib/services/investorReportService'
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
    const investorId = searchParams.get('investorId') || undefined

    if (!dateFrom || !dateTo) {
      clearTimeout(timeoutId)
      return NextResponse.json({ error: 'dateFrom and dateTo are required' }, { status: 400 })
    }

    logger.log(`Investor report export - Format: ${format}, User: ${user.email}`)

    const reportData = await getInvestorPerformanceReport({
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      investorId,
      branchId,
    })

    // Prepare export data
    const exportData = [
      // Summary
      {
        type: 'Summary',
        metric: 'Total Investors',
        value: reportData.summary.totalInvestors,
        amount: 0,
      },
      {
        type: 'Summary',
        metric: 'Total Revenue',
        value: 0,
        amount: reportData.summary.totalRevenue,
      },
      {
        type: 'Summary',
        metric: 'Total Commission',
        value: 0,
        amount: reportData.summary.totalCommission,
      },
      {
        type: 'Summary',
        metric: 'Total Net Payout',
        value: 0,
        amount: reportData.summary.totalNetPayout,
      },
      {
        type: 'Summary',
        metric: 'Average Commission %',
        value: reportData.summary.averageCommissionPercent,
        amount: 0,
      },
      // Investor performance
      ...reportData.investors.flatMap((inv) => [
        {
          type: 'Investor Performance',
          investor: inv.companyName || inv.investorName,
          vehicles: inv.totalVehicles,
          revenue: inv.totalRevenue,
          commission: inv.totalCommission,
          netPayout: inv.totalNetPayout,
          commissionPercent: inv.averageCommissionPercent,
          revenuePerVehicle: inv.revenuePerVehicle,
          commissionPerVehicle: inv.commissionPerVehicle,
          bookings: inv.totalBookings,
        },
        // Vehicle breakdown for each investor
        ...inv.vehicles.map((v) => ({
          type: 'Vehicle Performance',
          investor: inv.companyName || inv.investorName,
          plateNumber: v.plateNumber,
          vehicle: `${v.brand} ${v.model}`,
          category: v.category,
          revenue: v.revenue,
          commission: v.commission,
          netPayout: v.netPayout,
          bookings: v.bookingsCount,
        })),
      ]),
      // Payout details
      ...reportData.payouts.map((payout) => ({
        type: 'Payout',
        periodFrom: formatDate(new Date(payout.periodFrom), 'yyyy-MM-dd'),
        periodTo: formatDate(new Date(payout.periodTo), 'yyyy-MM-dd'),
        revenue: payout.totalRevenue,
        commissionPercent: payout.commissionPercent,
        commission: payout.commissionAmount,
        netPayout: payout.netPayout,
        status: payout.status,
        paymentStatus: payout.paymentStatus || 'N/A',
        paidAt: payout.paidAt ? formatDate(new Date(payout.paidAt), 'yyyy-MM-dd') : 'N/A',
      })),
      // Commission analysis
      ...reportData.commissionAnalysis.map((analysis) => ({
        type: 'Commission Analysis',
        investor: analysis.investorName,
        commissionPercent: analysis.commissionPercent,
        revenue: analysis.totalRevenue,
        commission: analysis.commissionAmount,
        netPayout: analysis.netPayout,
        commissionImpact: analysis.commissionImpact,
        effectiveRate: analysis.effectiveRate,
      })),
    ]

    const columns = [
      { key: 'type' as const, label: 'Type' },
      { key: 'investor' as const, label: 'Investor' },
      { key: 'metric' as const, label: 'Metric' },
      { key: 'vehicles' as const, label: 'Vehicles' },
      { key: 'revenue' as const, label: 'Revenue' },
      { key: 'commission' as const, label: 'Commission' },
      { key: 'netPayout' as const, label: 'Net Payout' },
      { key: 'commissionPercent' as const, label: 'Commission %' },
      { key: 'revenuePerVehicle' as const, label: 'Revenue/Vehicle' },
      { key: 'commissionPerVehicle' as const, label: 'Commission/Vehicle' },
      { key: 'bookings' as const, label: 'Bookings' },
      { key: 'status' as const, label: 'Status' },
      { key: 'value' as const, label: 'Value' },
      { key: 'amount' as const, label: 'Amount' },
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
        fileBuffer = await exportToPDF('Investor Performance Report', exportData as any, columns as any)
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
        filters: { dateFrom, dateTo, branchId, investorId },
        rowCount: exportData.length,
      })
    } catch (logError) {
      logger.error('Export logging failed:', logError)
    }

    clearTimeout(timeoutId)
    const timestamp = formatDate(new Date(), 'yyyyMMdd-HHmmss')
    const filename = `investor-report-${timestamp}.${fileExtension}`

    return new NextResponse(fileBuffer as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error: any) {
    logger.error('Investor report export error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export investor report' },
      { status: 500 }
    )
  }
}
