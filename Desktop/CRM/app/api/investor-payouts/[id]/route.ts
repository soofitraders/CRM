import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { hasRole, getCurrentUser } from '@/lib/auth'
import InvestorPayout from '@/lib/models/InvestorPayout'
import InvestorProfile from '@/lib/models/InvestorProfile'
import { updateInvestorPayoutStatus } from '@/lib/services/investorPayoutService'
import { investorPayoutUpdateSchema } from '@/lib/validation/investorPayout'

// GET - Get single investor payout
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await connectDB()

    const payout = await InvestorPayout.findById(params.id)
      .populate({
        path: 'investor',
        populate: {
          path: 'user',
          select: 'name email phone',
        },
      })
      .populate('expense', 'amount dateIncurred description')
      .populate('payment', 'amount method status transactionId paidAt')
      .populate('createdBy', 'name email')
      .lean()
    
    // Debug: Log payout structure
    if (payout) {
      console.log('Payout fetched:', {
        id: (payout as any)._id,
        hasTotals: !!(payout as any).totals,
        totals: (payout as any).totals,
      })
    }

    if (!payout) {
      return NextResponse.json({ error: 'Investor payout not found' }, { status: 404 })
    }

    // For INVESTOR role, only allow access to their own payouts
    if (user.role === 'INVESTOR') {
      const investorProfile = await InvestorProfile.findOne({ user: user._id }).lean()
      if (!investorProfile || String((payout as any).investor._id) !== String(investorProfile._id)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    return NextResponse.json({ payout })
  } catch (error: any) {
    console.error('Error fetching investor payout:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch investor payout' },
      { status: 500 }
    )
  }
}

// PATCH - Update investor payout
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only internal roles can update payouts
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await request.json()

    // Validate updates
    const validationResult = investorPayoutUpdateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const updates = validationResult.data

    // Convert paidAt string to Date if provided
    if (updates.paymentInfo?.paidAt && typeof updates.paymentInfo.paidAt === 'string') {
      updates.paymentInfo.paidAt = new Date(updates.paymentInfo.paidAt)
    }

    // Update payout status
    const payout = await updateInvestorPayoutStatus(params.id, updates, user)

    return NextResponse.json({ payout })
  } catch (error: any) {
    console.error('Error updating investor payout:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update investor payout' },
      { status: 500 }
    )
  }
}

// DELETE - Cancel investor payout (soft delete via status)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only internal roles can cancel payouts
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    // Cancel payout (sets status to CANCELLED and soft-deletes expense)
    const payout = await updateInvestorPayoutStatus(
      params.id,
      { status: 'CANCELLED' },
      user
    )

    return NextResponse.json({ message: 'Investor payout cancelled successfully', payout })
  } catch (error: any) {
    console.error('Error cancelling investor payout:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to cancel investor payout' },
      { status: 500 }
    )
  }
}
