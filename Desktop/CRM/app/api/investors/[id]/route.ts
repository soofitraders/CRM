import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import InvestorProfile from '@/lib/models/InvestorProfile'
import User from '@/lib/models/User'
import { hasRole } from '@/lib/auth'
import { getCurrentUser } from '@/lib/auth'

// GET - Get investor by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const investor = await InvestorProfile.findById(params.id)
      .populate('user', 'name email phone address')
      .populate('documents')
      .lean()

    if (!investor) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }

    return NextResponse.json({ investor })
  } catch (error: any) {
    console.error('Error fetching investor:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch investor' },
      { status: 500 }
    )
  }
}

// PUT - Update investor
export async function PUT(
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

    // Only internal roles can update investors
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const investor = await InvestorProfile.findById(params.id)
    if (!investor) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      type,
      companyName,
      tradeLicenseNumber,
      taxId,
      bankAccountName,
      bankName,
      iban,
      swift,
      payoutFrequency,
    } = body

    // Update fields
    if (type !== undefined) investor.type = type
    if (companyName !== undefined) investor.companyName = companyName
    if (tradeLicenseNumber !== undefined) investor.tradeLicenseNumber = tradeLicenseNumber
    if (taxId !== undefined) investor.taxId = taxId
    if (bankAccountName !== undefined) investor.bankAccountName = bankAccountName
    if (bankName !== undefined) investor.bankName = bankName
    if (iban !== undefined) investor.iban = iban.toUpperCase()
    if (swift !== undefined) investor.swift = swift.toUpperCase()
    if (payoutFrequency !== undefined) investor.payoutFrequency = payoutFrequency

    // Validate company name for COMPANY type
    if (investor.type === 'COMPANY' && !investor.companyName) {
      return NextResponse.json(
        { error: 'Company name is required for COMPANY type' },
        { status: 400 }
      )
    }

    await investor.save()
    await investor.populate('user', 'name email phone')

    return NextResponse.json({ investor })
  } catch (error: any) {
    console.error('Error updating investor:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update investor' },
      { status: 500 }
    )
  }
}

// DELETE - Delete investor
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

    // Only SUPER_ADMIN can delete investors
    if (!hasRole(user, ['SUPER_ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const investor = await InvestorProfile.findByIdAndDelete(params.id)
    if (!investor) {
      return NextResponse.json({ error: 'Investor not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Investor deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting investor:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete investor' },
      { status: 500 }
    )
  }
}

