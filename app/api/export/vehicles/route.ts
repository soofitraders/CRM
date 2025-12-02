import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import Vehicle from '@/lib/models/Vehicle'
import { hasRole } from '@/lib/auth'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/services/exportService'
import ExportLog from '@/lib/models/ExportLog'
import { format as formatDate } from 'date-fns'
import { logger } from '@/lib/utils/performance'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await import('@/lib/auth').then((m) => m.getCurrentUser())
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check permissions: SUPER_ADMIN, ADMIN can export
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'

    // Build filter from query params
    const filter: any = {}

    const status = searchParams.get('status')
    if (status) {
      filter.status = status
    }

    const ownershipType = searchParams.get('ownershipType')
    if (ownershipType) {
      filter.ownershipType = ownershipType
    }

    const search = searchParams.get('search')
    if (search) {
      filter.$or = [
        { plateNumber: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { vin: { $regex: search, $options: 'i' } },
      ]
    }

    // Fetch vehicles with populated data
    const vehicles = await Vehicle.find(filter)
      .populate('investor', 'user')
      .sort({ plateNumber: 1 })
      .lean()

    // Map to export-friendly format
    const exportData = vehicles.map((vehicle: any) => ({
      plateNumber: vehicle.plateNumber || 'N/A',
      brand: vehicle.brand || 'N/A',
      model: vehicle.model || 'N/A',
      year: vehicle.year || 'N/A',
      color: vehicle.color || 'N/A',
      vin: vehicle.vin || 'N/A',
      category: vehicle.category || 'N/A',
      status: vehicle.status || 'N/A',
      ownershipType: vehicle.ownershipType || 'N/A',
      dailyRate: vehicle.dailyRate || 0,
      mileage: vehicle.mileage || 0,
      currentBranch: vehicle.currentBranch || 'N/A',
      createdAt: vehicle.createdAt
        ? formatDate(new Date(vehicle.createdAt), 'yyyy-MM-dd')
        : 'N/A',
    }))

    // Define columns
    const columns = [
      { key: 'plateNumber' as const, label: 'Plate Number' },
      { key: 'brand' as const, label: 'Brand' },
      { key: 'model' as const, label: 'Model' },
      { key: 'year' as const, label: 'Year' },
      { key: 'color' as const, label: 'Color' },
      { key: 'vin' as const, label: 'VIN' },
      { key: 'category' as const, label: 'Category' },
      { key: 'status' as const, label: 'Status' },
      { key: 'ownershipType' as const, label: 'Ownership Type' },
      { key: 'dailyRate' as const, label: 'Daily Rate' },
      { key: 'mileage' as const, label: 'Mileage' },
      { key: 'currentBranch' as const, label: 'Branch' },
      { key: 'createdAt' as const, label: 'Created At' },
    ]

    // Generate export
    let fileBuffer: Buffer
    let contentType: string
    let fileExtension: string

    const filters = {
      status: status || undefined,
      ownershipType: ownershipType || undefined,
      search: search || undefined,
    }

    if (format === 'csv') {
      const csvContent = exportToCSV(exportData, columns)
      fileBuffer = Buffer.from(csvContent, 'utf-8')
      contentType = 'text/csv; charset=utf-8'
      fileExtension = 'csv'
    } else if (format === 'excel') {
      fileBuffer = await exportToExcel(exportData, columns)
      contentType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      fileExtension = 'xlsx'
    } else if (format === 'pdf') {
      fileBuffer = await exportToPDF('Vehicles Export', exportData, columns)
      contentType = 'application/pdf'
      fileExtension = 'pdf'
    } else {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
    }

    // Log export
    await ExportLog.create({
      user: user._id,
      module: 'VEHICLES',
      format: format.toUpperCase() as 'CSV' | 'EXCEL' | 'PDF',
      filters,
      rowCount: exportData.length,
    })

    // Generate filename
    const timestamp = formatDate(new Date(), 'yyyyMMdd-HHmmss')
    const filename = `vehicles-${timestamp}.${fileExtension}`

    // Return file
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    logger.error('Error exporting vehicles:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export vehicles' },
      { status: 500 }
    )
  }
}

