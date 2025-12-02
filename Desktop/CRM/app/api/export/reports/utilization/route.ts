import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/services/exportService'
import ExportLog from '@/lib/models/ExportLog'
import { getUtilizationReport } from '@/lib/services/reportingService'
import { format as formatDate } from 'date-fns'

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

    if (!dateFrom || !dateTo) {
      clearTimeout(timeoutId)
      return NextResponse.json({ error: 'dateFrom and dateTo are required' }, { status: 400 })
    }

    console.log(`Utilization export - Format: ${format}, User: ${user.email}`)

    const utilizationData = await getUtilizationReport({
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      branchId,
      vehicleCategory,
    })

    const exportData = utilizationData.vehicles.map((v) => ({
      plateNumber: v.plateNumber,
      vehicle: `${v.brand} ${v.model}`,
      category: v.category,
      ownershipType: v.ownershipType,
      daysAvailable: v.daysAvailable,
      daysRented: v.daysRented,
      utilizationPercent: v.utilizationPercent,
      revenue: v.revenue,
      revenuePerDay: v.revenuePerDay,
    }))

    const columns = [
      { key: 'plateNumber' as const, label: 'Plate #' },
      { key: 'vehicle' as const, label: 'Vehicle' },
      { key: 'category' as const, label: 'Category' },
      { key: 'ownershipType' as const, label: 'Ownership' },
      { key: 'daysAvailable' as const, label: 'Days Available' },
      { key: 'daysRented' as const, label: 'Days Rented' },
      { key: 'utilizationPercent' as const, label: 'Utilization %' },
      { key: 'revenue' as const, label: 'Revenue' },
      { key: 'revenuePerDay' as const, label: 'Revenue/Day' },
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
        fileBuffer = await exportToPDF('Utilization Report', exportData, columns)
        contentType = 'application/pdf'
        fileExtension = 'pdf'
      } else {
        clearTimeout(timeoutId)
        return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
      }
    } catch (exportError: any) {
      console.error(`${format.toUpperCase()} generation error:`, exportError)
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
        filters: { dateFrom, dateTo, branchId },
        rowCount: exportData.length,
      })
    } catch (logError) {
      console.error('Export logging failed:', logError)
    }

    clearTimeout(timeoutId)
    const timestamp = formatDate(new Date(), 'yyyyMMdd-HHmmss')
    const filename = `utilization-report-${timestamp}.${fileExtension}`

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error: any) {
    console.error('Utilization export error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export utilization report' },
      { status: 500 }
    )
  }
}

