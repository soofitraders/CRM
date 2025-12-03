import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import { logger } from '@/lib/utils/performance'

// GET - Generate and download invoice as PDF
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    logger.log('[PDF] PDF export request for invoice:', params.id)
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      logger.log('[PDF] Unauthorized - no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const invoiceId = params.id

    logger.log('[PDF] Starting PDF generation...')
    
    // Set a timeout for PDF generation (30 seconds)
    const pdfGenerationPromise = (async () => {
      // Dynamically import PDF service to avoid loading PDFKit on page load
      const { generateInvoicePDF } = await import('@/lib/services/pdfService')
      
      // Generate PDF
      return await generateInvoicePDF(invoiceId)
    })()

    // Race between PDF generation and timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('PDF generation timeout after 30 seconds')), 30000)
    })

    const pdfBuffer = await Promise.race([pdfGenerationPromise, timeoutPromise]) as Buffer

    logger.log('[PDF] PDF generated successfully, size:', pdfBuffer.length, 'bytes')

    // Return PDF as response
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoiceId}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    logger.error('[PDF] Error generating invoice PDF:', error)
    logger.error('[PDF] Error stack:', error.stack)
    logger.error('[PDF] Error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
    })
    
    // Return error response instead of crashing
    return NextResponse.json(
      { 
        error: error.message || 'Failed to generate PDF',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

