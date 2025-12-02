import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import CustomerProfile from '@/lib/models/CustomerProfile'
import User from '@/lib/models/User'
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
    let filter: any = {}

    const search = searchParams.get('search')
    if (search) {
      const userFilter = {
        role: 'CUSTOMER',
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ],
      }
      const matchingUsers = await User.find(userFilter).select('_id').lean()
      const userIds = matchingUsers.map((u) => u._id)

      const searchRegex = { $regex: search, $options: 'i' }
      const profileFilter = {
        $or: [
          { drivingLicenseNumber: searchRegex },
          { nationalId: searchRegex },
          { passportNumber: searchRegex },
          { phone: searchRegex },
        ],
      }

      if (userIds.length > 0) {
        filter = {
          $or: [{ user: { $in: userIds } }, profileFilter],
        }
      } else {
        filter = profileFilter
      }
    }

    const activeOnly = searchParams.get('activeOnly')
    if (activeOnly === 'true') {
      const activeUsers = await User.find({ role: 'CUSTOMER', status: 'ACTIVE' })
        .select('_id')
        .lean()
      const activeUserIds = activeUsers.map((u) => u._id)
      filter.user = { $in: activeUserIds }
    }

    // Fetch customers with populated data
    const customers = await CustomerProfile.find(filter)
      .populate('user', 'name email phone status')
      .sort({ createdAt: -1 })
      .lean()

    // Map to export-friendly format
    const exportData = customers.map((customer: any) => ({
      customerName: customer.user?.name || 'N/A',
      email: customer.user?.email || 'N/A',
      phone: customer.phone || customer.user?.phone || 'N/A',
      alternatePhone: customer.alternatePhone || 'N/A',
      drivingLicenseNumber: customer.drivingLicenseNumber || 'N/A',
      nationalId: customer.nationalId || 'N/A',
      passportNumber: customer.passportNumber || 'N/A',
      dateOfBirth: customer.dateOfBirth
        ? formatDate(new Date(customer.dateOfBirth), 'yyyy-MM-dd')
        : 'N/A',
      address: customer.address || 'N/A',
      status: customer.user?.status || 'N/A',
      createdAt: customer.createdAt
        ? formatDate(new Date(customer.createdAt), 'yyyy-MM-dd')
        : 'N/A',
    }))

    // Define columns
    const columns = [
      { key: 'customerName' as const, label: 'Customer Name' },
      { key: 'email' as const, label: 'Email' },
      { key: 'phone' as const, label: 'Phone' },
      { key: 'alternatePhone' as const, label: 'Alternate Phone' },
      { key: 'drivingLicenseNumber' as const, label: 'Driving License' },
      { key: 'nationalId' as const, label: 'National ID' },
      { key: 'passportNumber' as const, label: 'Passport Number' },
      { key: 'dateOfBirth' as const, label: 'Date of Birth' },
      { key: 'address' as const, label: 'Address' },
      { key: 'status' as const, label: 'Status' },
      { key: 'createdAt' as const, label: 'Created At' },
    ]

    // Generate export
    let fileBuffer: Buffer
    let contentType: string
    let fileExtension: string

    const filters = {
      search: search || undefined,
      activeOnly: activeOnly || undefined,
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
      fileBuffer = await exportToPDF('Clients Export', exportData, columns)
      contentType = 'application/pdf'
      fileExtension = 'pdf'
    } else {
      return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
    }

    // Log export
    await ExportLog.create({
      user: user._id,
      module: 'CLIENTS',
      format: format.toUpperCase() as 'CSV' | 'EXCEL' | 'PDF',
      filters,
      rowCount: exportData.length,
    })

    // Generate filename
    const timestamp = formatDate(new Date(), 'yyyyMMdd-HHmmss')
    const filename = `clients-${timestamp}.${fileExtension}`

    // Return file
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    logger.error('Error exporting clients:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export clients' },
      { status: 500 }
    )
  }
}

