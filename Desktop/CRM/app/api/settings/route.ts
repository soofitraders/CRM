import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/authOptions'
import connectDB from '@/lib/db'
import Settings from '@/lib/models/Settings'
import { updateSettingsSchema } from '@/lib/validation/settings'
import { getCurrentUser, hasRole } from '@/lib/auth'

// GET - Get settings (single document)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    // Get or create settings document
    let settings = await Settings.findOne()
    if (!settings) {
      settings = await Settings.create({})
    }

    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

// PATCH - Update settings (only SUPER_ADMIN and ADMIN)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check permissions - Only SUPER_ADMIN and ADMIN can update settings
    if (!hasRole(user, ['SUPER_ADMIN', 'ADMIN'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const data = updateSettingsSchema.parse(body)

    // Get or create settings document
    let settings = await Settings.findOne()
    if (!settings) {
      settings = await Settings.create({})
    }

    // Update fields
    if (data.companyName !== undefined) {
      settings.companyName = data.companyName
    }
    if (data.defaultCurrency !== undefined) {
      settings.defaultCurrency = data.defaultCurrency
    }
    if (data.timezone !== undefined) {
      settings.timezone = data.timezone
    }
    if (data.defaultTaxPercent !== undefined) {
      settings.defaultTaxPercent = data.defaultTaxPercent
    }

    await settings.save()

    return NextResponse.json({ settings })
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update settings' },
      { status: 500 }
    )
  }
}

