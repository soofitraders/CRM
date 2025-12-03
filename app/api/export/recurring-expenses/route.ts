import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/services/exportService'
import ExportLog from '@/lib/models/ExportLog'
import RecurringExpense from '@/lib/models/RecurringExpense'
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
    const isActive = searchParams.get('isActive')
    const branchId = searchParams.get('branchId')

    const filter: any = {}
    if (isActive !== null) {
      filter.isActive = isActive === 'true'
    }
    if (branchId) {
      filter.branchId = branchId
    }

    const recurringExpenses = await RecurringExpense.find(filter)
      .populate('category', 'name type code')
      .populate('createdBy', 'name email')
      .sort({ nextDueDate: 1 })
      .lean()

    // Prepare export data
    const exportData = recurringExpenses.map((exp: any) => ({
      description: exp.description,
      category: exp.category?.name || 'N/A',
      categoryType: exp.category?.type || 'N/A',
      amount: exp.amount,
      currency: exp.currency,
      interval: exp.interval,
      startDate: formatDate(new Date(exp.startDate), 'yyyy-MM-dd'),
      nextDueDate: formatDate(new Date(exp.nextDueDate), 'yyyy-MM-dd'),
      endDate: exp.endDate ? formatDate(new Date(exp.endDate), 'yyyy-MM-dd') : 'N/A',
      branchId: exp.branchId || 'N/A',
      isActive: exp.isActive ? 'Yes' : 'No',
      reminderDaysBefore: exp.reminderDaysBefore,
      currentOccurrence: exp.currentOccurrence,
      totalOccurrences: exp.totalOccurrences || 'Unlimited',
      lastProcessedDate: exp.lastProcessedDate
        ? formatDate(new Date(exp.lastProcessedDate), 'yyyy-MM-dd')
        : 'Never',
      createdBy: exp.createdBy?.name || 'N/A',
      createdAt: formatDate(new Date(exp.createdAt), 'yyyy-MM-dd'),
      notes: exp.notes || '',
    }))

    const columns = [
      { key: 'description' as const, label: 'Description' },
      { key: 'category' as const, label: 'Category' },
      { key: 'categoryType' as const, label: 'Category Type' },
      { key: 'amount' as const, label: 'Amount' },
      { key: 'currency' as const, label: 'Currency' },
      { key: 'interval' as const, label: 'Interval' },
      { key: 'startDate' as const, label: 'Start Date' },
      { key: 'nextDueDate' as const, label: 'Next Due Date' },
      { key: 'endDate' as const, label: 'End Date' },
      { key: 'branchId' as const, label: 'Branch' },
      { key: 'isActive' as const, label: 'Active' },
      { key: 'reminderDaysBefore' as const, label: 'Reminder Days' },
      { key: 'currentOccurrence' as const, label: 'Occurrences' },
      { key: 'totalOccurrences' as const, label: 'Total Occurrences' },
      { key: 'lastProcessedDate' as const, label: 'Last Processed' },
      { key: 'createdBy' as const, label: 'Created By' },
      { key: 'createdAt' as const, label: 'Created At' },
      { key: 'notes' as const, label: 'Notes' },
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
        fileBuffer = await exportToPDF('Recurring Expenses Report', exportData as any, columns as any)
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
        filters: { isActive, branchId },
        rowCount: exportData.length,
      })
    } catch (logError) {
      logger.error('Export logging failed:', logError)
    }

    clearTimeout(timeoutId)
    const timestamp = formatDate(new Date(), 'yyyyMMdd-HHmmss')
    const filename = `recurring-expenses-${timestamp}.${fileExtension}`

    return new NextResponse(fileBuffer as any, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error: any) {
    logger.error('Recurring expenses export error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export recurring expenses' },
      { status: 500 }
    )
  }
}

