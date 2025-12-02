import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/services/exportService'
import ExportLog from '@/lib/models/ExportLog'
import MaintenanceRecord from '@/lib/models/MaintenanceRecord'
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

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS'])) {
      clearTimeout(timeoutId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'
    const vehicleId = searchParams.get('vehicleId')
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const filter: any = {}
    if (vehicleId) filter.vehicle = vehicleId
    if (status) filter.status = status
    if (dateFrom && dateTo) {
      filter.completedDate = {
        $gte: new Date(dateFrom),
        $lte: new Date(dateTo),
      }
    }

    const records = await MaintenanceRecord.find(filter)
      .populate('vehicle', 'plateNumber brand model')
      .populate('maintenanceSchedule', 'serviceType')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean()

    // Prepare export data
    const exportData = records.map((record: any) => ({
      vehicle: record.vehicle
        ? `${record.vehicle.plateNumber} - ${record.vehicle.brand} ${record.vehicle.model}`
        : 'N/A',
      serviceType: record.serviceType || record.maintenanceSchedule?.serviceType || 'N/A',
      type: record.type,
      description: record.description,
      status: record.status,
      scheduledDate: record.scheduledDate
        ? formatDate(new Date(record.scheduledDate), 'yyyy-MM-dd')
        : 'N/A',
      startDate: record.startDate ? formatDate(new Date(record.startDate), 'yyyy-MM-dd') : 'N/A',
      completedDate: record.completedDate
        ? formatDate(new Date(record.completedDate), 'yyyy-MM-dd')
        : 'N/A',
      cost: record.cost || 0,
      vendorName: record.vendorName || 'N/A',
      mileageAtService: record.mileageAtService || 'N/A',
      downtimeHours: record.downtimeHours || 0,
      createdBy: record.createdBy?.name || 'N/A',
      createdAt: formatDate(new Date(record.createdAt), 'yyyy-MM-dd'),
    }))

    const columns = [
      { key: 'vehicle' as const, label: 'Vehicle' },
      { key: 'serviceType' as const, label: 'Service Type' },
      { key: 'type' as const, label: 'Type' },
      { key: 'description' as const, label: 'Description' },
      { key: 'status' as const, label: 'Status' },
      { key: 'scheduledDate' as const, label: 'Scheduled Date' },
      { key: 'startDate' as const, label: 'Start Date' },
      { key: 'completedDate' as const, label: 'Completed Date' },
      { key: 'cost' as const, label: 'Cost' },
      { key: 'vendorName' as const, label: 'Vendor' },
      { key: 'mileageAtService' as const, label: 'Mileage' },
      { key: 'downtimeHours' as const, label: 'Downtime (Hours)' },
      { key: 'createdBy' as const, label: 'Created By' },
      { key: 'createdAt' as const, label: 'Created At' },
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
        fileBuffer = await exportToPDF('Maintenance Records Report', exportData, columns)
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
        module: 'MAINTENANCE',
        format: format.toUpperCase() as 'CSV' | 'EXCEL' | 'PDF',
        filters: { vehicleId, status, dateFrom, dateTo },
        rowCount: exportData.length,
      })
    } catch (logError) {
      logger.error('Export logging failed:', logError)
    }

    clearTimeout(timeoutId)
    const timestamp = formatDate(new Date(), 'yyyyMMdd-HHmmss')
    const filename = `maintenance-records-${timestamp}.${fileExtension}`

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error: any) {
    logger.error('Maintenance export error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export maintenance records' },
      { status: 500 }
    )
  }
}

