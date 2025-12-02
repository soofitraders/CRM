import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import InvestorPayout from '@/lib/models/InvestorPayout'
import InvestorProfile from '@/lib/models/InvestorProfile'
import { format } from 'date-fns'

// GET - Generate and download investor payout statement as PDF
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[PDF] PDF export request for payout:', params.id)
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      console.log('[PDF] Unauthorized - no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await connectDB()

    // Check access permissions
    const payout = await InvestorPayout.findById(params.id)
      .populate({
        path: 'investor',
        populate: {
          path: 'user',
          select: 'name email',
        },
      })
      .lean()

    if (!payout) {
      return NextResponse.json({ error: 'Investor payout not found' }, { status: 404 })
    }

    // For INVESTOR role, only allow access to their own payouts
    if (user.role === 'INVESTOR') {
      const investorProfile = await InvestorProfile.findOne({ user: user._id }).lean()
      if (!investorProfile || String((payout as any).investor._id) !== String(investorProfile._id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    console.log('[PDF] Starting PDF generation...')

    // Set a timeout for PDF generation (30 seconds)
    const pdfGenerationPromise = (async () => {
      // Dynamically import PDF service
      const { generateInvestorPayoutPDF } = await import('@/lib/services/pdfService')

      // Generate PDF
      return await generateInvestorPayoutPDF(params.id)
    })()

    // Race between PDF generation and timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('PDF generation timeout after 30 seconds')), 30000)
    })

    const pdfBuffer = await Promise.race([pdfGenerationPromise, timeoutPromise]) as Buffer

    console.log('[PDF] PDF generated successfully, size:', pdfBuffer.length, 'bytes')

    // Generate filename
    const investorName = (payout as any).investor?.user?.name || 'Investor'
    const periodMonth = payout.periodFrom
      ? format(new Date(payout.periodFrom), 'yyyyMM')
      : format(new Date(), 'yyyyMM')
    const filename = `payout-${investorName.replace(/\s+/g, '-')}-${periodMonth}.pdf`

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('[PDF] Error generating payout PDF:', error)
    console.error('[PDF] Error stack:', error.stack)
    console.error('[PDF] Error details:', {
      message: error.message,
      code: error.code,
      name: error.name,
    })

    // Return error response instead of crashing
    return NextResponse.json(
      {
        error: error.message || 'Failed to generate PDF',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
