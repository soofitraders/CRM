// Don't import PDFKit at module level to avoid initialization issues
// We'll import it dynamically when needed
import connectDB from '@/lib/db'
import Invoice from '@/lib/models/Invoice'

// Note: PDFKit polyfill is loaded dynamically before PDFKit import
// This prevents font file access errors in Next.js serverless environment

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
 * Generate PDF buffer for an invoice
 */
export async function generateInvoicePDF(invoiceId: string): Promise<Buffer> {
  try {
    await connectDB()
  } catch (dbError: any) {
    console.error('[PDF] Database connection error:', dbError)
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
    console.error('[PDF] Invoice query error:', queryError)
    // Try without populate as fallback
    try {
      invoice = await Invoice.findById(invoiceId).lean().exec()
    } catch (fallbackError: any) {
      console.error('[PDF] Fallback query also failed:', fallbackError)
      throw new Error('Failed to fetch invoice data')
    }
  }

  if (!invoice) {
    throw new Error('Invoice not found')
  }

  return new Promise(async (resolve, reject) => {
    try {
      console.log('[PDF] Starting PDF generation for invoice:', invoiceId)
      
      // CRITICAL: Load polyfill FIRST and ensure it's executed
      // This must happen before PDFKit is imported
      try {
        console.log('[PDF] Loading polyfill...')
        // Force the polyfill module to execute by importing it
        const polyfillModule = await import('@/lib/utils/pdfkit-polyfill')
        // Give it a moment to set up
        await new Promise(resolve => setTimeout(resolve, 100))
        console.log('[PDF] Polyfill loaded and initialized')
      } catch (polyfillError: any) {
        console.error('[PDF] CRITICAL: Could not load polyfill:', polyfillError)
        console.error('[PDF] Polyfill error stack:', polyfillError.stack)
        // Don't continue if polyfill fails - it's critical for PDFKit to work
        reject(new Error('Failed to initialize PDF polyfill: ' + polyfillError.message))
        return
      }
      
      // Dynamically import PDFKit only when generating PDF
      // This prevents it from loading during page initialization
      let PDFDocument
      try {
        console.log('[PDF] Importing PDFKit (polyfill should be active)...')
        // Import PDFKit in a way that allows polyfill to intercept
        const pdfkitModule = await import('pdfkit')
        PDFDocument = pdfkitModule.default
        console.log('[PDF] PDFKit imported successfully')
      } catch (importError: any) {
        console.error('[PDF] Error importing PDFKit:', importError)
        console.error('[PDF] Import error name:', importError.name)
        console.error('[PDF] Import error message:', importError.message)
        console.error('[PDF] Import error code:', importError.code)
        console.error('[PDF] Import error stack:', importError.stack)
        reject(new Error('Failed to load PDF library: ' + importError.message))
        return
      }
      
      // Create PDF document with error handling
      let doc
      try {
        doc = new PDFDocument({ margin: 50, size: 'A4' })
      } catch (docError: any) {
        console.error('Error creating PDF document:', docError)
        // If it's a font-related error, try to continue anyway
        if (docError.message && docError.message.includes('font')) {
          console.warn('Font error detected, attempting to continue with default fonts')
          doc = new PDFDocument({ margin: 50, size: 'A4' })
        } else {
          reject(new Error('Failed to create PDF document: ' + docError.message))
          return
        }
      }
      
      const buffers: Buffer[] = []

      doc.on('data', (chunk: Buffer) => {
        buffers.push(chunk)
      })
      
      doc.on('end', () => {
        try {
          const pdfBuffer = Buffer.concat(buffers)
          if (pdfBuffer.length === 0) {
            reject(new Error('Generated PDF is empty'))
            return
          }
          console.log(`PDF generated successfully: ${pdfBuffer.length} bytes`)
          resolve(pdfBuffer)
        } catch (error: any) {
          console.error('Error concatenating PDF buffers:', error)
          reject(new Error('Failed to finalize PDF: ' + error.message))
        }
      })
      
      doc.on('error', (error: Error) => {
        console.error('PDF document error:', error)
        reject(new Error('PDF generation error: ' + error.message))
      })

      // Helper function to format currency
      const formatCurrency = (amount: number): string => {
        return `AED ${amount.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      }

      // Helper function to format date
      const formatDate = (date: string | Date): string => {
        const d = new Date(date)
        return d.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      }

      // Header
      // Use standard fonts that don't require external files
      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('INVOICE', 50, 50)
        .fontSize(10)
        .font('Helvetica')
        .text('MisterWheels CRM', 50, 80)
        .text('Car Rental Services', 50, 95)

      // Invoice details (right side)
      const invoiceData = invoice as any
      const invoiceNumber = invoiceData.invoiceNumber || 'N/A'
      const issueDate = formatDate(invoiceData.issueDate)
      const dueDate = formatDate(invoiceData.dueDate)
      const status = invoiceData.status || 'ISSUED'

      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Invoice #: ${invoiceNumber}`, 400, 50, { align: 'right' })
        .text(`Issue Date: ${issueDate}`, 400, 65, { align: 'right' })
        .text(`Due Date: ${dueDate}`, 400, 80, { align: 'right' })
        .text(`Status: ${status}`, 400, 95, { align: 'right' })

      // Customer Information
      const booking = invoiceData.booking
      const customer = booking?.customer?.user
      const vehicle = booking?.vehicle

      let yPos = 140

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Bill To:', 50, yPos)
        .fontSize(10)
        .font('Helvetica')
        .text(customer?.name || 'N/A', 50, yPos + 20)
        .text(customer?.email || '', 50, yPos + 35)
        if (customer?.phone) {
          doc.text(customer.phone, 50, yPos + 50)
        }

      // Vehicle Information
      if (vehicle) {
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('Vehicle:', 300, yPos)
          .fontSize(10)
          .font('Helvetica')
          .text(
            `${vehicle.plateNumber} - ${vehicle.brand} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ''}`,
            300,
            yPos + 20
          )
      }

      // Line items table
      yPos = 250
      const items = invoiceData.items || []
      const tableTop = yPos
      const itemHeight = 25

      // Table header
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Description', 50, tableTop)
        .text('Amount', 450, tableTop, { align: 'right' })

      // Draw line under header
      doc
        .moveTo(50, tableTop + 15)
        .lineTo(550, tableTop + 15)
        .stroke()

      // Table rows
      let currentY = tableTop + 25
      items.forEach((item: { label: string; amount: number }) => {
        const isNegative = item.amount < 0
        const isDeposit = item.label.toLowerCase().includes('deposit')

        doc
          .fontSize(9)
          .font('Helvetica')
          .text(item.label, 50, currentY, { width: 380 })
          .font(isNegative ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(isNegative ? '#059669' : '#000000')
          .text(
            isNegative
              ? `(${formatCurrency(Math.abs(item.amount))})`
              : formatCurrency(item.amount),
            450,
            currentY,
            { align: 'right', width: 100 }
          )
          .fillColor('#000000')

        if (isDeposit) {
          doc
            .fontSize(7)
            .font('Helvetica')
            .fillColor('#059669')
            .text('(Payment Received)', 50, currentY + 12)
            .fillColor('#000000')
        }

        currentY += itemHeight
      })

      // Totals section
      const totalsY = currentY + 20
      const subtotal = invoiceData.subtotal || 0
      const taxAmount = invoiceData.taxAmount || 0
      const total = invoiceData.total || 0

      // Draw line before totals
      doc
        .moveTo(400, totalsY - 10)
        .lineTo(550, totalsY - 10)
        .stroke()

      doc
        .fontSize(10)
        .font('Helvetica')
        .text('Subtotal:', 400, totalsY, { align: 'right' })
        .text(formatCurrency(subtotal), 450, totalsY, { align: 'right', width: 100 })

        .text('Tax:', 400, totalsY + 20, { align: 'right' })
        .text(formatCurrency(taxAmount), 450, totalsY + 20, { align: 'right', width: 100 })

        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Total:', 400, totalsY + 45, { align: 'right' })
        .text(formatCurrency(total), 450, totalsY + 45, { align: 'right', width: 100 })

      // Draw line under total
      doc
        .moveTo(400, totalsY + 60)
        .lineTo(550, totalsY + 60)
        .stroke()

      // Footer
      const footerY = 750
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#666666')
        .text('Thank you for your business!', 50, footerY, { align: 'center' })
        .text('For inquiries, please contact us through the CRM system.', 50, footerY + 15, {
          align: 'center',
        })

      // Page number
      doc
        .text(`Page 1 of 1`, 50, 800, { align: 'right' })
        .fillColor('#000000')

      // Finalize the PDF
      try {
        doc.end()
      } catch (endError: any) {
        console.error('Error ending PDF document:', endError)
        reject(new Error('Failed to finalize PDF: ' + endError.message))
      }
    } catch (error: any) {
      console.error('Error in PDF generation promise:', error)
      console.error('Error stack:', error.stack)
      reject(new Error('PDF generation failed: ' + (error.message || 'Unknown error')))
    }
  })
}

