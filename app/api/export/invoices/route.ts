export const dynamic = 'force-dynamic'

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
import { logger } from '@/lib/utils/performance'

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

    logger.log('Fetching invoices with filter:', JSON.stringify(filter))

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

    logger.log(`Found ${invoices.length} invoices`)

    if (invoices.length === 0) {
      logger.log('No invoices found matching criteria')
    }

    const isSalikCharge = (item: any): boolean => {
      if (!item || typeof item.label !== 'string') return false
      const label = item.label.toLowerCase()
      return item.amount > 0 && (label.includes('salik') || label.includes('toll'))
    }

    const isFineCharge = (item: any): boolean => {
      if (!item || typeof item.label !== 'string') return false
      const label = item.label.toLowerCase()
      return item.amount > 0 && (
        label.includes('fine') ||
        label.includes('penalty') ||
        label.includes('government') ||
        label.includes('traffic')
      )
    }

    const sumCharges = (items: any[], predicate: (item: any) => boolean): number => {
      if (!items || !Array.isArray(items)) return 0
      return items.filter(predicate).reduce((sum, item) => sum + item.amount, 0)
    }

    // 7. Map to export-friendly format
    const exportRows = invoices.map((invoice: any) => {
      const customerName = invoice.booking?.customer?.user?.name || 'N/A'
      const items = invoice.items || []
      const salikCharges = sumCharges(items, isSalikCharge)
      const finesAmount = sumCharges(items, isFineCharge)
      const advanceAmount = invoice.paidAmount || 0
      const totalAmount = invoice.total || 0

      return {
        invoiceNumber: invoice.invoiceNumber || 'N/A',
        issueDate: invoice.issueDate ? formatDate(new Date(invoice.issueDate), 'yyyy-MM-dd') : 'N/A',
        dueDate: invoice.dueDate ? formatDate(new Date(invoice.dueDate), 'yyyy-MM-dd') : 'N/A',
        customerName,
        status: invoice.status || 'N/A',
        subtotal: invoice.subtotal || 0,
        taxAmount: invoice.taxAmount || 0,
        salikCharges,
        finesAmount,
        total: totalAmount,
        advanceAmount,
        balance: totalAmount - advanceAmount,
      }
    })

    const totals = exportRows.reduce(
      (acc, row) => ({
        subtotal: acc.subtotal + (row.subtotal || 0),
        taxAmount: acc.taxAmount + (row.taxAmount || 0),
        salikCharges: acc.salikCharges + (row.salikCharges || 0),
        finesAmount: acc.finesAmount + (row.finesAmount || 0),
        total: acc.total + (row.total || 0),
        advanceAmount: acc.advanceAmount + (row.advanceAmount || 0),
        balance: acc.balance + (row.balance || 0),
      }),
      {
        subtotal: 0,
        taxAmount: 0,
        salikCharges: 0,
        finesAmount: 0,
        total: 0,
        advanceAmount: 0,
        balance: 0,
      }
    )

    const exportData = [
      ...exportRows,
      {
        invoiceNumber: 'TOTAL',
        issueDate: '',
        dueDate: '',
        customerName: '',
        status: '',
        ...totals,
      },
    ]

    // 8. Define columns
    const columns = [
      { key: 'invoiceNumber' as const, label: 'Invoice Number' },
      { key: 'issueDate' as const, label: 'Issue Date' },
      { key: 'dueDate' as const, label: 'Due Date' },
      { key: 'customerName' as const, label: 'Customer Name' },
      { key: 'status' as const, label: 'Status' },
      { key: 'subtotal' as const, label: 'Subtotal' },
      { key: 'taxAmount' as const, label: 'Tax Amount' },
      { key: 'salikCharges' as const, label: 'Salik Charges' },
      { key: 'finesAmount' as const, label: 'Fines Amount' },
      { key: 'total' as const, label: 'Total' },
      { key: 'advanceAmount' as const, label: 'Advance Amount' },
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
        const csvContent = exportToCSV(exportData as any, columns as any)
        fileBuffer = Buffer.from(csvContent, 'utf-8')
        contentType = 'text/csv; charset=utf-8'
        fileExtension = 'csv'
      } else if (format === 'excel') {
        fileBuffer = await exportToExcel(exportData as any, columns as any)
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        fileExtension = 'xlsx'
      } else if (format === 'pdf') {
        fileBuffer = await exportToPDF('Invoices Export', exportData as any, columns as any)
        contentType = 'application/pdf'
        fileExtension = 'pdf'
      } else {
        return NextResponse.json({ error: 'Invalid format' }, { status: 400 })
      }
    } catch (exportError: any) {
      logger.error('Export generation error:', exportError)
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
      logger.error('Failed to log export:', logError)
      // Don't fail the request if logging fails
    }

    // 11. Generate filename
    const timestamp = formatDate(new Date(), 'yyyyMMdd-HHmmss')
    const filename = `invoices-${timestamp}.${fileExtension}`

    logger.log(`Returning ${format} file: ${filename} (${fileBuffer.length} bytes)`)

    // 12. Return file
    return new NextResponse(fileBuffer as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    logger.error('Error exporting invoices:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export invoices' },
      { status: 500 }
    )
  }
}