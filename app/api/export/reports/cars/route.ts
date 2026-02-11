export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/services/exportService'
import ExportLog from '@/lib/models/ExportLog'
import { getCarsReport } from '@/lib/services/reportingService'
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

    const carsData = await getCarsReport()

    const exportRows = carsData.rows.map((row) => ({
      vehicleName: row.vehicleName,
      plateNumber: row.plateNumber,
      purchaseDate: row.purchaseDate ? formatDate(new Date(row.purchaseDate), 'yyyy-MM-dd') : 'N/A',
      purchaseCost: row.purchaseCost || 0,
    }))

    const exportData = [
      ...exportRows,
      {
        vehicleName: 'TOTAL',
        plateNumber: '',
        purchaseDate: '',
        purchaseCost: carsData.totalCost || 0,
      },
    ]

    const columns = [
      { key: 'vehicleName' as const, label: 'Vehicle' },
      { key: 'plateNumber' as const, label: 'Plate Number' },
      { key: 'purchaseDate' as const, label: 'Purchase Date' },
      { key: 'purchaseCost' as const, label: 'Purchase Price' },
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
        fileBuffer = await exportToPDF('Cars Report', exportData as any, columns as any)
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
        filters: {},
        rowCount: exportData.length,
      })
    } catch (logError) {
      logger.error('Failed to log export:', logError)
    }

    const timestamp = formatDate(new Date(), 'yyyyMMdd-HHmmss')
    const filename = `cars-report-${timestamp}.${fileExtension}`

    clearTimeout(timeoutId)
    return new NextResponse(fileBuffer as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    logger.error('Error exporting cars report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export cars report' },
      { status: 500 }
    )
  }
}
