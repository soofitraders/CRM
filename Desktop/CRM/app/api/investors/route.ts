import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import InvestorProfile from '@/lib/models/InvestorProfile'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const investors = await InvestorProfile.find()
      .populate('user', 'name email')
      .select('_id user')
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

