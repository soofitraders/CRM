import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import Invoice from '@/lib/models/Invoice'
import Booking from '@/lib/models/Booking'
import CustomerProfile from '@/lib/models/CustomerProfile'
import User from '@/lib/models/User'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { UserRole } from '@/lib/models/User'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/services/exportService'
import ExportLog from '@/lib/models/ExportLog'
import { format as formatDate } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    // 1. Check session
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Get current user
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 3. Check permissions
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 4. Connect to database
    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'

    // 5. Build filter from query params
    const filter: any = {}

    const status = searchParams.get('status')
    if (status) {
      filter.status = status
    }

    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    if (dateFrom || dateTo) {
      filter.issueDate = {}
      if (dateFrom) {
        try {
          filter.issueDate.$gte = new Date(dateFrom)
        } catch (e) {
          return NextResponse.json({ error: 'Invalid dateFrom format' }, { status: 400 })
        }
      }
      if (dateTo) {
        try {
          const date = new Date(dateTo)
          date.setHours(23, 59, 59, 999) // End of day
          filter.issueDate.$lte = date
        } catch (e) {
          return NextResponse.json({ error: 'Invalid dateTo format' }, { status: 400 })
        }
      }
    }

    const search = searchParams.get('search')
    if (search) {
      filter.$or = [{ invoiceNumber: { $regex: search, $options: 'i' } }]
    }

    console.log('Fetching invoices with filter:', JSON.stringify(filter))

    // 6. Fetch invoices with populated data
    const invoices = await Invoice.find(filter)
      .populate({
        path: 'booking',
        model: Booking,
        populate: {
          path: 'customer',
          model: CustomerProfile,
          populate: {
            path: 'user',
            model: User,
            select: 'name email',
          },
        },
      })
      .sort({ issueDate: -1 })
      .lean()

    console.log(`Found ${invoices.length} invoices`)

    if (invoices.length === 0) {
      console.log('No invoices found matching criteria')
    }

    // 7. Map to export-friendly format
    const exportData = invoices.map((invoice: any) => {
      const customerName = invoice.booking?.customer?.user?.name || 'N/A'
      const customerEmail = invoice.booking?.customer?.user?.email || 'N/A'
      
      return {
        invoiceNumber: invoice.invoiceNumber || 'N/A',
        issueDate: invoice.issueDate ? formatDate(new Date(invoice.issueDate), 'yyyy-MM-dd') : 'N/A',
        dueDate: invoice.dueDate ? formatDate(new Date(invoice.dueDate), 'yyyy-MM-dd') : 'N/A',
        customerName,
        customerEmail,
        status: invoice.status || 'N/A',
        subtotal: invoice.subtotal || 0,
        taxAmount: invoice.taxAmount || 0,
        total: invoice.total || 0,
        paidAmount: invoice.paidAmount || 0,
        balance: (invoice.total || 0) - (invoice.paidAmount || 0),
      }
    })

    // 8. Define columns
    const columns = [
      { key: 'invoiceNumber' as const, label: 'Invoice Number' },
      { key: 'issueDate' as const, label: 'Issue Date' },
      { key: 'dueDate' as const, label: 'Due Date' },
      { key: 'customerName' as const, label: 'Customer Name' },
      { key: 'customerEmail' as const, label: 'Customer Email' },
      { key: 'status' as const, label: 'Status' },
      { key: 'subtotal' as const, label: 'Subtotal' },
      { key: 'taxAmount' as const, label: 'Tax Amount' },
      { key: 'total' as const, label: 'Total' },
      { key: 'paidAmount' as const, label: 'Paid Amount' },
      { key: 'balance' as const, label: 'Balance' },
    ]

    // 9. Generate export
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
        const csvContent = exportToCSV(exportData, columns)
        fileBuffer = Buffer.from(csvContent, 'utf-8')
        contentType = 'text/csv; charset=utf-8'
        fileExtension = 'csv'
      } else if (format === 'excel') {
        fileBuffer = await exportToExcel(exportData, columns)
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        fileExtension = 'xlsx'
      } else if (format === 'pdf') {
        fileBuffer = await exportToPDF('Invoices Export', exportData, columns)
        contentType = 'application/pdf'
        fileExtension = 'pdf'
      } else {
        return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
      }
    } catch (exportError: any) {
      console.error('Export generation error:', exportError)
      return NextResponse.json(
        { error: `Failed to generate ${format} file: ${exportError.message}` },
        { status: 500 }
      )
    }

    // 10. Log export
    try {
      await ExportLog.create({
        user: user._id,
        module: 'INVOICES',
        format: format.toUpperCase() as 'CSV' | 'EXCEL' | 'PDF',
        filters,
        rowCount: exportData.length,
      })
    } catch (logError) {
      console.error('Failed to log export:', logError)
      // Don't fail the request if logging fails
    }

    // 11. Generate filename
    const timestamp = formatDate(new Date(), 'yyyyMMdd-HHmmss')
    const filename = `invoices-${timestamp}.${fileExtension}`

    console.log(`Returning ${format} file: ${filename} (${fileBuffer.length} bytes)`)

    // 12. Return file
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('Error exporting invoices:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export invoices' },
      { status: 500 }
    )
  }
}