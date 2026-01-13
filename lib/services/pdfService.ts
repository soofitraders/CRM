import connectDB from '@/lib/db'
import Invoice from '@/lib/models/Invoice'
import InvestorPayout from '@/lib/models/InvestorPayout'
import { format } from 'date-fns'
import { logger } from '@/lib/utils/performance'
import fs from 'fs'
import path from 'path'

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

    const { jsPDF } = await import('jspdf')
    const autoTableModule = await import('jspdf-autotable')
    const autoTable = (autoTableModule as any).default || autoTableModule

    logger.log('[PDF] jsPDF loaded successfully')

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })

    // Get autoTable function
    let autoTableFn: any = null
    if (typeof (doc as any).autoTable === 'function') {
      autoTableFn = (doc as any).autoTable.bind(doc)
      logger.log('[PDF] Using autoTable as method')
    } else if (typeof autoTable === 'function') {
      autoTableFn = autoTable
      logger.log('[PDF] Using autoTable as function')
    } else if (typeof (autoTableModule as any).default === 'function') {
      autoTableFn = (autoTableModule as any).default
      logger.log('[PDF] Using autoTable from default export')
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

    const formatCurrency = (amount: number): string => {
      return `AED ${amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    }

    // Load company logo
    let logoBase64: string | null = null
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo.png')
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath)
        logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`
        logger.log('[PDF] Logo loaded successfully')
      }
    } catch (logoError) {
      logger.error('[PDF] Error loading logo:', logoError)
    }

    // ============= HEADER SECTION =============
    const headerHeight = 40
    
    // Black header background with gradient effect (simulated with multiple rectangles)
    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, 210, headerHeight, 'F')
    
    // Add decorative accent bar at top
    doc.setFillColor(255, 215, 0) // Gold accent
    doc.rect(0, 0, 210, 2, 'F')
    
    // Add logo if available
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 20, 20, 30, 20)
      } catch (imgError) {
        logger.error('[PDF] Error adding logo image:', imgError)
      }
    }
    
    // INVOICE title in white
    // doc.setTextColor(255, 255, 255)
    // doc.setFontSize(36)
    // doc.setFont('helvetica', 'bold')
    // doc.text('INVOICE', logoBase64 ? 50 : 20, 28)
    
    // Company tagline
    // doc.setFontSize(9)
    // doc.setFont('helvetica', 'normal')
    // doc.setTextColor(200, 200, 200)
    // doc.text('Professional Car Rental Services', logoBase64 ? 50 : 20, 36)

    // Invoice details box (right side) - white box on black background
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(135, 10, 60, 32, 3, 3, 'F')
    
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('INVOICE DETAILS', 165, 17, { align: 'center' })
    
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.text(`#${invoiceNumber}`, 140, 24)
    doc.text(`Issued: ${issueDate}`, 140, 29)
    doc.text(`Due: ${dueDate}`, 140, 34)
    
    // Status badge
    const statusColors: { [key: string]: number[] } = {
      'PAID': [34, 197, 94],
      'VOID': [239, 68, 68],
      'ISSUED': [251, 191, 36],
      'DRAFT': [156, 163, 175],
    }
    const statusColor = statusColors[status] || [156, 163, 175]
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2])
    doc.roundedRect(140, 37, 20, 4, 1, 1, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text(status, 150, 39.5, { align: 'center' })

    // ============= CUSTOMER & VEHICLE INFO =============
    const booking = invoiceData.booking
    const customer = booking?.customer?.user
    const vehicle = booking?.vehicle

    let startY = 60

    // Bill To section - elegant bordered box
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.3)
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(15, startY, 88, 32, 2, 2, 'FD')
    
    // Black header bar for Bill To
    doc.setFillColor(0, 0, 0)
    doc.roundedRect(15, startY, 88, 7, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('BILL TO', 20, startY + 5)

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(customer?.name || 'N/A', 20, startY + 14)
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    doc.text(customer?.email || '', 20, startY + 20)
    if (customer?.phone) {
      doc.text(`Phone: ${customer.phone}`, 20, startY + 26)
    }

    // Vehicle Information section - matching design
    if (vehicle) {
      doc.setDrawColor(0, 0, 0)
      doc.setLineWidth(0.3)
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(107, startY, 88, 32, 2, 2, 'FD')
      
      // Black header bar for Vehicle
      doc.setFillColor(0, 0, 0)
      doc.roundedRect(107, startY, 88, 7, 2, 2, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('VEHICLE DETAILS', 112, startY + 5)

      doc.setTextColor(0, 0, 0)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text(`Plate: ${vehicle.plateNumber || 'N/A'}`, 112, startY + 14)
      
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text(
        `${vehicle.brand || ''} ${vehicle.model || ''}`,
        112,
        startY + 20
      )
      if (vehicle.year) {
        doc.text(`Year: ${vehicle.year}`, 112, startY + 26)
      }
    }

    // ============= LINE ITEMS TABLE =============
    const items = invoiceData.items || []
    const tableStartY = startY + 42

    // Section header
    doc.setFillColor(245, 245, 245)
    doc.rect(15, tableStartY - 8, 180, 6, 'F')
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('ITEMIZED CHARGES', 20, tableStartY - 4)

    const tableData = items.map((item: { label: string; amount: number }) => {
      const isNegative = item.amount < 0
      const amountStr = isNegative
        ? `(${formatCurrency(Math.abs(item.amount))})`
        : formatCurrency(item.amount)
      return [item.label, amountStr]
    })

    const autoTableOptions = {
      head: [['Description', 'Amount']],
      body: tableData,
      startY: tableStartY,
      theme: 'plain' as any,
      styles: {
        fontSize: 9,
        cellPadding: 5,
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: 'bold' as any,
        halign: 'left' as any,
        fontSize: 10,
        cellPadding: 6,
      },
      bodyStyles: {
        textColor: [40, 40, 40],
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      columnStyles: {
        0: { cellWidth: 'auto' as any, halign: 'left' as any },
        1: { cellWidth: 50, halign: 'right' as any, fontStyle: 'bold' as any, textColor: [0, 0, 0] },
      },
      margin: { left: 15, right: 15 },
    }

    if (typeof (doc as any).autoTable === 'function' && autoTableFn === (doc as any).autoTable.bind(doc)) {
      ;(doc as any).autoTable(autoTableOptions)
    } else {
      autoTableFn(doc, autoTableOptions)
    }

    // ============= TOTALS SECTION =============
    const finalY = (doc as any).lastAutoTable.finalY || tableStartY + 50
    const totalsY = finalY + 10
    const subtotal = invoiceData.subtotal || 0
    const taxAmount = invoiceData.taxAmount || 0
    const total = invoiceData.total || 0

    // Elegant totals card with black accent
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.3)
    doc.roundedRect(115, totalsY, 80, 42, 3, 3, 'FD')

    // Subtotal
    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text('Subtotal:', 120, totalsY + 8)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.text(formatCurrency(subtotal), 190, totalsY + 8, { align: 'right' })

    // Tax
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text('Tax (VAT):', 120, totalsY + 16)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.text(formatCurrency(taxAmount), 190, totalsY + 16, { align: 'right' })

    // Separator line
    doc.setDrawColor(220, 220, 220)
    doc.setLineWidth(0.2)
    doc.line(120, totalsY + 20, 190, totalsY + 20)

    // Total - BLACK background bar
    doc.setFillColor(0, 0, 0)
    doc.roundedRect(115, totalsY + 25, 80, 12, 2, 2, 'F')
    
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('TOTAL:', 120, totalsY + 32)
    doc.setFontSize(14)
    doc.text(formatCurrency(total), 190, totalsY + 32, { align: 'right' })

    // ============= FOOTER =============
    const footerY = 268
    
    // Black footer bar
    doc.setFillColor(0, 0, 0)
    doc.rect(0, footerY - 8, 210, 40, 'F')
    
    // Gold accent line
    doc.setFillColor(255, 215, 0)
    doc.rect(0, footerY - 8, 210, 1, 'F')
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('Thank you for your business!', 105, footerY, { align: 'center' })
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(180, 180, 180)
    doc.text('For inquiries, please contact us through the CRM system.', 105, footerY + 7, {
      align: 'center',
    })
    
    // Page number
    doc.setFontSize(7)
    doc.setTextColor(150, 150, 150)
    doc.text('Page 1 of 1', 190, footerY + 14, { align: 'right' })

    logger.log('[PDF] PDF generated successfully')

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

    const { jsPDF } = await import('jspdf')
    const autoTableModule = await import('jspdf-autotable')
    const autoTable = (autoTableModule as any).default || autoTableModule

    logger.log('[PDF] jsPDF loaded successfully')

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

    const formatCurrency = (amount: number): string => {
      return `AED ${amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    }

    // ============= HEADER SECTION =============
    const headerHeight = 45
    
    // Black header background
    doc.setFillColor(0, 0, 0)
    doc.rect(0, 0, 210, headerHeight, 'F')
    
    // Gold accent bar
    doc.setFillColor(255, 215, 0)
    doc.rect(0, 0, 210, 2, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(28)
    doc.setFont('helvetica', 'bold')
    doc.text('INVESTOR PAYOUT', 20, 18)
    doc.text('STATEMENT', 20, 28)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(200, 200, 200)
    doc.text('MisterWheels CRM - Car Rental Services', 20, 36)

    // Statement details box
    const periodFrom = payoutData.periodFrom
      ? format(new Date(payoutData.periodFrom), 'MMMM dd, yyyy')
      : 'N/A'
    const periodTo = payoutData.periodTo
      ? format(new Date(payoutData.periodTo), 'MMMM dd, yyyy')
      : 'N/A'
    const status = payoutData.status || 'DRAFT'
    const generatedDate = format(new Date(), 'MMMM dd, yyyy HH:mm')

    doc.setFillColor(255, 255, 255)
    doc.roundedRect(130, 8, 65, 30, 3, 3, 'F')
    
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('STATEMENT DETAILS', 162.5, 14, { align: 'center' })
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text(`Period: ${periodFrom}`, 135, 20)
    doc.text(`to ${periodTo}`, 135, 25)
    doc.text(`Status: ${status}`, 135, 30)
    doc.text(`Generated: ${generatedDate}`, 135, 35)

    // ============= INVESTOR INFORMATION =============
    let startY = 55

    // Investor Details box
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.3)
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(15, startY, 88, 38, 2, 2, 'FD')
    
    doc.setFillColor(0, 0, 0)
    doc.roundedRect(15, startY, 88, 7, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('INVESTOR DETAILS', 20, startY + 5)

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(investorUser?.name || 'N/A', 20, startY + 14)
    
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    if (investor?.companyName) {
      doc.text(`Company: ${investor.companyName}`, 20, startY + 20)
    }
    doc.text(investorUser?.email || '', 20, startY + 26)
    if (investorUser?.phone) {
      doc.text(`Phone: ${investorUser.phone}`, 20, startY + 32)
    }

    // Bank Details box
    if (investor) {
      doc.setDrawColor(0, 0, 0)
      doc.setLineWidth(0.3)
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(107, startY, 88, 38, 2, 2, 'FD')
      
      doc.setFillColor(0, 0, 0)
      doc.roundedRect(107, startY, 88, 7, 2, 2, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('BANK DETAILS', 112, startY + 5)

      doc.setTextColor(0, 0, 0)
      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text(`Bank: ${investor.bankName || 'N/A'}`, 112, startY + 14)
      doc.text(`Account: ${investor.bankAccountName || 'N/A'}`, 112, startY + 20)
      doc.text(`IBAN: ${investor.iban || 'N/A'}`, 112, startY + 26)
      if (investor.swift) {
        doc.text(`SWIFT: ${investor.swift}`, 112, startY + 32)
      }
    }

    // ============= PAYOUT SUMMARY =============
    const summaryY = startY + 48
    
    // Summary box with black header
    doc.setDrawColor(0, 0, 0)
    doc.setLineWidth(0.3)
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(15, summaryY, 180, 36, 2, 2, 'FD')
    
    doc.setFillColor(0, 0, 0)
    doc.roundedRect(15, summaryY, 180, 7, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('PAYOUT SUMMARY', 20, summaryY + 5)

    doc.setTextColor(60, 60, 60)
    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'normal')
    
    // Total Revenue
    doc.text('Total Revenue:', 20, summaryY + 16)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.text(formatCurrency(totals.totalRevenue || 0), 190, summaryY + 16, { align: 'right' })

    // Commission
    doc.setTextColor(60, 60, 60)
    doc.setFont('helvetica', 'normal')
    doc.text(`Commission (${totals.commissionPercent || 0}%):`, 20, summaryY + 23)
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'bold')
    doc.text(formatCurrency(totals.commissionAmount || 0), 190, summaryY + 23, { align: 'right' })

    // Net Payout - highlighted
    doc.setFillColor(0, 0, 0)
    doc.roundedRect(15, summaryY + 27, 180, 8, 1, 1, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('NET PAYOUT:', 20, summaryY + 32)
    doc.setFontSize(12)
    doc.text(formatCurrency(totals.netPayout || 0), 190, summaryY + 32, { align: 'right' })

    // ============= BREAKDOWN TABLE =============
    const tableStartY = summaryY + 45

    if (breakdown.length > 0) {
      // Section header
      doc.setFillColor(245, 245, 245)
      doc.rect(15, tableStartY - 8, 180, 6, 'F')
      doc.setTextColor(0, 0, 0)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.text('VEHICLE BREAKDOWN', 20, tableStartY - 4)

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
