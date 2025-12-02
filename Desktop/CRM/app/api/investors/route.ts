import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import InvestorProfile from '@/lib/models/InvestorProfile'
import User from '@/lib/models/User'
import { hasRole } from '@/lib/auth'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const investors = await InvestorProfile.find()
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json({ investors })
  } catch (error: any) {
    console.error('Error fetching investors:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch investors' },
      { status: 500 }
    )
  }
}

// POST - Create new investor
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Only internal roles can create investors
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await request.json()
    const {
      userId,
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

    // Validate required fields
    if (!userId || !type || !taxId || !bankAccountName || !bankName || !iban || !swift) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if user exists
    const userExists = await User.findById(userId)
    if (!userExists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if investor profile already exists for this user
    const existingInvestor = await InvestorProfile.findOne({ user: userId })
    if (existingInvestor) {
      return NextResponse.json(
        { error: 'Investor profile already exists for this user' },
        { status: 400 }
      )
    }

    // Validate company name for COMPANY type
    if (type === 'COMPANY' && !companyName) {
      return NextResponse.json(
        { error: 'Company name is required for COMPANY type' },
        { status: 400 }
      )
    }

    // Create investor profile
    const investor = await InvestorProfile.create({
      user: userId,
      type,
      companyName: type === 'COMPANY' ? companyName : undefined,
      tradeLicenseNumber,
      taxId,
      bankAccountName,
      bankName,
      iban: iban.toUpperCase(),
      swift: swift.toUpperCase(),
      payoutFrequency: payoutFrequency || 'MONTHLY',
    })

    await investor.populate('user', 'name email phone')

    return NextResponse.json({ investor }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating investor:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create investor' },
      { status: 500 }
    )
  }
}


