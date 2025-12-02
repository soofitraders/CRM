import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/services/exportService'
import ExportLog from '@/lib/models/ExportLog'
import { getRevenueOverview } from '@/lib/services/reportingService'
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
    const vehicleCategory = searchParams.get('vehicleCategory') || undefined
    const customerType = searchParams.get('customerType') || undefined
    const groupBy = (searchParams.get('groupBy') || 'day') as 'day' | 'week' | 'month'

    if (!dateFrom || !dateTo) {
      clearTimeout(timeoutId)
      return NextResponse.json({ error: 'dateFrom and dateTo are required' }, { status: 400 })
    }

    logger.log(`Revenue export - Format: ${format}, User: ${user.email}`)

    // Get revenue data
    const revenueData = await getRevenueOverview({
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      branchId,
      vehicleCategory: vehicleCategory as any,
      customerType: customerType as any,
      groupBy,
    })

    // Prepare export data
    const exportData = [
      // Summary row
      {
        metric: 'Gross Rental Revenue',
        value: revenueData.summary.grossRentalRevenue,
      },
      {
        metric: 'Discounts',
        value: revenueData.summary.discounts,
      },
      {
        metric: 'Tax Collected',
        value: revenueData.summary.taxCollected,
      },
      {
        metric: 'Net Rental Revenue',
        value: revenueData.summary.netRentalRevenue,
      },
      {
        metric: 'Total Bookings',
        value: revenueData.summary.totalBookings,
      },
      {
        metric: 'Average Booking Value',
        value: revenueData.summary.averageBookingValue,
      },
      // Period breakdown
      ...revenueData.byPeriod.map((p) => ({
        period: p.period,
        grossRevenue: p.grossRevenue,
        discounts: p.discounts,
        tax: p.tax,
        netRevenue: p.netRevenue,
        bookings: p.bookings,
      })),
    ]

    const columns = [
      { key: 'period' as const, label: 'Period' },
      { key: 'grossRevenue' as const, label: 'Gross Revenue' },
      { key: 'discounts' as const, label: 'Discounts' },
      { key: 'tax' as const, label: 'Tax' },
      { key: 'netRevenue' as const, label: 'Net Revenue' },
      { key: 'bookings' as const, label: 'Bookings' },
    ]

    let fileBuffer: Buffer
    let contentType: string
    let fileExtension: string

    try {
      if (format === 'csv') {
        const csvContent = exportToCSV(exportData, columns)
        fileBuffer = Buffer.from(csvContent, 'utf-8')
        contentType = 'text/csv; charset=utf-8'
        fileExtension = 'csv'
      } else if (format === 'excel') {
        fileBuffer = await exportToExcel(exportData, columns)
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        fileExtension = 'xlsx'
      } else if (format === 'pdf') {
        fileBuffer = await exportToPDF('Revenue Report', exportData, columns)
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
        filters: { dateFrom, dateTo, branchId, vehicleCategory, customerType, groupBy },
        rowCount: exportData.length,
      })
    } catch (logError) {
      logger.error('Export logging failed:', logError)
    }

    clearTimeout(timeoutId)
    const timestamp = formatDate(new Date(), 'yyyyMMdd-HHmmss')
    const filename = `revenue-report-${timestamp}.${fileExtension}`

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error: any) {
    logger.error('Revenue export error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export revenue report' },
      { status: 500 }
    )
  }
}

