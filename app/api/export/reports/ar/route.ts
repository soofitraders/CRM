import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/services/exportService'
import ExportLog from '@/lib/models/ExportLog'
import { getAccountsReceivable } from '@/lib/services/reportingService'
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
    const dateAsOf = searchParams.get('dateAsOf') || new Date().toISOString()

    logger.log(`AR export - Format: ${format}, User: ${user.email}`)

    const arData = await getAccountsReceivable({
      dateAsOf: new Date(dateAsOf),
    })

    const exportData = [
      // Summary
      {
        bucket: '0-30 Days',
        amount: arData.buckets['0-30'],
      },
      {
        bucket: '31-60 Days',
        amount: arData.buckets['31-60'],
      },
      {
        bucket: '61-90 Days',
        amount: arData.buckets['61-90'],
      },
      {
        bucket: '90+ Days',
        amount: arData.buckets['90+'],
      },
      {
        bucket: 'Total',
        amount: arData.total,
      },
      // Invoice details
      ...arData.invoices.map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        issueDate: formatDate(new Date(inv.issueDate), 'yyyy-MM-dd'),
        dueDate: formatDate(new Date(inv.dueDate), 'yyyy-MM-dd'),
        total: inv.total,
        paidAmount: inv.paidAmount,
        balance: inv.balance,
        daysOverdue: inv.daysOverdue,
        bucket: inv.bucket,
      })),
    ]

    const columns: { key: string; label: string }[] = [
      { key: 'invoiceNumber', label: 'Invoice #' },
      { key: 'customerName', label: 'Customer' },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'total', label: 'Total' },
      { key: 'paidAmount', label: 'Paid' },
      { key: 'balance', label: 'Balance' },
      { key: 'daysOverdue', label: 'Days Overdue' },
      { key: 'bucket', label: 'Aging Bucket' },
    ]

    let fileBuffer: Buffer
    let contentType: string
    let fileExtension: string

    try {
      if (format === 'csv') {
        const csvContent = exportToCSV(exportData as any[], columns as any[])
        fileBuffer = Buffer.from(csvContent, 'utf-8')
        contentType = 'text/csv; charset=utf-8'
        fileExtension = 'csv'
      } else if (format === 'excel') {
        fileBuffer = await exportToExcel(exportData as any[], columns as any[])
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        fileExtension = 'xlsx'
      } else if (format === 'pdf') {
        fileBuffer = await exportToPDF('Accounts Receivable Report', exportData as any[], columns as any[])
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
        filters: { dateAsOf },
        rowCount: exportData.length,
      })
    } catch (logError) {
      logger.error('Export logging failed:', logError)
    }

    clearTimeout(timeoutId)
    const timestamp = formatDate(new Date(), 'yyyyMMdd-HHmmss')
    const filename = `ar-report-${timestamp}.${fileExtension}`

    return new NextResponse(fileBuffer as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error: any) {
    logger.error('AR export error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export AR report' },
      { status: 500 }
    )
  }
}

