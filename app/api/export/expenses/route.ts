export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import Expense from '@/lib/models/Expense'
import ExpenseCategory from '@/lib/models/ExpenseCategory'
import SalaryRecord from '@/lib/models/SalaryRecord'
import User from '@/lib/models/User'
import { hasRole, getCurrentUser } from '@/lib/auth'
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/services/exportService'
import ExportLog from '@/lib/models/ExportLog'
import { format as formatDate, startOfDay, endOfDay } from 'date-fns'
import { logger } from '@/lib/utils/performance'

export async function GET(request: NextRequest) {
  try {
    // Add request timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 sec timeout

    // Authentication
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

    // Permission check - only SUPER_ADMIN, ADMIN, FINANCE can export expenses
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      clearTimeout(timeoutId)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    // Ensure all models are registered
    void ExpenseCategory
    void SalaryRecord
    void User

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'csv'

    logger.log(`Export request - Format: ${format}, User: ${user.email}, Module: EXPENSES`)

    // Build filter from query params
    const filter: any = {
      isDeleted: false,
    }

    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    if (dateFrom && dateTo) {
      filter.dateIncurred = {
        $gte: startOfDay(new Date(dateFrom)),
        $lte: endOfDay(new Date(dateTo)),
      }
    }

    const categoryId = searchParams.get('categoryId')
    if (categoryId) {
      filter.category = categoryId
    }

    const branchId = searchParams.get('branchId')
    if (branchId) {
      filter.branchId = branchId
    }

    // Fetch expenses with populated data
    logger.log('Fetching expenses with filter:', JSON.stringify(filter))

    let expenses
    try {
      expenses = await Expense.find(filter)
        .populate('category', 'name type code')
        .populate({
          path: 'salaryRecord',
          select: 'month year staffUser',
          populate: {
            path: 'staffUser',
            select: 'name',
          },
        })
        .populate('createdBy', 'name email')
        .sort({ dateIncurred: -1 })
        .lean()
    } catch (populateError: any) {
      logger.error('Error populating expenses for export:', populateError)
      // Fallback: try without salaryRecord populate
      expenses = await Expense.find(filter)
        .populate('category', 'name type code')
        .populate('createdBy', 'name email')
        .sort({ dateIncurred: -1 })
        .lean()
    }

    // Map expenses to export format
    const exportData = expenses.map((exp: any) => {
      const category = exp.category
      const salaryRecord = exp.salaryRecord
      const createdBy = exp.createdBy

      // Build linkedTo field for salary expenses
      let linkedTo = ''
      if (salaryRecord && salaryRecord.staffUser) {
        const staffName = (salaryRecord.staffUser as any)?.name || 'Unknown'
        linkedTo = `Salary: ${staffName} ${salaryRecord.month}/${salaryRecord.year}`
      }

      return {
        date: formatDate(new Date(exp.dateIncurred), 'yyyy-MM-dd'),
        category: category?.name || 'N/A',
        categoryType: category?.type || 'N/A',
        description: exp.description || '',
        amount: exp.amount || 0,
        currency: exp.currency || 'AED',
        branch: exp.branchId || 'N/A',
        linkedTo: linkedTo || '—',
        createdBy: createdBy?.name || 'N/A',
        createdAt: formatDate(new Date(exp.createdAt), 'yyyy-MM-dd HH:mm:ss'),
      }
    })

    // Define columns for export
    const columns = [
      { key: 'date' as const, label: 'Date' },
      { key: 'category' as const, label: 'Category' },
      { key: 'categoryType' as const, label: 'Type' },
      { key: 'description' as const, label: 'Description' },
      { key: 'amount' as const, label: 'Amount' },
      { key: 'currency' as const, label: 'Currency' },
      { key: 'branch' as const, label: 'Branch' },
      { key: 'linkedTo' as const, label: 'Linked To' },
      { key: 'createdBy' as const, label: 'Created By' },
      { key: 'createdAt' as const, label: 'Created At' },
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
        fileBuffer = await exportToPDF('Expenses Report', exportData as any, columns as any)
        contentType = 'application/pdf'
        fileExtension = 'pdf'
      } else {
        clearTimeout(timeoutId)
        return NextResponse.json({ error: 'Invalid format. Use csv, excel, or pdf' }, { status: 400 })
      }

      clearTimeout(timeoutId)

      // Create export log
      try {
        await ExportLog.create({
          user: user._id,
          module: 'EXPENSES',
          format: format.toUpperCase() as 'CSV' | 'EXCEL' | 'PDF',
          filters: {
            dateFrom,
            dateTo,
            categoryId,
            branchId,
          },
          rowCount: exportData.length,
        })
      } catch (logError: any) {
        logger.error('Error creating export log:', logError)
        // Don't fail the export if logging fails
      }

      // Return file with proper headers
      const filename = `expenses_${formatDate(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.${fileExtension}`
      return new NextResponse(fileBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'no-cache',
        },
      })
    } catch (exportError: any) {
      clearTimeout(timeoutId)
      logger.error('Export error:', exportError)
      return NextResponse.json(
        { error: 'Failed to generate export file', details: exportError.message },
        { status: 500 }
      )
    }
  } catch (error: any) {
    logger.error('Error in expenses export:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export expenses' },
      { status: 500 }
    )
  }
}

