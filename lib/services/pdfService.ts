import connectDB from '@/lib/db'
import Invoice from '@/lib/models/Invoice'
import InvestorPayout from '@/lib/models/InvestorPayout'
import { format } from 'date-fns'
import { logger } from '@/lib/utils/performance'
import fs from 'fs'
import path from 'path'

// ============= PDF DESIGN SYSTEM =============
const DESIGN_SYSTEM = {
  COLORS: {
    textPrimary: [17, 24, 39] as [number, number, number], // Dark gray/black
    textMuted: [107, 114, 128] as [number, number, number], // Medium gray
    textLight: [156, 163, 175] as [number, number, number], // Light gray
    border: [229, 231, 235] as [number, number, number], // Light border
    bgSoft: [249, 250, 251] as [number, number, number], // Soft background
    bgWhite: [255, 255, 255] as [number, number, number], // White
    accent: [242, 178, 51] as [number, number, number], // Gold #F2B233
    accentDark: [17, 24, 39] as [number, number, number], // Dark for headers
  },
  FONT_SIZES: {
    xs: 7,
    sm: 8,
    base: 9,
    lg: 11,
    xl: 14,
  },
  SPACING: {
    xs: 3,
    sm: 5,
    md: 8,
    lg: 12,
  },
  BORDER: {
    radiusSm: 2,
    radiusMd: 3,
    lineThin: 0.2,
    lineMedium: 0.3,
    lineThick: 0.5,
  },
} as const

/**
 * Helper function to load Poppins fonts into jsPDF
 */
async function loadPoppinsFonts(doc: any): Promise<void> {
  try {
    const fontsDir = path.join(process.cwd(), 'public', 'fonts')
    const regularPath = path.join(fontsDir, 'Poppins-Regular.ttf')
    const semiboldPath = path.join(fontsDir, 'Poppins-SemiBold.ttf')

    // Read and convert fonts to base64
    const regularFont = fs.readFileSync(regularPath)
    const semiboldFont = fs.readFileSync(semiboldPath)
    
    const regularBase64 = regularFont.toString('base64')
    const semiboldBase64 = semiboldFont.toString('base64')

    // Add fonts to VFS
    doc.addFileToVFS('Poppins-Regular.ttf', regularBase64)
    doc.addFileToVFS('Poppins-SemiBold.ttf', semiboldBase64)

    // Register fonts
    doc.addFont('Poppins-Regular.ttf', 'Poppins', 'normal')
    doc.addFont('Poppins-SemiBold.ttf', 'Poppins', 'bold')

    logger.log('[PDF] Poppins fonts loaded successfully')
  } catch (error: any) {
    logger.error('[PDF] Failed to load Poppins fonts, falling back to helvetica:', error)
    // Font loading failure is non-critical, will fallback to helvetica
  }
}

/**
 * Standardized typography helper function
 * Replaces scattered setFontSize calls with consistent variants
 */
function setTextStyle(
  doc: any,
  variant: 'sectionLabel' | 'primaryName' | 'secondaryLine' | 'title' | 'totalNumber' | 'regular'
): void {
  const styles = {
    sectionLabel: { size: 7.5, weight: 'bold' as const, color: DESIGN_SYSTEM.COLORS.textMuted },
    primaryName: { size: 10.5, weight: 'bold' as const, color: DESIGN_SYSTEM.COLORS.textPrimary },
    secondaryLine: { size: 8.5, weight: 'regular' as const, color: DESIGN_SYSTEM.COLORS.textMuted },
    title: { size: 17, weight: 'bold' as const, color: DESIGN_SYSTEM.COLORS.textPrimary },
    totalNumber: { size: 11, weight: 'bold' as const, color: DESIGN_SYSTEM.COLORS.textPrimary },
    regular: { size: 9, weight: 'regular' as const, color: DESIGN_SYSTEM.COLORS.textPrimary },
  }
  
  const style = styles[variant]
  const fontMap: { [key: string]: 'normal' | 'bold' } = {
    regular: 'normal',
    bold: 'bold',
  }
  
  doc.setFontSize(style.size)
  
  // Try to use Poppins, fallback to helvetica if not available
  try {
    doc.setFont('Poppins', fontMap[style.weight])
  } catch (error) {
    // Fallback to helvetica if Poppins is not loaded
    doc.setFont('helvetica', fontMap[style.weight])
  }
  
  doc.setTextColor(style.color[0], style.color[1], style.color[2])
}

/**
 * Helper function to set font with weight, size, and color
 * Uses Poppins font if available, falls back to helvetica
 * @deprecated Use setTextStyle instead for standardized typography
 */
function setFont(
  doc: any,
  weight: 'regular' | 'medium' | 'semibold' | 'bold',
  size: number,
  color?: [number, number, number]
): void {
  const fontMap: { [key: string]: 'normal' | 'bold' } = {
    regular: 'normal',
    medium: 'normal',
    semibold: 'bold',
    bold: 'bold',
  }
  
  doc.setFontSize(size)
  
  // Try to use Poppins, fallback to helvetica if not available
  try {
    doc.setFont('Poppins', fontMap[weight])
  } catch (error) {
    // Fallback to helvetica if Poppins is not loaded
    doc.setFont('helvetica', fontMap[weight])
  }
  
  if (color) {
    doc.setTextColor(color[0], color[1], color[2])
  }
}

/**
 * Helper function to draw a card/box with background and border
 */
function drawCard(
  doc: any,
  x: number,
  y: number,
  w: number,
  h: number,
  bgColor?: [number, number, number],
  borderColor?: [number, number, number],
  radius: number = DESIGN_SYSTEM.BORDER.radiusSm,
  lineWidth: number = DESIGN_SYSTEM.BORDER.lineMedium
): void {
  if (bgColor) {
    doc.setFillColor(bgColor[0], bgColor[1], bgColor[2])
  } else {
    doc.setFillColor(...DESIGN_SYSTEM.COLORS.bgWhite)
  }
  
  if (borderColor) {
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2])
  } else {
    doc.setDrawColor(...DESIGN_SYSTEM.COLORS.border)
  }
  
  doc.setLineWidth(lineWidth)
  doc.roundedRect(x, y, w, h, radius, radius, bgColor ? 'FD' : 'D')
}

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

    // Load Poppins fonts
    await loadPoppinsFonts(doc)

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

    // Load company logo and name from settings
    const Settings = (await import('@/lib/models/Settings')).default
    const settings = await Settings.findOne()
    const companyName = settings?.companyName || 'MisterWheels'
    
    let logoBase64: string | null = null
    try {
      // Try to get logo from settings first
      const logoPath = settings?.logoUrl 
        ? path.join(process.cwd(), 'public', settings.logoUrl.replace(/^\//, ''))
        : path.join(process.cwd(), 'public', 'logo.png')
      
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath)
        // Detect image format from file extension
        const ext = path.extname(logoPath).toLowerCase()
        const imageType = ext === '.jpg' || ext === '.jpeg' ? 'JPEG' : ext === '.png' ? 'PNG' : 'PNG'
        logoBase64 = `data:image/${imageType.toLowerCase()};base64,${logoBuffer.toString('base64')}`
        logger.log('[PDF] Logo loaded successfully from:', settings?.logoUrl || '/logo.png')
      }
    } catch (logoError) {
      logger.error('[PDF] Error loading logo:', logoError)
    }

    // ============= CLEAN MINIMAL HEADER =============
    // White background
    doc.setFillColor(...DESIGN_SYSTEM.COLORS.bgWhite)
    doc.rect(0, 0, 210, 38, 'F')
    
    // Thin accent line at top (2mm)
    doc.setFillColor(...DESIGN_SYSTEM.COLORS.accent)
    doc.rect(0, 0, 210, 2, 'F')
    
    const headerY = 12
    
    // Logo - slightly smaller
    if (logoBase64) {
      try {
        // Detect image format from base64 data URI
        const imageType = logoBase64.startsWith('data:image/jpeg') || logoBase64.startsWith('data:image/jpg') 
          ? 'JPEG' : 'PNG'
        doc.addImage(logoBase64, imageType, 15, headerY, 28, 16)
      } catch (imgError) {
        logger.error('[PDF] Error adding logo image:', imgError)
      }
    }
    
    // Invoice details box - reduced height and smaller font, very light border
    drawCard(doc, 130, headerY - 1, 65, 18, DESIGN_SYSTEM.COLORS.bgWhite, [230, 230, 230], DESIGN_SYSTEM.BORDER.radiusSm, 0.2)
    
    setTextStyle(doc, 'sectionLabel')
    doc.text('Invoice No:', 135, headerY + 7)
    doc.text('Date:', 135, headerY + 11.5)
    
    setTextStyle(doc, 'regular')
    doc.text(invoiceNumber, 190, headerY + 7, { align: 'right' })
    doc.text(issueDate, 190, headerY + 11.5, { align: 'right' })

    // ============= CLEAN INFO CARDS =============
    const booking = invoiceData.booking
    const customer = booking?.customer?.user
    const vehicle = booking?.vehicle

    let cardY = 48 // Moved up from 58 (10mm reduction)

    // From (Supplier) Card - reduced height and tighter spacing, very light border
    drawCard(doc, 15, cardY, 88, 34, DESIGN_SYSTEM.COLORS.bgWhite, [230, 230, 230], DESIGN_SYSTEM.BORDER.radiusSm, 0.2)
    
    setTextStyle(doc, 'sectionLabel')
    doc.text('FROM', 20, cardY + 5)
    
    setTextStyle(doc, 'primaryName')
    doc.text(companyName, 20, cardY + 11)
    
    setTextStyle(doc, 'secondaryLine')
    doc.text('Car Rental Services', 20, cardY + 16)
    doc.text('Dubai, United Arab Emirates', 20, cardY + 20)
    doc.text('info@misterwheels.com', 20, cardY + 24)

    // To (Customer) Card - reduced height and tighter spacing, very light border
    drawCard(doc, 107, cardY, 88, 34, DESIGN_SYSTEM.COLORS.bgWhite, [230, 230, 230], DESIGN_SYSTEM.BORDER.radiusSm, 0.2)
    
    setTextStyle(doc, 'sectionLabel')
    doc.text('BILL TO', 112, cardY + 5)
    
    setTextStyle(doc, 'primaryName')
    doc.text(customer?.name || 'N/A', 112, cardY + 11)
    
    setTextStyle(doc, 'secondaryLine')
    doc.text(customer?.email || 'N/A', 112, cardY + 16)
    doc.text(customer?.phone || 'N/A', 112, cardY + 20)
    
    if (vehicle) {
      setTextStyle(doc, 'secondaryLine')
      // Combine plate and vehicle info into 2 lines max
      const plateText = vehicle.plateNumber || 'N/A'
      const vehicleInfo = `${vehicle.brand || ''} ${vehicle.model || ''}${vehicle.year ? ` (${vehicle.year})` : ''}`.trim()
      doc.text(plateText, 112, cardY + 24)
      if (vehicleInfo) {
        doc.text(vehicleInfo, 112, cardY + 28)
      }
    }

    // Due date banner - minimal style with light border, 8mm height, with spacing from cards above
    const bannerY = cardY + 38 // Added 4mm spacing from cards (cards end at cardY + 34)
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.2)
    doc.roundedRect(15, bannerY, 180, 8, DESIGN_SYSTEM.BORDER.radiusSm, DESIGN_SYSTEM.BORDER.radiusSm, 'D')
    
    // Payment Due and Status on same baseline with fontSize 8, with spacing
    setTextStyle(doc, 'regular')
    doc.setFontSize(8)
    doc.text(`Payment Due: ${dueDate}`, 20, bannerY + 5)
    
    setTextStyle(doc, 'secondaryLine')
    doc.setFontSize(8)
    doc.text(`Status: ${status}`, 185, bannerY + 5, { align: 'right' }) // Moved from 190 to 185 for more space

    // ============= MODERN TABLE =============
    const items = invoiceData.items || []
    const tableStartY = bannerY + 12 // Adjusted: bannerY + 8 (banner height) + 4 (spacing)
    
    const subtotal = invoiceData.subtotal || 0
    const taxAmount = invoiceData.taxAmount || 0
    const vatPercent = subtotal > 0 ? ((taxAmount / subtotal) * 100).toFixed(0) : '0'

    const tableData = items.map((item: { label: string; amount: number }, index: number) => {
      const itemSubtotal = Math.abs(item.amount)
      const itemVAT = (itemSubtotal * parseFloat(vatPercent)) / 100
      const itemTotal = itemSubtotal + itemVAT
      
      return [
        String(index + 1),
        item.label,
        formatCurrency(itemSubtotal),
        '1',
        `${vatPercent}%`,
        formatCurrency(itemVAT),
        formatCurrency(itemTotal),
      ]
    })

    const autoTableOptions = {
      head: [['#', 'Description', 'Price', 'Qty', 'VAT', 'Tax Amt', 'Total']],
      body: tableData,
      startY: tableStartY,
      theme: 'plain' as any,
      styles: {
        font: 'Poppins' as any,
        fontSize: 8.5,
        cellPadding: 2.5,
        lineColor: [230, 230, 230],
        lineWidth: 0.15,
      },
      headStyles: {
        font: 'Poppins' as any,
        fillColor: DESIGN_SYSTEM.COLORS.bgSoft,
        textColor: [75, 85, 99],
        fontStyle: 'bold' as any,
        halign: 'left' as any,
        fontSize: 8,
        cellPadding: 3,
      },
      bodyStyles: {
        font: 'Poppins' as any,
        textColor: [31, 41, 55],
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' as any, textColor: DESIGN_SYSTEM.COLORS.textMuted },
        1: { cellWidth: 'auto' as any, halign: 'left' as any },
        2: { cellWidth: 28, halign: 'right' as any },
        3: { cellWidth: 12, halign: 'center' as any },
        4: { cellWidth: 18, halign: 'right' as any },
        5: { cellWidth: 25, halign: 'right' as any },
        6: { cellWidth: 30, halign: 'right' as any, fontStyle: 'bold' as any, textColor: DESIGN_SYSTEM.COLORS.textPrimary },
      },
      margin: { left: 15, right: 15 },
    }

    // Try to use Poppins font, fallback silently if autoTable doesn't support it
    try {
      if (typeof (doc as any).autoTable === 'function' && autoTableFn === (doc as any).autoTable.bind(doc)) {
        ;(doc as any).autoTable(autoTableOptions)
      } else {
        autoTableFn(doc, autoTableOptions)
      }
    } catch (fontError: any) {
      // If Poppins font causes issues, remove font specification and retry
      if (fontError.message && fontError.message.includes('font') || fontError.message.includes('Poppins')) {
        logger.warn('[PDF] Poppins font not supported in autoTable, falling back to default font')
        const fallbackOptions = {
          ...autoTableOptions,
          styles: { ...autoTableOptions.styles, font: undefined },
          headStyles: { ...autoTableOptions.headStyles, font: undefined },
          bodyStyles: { ...autoTableOptions.bodyStyles, font: undefined },
        }
        if (typeof (doc as any).autoTable === 'function' && autoTableFn === (doc as any).autoTable.bind(doc)) {
          ;(doc as any).autoTable(fallbackOptions)
        } else {
          autoTableFn(doc, fallbackOptions)
        }
      } else {
        throw fontError
      }
    }

    // ============= TOTALS SECTION =============
    const finalY = (doc as any).lastAutoTable.finalY || tableStartY + 50
    const totalsY = finalY + DESIGN_SYSTEM.SPACING.sm // Reduced spacing
    const total = invoiceData.total || 0

    // Totals box - minimal white with light border
    drawCard(doc, 125, totalsY, 70, 24, DESIGN_SYSTEM.COLORS.bgWhite, [230, 230, 230], DESIGN_SYSTEM.BORDER.radiusSm, 0.2)
    
    // Subtotal - muted label with bold value
    setTextStyle(doc, 'secondaryLine')
    doc.text('Subtotal:', 130, totalsY + 6)
    setTextStyle(doc, 'regular')
    try {
      doc.setFont('Poppins', 'bold')
    } catch {
      doc.setFont('helvetica', 'bold')
    }
    doc.text(formatCurrency(subtotal), 190, totalsY + 6, { align: 'right' })

    // VAT - muted label with bold value
    setTextStyle(doc, 'secondaryLine')
    doc.text(`VAT (${vatPercent}%):`, 130, totalsY + 12)
    setTextStyle(doc, 'regular')
    try {
      doc.setFont('Poppins', 'bold')
    } catch {
      doc.setFont('helvetica', 'bold')
    }
    doc.text(formatCurrency(taxAmount), 190, totalsY + 12, { align: 'right' })

    // TOTAL - minimal style with black bold amount
    setTextStyle(doc, 'regular')
    try {
      doc.setFont('Poppins', 'bold')
    } catch {
      doc.setFont('helvetica', 'bold')
    }
    doc.text('TOTAL:', 130, totalsY + 20)
    
    // Total amount in black and bold
    setTextStyle(doc, 'totalNumber')
    doc.setTextColor(...DESIGN_SYSTEM.COLORS.textPrimary)
    try {
      doc.setFont('Poppins', 'bold')
    } catch {
      doc.setFont('helvetica', 'bold')
    }
    doc.text(formatCurrency(total), 190, totalsY + 20, { align: 'right' })

    // ============= FOOTER =============
    const footerY = 270 // Pulled up from 280
    
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.2)
    doc.line(15, footerY - DESIGN_SYSTEM.SPACING.sm, 195, footerY - DESIGN_SYSTEM.SPACING.sm)
    
    setTextStyle(doc, 'secondaryLine')
    doc.text('1606, Empire Heights Tower B, Business Bay, Dubai', 105, footerY, {
      align: 'center',
    })
    doc.text('+971586840296, +971585282840', 105, footerY + 5, {
      align: 'center',
    })
    doc.text('www.misterwheels.ae', 105, footerY + 10, {
      align: 'center',
    })
    
    setTextStyle(doc, 'secondaryLine')
    doc.setFontSize(7) // Smaller for page number
    doc.text('Page 1 of 1', 195, 290, { align: 'right' })

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

    // Load Poppins fonts
    await loadPoppinsFonts(doc)

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

    // Get company name from settings
    const SettingsPayout = (await import('@/lib/models/Settings')).default
    const settingsPayout = await SettingsPayout.findOne()
    const companyNamePayout = settingsPayout?.companyName || 'MisterWheels'

    // ============= CLEAN MINIMAL HEADER =============
    // White background
    doc.setFillColor(...DESIGN_SYSTEM.COLORS.bgWhite)
    doc.rect(0, 0, 210, 42, 'F')
    
    // Thin accent bar at top
    doc.setFillColor(...DESIGN_SYSTEM.COLORS.accent)
    doc.rect(0, 0, 210, 2, 'F')
    
    setTextStyle(doc, 'title')
    doc.text('INVESTOR', 20, 18)
    doc.setFontSize(19) // Slightly larger for second line
    doc.text('PAYOUT STATEMENT', 20, 26)

    setTextStyle(doc, 'secondaryLine')
    doc.text(`${companyNamePayout} Car Rental Services`, 20, 33)

    // Statement info card - reduced height
    const periodFrom = payoutData.periodFrom
      ? format(new Date(payoutData.periodFrom), 'MMM dd, yyyy')
      : 'N/A'
    const periodTo = payoutData.periodTo
      ? format(new Date(payoutData.periodTo), 'MMM dd, yyyy')
      : 'N/A'
    const status = payoutData.status || 'DRAFT'
    const generatedDate = format(new Date(), 'MMM dd, yyyy HH:mm')

    drawCard(doc, 130, 8, 65, 28, DESIGN_SYSTEM.COLORS.bgWhite, [230, 230, 230], DESIGN_SYSTEM.BORDER.radiusMd, 0.2)
    
    setTextStyle(doc, 'sectionLabel')
    doc.text('PERIOD', 162.5, 13, { align: 'center' })
    
    setTextStyle(doc, 'secondaryLine')
    doc.text(`${periodFrom}`, 162.5, 18, { align: 'center' })
    doc.text('to', 162.5, 22, { align: 'center' })
    doc.text(`${periodTo}`, 162.5, 26, { align: 'center' })
    
    // Status badge - smaller and more subtle
    const statusColor = status === 'PAID' ? [34, 197, 94] : status === 'PENDING' ? DESIGN_SYSTEM.COLORS.accent : DESIGN_SYSTEM.COLORS.textMuted
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2])
    doc.roundedRect(138, 30, 18, 3.5, DESIGN_SYSTEM.BORDER.radiusSm, DESIGN_SYSTEM.BORDER.radiusSm, 'F')
    setTextStyle(doc, 'sectionLabel')
    doc.setTextColor(255, 255, 255)
    doc.text(status, 147, 32.5, { align: 'center' })

    // ============= INFO CARDS =============
    let startY = 50 // Moved up from 63 (13mm reduction)

    // Investor card - reduced height by 20% (40 -> 32), very light border
    drawCard(doc, 15, startY, 90, 32, DESIGN_SYSTEM.COLORS.bgWhite, [230, 230, 230], DESIGN_SYSTEM.BORDER.radiusMd, 0.2)
    
    // Header strip - subtle bgSoft
    doc.setFillColor(...DESIGN_SYSTEM.COLORS.bgSoft)
    doc.roundedRect(15, startY, 90, 6, DESIGN_SYSTEM.BORDER.radiusMd, DESIGN_SYSTEM.BORDER.radiusMd, 'F')
    
    setTextStyle(doc, 'sectionLabel')
    doc.text('INVESTOR INFORMATION', 20, startY + 4)

    setTextStyle(doc, 'primaryName')
    doc.text(investorUser?.name || 'N/A', 20, startY + 12)
    
    setTextStyle(doc, 'secondaryLine')
    if (investor?.companyName) {
      doc.text(investor.companyName, 20, startY + 17)
    }
    doc.text(investorUser?.email || '', 20, startY + 22)
    if (investorUser?.phone) {
      doc.text(investorUser.phone, 20, startY + 27)
    }

    // Bank details card - reduced height by 20% (40 -> 32), very light border
    if (investor) {
      drawCard(doc, 110, startY, 85, 32, DESIGN_SYSTEM.COLORS.bgWhite, [230, 230, 230], DESIGN_SYSTEM.BORDER.radiusMd, 0.2)
      
      // Subtle header with bgSoft instead of yellow
      doc.setFillColor(...DESIGN_SYSTEM.COLORS.bgSoft)
      doc.roundedRect(110, startY, 85, 6, DESIGN_SYSTEM.BORDER.radiusMd, DESIGN_SYSTEM.BORDER.radiusMd, 'F')
      
      setTextStyle(doc, 'sectionLabel')
      doc.text('BANK DETAILS', 115, startY + 4)

      setTextStyle(doc, 'secondaryLine')
      doc.text(`Bank: ${investor.bankName || 'N/A'}`, 115, startY + 12)
      doc.text(`Account: ${investor.bankAccountName || 'N/A'}`, 115, startY + 17)
      doc.text(`IBAN: ${investor.iban || 'N/A'}`, 115, startY + 22)
      if (investor.swift) {
        doc.text(`SWIFT: ${investor.swift}`, 115, startY + 27)
      }
    }

    // ============= PAYOUT SUMMARY CARD =============
    const summaryY = startY + 38 // Reduced spacing (was startY + 48)
    
    // Reduced height by 20% (48 -> 38), very light border
    drawCard(doc, 15, summaryY, 180, 38, DESIGN_SYSTEM.COLORS.bgWhite, [230, 230, 230], DESIGN_SYSTEM.BORDER.radiusMd, 0.2)
    
    // Header with subtle bgSoft
    doc.setFillColor(...DESIGN_SYSTEM.COLORS.bgSoft)
    doc.roundedRect(15, summaryY, 180, 8, DESIGN_SYSTEM.BORDER.radiusMd, DESIGN_SYSTEM.BORDER.radiusMd, 'F')
    
    setTextStyle(doc, 'sectionLabel')
    doc.setFontSize(8) // Slightly larger for summary header
    doc.text('PAYOUT SUMMARY', 20, summaryY + 5.5)

    // Summary rows with tighter spacing
    setTextStyle(doc, 'secondaryLine')
    
    // Total Revenue
    doc.text('Total Revenue:', 20, summaryY + 15)
    setTextStyle(doc, 'regular')
    doc.text(formatCurrency(totals.totalRevenue || 0), 190, summaryY + 15, { align: 'right' })

    // Commission with percentage
    setTextStyle(doc, 'secondaryLine')
    doc.text(`Commission (${totals.commissionPercent || 0}%):`, 20, summaryY + 22)
    setTextStyle(doc, 'regular')
    doc.setTextColor(220, 38, 38)
    doc.text(`- ${formatCurrency(totals.commissionAmount || 0)}`, 190, summaryY + 22, { align: 'right' })

    // Divider line
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.2)
    doc.line(20, summaryY + 26, 190, summaryY + 26)

    // Net Payout - subtle bgSoft row with thin accent line on the left
    doc.setFillColor(...DESIGN_SYSTEM.COLORS.bgSoft)
    doc.roundedRect(15, summaryY + 28, 180, 8, DESIGN_SYSTEM.BORDER.radiusSm, DESIGN_SYSTEM.BORDER.radiusSm, 'F')
    
    // Thin accent line on the left
    doc.setFillColor(...DESIGN_SYSTEM.COLORS.accent)
    doc.rect(15, summaryY + 28, 2, 8, 'F')
    
    setTextStyle(doc, 'regular')
    try {
      doc.setFont('Poppins', 'bold')
    } catch {
      doc.setFont('helvetica', 'bold')
    }
    doc.text('NET PAYOUT', 20, summaryY + 33)
    
    // Net payout amount in accent color and bold
    setTextStyle(doc, 'totalNumber')
    doc.setTextColor(...DESIGN_SYSTEM.COLORS.accent)
    try {
      doc.setFont('Poppins', 'bold')
    } catch {
      doc.setFont('helvetica', 'bold')
    }
    doc.text(formatCurrency(totals.netPayout || 0), 190, summaryY + 33, { align: 'right' })

    // ============= VEHICLE BREAKDOWN TABLE =============
    const tableStartY = summaryY + 45 // Reduced spacing (was summaryY + 58)

    if (breakdown.length > 0) {
      // Section header with icon-style design
      doc.setFillColor(...DESIGN_SYSTEM.COLORS.bgSoft)
      doc.roundedRect(15, tableStartY - 10, 180, 8, DESIGN_SYSTEM.BORDER.radiusSm, DESIGN_SYSTEM.BORDER.radiusSm, 'F')
      
      setTextStyle(doc, 'sectionLabel')
      doc.setFontSize(8) // Slightly larger for section header
      doc.text('VEHICLE BREAKDOWN', 20, tableStartY - 5)
      
      setTextStyle(doc, 'secondaryLine')
      doc.text(`${breakdown.length} vehicle(s)`, 190, tableStartY - 5, { align: 'right' })

      const tableData = breakdown.map((item: any) => [
        item.plateNumber || 'N/A',
        `${item.brand || ''} ${item.model || ''}`.trim() || 'N/A',
        item.category || 'N/A',
        String(item.bookingsCount || 0),
        formatCurrency(item.revenue || 0),
      ])

      const autoTableOptions = {
        head: [['Plate No', 'Vehicle', 'Category', 'Bookings', 'Revenue']],
        body: tableData,
        startY: tableStartY,
        theme: 'plain' as any,
        styles: {
          font: 'Poppins' as any,
          fontSize: 8.5,
          cellPadding: 2.5,
          lineColor: [230, 230, 230],
          lineWidth: 0.15,
        },
        headStyles: {
          font: 'Poppins' as any,
          fillColor: DESIGN_SYSTEM.COLORS.bgSoft,
          textColor: [71, 85, 105],
          fontStyle: 'bold' as any,
          halign: 'left' as any,
          fontSize: 8,
          cellPadding: 3,
        },
        bodyStyles: {
          font: 'Poppins' as any,
          textColor: [51, 65, 85],
        },
        alternateRowStyles: {
          fillColor: [250, 250, 250],
        },
        columnStyles: {
          0: { cellWidth: 30, halign: 'left' as any, fontStyle: 'bold' as any },
          1: { cellWidth: 55, halign: 'left' as any },
          2: { cellWidth: 30, halign: 'left' as any },
          3: { cellWidth: 25, halign: 'center' as any, textColor: [100, 116, 139] },
          4: { cellWidth: 35, halign: 'right' as any, fontStyle: 'bold' as any, textColor: DESIGN_SYSTEM.COLORS.textPrimary },
        },
        margin: { left: 15, right: 15 },
      }

      // Try to use Poppins font, fallback silently if autoTable doesn't support it
      try {
        if (typeof (doc as any).autoTable === 'function' && autoTableFn === (doc as any).autoTable.bind(doc)) {
          ;(doc as any).autoTable(autoTableOptions)
        } else {
          autoTableFn(doc, autoTableOptions)
        }
      } catch (fontError: any) {
        // If Poppins font causes issues, remove font specification and retry
        if (fontError.message && (fontError.message.includes('font') || fontError.message.includes('Poppins'))) {
          logger.warn('[PDF] Poppins font not supported in autoTable, falling back to default font')
          const fallbackOptions = {
            ...autoTableOptions,
            styles: { ...autoTableOptions.styles, font: undefined },
            headStyles: { ...autoTableOptions.headStyles, font: undefined },
            bodyStyles: { ...autoTableOptions.bodyStyles, font: undefined },
          }
          if (typeof (doc as any).autoTable === 'function' && autoTableFn === (doc as any).autoTable.bind(doc)) {
            ;(doc as any).autoTable(fallbackOptions)
          } else {
            autoTableFn(doc, fallbackOptions)
          }
        } else {
          throw fontError
        }
      }
    }

    // ============= PAYMENT INFORMATION =============
    const paymentY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 15 : tableStartY + 50
    
    if (payoutData.payment) {
      const payment = payoutData.payment
      
      doc.setFillColor(236, 253, 245)
      doc.roundedRect(15, paymentY, 180, 28, 3, 3, 'F')
      doc.setDrawColor(167, 243, 208)
      doc.setLineWidth(0.3)
      doc.roundedRect(15, paymentY, 180, 28, 3, 3, 'D')
      
      doc.setFontSize(10)
      try {
        doc.setFont('Poppins', 'bold')
      } catch {
        doc.setFont('helvetica', 'bold')
      }
      doc.setTextColor(5, 150, 105)
      doc.text('PAYMENT INFORMATION', 20, paymentY + 7)
      
      doc.setFontSize(8.5)
      try {
        doc.setFont('Poppins', 'normal')
      } catch {
        doc.setFont('helvetica', 'normal')
      }
      doc.setTextColor(6, 78, 59)
      
      if (payment.method) {
        doc.text(`Method: ${payment.method}`, 20, paymentY + 15)
      }
      if (payment.transactionId) {
        doc.text(`Transaction ID: ${payment.transactionId}`, 20, paymentY + 21)
      }
      if (payment.paidAt) {
        doc.text(`Paid: ${format(new Date(payment.paidAt), 'MMMM dd, yyyy')}`, 120, paymentY + 15)
      }
      if (payment.status) {
        doc.text(`Status: ${payment.status}`, 120, paymentY + 21)
      }
    }

    // ============= FOOTER =============
    const footerY = 272
    
    doc.setDrawColor(230, 230, 230)
    doc.setLineWidth(0.2)
    doc.line(15, footerY, 195, footerY)
    
    setTextStyle(doc, 'secondaryLine')
    doc.text('This is an automatically generated payout statement.', 105, footerY + DESIGN_SYSTEM.SPACING.md, { align: 'center' })
    doc.text('For inquiries, please contact us through the CRM system.', 105, footerY + 11, {
      align: 'center',
    })

    // Confidential notice
    setTextStyle(doc, 'secondaryLine')
    doc.setFontSize(7) // Smaller for notice
    doc.setTextColor(148, 163, 184)
    doc.text('CONFIDENTIAL - For authorized recipients only', 105, footerY + 17, { align: 'center' })
    
    // Page number
    setTextStyle(doc, 'secondaryLine')
    doc.setFontSize(7) // Smaller for page number
    doc.text('Page 1 of 1', 195, 290, { align: 'right' })

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