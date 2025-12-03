export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import { getCurrentUser, hasRole } from '@/lib/auth'
import ReportPreset from '@/lib/models/ReportPreset'
import { logger } from '@/lib/utils/performance'

// GET - List user's report presets
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') as 'REVENUE' | 'AR' | 'INVESTOR' | 'UTILIZATION' | null

    const filter: any = { user: user._id }
    if (type) {
      filter.type = type
    }

    const presets = await ReportPreset.find(filter)
      .sort({ createdAt: -1 })
      .lean()

    return NextResponse.json({ presets })
  } catch (error: any) {
    logger.error('Error fetching report presets:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch presets' },
      { status: 500 }
    )
  }
}

// POST - Create a new report preset
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

    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN', 'FINANCE'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await connectDB()

    const body = await request.json()
    const { name, type, filters } = body

    if (!name || !type || !filters) {
      return NextResponse.json(
        { error: 'name, type, and filters are required' },
        { status: 400 }
      )
    }

    const preset = await ReportPreset.create({
      user: user._id,
      name,
      type,
      filters,
    })

    return NextResponse.json({ preset }, { status: 201 })
  } catch (error: any) {
    logger.error('Error creating report preset:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create preset' },
      { status: 500 }
    )
  }
}

