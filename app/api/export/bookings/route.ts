import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import Booking from '@/lib/models/Booking'
import Vehicle from '@/lib/models/Vehicle'
import CustomerProfile from '@/lib/models/CustomerProfile'
import User from '@/lib/models/User'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { UserRole } from '@/lib/models/User'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/services/exportService'
import ExportLog from '@/lib/models/ExportLog'
import { format as formatDate } from 'date-fns'
import { logger } from '@/lib/utils/performance'

export async function GET(request: NextRequest) {
  try {
    // 1. Add request timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 sec timeout

    // 2. Better authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      clearTimeout(timeoutId)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 3. Use proper import (not dynamic)
    const user = await getCurrentUser()
    if (!user) {
      clearTimeout(timeoutId)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 4. Permission check
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      clearTimeout(timeoutId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()
    
    // Ensure all models are registered
    void Vehicle
    void CustomerProfile
    void User

    // 5. Get query parameters
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'

    logger.log(`Export request - Format: ${format}, User: ${user.email}, Module: BOOKINGS`)

    // Build filter from query params
    const filter: any = {}

    const status = searchParams.get('status')
    if (status) {
      filter.status = status
    }

    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    if (dateFrom || dateTo) {
      filter.startDateTime = {}
      if (dateFrom) {
        filter.startDateTime.$gte = new Date(dateFrom)
      }
      if (dateTo) {
        filter.startDateTime.$lte = new Date(dateTo)
      }
    }

    const search = searchParams.get('search')
    if (search) {
      filter.$or = [{ notes: { $regex: search, $options: 'i' } }]
    }

    // 6. Build filters and fetch data
    logger.log('Fetching bookings with filter:', JSON.stringify(filter))

    const bookings = await Booking.find(filter)
      .populate({
        path: 'vehicle',
        select: 'plateNumber brand model year',
      })
      .populate({
        path: 'customer',
        select: 'user',
        populate: {
          path: 'user',
          select: 'name email phone',
        },
      })
      .populate({
        path: 'bookedBy',
        select: 'name email',
      })
      .sort({ startDateTime: -1 })
      .lean()

    logger.log(`Fetched ${bookings.length} bookings for export`)

    // 7. Map to export format
    const exportData = bookings.map((booking: any) => ({
      bookingId: booking._id?.toString().slice(-8) || 'N/A',
      customerName: booking.customer?.user?.name || 'N/A',
      customerEmail: booking.customer?.user?.email || 'N/A',
      customerPhone: booking.customer?.user?.phone || 'N/A',
      vehicle: booking.vehicle
        ? `${booking.vehicle.plateNumber} - ${booking.vehicle.brand} ${booking.vehicle.model}`
        : 'N/A',
      startDate: booking.startDateTime ? formatDate(new Date(booking.startDateTime), 'yyyy-MM-dd HH:mm') : 'N/A',
      endDate: booking.endDateTime ? formatDate(new Date(booking.endDateTime), 'yyyy-MM-dd HH:mm') : 'N/A',
      status: booking.status || 'N/A',
      paymentStatus: booking.paymentStatus || 'N/A',
      depositAmount: booking.depositAmount || 0,
      depositStatus: booking.depositStatus || 'N/A',
      totalAmount: booking.totalAmount || 0,
      bookedBy: booking.bookedBy?.name || 'N/A',
      notes: booking.notes || '',
    }))

    // 8. Define columns
    const columns = [
      { key: 'bookingId' as const, label: 'Booking ID' },
      { key: 'customerName' as const, label: 'Customer Name' },
      { key: 'customerEmail' as const, label: 'Customer Email' },
      { key: 'customerPhone' as const, label: 'Customer Phone' },
      { key: 'vehicle' as const, label: 'Vehicle' },
      { key: 'startDate' as const, label: 'Start Date' },
      { key: 'endDate' as const, label: 'End Date' },
      { key: 'status' as const, label: 'Status' },
      { key: 'paymentStatus' as const, label: 'Payment Status' },
      { key: 'depositAmount' as const, label: 'Deposit Amount' },
      { key: 'depositStatus' as const, label: 'Deposit Status' },
      { key: 'totalAmount' as const, label: 'Total Amount' },
      { key: 'bookedBy' as const, label: 'Booked By' },
      { key: 'notes' as const, label: 'Notes' },
    ]

    // 9. Generate export with detailed error handling
    let fileBuffer: Buffer
    let contentType: string
    let fileExtension: string

    const filters = {
      status: status || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      search: search || undefined,
    }

    try {
      if (format === 'csv') {
        logger.log('Generating CSV...')
        const csvContent = exportToCSV(exportData, columns)
        fileBuffer = Buffer.from(csvContent, 'utf-8')
        contentType = 'text/csv; charset=utf-8'
        fileExtension = 'csv'
      } else if (format === 'excel') {
        logger.log('Generating Excel...')
        fileBuffer = await exportToExcel(exportData, columns)
        contentType =
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        fileExtension = 'xlsx'
      } else if (format === 'pdf') {
        logger.log('Generating PDF...')
        fileBuffer = await exportToPDF('Bookings Export', exportData, columns)

        if (!fileBuffer || fileBuffer.length === 0) {
          throw new Error('PDF generation returned empty buffer')
        }

        logger.log(`PDF generated: ${fileBuffer.length} bytes`)
        contentType = 'application/pdf'
        fileExtension = 'pdf'
      } else {
        clearTimeout(timeoutId)
        return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
      }
    } catch (exportError: any) {
      logger.error(`${format.toUpperCase()} generation error:`, exportError)
      logger.error('Stack trace:', exportError.stack)
      clearTimeout(timeoutId)
      return NextResponse.json(
        { error: `Failed to generate ${format} file: ${exportError.message}` },
        { status: 500 }
      )
    }

    // 10. Log export (non-blocking)
    try {
      await ExportLog.create({
        user: user._id,
        module: 'BOOKINGS',
        format: format.toUpperCase() as 'CSV' | 'EXCEL' | 'PDF',
        filters,
        rowCount: exportData.length,
      })
    } catch (logError) {
      logger.error('Export logging failed:', logError)
      // Don't fail the request if logging fails
    }

    // 11. Generate filename and return
    clearTimeout(timeoutId)
    const timestamp = formatDate(new Date(), 'yyyyMMdd-HHmmss')
    const filename = `bookings-${timestamp}.${fileExtension}`

    logger.log(`Returning file: ${filename} (${fileBuffer.length} bytes)`)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    logger.error('Export route error:', error)
    logger.error('Error stack:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Failed to export bookings' },
      { status: 500 }
    )
  }
}

