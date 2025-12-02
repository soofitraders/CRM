import connectDB from '@/lib/db'
import Invoice from '@/lib/models/Invoice'
import InvestorPayout from '@/lib/models/InvestorPayout'
import { format } from 'date-fns'
import { logger } from '@/lib/utils/performance'

interface InvoiceData {
  invoice: {
    _id: string
    invoiceNumber: string
    issueDate: string | Date
    dueDate: string | Date
    items: Array<{ label: string; amount: number }>
    subtotal: number
    taxAmount: number
    total: number
    status: string
    booking: {
      _id: string
      vehicle: {
        plateNumber: string
        brand: string
        model: string
        year?: number
      }
      customer: {
        user: {
          name: string
          email: string
          phone?: string
        }
      }
    }
  }
}

/**
 * Generate PDF buffer for an invoice using jsPDF
 */
export async function generateInvoicePDF(invoiceId: string): Promise<Buffer> {
  try {
    await connectDB()
  } catch (dbError: any) {
    logger.error('[PDF] Database connection error:', dbError)
    throw new Error('Failed to connect to database')
  }

  let invoice
  try {
    invoice = await Invoice.findById(invoiceId)
      .populate({
        path: 'booking',
        populate: [
          {
            path: 'vehicle',
            select: 'plateNumber brand model year',
          },
          {
            path: 'customer',
            select: 'user',
            populate: {
              path: 'user',
              select: 'name email phone',
            },
          },
        ],
      })
      .lean()
      .exec()
  } catch (queryError: any) {
    logger.error('[PDF] Invoice query error:', queryError)
    // Try without populate as fallback
    try {
      invoice = await Invoice.findById(invoiceId).lean().exec()
    } catch (fallbackError: any) {
      logger.error('[PDF] Fallback query also failed:', fallbackError)
      throw new Error('Failed to fetch invoice data')
    }
  }

  if (!invoice) {
    throw new Error('Invoice not found')
  }

  try {
    logger.log('[PDF] Starting PDF generation for invoice:', invoiceId)
    logger.log('[PDF] Loading jsPDF...')

    // Dynamic imports
    const { jsPDF } = await import('jspdf')
    // Import autoTable - in v5 it can be used as a function or extends prototype
    const autoTableModule = await import('jspdf-autotable')
    const autoTable = (autoTableModule as any).default || autoTableModule

    logger.log('[PDF] jsPDF loaded successfully')

    // Create PDF document in portrait A4
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    // Try to get autoTable function
    let autoTableFn: any = null

    // Method 1: Check if it's available as a method on doc
    if (typeof (doc as any).autoTable === 'function') {
      autoTableFn = (doc as any).autoTable.bind(doc)
      logger.log('[PDF] Using autoTable as method')
    }
    // Method 2: Check if it's a standalone function
    else if (typeof autoTable === 'function') {
      autoTableFn = autoTable
      logger.log('[PDF] Using autoTable as function')
    }
    // Method 3: Check default export
    else if (typeof (autoTableModule as any).default === 'function') {
      autoTableFn = (autoTableModule as any).default
      logger.log('[PDF] Using autoTable from default export')
    }
    // Method 4: Try require
    else {
      try {
        const autoTableRequire = require('jspdf-autotable')
        if (typeof autoTableRequire === 'function') {
          autoTableFn = autoTableRequire
        } else if (typeof autoTableRequire.default === 'function') {
          autoTableFn = autoTableRequire.default
        } else if (typeof (doc as any).autoTable === 'function') {
          autoTableFn = (doc as any).autoTable.bind(doc)
        }
        logger.log('[PDF] Using autoTable from require')
      } catch (e) {
        logger.error('[PDF] Could not load autoTable:', e)
      }
    }

    if (!autoTableFn) {
      throw new Error('autoTable function not available. jspdf-autotable may not be properly installed.')
    }

    const invoiceData = invoice as any
    const invoiceNumber = invoiceData.invoiceNumber || 'N/A'
    const issueDate = invoiceData.issueDate
      ? format(new Date(invoiceData.issueDate), 'MMMM dd, yyyy')
      : 'N/A'
    const dueDate = invoiceData.dueDate
      ? format(new Date(invoiceData.dueDate), 'MMMM dd, yyyy')
      : 'N/A'
    const status = invoiceData.status || 'ISSUED'

    // Helper function to format currency
    const formatCurrency = (amount: number): string => {
      return `AED ${amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    }

    // Header
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('INVOICE', 20, 20)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('MisterWheels CRM', 20, 28)
    doc.text('Car Rental Services', 20, 33)

    // Invoice details (right side)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Invoice #: ${invoiceNumber}`, 190, 20, { align: 'right' })
    doc.text(`Issue Date: ${issueDate}`, 190, 25, { align: 'right' })
    doc.text(`Due Date: ${dueDate}`, 190, 30, { align: 'right' })
    doc.text(`Status: ${status}`, 190, 35, { align: 'right' })

    // Customer Information
    const booking = invoiceData.booking
    const customer = booking?.customer?.user
    const vehicle = booking?.vehicle

    let startY = 50

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Bill To:', 20, startY)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(customer?.name || 'N/A', 20, startY + 8)
    doc.text(customer?.email || '', 20, startY + 14)
    if (customer?.phone) {
      doc.text(customer.phone, 20, startY + 20)
    }

    // Vehicle Information
    if (vehicle) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Vehicle:', 110, startY)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `${vehicle.plateNumber} - ${vehicle.brand} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ''}`,
        110,
        startY + 8
      )
    }

    // Line items table
    const items = invoiceData.items || []
    const tableStartY = startY + 35

    // Prepare table data
    const tableData = items.map((item: { label: string; amount: number }) => {
      const isNegative = item.amount < 0
      const amountStr = isNegative
        ? `(${formatCurrency(Math.abs(item.amount))})`
        : formatCurrency(item.amount)
      return [item.label, amountStr]
    })

    // Generate table using autoTable
    const autoTableOptions = {
      head: [['Description', 'Amount']],
      body: tableData,
      startY: tableStartY,
      theme: 'striped' as any,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold' as any,
      },
      columnStyles: {
        0: { cellWidth: 'auto' as any, halign: 'left' as any },
        1: { cellWidth: 'auto' as any, halign: 'right' as any },
      },
      margin: { top: tableStartY, left: 20, right: 20 },
    }

    // Call autoTable - if it's a method (bound), call with options only
    // If it's a function, pass doc as first parameter
    if (typeof (doc as any).autoTable === 'function' && autoTableFn === (doc as any).autoTable.bind(doc)) {
      // It's a method, call it directly on doc
      ;(doc as any).autoTable(autoTableOptions)
    } else {
      // It's a function, pass doc as first argument
      autoTableFn(doc, autoTableOptions)
    }

    // Get the Y position after the table
    const finalY = (doc as any).lastAutoTable.finalY || tableStartY + 50

    // Totals section
    const totalsY = finalY + 10
    const subtotal = invoiceData.subtotal || 0
    const taxAmount = invoiceData.taxAmount || 0
    const total = invoiceData.total || 0

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Subtotal:', 150, totalsY, { align: 'right' })
    doc.text(formatCurrency(subtotal), 190, totalsY, { align: 'right' })

    doc.text('Tax:', 150, totalsY + 8, { align: 'right' })
    doc.text(formatCurrency(taxAmount), 190, totalsY + 8, { align: 'right' })

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Total:', 150, totalsY + 20, { align: 'right' })
    doc.text(formatCurrency(total), 190, totalsY + 20, { align: 'right' })

    // Footer
    const footerY = 270
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('Thank you for your business!', 105, footerY, { align: 'center' })
    doc.text('For inquiries, please contact us through the CRM system.', 105, footerY + 6, {
      align: 'center',
    })
    doc.setTextColor(0, 0, 0)

    // Page number
    doc.text('Page 1 of 1', 190, 290, { align: 'right' })

    logger.log('[PDF] PDF generated successfully')

    // Convert to buffer
    const pdfBlob = doc.output('arraybuffer')
    const buffer = Buffer.from(pdfBlob)

    if (buffer.length === 0) {
      throw new Error('Generated PDF is empty')
    }

    logger.log(`[PDF] PDF buffer size: ${buffer.length} bytes`)
    return buffer
  } catch (error: any) {
    logger.error('[PDF] PDF generation error:', error)
    logger.error('[PDF] Error stack:', error.stack)
    throw new Error(`PDF generation failed: ${error.message}`)
  }
}

/**
 * Generate PDF buffer for an investor payout statement using jsPDF
 */
export async function generateInvestorPayoutPDF(payoutId: string): Promise<Buffer> {
  try {
    await connectDB()
  } catch (dbError: any) {
    logger.error('[PDF] Database connection error:', dbError)
    throw new Error('Failed to connect to database')
  }

  let payout
  try {
    payout = await InvestorPayout.findById(payoutId)
      .populate({
        path: 'investor',
        populate: {
          path: 'user',
          select: 'name email phone',
        },
      })
      .populate('expense', 'amount dateIncurred description')
      .populate('payment', 'amount method status transactionId paidAt')
      .lean()
      .exec()
  } catch (queryError: any) {
    logger.error('[PDF] Payout query error:', queryError)
    throw new Error('Failed to fetch payout data')
  }

  if (!payout) {
    throw new Error('Investor payout not found')
  }

  try {
    logger.log('[PDF] Starting PDF generation for payout:', payoutId)
    logger.log('[PDF] Loading jsPDF...')

    // Dynamic imports
    const { jsPDF } = await import('jspdf')
    const autoTableModule = await import('jspdf-autotable')
    const autoTable = (autoTableModule as any).default || autoTableModule

    logger.log('[PDF] jsPDF loaded successfully')

    // Create PDF document in portrait A4
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    // Get autoTable function
    let autoTableFn: any = null
    if (typeof (doc as any).autoTable === 'function') {
      autoTableFn = (doc as any).autoTable.bind(doc)
    } else if (typeof autoTable === 'function') {
      autoTableFn = autoTable
    } else if (typeof (autoTableModule as any).default === 'function') {
      autoTableFn = (autoTableModule as any).default
    } else {
      try {
        const autoTableRequire = require('jspdf-autotable')
        if (typeof autoTableRequire === 'function') {
          autoTableFn = autoTableRequire
        } else if (typeof autoTableRequire.default === 'function') {
          autoTableFn = autoTableRequire.default
        } else if (typeof (doc as any).autoTable === 'function') {
          autoTableFn = (doc as any).autoTable.bind(doc)
        }
      } catch (e) {
        logger.error('[PDF] Could not load autoTable:', e)
      }
    }

    if (!autoTableFn) {
      throw new Error('autoTable function not available')
    }

    const payoutData = payout as any
    const investor = payoutData.investor
    const investorUser = investor?.user
    const totals = payoutData.totals || {}
    const breakdown = totals.breakdown || []

    // Helper function to format currency
    const formatCurrency = (amount: number): string => {
      return `AED ${amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    }

    // Header
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('INVESTOR PAYOUT STATEMENT', 20, 20)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('MisterWheels CRM', 20, 28)
    doc.text('Car Rental Services', 20, 33)

    // Statement details (right side)
    const periodFrom = payoutData.periodFrom
      ? format(new Date(payoutData.periodFrom), 'MMMM dd, yyyy')
      : 'N/A'
    const periodTo = payoutData.periodTo
      ? format(new Date(payoutData.periodTo), 'MMMM dd, yyyy')
      : 'N/A'
    const status = payoutData.status || 'DRAFT'
    const generatedDate = format(new Date(), 'MMMM dd, yyyy HH:mm')

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Period: ${periodFrom} - ${periodTo}`, 190, 20, { align: 'right' })
    doc.text(`Status: ${status}`, 190, 25, { align: 'right' })
    doc.text(`Generated: ${generatedDate}`, 190, 30, { align: 'right' })

    // Investor Information
    let startY = 50

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Investor Details:', 20, startY)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(investorUser?.name || 'N/A', 20, startY + 8)
    if (investor?.companyName) {
      doc.text(`Company: ${investor.companyName}`, 20, startY + 14)
    }
    doc.text(investorUser?.email || '', 20, startY + 20)
    if (investorUser?.phone) {
      doc.text(investorUser.phone, 20, startY + 26)
    }

    // Bank Details
    if (investor) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Bank Details:', 110, startY)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Bank: ${investor.bankName || 'N/A'}`, 110, startY + 8)
      doc.text(`Account: ${investor.bankAccountName || 'N/A'}`, 110, startY + 14)
      doc.text(`IBAN: ${investor.iban || 'N/A'}`, 110, startY + 20)
      if (investor.swift) {
        doc.text(`SWIFT: ${investor.swift}`, 110, startY + 26)
      }
    }

    // Summary section
    const summaryY = startY + 40
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Payout Summary', 20, summaryY)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Total Revenue:', 20, summaryY + 10)
    doc.text(formatCurrency(totals.totalRevenue || 0), 150, summaryY + 10, { align: 'right' })

    doc.text(`Commission (${totals.commissionPercent || 0}%):`, 20, summaryY + 18)
    doc.text(formatCurrency(totals.commissionAmount || 0), 150, summaryY + 18, { align: 'right' })

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Net Payout:', 20, summaryY + 30)
    doc.text(formatCurrency(totals.netPayout || 0), 150, summaryY + 30, { align: 'right' })

    // Breakdown table
    const tableStartY = summaryY + 45

    if (breakdown.length > 0) {
      const tableData = breakdown.map((item: any) => [
        item.plateNumber || 'N/A',
        `${item.brand || ''} ${item.model || ''}`.trim() || 'N/A',
        item.category || 'N/A',
        String(item.bookingsCount || 0),
        formatCurrency(item.revenue || 0),
      ])

      const autoTableOptions = {
        head: [['Plate No', 'Vehicle', 'Category', 'Bookings', 'Revenue (AED)']],
        body: tableData,
        startY: tableStartY,
        theme: 'striped' as any,
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [240, 240, 240],
          textColor: [0, 0, 0],
          fontStyle: 'bold' as any,
        },
        columnStyles: {
          0: { cellWidth: 30, halign: 'left' as any },
          1: { cellWidth: 50, halign: 'left' as any },
          2: { cellWidth: 30, halign: 'left' as any },
          3: { cellWidth: 25, halign: 'center' as any },
          4: { cellWidth: 35, halign: 'right' as any },
        },
        margin: { top: tableStartY, left: 20, right: 20 },
      }

      if (typeof (doc as any).autoTable === 'function' && autoTableFn === (doc as any).autoTable.bind(doc)) {
        ;(doc as any).autoTable(autoTableOptions)
      } else {
        autoTableFn(doc, autoTableOptions)
      }
    }

    // Footer
    const footerY = 270
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('This is an automatically generated payout statement.', 105, footerY, { align: 'center' })
    doc.text('For inquiries, please contact us through the CRM system.', 105, footerY + 6, {
      align: 'center',
    })
    doc.setTextColor(0, 0, 0)

    // Page number
    doc.text('Page 1 of 1', 190, 290, { align: 'right' })

    logger.log('[PDF] PDF generated successfully')

    // Convert to buffer
    const pdfBlob = doc.output('arraybuffer')
    const buffer = Buffer.from(pdfBlob)

    if (buffer.length === 0) {
      throw new Error('Generated PDF is empty')
    }

    logger.log(`[PDF] PDF buffer size: ${buffer.length} bytes`)
    return buffer
  } catch (error: any) {
    logger.error('[PDF] PDF generation error:', error)
    logger.error('[PDF] Error stack:', error.stack)
    throw new Error(`PDF generation failed: ${error.message}`)
  }
}
